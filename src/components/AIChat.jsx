import { useState, useRef, useEffect } from 'react';
import { colIndexToLetter } from '../formulaEngine';

const SUGGESTIONS = [
  'Create a monthly budget table',
  'Add a sales tracker with totals',
  'Fill A1:E1 with month names',
  'Create a student grade sheet',
  'Add a simple expense log',
];

// OpenRouter models that handle instruction-following well
const OPENROUTER_MODELS = [
  { id: 'anthropic/claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
  { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
  { id: 'openai/gpt-4o', label: 'GPT-4o' },
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini' },
  { id: 'google/gemini-2.0-flash-exp:free', label: 'Gemini 2.0 Flash' },
  { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B' },
  { id: 'deepseek/deepseek-chat', label: 'DeepSeek V3' },
  { id: 'mistralai/mistral-large-2411', label: 'Mistral Large' },
];

function buildSystemPrompt(sheetData, selectedCell, sheetName) {
  const colLetter = colIndexToLetter(selectedCell.col);
  const cellRef = `${colLetter}${selectedCell.row + 1}`;

  let dataStr = 'The spreadsheet is currently empty.';
  if (sheetData.length > 0) {
    const rows = sheetData.map((row, ri) =>
      row.map((val, ci) => `${colIndexToLetter(ci)}${ri + 1}:${val || '(empty)'}`).join(', ')
    );
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

async function callAnthropic(apiKey, systemPrompt, messages) {
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
      messages,
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${response.status}`);
  }
  const data = await response.json();
  return data.content?.[0]?.text ?? '';
}

async function callOpenRouter(apiKey, model, systemPrompt, messages) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://gridwise.app',
      'X-Title': 'GridWise SheetAI',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${response.status}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
}

export default function AIChat({ theme, sheetData, selected, sheetName, applyAICells }) {
  const [provider, setProvider] = useState('anthropic'); // 'anthropic' | 'openrouter'
  const [keys, setKeys] = useState({ anthropic: '', openrouter: '' });
  const [orModel, setOrModel] = useState(OPENROUTER_MODELS[0].id);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(true);
  const [tempKey, setTempKey] = useState('');
  const messagesEndRef = useRef(null);

  const isDark = theme === 'dark';
  const accent = isDark ? '#7c4dff' : '#5c6bc0';
  const bg = isDark ? '#0d0d1a' : '#f5f5ff';
  const surface = isDark ? '#13132a' : '#ffffff';
  const border = isDark ? '#2d2e4a' : '#e0e0f0';
  const text = isDark ? '#c8d0f0' : '#1a1a2e';
  const muted = isDark ? '#6068a0' : '#9098c8';

  const activeKey = keys[provider];
  const colLetter = colIndexToLetter(selected.col);
  const cellRef = `${colLetter}${selected.row + 1}`;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // When switching provider, show key input if that provider's key isn't set
  const switchProvider = (p) => {
    setProvider(p);
    if (!keys[p]) {
      setTempKey('');
      setShowKeyInput(true);
    }
  };

  const saveKey = () => {
    if (!tempKey.trim()) return;
    setKeys(prev => ({ ...prev, [provider]: tempKey.trim() }));
    setShowKeyInput(false);
  };

  const sendMessage = async (text) => {
    if (!text.trim() || loading) return;
    if (!activeKey) { setShowKeyInput(true); return; }

    const userMsg = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const systemPrompt = buildSystemPrompt(sheetData, selected, sheetName);
      let rawContent;
      if (provider === 'anthropic') {
        rawContent = await callAnthropic(activeKey, systemPrompt, newMessages);
      } else {
        rawContent = await callOpenRouter(activeKey, orModel, systemPrompt, newMessages);
      }

      const cellUpdates = parseCellBlock(rawContent);
      const displayContent = removeCodeBlock(rawContent);

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: rawContent,
        display: displayContent,
        cellUpdates,
      }]);

      if (cellUpdates) applyAICells(cellUpdates);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant', content: '', display: `Error: ${err.message}`, cellUpdates: null,
      }]);
    } finally {
      setLoading(false);
    }
  };

  const providerLabel = provider === 'anthropic' ? 'Claude AI' : 'OpenRouter';
  const modelLabel = provider === 'openrouter'
    ? (OPENROUTER_MODELS.find(m => m.id === orModel)?.label ?? orModel)
    : 'claude-sonnet-4-6';

  // ── Key setup screen ──
  if (showKeyInput) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: bg, padding: 20, gap: 14, overflowY: 'auto' }}>
        <h3 style={{ fontFamily: 'Syne, sans-serif', color: text, margin: 0, fontSize: 15, fontWeight: 700 }}>
          Connect AI Provider
        </h3>

        {/* Provider toggle */}
        <div style={{ display: 'flex', gap: 6 }}>
          {['anthropic', 'openrouter'].map(p => (
            <button
              key={p}
              onClick={() => setProvider(p)}
              style={{
                flex: 1,
                padding: '7px 0',
                borderRadius: 8,
                border: `1px solid ${provider === p ? accent : border}`,
                background: provider === p
                  ? (isDark ? 'rgba(124,77,255,0.15)' : 'rgba(92,107,192,0.1)')
                  : 'transparent',
                fontFamily: 'Syne, sans-serif',
                fontSize: 12,
                fontWeight: provider === p ? 700 : 400,
                color: provider === p ? accent : muted,
                cursor: 'pointer',
              }}
            >
              {p === 'anthropic' ? 'Anthropic' : 'OpenRouter'}
            </button>
          ))}
        </div>

        <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: muted, margin: 0, lineHeight: 1.6 }}>
          {provider === 'anthropic'
            ? 'Enter your Anthropic API key (sk-ant-…). Stored in memory only.'
            : 'Enter your OpenRouter API key (sk-or-…) to access 200+ models.'}
        </p>

        <input
          type="password"
          placeholder={provider === 'anthropic' ? 'sk-ant-...' : 'sk-or-...'}
          value={tempKey}
          onChange={e => setTempKey(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') saveKey(); }}
          style={{
            background: surface, border: `1px solid ${border}`, borderRadius: 8,
            padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: 12,
            color: text, outline: 'none',
          }}
        />

        {/* Model picker for OpenRouter */}
        {provider === 'openrouter' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 11, fontWeight: 600, color: muted }}>
              Model
            </span>
            <select
              value={orModel}
              onChange={e => setOrModel(e.target.value)}
              style={{
                background: surface, border: `1px solid ${border}`, borderRadius: 8,
                padding: '8px 10px', fontFamily: 'DM Mono, monospace', fontSize: 12,
                color: text, outline: 'none', cursor: 'pointer',
              }}
            >
              {OPENROUTER_MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>
        )}

        <button
          onClick={saveKey}
          disabled={!tempKey.trim()}
          style={{
            background: tempKey.trim() ? accent : (isDark ? '#2d2e4a' : '#e0e0f0'),
            color: tempKey.trim() ? '#fff' : muted,
            border: 'none', borderRadius: 8, padding: '10px 0',
            fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 600,
            cursor: tempKey.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          Connect
        </button>

        {activeKey && (
          <button
            onClick={() => setShowKeyInput(false)}
            style={{
              background: 'transparent', border: `1px solid ${border}`, borderRadius: 8,
              padding: '8px 0', fontFamily: 'Syne, sans-serif', fontSize: 12, color: muted, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        )}
      </div>
    );
  }

  // ── Chat screen ──
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: bg }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px', borderBottom: `1px solid ${border}`,
        background: surface, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: accent, boxShadow: `0 0 6px ${accent}`,
            }} />
            <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 700, color: text }}>
              {providerLabel}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontFamily: 'DM Mono, monospace', fontSize: 10, color: accent,
              background: isDark ? 'rgba(124,77,255,0.1)' : 'rgba(92,107,192,0.1)',
              padding: '2px 7px', borderRadius: 4, border: `1px solid ${accent}30`,
            }}>
              {cellRef}
            </span>
            <button
              onClick={() => { setTempKey(''); setShowKeyInput(true); }}
              title="Change provider / key"
              style={{
                background: 'transparent', border: `1px solid ${border}`, borderRadius: 5,
                padding: '2px 7px', fontFamily: 'DM Mono, monospace', fontSize: 10,
                color: muted, cursor: 'pointer',
              }}
            >
              key
            </button>
          </div>
        </div>

        {/* Provider + model sub-row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Provider pills */}
          <div style={{ display: 'flex', gap: 4 }}>
            {['anthropic', 'openrouter'].map(p => (
              <button
                key={p}
                onClick={() => switchProvider(p)}
                style={{
                  padding: '2px 8px', borderRadius: 4,
                  border: `1px solid ${provider === p ? accent : border}`,
                  background: provider === p
                    ? (isDark ? 'rgba(124,77,255,0.15)' : 'rgba(92,107,192,0.1)')
                    : 'transparent',
                  fontFamily: 'Syne, sans-serif', fontSize: 10, fontWeight: provider === p ? 700 : 400,
                  color: provider === p ? accent : muted, cursor: 'pointer',
                }}
              >
                {p === 'anthropic' ? 'Anthropic' : 'OpenRouter'}
              </button>
            ))}
          </div>

          {/* Model selector (OpenRouter only) */}
          {provider === 'openrouter' && (
            <select
              value={orModel}
              onChange={e => setOrModel(e.target.value)}
              style={{
                flex: 1, background: isDark ? '#0f0f1a' : '#f0f0ff',
                border: `1px solid ${border}`, borderRadius: 4,
                padding: '2px 6px', fontFamily: 'DM Mono, monospace', fontSize: 10,
                color: text, outline: 'none', cursor: 'pointer',
              }}
            >
              {OPENROUTER_MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          )}

          {provider === 'anthropic' && (
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: muted }}>
              claude-sonnet-4-6
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10 }}>
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: muted, textAlign: 'center', margin: 0 }}>
              Ask AI to fill your sheet, create tables, or answer questions.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  style={{
                    background: isDark ? 'rgba(124,77,255,0.08)' : 'rgba(92,107,192,0.06)',
                    border: `1px solid ${accent}30`, borderRadius: 8,
                    padding: '7px 10px', fontFamily: 'DM Mono, monospace', fontSize: 11,
                    color: isDark ? '#a0a8e0' : '#5c6bc0', cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '85%', padding: '8px 12px',
              borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
              background: msg.role === 'user' ? accent : (isDark ? '#1a1b30' : '#eef0ff'),
              color: msg.role === 'user' ? '#fff' : text,
              fontFamily: 'DM Mono, monospace', fontSize: 12, lineHeight: 1.6,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {msg.role === 'assistant' ? (msg.display || msg.content) : msg.content}
              {msg.cellUpdates && (
                <div style={{
                  marginTop: 6, padding: '3px 8px',
                  background: isDark ? 'rgba(124,77,255,0.15)' : 'rgba(92,107,192,0.1)',
                  borderRadius: 4, fontSize: 10, color: accent,
                  fontFamily: 'Syne, sans-serif', fontWeight: 600,
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
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: '50%', background: accent,
                  animation: `bounce 1s ${i * 0.2}s infinite`, opacity: 0.8,
                }} />
              ))}
            </div>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: muted }}>
              {providerLabel} · {modelLabel}…
            </span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: 10, borderTop: `1px solid ${border}`, background: surface,
        display: 'flex', gap: 8, alignItems: 'flex-end', flexShrink: 0,
      }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
          }}
          placeholder="Ask AI… (Enter to send)"
          rows={2}
          style={{
            flex: 1, resize: 'none',
            background: isDark ? '#0f0f1a' : '#f0f0ff',
            border: `1px solid ${border}`, borderRadius: 8,
            padding: '7px 10px', fontFamily: 'DM Mono, monospace', fontSize: 12,
            color: text, outline: 'none', lineHeight: 1.5,
          }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={loading || !input.trim()}
          style={{
            background: loading || !input.trim() ? (isDark ? '#2d2e4a' : '#e0e0f0') : accent,
            color: loading || !input.trim() ? muted : '#fff',
            border: 'none', borderRadius: 8, padding: '10px 12px',
            fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 700,
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
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
