import { useState, useCallback, useRef, useEffect } from 'react';
import Grid from './components/Grid';
import AIChat from './components/AIChat';
import Toolbar from './components/Toolbar';
import { useSpreadsheet } from './useSpreadsheet';
import { colIndexToLetter } from './formulaEngine';
import './App.css';

export default function App() {
  const [theme, setTheme] = useState('dark');
  const [formulaBarValue, setFormulaBarValue] = useState('');
  const [formulaBarEditing, setFormulaBarEditing] = useState(false);
  const fileInputRef = useRef(null);

  const {
    sheets, activeSheet, setActiveSheet,
    currentCells, selected, setSelected,
    editing, setEditing,
    getCellDisplay, setCellValue,
    formats, getCellFormat, setCellFormat, setRangeFormat,
    getColWidth, getRowHeight, setColWidth, setRowHeight,
    selectionRange, setSelectionRange,
    copySelection, pasteSelection,
    addSheet, getSheetData, applyAICells, importCSV,
    getStatusBarInfo,
    ROWS, COLS,
  } = useSpreadsheet();

  const isDark   = theme === 'dark';
  const accent   = isDark ? '#7c4dff' : '#5c6bc0';
  const bg       = isDark ? '#09091a' : '#f2f2ff';
  const surface  = isDark ? '#0f0f1c' : '#ffffff';
  const border   = isDark ? '#252640' : '#dde0f5';
  const text     = isDark ? '#c8d0f0' : '#1a1a2e';
  const muted    = isDark ? '#565880' : '#9098c8';
  const toolBg   = isDark ? '#111128' : '#eceeff';

  const colLetter = colIndexToLetter(selected.col);
  const cellRef   = `${colLetter}${selected.row + 1}`;
  const rawCellValue = currentCells[`${selected.row}-${selected.col}`]?.value ?? '';
  const displayFormulaBar = formulaBarEditing ? formulaBarValue : rawCellValue;
  const statusInfo = getStatusBarInfo();

  /* ── Format change (single cell or range) ── */
  const handleFormatChange = useCallback((updates) => {
    if (selectionRange) {
      setRangeFormat(selectionRange.startRow, selectionRange.startCol,
                     selectionRange.endRow,   selectionRange.endCol, updates);
    } else {
      setCellFormat(selected.row, selected.col, updates);
    }
  }, [selectionRange, selected, setRangeFormat, setCellFormat]);

  /* ── Ctrl+B / I / U ── */
  useEffect(() => {
    const onKey = e => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const fmt = getCellFormat(selected.row, selected.col);
      switch (e.key.toLowerCase()) {
        case 'b': e.preventDefault(); handleFormatChange({ bold: !fmt.bold }); break;
        case 'i': e.preventDefault(); handleFormatChange({ italic: !fmt.italic }); break;
        case 'u': e.preventDefault(); handleFormatChange({ underline: !fmt.underline }); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, getCellFormat, handleFormatChange]);

  /* ── CSV import ── */
  const handleFileChange = useCallback(e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => importCSV(ev.target.result);
    reader.readAsText(file);
    e.target.value = '';
  }, [importCSV]);

  const selectedFormat = getCellFormat(selected.row, selected.col);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      width: '100vw', height: '100vh',
      background: bg, color: text,
      fontFamily: 'Syne, sans-serif',
      overflow: 'hidden',
    }}>
      {/* ── Top bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        height: 44, padding: '0 14px',
        background: toolBg, borderBottom: `1px solid ${border}`,
        gap: 10, flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 6 }}>
          <div style={{
            width: 24, height: 24, borderRadius: 7,
            background: `linear-gradient(135deg, ${accent}, ${isDark ? '#b060ff' : '#9575cd'})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 12px ${accent}55`,
          }}>
            <span style={{ color: '#fff', fontSize: 12, fontWeight: 800 }}>G</span>
          </div>
          <span style={{ fontWeight: 800, fontSize: 15, color: text, letterSpacing: '-0.02em' }}>
            Grid<span style={{ color: accent }}>Wise</span>
          </span>
        </div>

        {/* Cell reference */}
        <div style={{
          padding: '3px 10px', background: surface,
          border: `1px solid ${border}`, borderRadius: 6,
          fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 600,
          color: accent, minWidth: 54, textAlign: 'center', flexShrink: 0,
        }}>
          {cellRef}
        </div>

        {/* Formula bar */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: muted, flexShrink: 0, fontStyle: 'italic' }}>fx</span>
          <input
            value={displayFormulaBar}
            onFocus={() => { setFormulaBarValue(rawCellValue); setFormulaBarEditing(true); }}
            onChange={e => setFormulaBarValue(e.target.value)}
            onBlur={() => { setCellValue(selected.row, selected.col, formulaBarValue); setFormulaBarEditing(false); }}
            onKeyDown={e => {
              if (e.key === 'Enter') { setCellValue(selected.row, selected.col, formulaBarValue); setFormulaBarEditing(false); e.target.blur(); }
              else if (e.key === 'Escape') { setFormulaBarEditing(false); e.target.blur(); }
            }}
            placeholder="Enter value or formula…"
            style={{
              flex: 1, background: surface, border: `1px solid ${border}`,
              borderRadius: 6, padding: '4px 10px',
              fontFamily: 'DM Mono, monospace', fontSize: 12, color: text,
              outline: 'none', height: 28, boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
          style={{
            background: 'transparent', border: `1px solid ${border}`, borderRadius: 6,
            padding: '4px 12px', fontFamily: 'DM Mono, monospace', fontSize: 11,
            color: muted, cursor: 'pointer', flexShrink: 0,
          }}
        >
          {isDark ? '☀ Light' : '☽ Dark'}
        </button>
      </div>

      {/* ── Toolbar ── */}
      <Toolbar
        theme={theme}
        selectedFormat={selectedFormat}
        onFormatChange={handleFormatChange}
        onImportCSV={() => fileInputRef.current?.click()}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.tsv,.txt"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* ── Main content ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Spreadsheet pane ── */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          {/* Grid scroll area */}
          <div style={{ flex: 1, overflow: 'auto', background: isDark ? '#0d0d1c' : '#ffffff' }}>
            <Grid
              rows={ROWS} cols={COLS}
              cells={currentCells}
              selected={selected} setSelected={setSelected}
              getCellDisplay={getCellDisplay} setCellValue={setCellValue}
              editing={editing} setEditing={setEditing}
              theme={theme}
              getColWidth={getColWidth} getRowHeight={getRowHeight}
              setColWidth={setColWidth} setRowHeight={setRowHeight}
              formats={formats} getCellFormat={getCellFormat}
              selectionRange={selectionRange} setSelectionRange={setSelectionRange}
              copySelection={copySelection} pasteSelection={pasteSelection}
            />
          </div>

          {/* ── Sheet tabs + status bar ── */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            height: 30, background: toolBg, borderTop: `1px solid ${border}`,
            padding: '0 8px', flexShrink: 0, gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              {sheets.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setActiveSheet(i)}
                  style={{
                    padding: '3px 12px', borderRadius: '4px 4px 0 0',
                    border: `1px solid ${border}`,
                    borderBottom: i === activeSheet ? `2px solid ${accent}` : `1px solid ${border}`,
                    background: i === activeSheet ? (isDark ? '#1a1b30' : '#fff') : 'transparent',
                    fontFamily: 'Syne, sans-serif', fontSize: 11,
                    fontWeight: i === activeSheet ? 700 : 400,
                    color: i === activeSheet ? accent : muted,
                    cursor: 'pointer',
                  }}
                >
                  {s.name}
                </button>
              ))}
              <button
                onClick={addSheet}
                style={{
                  padding: '3px 9px', border: `1px solid ${border}`, borderRadius: 4,
                  background: 'transparent', fontSize: 14, color: muted, cursor: 'pointer',
                  fontFamily: 'Syne, sans-serif', lineHeight: 1,
                }}
              >+</button>
            </div>

            {statusInfo && (
              <div style={{ display: 'flex', gap: 14 }}>
                {[['Count', statusInfo.count], ['Sum', statusInfo.sum], ['Avg', statusInfo.average]].map(([label, val]) => (
                  <span key={label} style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: muted }}>
                    {label}: <span style={{ color: text }}>{val}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── AI Chat pane ── */}
        <div style={{
          width: 320, flexShrink: 0,
          borderLeft: `1px solid ${border}`,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <AIChat
            theme={theme}
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
