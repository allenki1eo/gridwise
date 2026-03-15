import { useState, useRef, useEffect } from 'react';
import { colIndexToLetter } from '../formulaEngine';

const SUGGESTIONS = [
  'Create a monthly budget table',
  'Add a sales tracker with totals',
  'Fill A1:E1 with month names',
  'Create a student grade sheet',
  'Add a simple expense log',
];

const OPENROUTER_MODELS = [
  { id: 'anthropic/claude-sonnet-4-5',         label: 'Claude Sonnet 4.5' },
  { id: 'anthropic/claude-3.5-sonnet',          label: 'Claude 3.5 Sonnet' },
  { id: 'openai/gpt-4o',                        label: 'GPT-4o' },
  { id: 'openai/gpt-4o-mini',                   label: 'GPT-4o Mini' },
  { id: 'google/gemini-2.0-flash-exp:free',     label: 'Gemini 2.0 Flash' },
  { id: 'meta-llama/llama-3.3-70b-instruct',    label: 'Llama 3.3 70B' },
  { id: 'deepseek/deepseek-chat',               label: 'DeepSeek V3' },
  { id: 'mistralai/mistral-large-2411',         label: 'Mistral Large' },
];

const AI_MODES = [
  { id: 'full_doc',  label: 'Full Doc',  title: 'AI works on the whole spreadsheet' },
  { id: 'this_cell', label: 'This Cell', title: 'AI focuses on the selected cell only' },
  { id: 'ask_only',  label: 'Ask Only',  title: 'AI answers questions without editing the sheet' },
];

function buildSystemPrompt(sheetData, selectedCell, sheetName, mode) {
  const colLetter = colIndexToLetter(selectedCell.col);
  const cellRef   = `${colLetter}${selectedCell.row + 1}`;

  if (mode === 'ask_only') {
    return `You are a helpful assistant integrated into GridWise, a spreadsheet application. Answer questions clearly and concisely. Do NOT suggest any cell edits — the user only wants information or analysis, not modifications to the sheet.`;
  }

  if (mode === 'this_cell') {
    return `You are an AI assistant in GridWise. The user wants you to work on cell ${cellRef} on sheet "${sheetName}".
When setting the cell value, respond with exactly this format:
\`\`\`cells
{ "${cellRef}": "value or =formula" }
\`\`\`
Be concise. Focus only on the selected cell unless explicitly told to modify others.
Supported formulas: =SUM(), =AVERAGE(), =MAX(), =MIN(), =COUNT(), arithmetic like =A1+B2*3.`;
  }

  // full_doc
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

When filling in data or creating tables, respond with a JSON block:
\`\`\`cells
{
  "A1": "Header",
  "B1": "Value",
  "A2": "=SUM(A1:A5)"
}
\`\`\`

Supported formulas: =SUM(), =AVERAGE(), =MAX(), =MIN(), =COUNT(), arithmetic like =A1+B2*3.
Columns A–Z, rows 1–100.

Be concise. Include a brief explanation alongside any cell updates.`;
}

function parseCellBlock(text) {
  const match = text.match(/```cells\s*([\s\S]*?)```/);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

function removeCodeBlock(text) {
  return text.replace(/```cells[\s\S]*?```/g, '').trim();
}

async function callAnthropic(apiKey, systemPrompt, messages) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1024, system: systemPrompt, messages }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `HTTP ${res.status}`); }
  const d = await res.json();
  return d.content?.[0]?.text ?? '';
}

async function callOpenRouter(apiKey, model, systemPrompt, messages) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://gridwise.app',
      'X-Title': 'GridWise SheetAI',
    },
    body: JSON.stringify({
      model, max_tokens: 1024,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `HTTP ${res.status}`); }
  const d = await res.json();
  return d.choices?.[0]?.message?.content ?? '';
}

export default function AIChat({ theme, sheetData, selected, sheetName, applyAICells }) {
  const [provider,  setProvider]  = useState('anthropic');
  const [keys,      setKeys]      = useState({ anthropic: '', openrouter: '' });
  const [orModel,   setOrModel]   = useState(OPENROUTER_MODELS[0].id);
  const [aiMode,    setAiMode]    = useState('full_doc');
  const [messages,  setMessages]  = useState([]);
  const [input,     setInput]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [showKey,   setShowKey]   = useState(true);
  const [tempKey,   setTempKey]   = useState('');
  const endRef = useRef(null);

  const isDark  = theme === 'dark';
  const accent  = isDark ? '#7c4dff' : '#5c6bc0';
  const bg      = isDark ? '#0a0a1a' : '#f4f4ff';
  const surface = isDark ? '#111126' : '#ffffff';
  const border  = isDark ? '#252640' : '#dde0f5';
  const text    = isDark ? '#c8d0f0' : '#1a1a2e';
  const muted   = isDark ? '#5a6090' : '#9098c8';
  const activeKey = keys[provider];
  const colLetter = colIndexToLetter(selected.col);
  const cellRef   = `${colLetter}${selected.row + 1}`;

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const switchProvider = p => {
    setProvider(p);
    if (!keys[p]) { setTempKey(''); setShowKey(true); }
  };

  const saveKey = () => {
    if (!tempKey.trim()) return;
    setKeys(prev => ({ ...prev, [provider]: tempKey.trim() }));
    setShowKey(false);
  };

  const sendMessage = async (userText) => {
    if (!userText.trim() || loading) return;
    if (!activeKey) { setShowKey(true); return; }

    const userMsg    = { role: 'user', content: userText };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput('');
    setLoading(true);

    try {
      const sysPrompt = buildSystemPrompt(sheetData, selected, sheetName, aiMode);
      const rawContent = provider === 'anthropic'
        ? await callAnthropic(activeKey, sysPrompt, newHistory)
        : await callOpenRouter(activeKey, orModel, sysPrompt, newHistory);

      const cellUpdates  = aiMode !== 'ask_only' ? parseCellBlock(rawContent) : null;
      const displayText  = removeCodeBlock(rawContent);

      setMessages(prev => [...prev, {
        role: 'assistant', content: rawContent, display: displayText, cellUpdates,
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

  const modelLabel = provider === 'openrouter'
    ? (OPENROUTER_MODELS.find(m => m.id === orModel)?.label ?? orModel)
    : 'claude-sonnet-4-6';

  /* ── Key setup screen ── */
  if (showKey) return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: bg, padding: 18, gap: 12, overflowY: 'auto' }}>
      <h3 style={{ fontFamily: 'Syne, sans-serif', color: text, margin: 0, fontSize: 14, fontWeight: 700 }}>
        Connect AI Provider
      </h3>

      {/* Provider toggle */}
      <div style={{ display: 'flex', gap: 6 }}>
        {['anthropic', 'openrouter'].map(p => (
          <button key={p} onClick={() => setProvider(p)} style={{
            flex: 1, padding: '6px 0', borderRadius: 7,
            border: `1px solid ${provider === p ? accent : border}`,
            background: provider === p ? (isDark ? 'rgba(124,77,255,0.15)' : 'rgba(92,107,192,0.1)') : 'transparent',
            fontFamily: 'Syne, sans-serif', fontSize: 12,
            fontWeight: provider === p ? 700 : 400,
            color: provider === p ? accent : muted, cursor: 'pointer',
          }}>
            {p === 'anthropic' ? 'Anthropic' : 'OpenRouter'}
          </button>
        ))}
      </div>

      <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: muted, margin: 0, lineHeight: 1.65 }}>
        {provider === 'anthropic'
          ? 'Enter your Anthropic API key (sk-ant-…). Stored in memory only.'
          : 'Enter your OpenRouter key (sk-or-…) to access 200+ models.'}
      </p>

      <input
        type="password"
        placeholder={provider === 'anthropic' ? 'sk-ant-...' : 'sk-or-...'}
        value={tempKey}
        onChange={e => setTempKey(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && saveKey()}
        style={{
          background: surface, border: `1px solid ${border}`, borderRadius: 7,
          padding: '8px 12px', fontFamily: 'DM Mono, monospace', fontSize: 12,
          color: text, outline: 'none',
        }}
      />

      {provider === 'openrouter' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 11, fontWeight: 600, color: muted }}>Model</span>
          <select value={orModel} onChange={e => setOrModel(e.target.value)} style={{
            background: surface, border: `1px solid ${border}`, borderRadius: 7,
            padding: '7px 10px', fontFamily: 'DM Mono, monospace', fontSize: 12,
            color: text, outline: 'none', cursor: 'pointer',
          }}>
            {OPENROUTER_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>
      )}

      <button
        onClick={saveKey}
        disabled={!tempKey.trim()}
        style={{
          background: tempKey.trim() ? accent : (isDark ? '#2d2e4a' : '#e0e0f0'),
          color: tempKey.trim() ? '#fff' : muted,
          border: 'none', borderRadius: 7, padding: '10px 0',
          fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700,
          cursor: tempKey.trim() ? 'pointer' : 'not-allowed',
        }}
      >Connect</button>

      {activeKey && (
        <button onClick={() => setShowKey(false)} style={{
          background: 'transparent', border: `1px solid ${border}`, borderRadius: 7,
          padding: '8px 0', fontFamily: 'Syne, sans-serif', fontSize: 12, color: muted, cursor: 'pointer',
        }}>Cancel</button>
      )}
    </div>
  );

  /* ── Chat screen ── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: bg }}>
      {/* Header */}
      <div style={{ background: surface, borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
        {/* Provider row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px 4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: accent, boxShadow: `0 0 6px ${accent}` }} />
            <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 700, color: text }}>
              {provider === 'anthropic' ? 'Claude AI' : 'OpenRouter'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              fontFamily: 'DM Mono, monospace', fontSize: 10, color: accent,
              background: isDark ? 'rgba(124,77,255,0.1)' : 'rgba(92,107,192,0.1)',
              padding: '2px 7px', borderRadius: 4, border: `1px solid ${accent}30`,
            }}>{cellRef}</span>
            <button onClick={() => { setTempKey(''); setShowKey(true); }} style={{
              background: 'transparent', border: `1px solid ${border}`, borderRadius: 5,
              padding: '2px 7px', fontFamily: 'DM Mono, monospace', fontSize: 10, color: muted, cursor: 'pointer',
            }}>key</button>
          </div>
        </div>

        {/* Provider pills + model */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0 12px 6px' }}>
          {['anthropic', 'openrouter'].map(p => (
            <button key={p} onClick={() => switchProvider(p)} style={{
              padding: '2px 8px', borderRadius: 4,
              border: `1px solid ${provider === p ? accent : border}`,
              background: provider === p ? (isDark ? 'rgba(124,77,255,0.15)' : 'rgba(92,107,192,0.1)') : 'transparent',
              fontFamily: 'Syne, sans-serif', fontSize: 10, fontWeight: provider === p ? 700 : 400,
              color: provider === p ? accent : muted, cursor: 'pointer',
            }}>
              {p === 'anthropic' ? 'Anthropic' : 'OpenRouter'}
            </button>
          ))}
          {provider === 'openrouter' ? (
            <select value={orModel} onChange={e => setOrModel(e.target.value)} style={{
              flex: 1, background: isDark ? '#0f0f1a' : '#f0f0ff',
              border: `1px solid ${border}`, borderRadius: 4,
              padding: '2px 5px', fontFamily: 'DM Mono, monospace', fontSize: 10,
              color: text, outline: 'none', cursor: 'pointer',
            }}>
              {OPENROUTER_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          ) : (
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: muted }}>claude-sonnet-4-6</span>
          )}
        </div>

        {/* AI Mode selector */}
        <div style={{ display: 'flex', gap: 0, padding: '0 12px 8px' }}>
          {AI_MODES.map((m, i) => (
            <button key={m.id} onClick={() => setAiMode(m.id)} title={m.title} style={{
              flex: 1,
              padding: '4px 0',
              background: aiMode === m.id
                ? (isDark ? 'rgba(124,77,255,0.2)' : 'rgba(92,107,192,0.15)')
                : 'transparent',
              border: `1px solid ${aiMode === m.id ? accent : border}`,
              borderLeft: i > 0 ? 'none' : `1px solid ${aiMode === m.id ? accent : border}`,
              borderRadius: i === 0 ? '5px 0 0 5px' : i === AI_MODES.length - 1 ? '0 5px 5px 0' : '0',
              fontFamily: 'Syne, sans-serif', fontSize: 10,
              fontWeight: aiMode === m.id ? 700 : 400,
              color: aiMode === m.id ? accent : muted,
              cursor: 'pointer',
            }}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8 }}>
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: muted, textAlign: 'center', margin: 0 }}>
              {aiMode === 'ask_only'
                ? 'Ask any question about spreadsheets or data.'
                : aiMode === 'this_cell'
                ? `AI will modify cell ${cellRef} only.`
                : 'Ask AI to fill your sheet, create tables, or run analysis.'}
            </p>
            {aiMode !== 'ask_only' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => sendMessage(s)} style={{
                    background: isDark ? 'rgba(124,77,255,0.07)' : 'rgba(92,107,192,0.06)',
                    border: `1px solid ${accent}25`, borderRadius: 7,
                    padding: '7px 10px', fontFamily: 'DM Mono, monospace', fontSize: 11,
                    color: isDark ? '#a0a8e0' : '#5c6bc0', cursor: 'pointer', textAlign: 'left',
                  }}>{s}</button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '88%', padding: '8px 12px',
              borderRadius: msg.role === 'user' ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
              background: msg.role === 'user' ? accent : (isDark ? '#181830' : '#eef0ff'),
              color: msg.role === 'user' ? '#fff' : text,
              fontFamily: 'DM Mono, monospace', fontSize: 12, lineHeight: 1.6,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {msg.role === 'assistant' ? (msg.display || msg.content) : msg.content}
              {msg.cellUpdates && (
                <div style={{
                  marginTop: 6, padding: '3px 8px', borderRadius: 4, fontSize: 10,
                  background: isDark ? 'rgba(124,77,255,0.15)' : 'rgba(92,107,192,0.1)',
                  color: accent, fontFamily: 'Syne, sans-serif', fontWeight: 700,
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
              {[0,1,2].map(i => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: '50%', background: accent,
                  animation: `bounce 1s ${i*0.2}s infinite`, opacity: 0.8,
                }} />
              ))}
            </div>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: muted }}>
              {provider === 'anthropic' ? 'Claude' : modelLabel}…
            </span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: 10, borderTop: `1px solid ${border}`, background: surface,
        display: 'flex', gap: 7, alignItems: 'flex-end', flexShrink: 0,
      }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
          placeholder={aiMode === 'ask_only' ? 'Ask a question…' : aiMode === 'this_cell' ? `What to put in ${cellRef}?` : 'Ask AI… (Enter to send)'}
          rows={2}
          style={{
            flex: 1, resize: 'none',
            background: isDark ? '#0f0f1c' : '#f0f0ff',
            border: `1px solid ${border}`, borderRadius: 8,
            padding: '7px 10px', fontFamily: 'DM Mono, monospace', fontSize: 12,
            color: text, outline: 'none', lineHeight: 1.5,
          }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={loading || !input.trim()}
          style={{
            background: loading || !input.trim() ? (isDark ? '#252640' : '#e0e0f0') : accent,
            color: loading || !input.trim() ? muted : '#fff',
            border: 'none', borderRadius: 8, padding: '10px 12px',
            fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 700,
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
          }}
        >Send</button>
      </div>

      <style>{`
        @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }
      `}</style>
    </div>
  );
}
