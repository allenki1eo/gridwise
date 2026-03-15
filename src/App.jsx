import { useState } from 'react';
import Grid from './components/Grid';
import AIChat from './components/AIChat';
import { useSpreadsheet } from './useSpreadsheet';
import { colIndexToLetter } from './formulaEngine';
import './App.css';

export default function App() {
  const [theme, setTheme] = useState('dark');
  const [apiKey, setApiKey] = useState('');
  const [formulaBarValue, setFormulaBarValue] = useState('');
  const [formulaBarEditing, setFormulaBarEditing] = useState(false);

  const {
    sheets,
    activeSheet,
    setActiveSheet,
    currentCells,
    selected,
    setSelected,
    editing,
    setEditing,
    getCellDisplay,
    setCellValue,
    addSheet,
    getSheetData,
    applyAICells,
    getStatusBarInfo,
    ROWS,
    COLS,
  } = useSpreadsheet();

  const isDark = theme === 'dark';

  const accent = isDark ? '#7c4dff' : '#5c6bc0';
  const bg = isDark ? '#0a0a14' : '#f0f0fa';
  const surface = isDark ? '#0f0f1a' : '#ffffff';
  const border = isDark ? '#2d2e4a' : '#dde0f5';
  const text = isDark ? '#c8d0f0' : '#1a1a2e';
  const muted = isDark ? '#565880' : '#9098c8';
  const toolbarBg = isDark ? '#12122a' : '#eeeeff';

  const colLetter = colIndexToLetter(selected.col);
  const cellRef = `${colLetter}${selected.row + 1}`;
  const rawCellValue = currentCells[`${selected.row}-${selected.col}`]?.value ?? '';

  // Sync formula bar with selected cell
  const displayFormulaBar = formulaBarEditing ? formulaBarValue : rawCellValue;

  const statusInfo = getStatusBarInfo();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100vw',
        height: '100vh',
        background: bg,
        color: text,
        fontFamily: 'Syne, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* ── Top bar ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 44,
          padding: '0 16px',
          background: toolbarBg,
          borderBottom: `1px solid ${border}`,
          gap: 12,
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 8 }}>
          <div style={{
            width: 22, height: 22, borderRadius: 6,
            background: `linear-gradient(135deg, ${accent}, ${isDark ? '#b060ff' : '#9575cd'})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 10px ${accent}60`,
          }}>
            <span style={{ color: '#fff', fontSize: 11, fontWeight: 800 }}>G</span>
          </div>
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 14, color: text, letterSpacing: '-0.02em' }}>
            Grid<span style={{ color: accent }}>Wise</span>
          </span>
        </div>

        {/* Cell reference box */}
        <div style={{
          padding: '3px 10px',
          background: surface,
          border: `1px solid ${border}`,
          borderRadius: 6,
          fontFamily: 'DM Mono, monospace',
          fontSize: 12,
          fontWeight: 500,
          color: accent,
          minWidth: 52,
          textAlign: 'center',
          flexShrink: 0,
        }}>
          {cellRef}
        </div>

        {/* Formula bar */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: muted, flexShrink: 0 }}>fx</span>
          <input
            value={displayFormulaBar}
            onFocus={() => {
              setFormulaBarValue(rawCellValue);
              setFormulaBarEditing(true);
            }}
            onChange={e => setFormulaBarValue(e.target.value)}
            onBlur={() => {
              setCellValue(selected.row, selected.col, formulaBarValue);
              setFormulaBarEditing(false);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                setCellValue(selected.row, selected.col, formulaBarValue);
                setFormulaBarEditing(false);
                e.target.blur();
              } else if (e.key === 'Escape') {
                setFormulaBarEditing(false);
                e.target.blur();
              }
            }}
            style={{
              flex: 1,
              background: surface,
              border: `1px solid ${border}`,
              borderRadius: 6,
              padding: '4px 10px',
              fontFamily: 'DM Mono, monospace',
              fontSize: 12,
              color: text,
              outline: 'none',
              height: 26,
              boxSizing: 'border-box',
            }}
            placeholder="Enter value or formula…"
          />
        </div>

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
          title="Toggle theme"
          style={{
            background: 'transparent',
            border: `1px solid ${border}`,
            borderRadius: 6,
            padding: '4px 10px',
            fontFamily: 'DM Mono, monospace',
            fontSize: 11,
            color: muted,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          {isDark ? '☀ Light' : '☽ Dark'}
        </button>
      </div>

      {/* ── Main content ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* ── Spreadsheet pane ── */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          {/* Grid scroll area */}
          <div style={{ flex: 1, overflow: 'auto', background: isDark ? '#0f0f1a' : '#ffffff' }}>
            <Grid
              rows={ROWS}
              cols={COLS}
              cells={currentCells}
              selected={selected}
              setSelected={setSelected}
              getCellDisplay={getCellDisplay}
              setCellValue={setCellValue}
              editing={editing}
              setEditing={setEditing}
              theme={theme}
            />
          </div>

          {/* ── Sheet tabs + status bar ── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: 32,
              background: toolbarBg,
              borderTop: `1px solid ${border}`,
              padding: '0 8px',
              flexShrink: 0,
              gap: 8,
            }}
          >
            {/* Sheet tabs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {sheets.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setActiveSheet(i)}
                  style={{
                    padding: '3px 12px',
                    borderRadius: '4px 4px 0 0',
                    border: `1px solid ${border}`,
                    borderBottom: i === activeSheet ? `2px solid ${accent}` : `1px solid ${border}`,
                    background: i === activeSheet
                      ? (isDark ? '#1a1b30' : '#fff')
                      : 'transparent',
                    fontFamily: 'Syne, sans-serif',
                    fontSize: 11,
                    fontWeight: i === activeSheet ? 600 : 400,
                    color: i === activeSheet ? accent : muted,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {s.name}
                </button>
              ))}
              <button
                onClick={addSheet}
                title="Add sheet"
                style={{
                  padding: '3px 8px',
                  border: `1px solid ${border}`,
                  borderRadius: 4,
                  background: 'transparent',
                  fontFamily: 'Syne, sans-serif',
                  fontSize: 13,
                  color: muted,
                  cursor: 'pointer',
                  lineHeight: 1,
                }}
              >
                +
              </button>
            </div>

            {/* Status bar */}
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              {statusInfo && (
                <>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: muted }}>
                    Count: <span style={{ color: text }}>{statusInfo.count}</span>
                  </span>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: muted }}>
                    Sum: <span style={{ color: text }}>{statusInfo.sum}</span>
                  </span>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: muted }}>
                    Avg: <span style={{ color: text }}>{statusInfo.average}</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── AI Chat pane ── */}
        <div
          style={{
            width: 320,
            flexShrink: 0,
            borderLeft: `1px solid ${border}`,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <AIChat
            theme={theme}
            apiKey={apiKey}
            setApiKey={setApiKey}
            sheetData={getSheetData()}
            selected={selected}
            sheetName={sheets[activeSheet].name}
            applyAICells={applyAICells}
          />
        </div>
      </div>
    </div>
  );
}
