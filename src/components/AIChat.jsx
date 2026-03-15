import { useState, useRef, useEffect } from 'react';
import { colIndexToLetter } from '../formulaEngine';

const SUGGESTIONS = [
  'Create a monthly budget table',
  'Add a sales tracker with totals',
  'Fill A1:E1 with month names',
  'Create a student grade sheet',
  'Add a simple expense log',
];

function buildSystemPrompt(sheetData, selectedCell, sheetName) {
  const colLetter = colIndexToLetter(selectedCell.col);
  const cellRef = `${colLetter}${selectedCell.row + 1}`;

  let dataStr = 'The spreadsheet is currently empty.';
  if (sheetData.length > 0) {
    const rows = sheetData.map((row, ri) => {
      const cells = row.map((val, ci) => `${colIndexToLetter(ci)}${ri + 1}:${val || '(empty)'}`);
      return cells.join(', ');
    });
    dataStr = `Current sheet data (${sheetName}):\n` + rows.join('\n');
  }

  return `You are an AI assistant integrated into GridWise, a spreadsheet application.
The user's selected cell is ${cellRef} on sheet "${sheetName}".

${dataStr}

When the user asks you to fill in data, create tables, or write to cells, respond with a JSON block like:
\`\`\`cells
{
  "A1": "Header",
  "B1": "Value",
  "A2": "=SUM(A1:A5)"
}
\`\`\`

Supported formulas: =SUM(), =AVERAGE(), =MAX(), =MIN(), =COUNT(), and arithmetic like =A1+B2*3.
Columns go from A to Z (26 columns), rows from 1 to 50.

Be concise. When writing cells, also give a brief explanation. When answering questions, be helpful and direct.`;
}

function parseCellBlock(text) {
  const match = text.match(/```cells\s*([\s\S]*?)```/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function removeCodeBlock(text) {
  return text.replace(/```cells[\s\S]*?```/g, '').trim();
}

export default function AIChat({
  theme,
  apiKey,
  setApiKey,
  sheetData,
  selected,
  sheetName,
  applyAICells,
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(!apiKey);
  const [tempKey, setTempKey] = useState('');
  const messagesEndRef = useRef(null);

  const isDark = theme === 'dark';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    setShowKeyInput(!apiKey);
  }, [apiKey]);

  const colLetter = colIndexToLetter(selected.col);
  const cellRef = `${colLetter}${selected.row + 1}`;

  const sendMessage = async (text) => {
    if (!text.trim() || loading) return;
    if (!apiKey) {
      setShowKeyInput(true);
      return;
    }

    const userMsg = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const systemPrompt = buildSystemPrompt(sheetData, selected, sheetName);
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: systemPrompt,
          messages: newMessages,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const rawContent = data.content?.[0]?.text ?? '';
      const cellUpdates = parseCellBlock(rawContent);
      const displayContent = removeCodeBlock(rawContent);

      const assistantMsg = {
        role: 'assistant',
        content: rawContent,
        display: displayContent,
        cellUpdates,
      };
      setMessages(prev => [...prev, assistantMsg]);

      if (cellUpdates) {
        applyAICells(cellUpdates);
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: '', display: `Error: ${err.message}`, cellUpdates: null },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const accent = isDark ? '#7c4dff' : '#5c6bc0';
  const bg = isDark ? '#0d0d1a' : '#f5f5ff';
  const surface = isDark ? '#13132a' : '#ffffff';
  const border = isDark ? '#2d2e4a' : '#e0e0f0';
  const text = isDark ? '#c8d0f0' : '#1a1a2e';
  const muted = isDark ? '#6068a0' : '#9098c8';

  if (showKeyInput) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: bg, padding: 24, gap: 16 }}>
        <h3 style={{ fontFamily: 'Syne, sans-serif', color: text, margin: 0, fontSize: 16, fontWeight: 700 }}>
          Connect to Claude AI
        </h3>
        <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: muted, margin: 0 }}>
          Enter your Anthropic API key to enable AI features. Your key is stored only in memory.
        </p>
        <input
          type="password"
          placeholder="sk-ant-..."
          value={tempKey}
          onChange={e => setTempKey(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && tempKey.trim()) {
              setApiKey(tempKey.trim());
              setShowKeyInput(false);
            }
          }}
          style={{
            background: surface,
            border: `1px solid ${border}`,
            borderRadius: 8,
            padding: '10px 14px',
            fontFamily: 'DM Mono, monospace',
            fontSize: 13,
            color: text,
            outline: 'none',
          }}
        />
        <button
          onClick={() => {
            if (tempKey.trim()) {
              setApiKey(tempKey.trim());
              setShowKeyInput(false);
            }
          }}
          style={{
            background: accent,
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '10px 0',
            fontFamily: 'Syne, sans-serif',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Connect
        </button>
        {apiKey && (
          <button
            onClick={() => setShowKeyInput(false)}
            style={{ background: 'transparent', border: `1px solid ${border}`, borderRadius: 8, padding: '8px 0', fontFamily: 'Syne, sans-serif', fontSize: 13, color: muted, cursor: 'pointer' }}
          >
            Cancel
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: bg }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: `1px solid ${border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: surface,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: accent,
            boxShadow: `0 0 6px ${accent}`,
          }} />
          <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 700, color: text }}>
            Claude AI
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontFamily: 'DM Mono, monospace', fontSize: 10, color: accent,
            background: isDark ? 'rgba(124,77,255,0.1)' : 'rgba(92,107,192,0.1)',
            padding: '2px 8px', borderRadius: 4, border: `1px solid ${accent}30`,
          }}>
            {cellRef}
          </span>
          <button
            onClick={() => setShowKeyInput(true)}
            title="Change API Key"
            style={{
              background: 'transparent', border: `1px solid ${border}`, borderRadius: 6,
              padding: '2px 8px', fontFamily: 'DM Mono, monospace', fontSize: 10,
              color: muted, cursor: 'pointer',
            }}
          >
            key
          </button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}>
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: muted, textAlign: 'center', margin: 0 }}>
              Ask AI to fill your sheet, create tables, or answer questions.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  style={{
                    background: isDark ? 'rgba(124,77,255,0.08)' : 'rgba(92,107,192,0.06)',
                    border: `1px solid ${accent}30`,
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontFamily: 'DM Mono, monospace',
                    fontSize: 11,
                    color: isDark ? '#a0a8e0' : '#5c6bc0',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.15s',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                maxWidth: '85%',
                padding: '8px 12px',
                borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                background: msg.role === 'user'
                  ? accent
                  : (isDark ? '#1a1b30' : '#eef0ff'),
                color: msg.role === 'user' ? '#fff' : text,
                fontFamily: 'DM Mono, monospace',
                fontSize: 12,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {msg.role === 'assistant' ? (msg.display || msg.content) : msg.content}
              {msg.cellUpdates && (
                <div style={{
                  marginTop: 6,
                  padding: '4px 8px',
                  background: isDark ? 'rgba(124,77,255,0.15)' : 'rgba(92,107,192,0.1)',
                  borderRadius: 4,
                  fontSize: 10,
                  color: accent,
                  fontFamily: 'Syne, sans-serif',
                  fontWeight: 600,
                }}>
                  ✓ {Object.keys(msg.cellUpdates).length} cells updated
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: accent,
                    animation: `bounce 1s ${i * 0.2}s infinite`,
                    opacity: 0.8,
                  }}
                />
              ))}
            </div>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: muted }}>
              Claude is thinking...
            </span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: 12,
        borderTop: `1px solid ${border}`,
        background: surface,
        display: 'flex',
        gap: 8,
        alignItems: 'flex-end',
      }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage(input);
            }
          }}
          placeholder="Ask Claude… (Enter to send)"
          rows={2}
          style={{
            flex: 1,
            resize: 'none',
            background: isDark ? '#0f0f1a' : '#f0f0ff',
            border: `1px solid ${border}`,
            borderRadius: 8,
            padding: '8px 10px',
            fontFamily: 'DM Mono, monospace',
            fontSize: 12,
            color: text,
            outline: 'none',
            lineHeight: 1.5,
          }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={loading || !input.trim()}
          style={{
            background: loading || !input.trim() ? (isDark ? '#2d2e4a' : '#e0e0f0') : accent,
            color: loading || !input.trim() ? muted : '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '10px 14px',
            fontFamily: 'Syne, sans-serif',
            fontSize: 12,
            fontWeight: 700,
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s',
            whiteSpace: 'nowrap',
          }}
        >
          Send
        </button>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
