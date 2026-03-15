import { useState, useCallback, useRef, useEffect } from 'react';
import Grid       from './components/Grid';
import AIChat     from './components/AIChat';
import Toolbar    from './components/Toolbar';
import ChartPanel from './components/ChartPanel';
import { useSpreadsheet } from './useSpreadsheet';
import { colIndexToLetter } from './formulaEngine';
import './App.css';

export default function App() {
  const [theme,       setTheme]       = useState('dark');
  const [fbarValue,   setFbarValue]   = useState('');
  const [fbarEditing, setFbarEditing] = useState(false);
  const [showChart,   setShowChart]   = useState(false);
  const csvRef  = useRef(null);
  const xlsxRef = useRef(null);

  const {
    sheets, activeSheet, setActiveSheet,
    currentCells, selected, setSelected,
    editing, setEditing,
    getCellDisplay, setCellValue,
    formats, getCellFormat, setCellFormat, setRangeFormat,
    getColWidth, getRowHeight, setColWidth, setRowHeight,
    selectionRange, setSelectionRange,
    copySelection, pasteSelection,
    addSheet, getSheetData, applyAICells,
    importCSV, importXLSX, exportCSV,
    getStatusBarInfo,
    ROWS, COLS,
  } = useSpreadsheet();

  const isDark  = theme === 'dark';
  const accent  = isDark ? '#7c4dff' : '#5c6bc0';
  const bg      = isDark ? '#09091a' : '#f2f2ff';
  const surface = isDark ? '#0f0f1c' : '#ffffff';
  const border  = isDark ? '#252640' : '#dde0f5';
  const text    = isDark ? '#c8d0f0' : '#1a1a2e';
  const muted   = isDark ? '#565880' : '#9098c8';
  const toolBg  = isDark ? '#0e0e26' : '#e8eaff';

  const colLetter    = colIndexToLetter(selected.col);
  const cellRef      = `${colLetter}${selected.row + 1}`;
  const rawCellValue = currentCells[`${selected.row}-${selected.col}`]?.value ?? '';
  const dispFbar     = fbarEditing ? fbarValue : rawCellValue;
  const statusInfo   = getStatusBarInfo();
  const selectedFmt  = getCellFormat(selected.row, selected.col);

  /* ── Format change ── */
  const handleFormatChange = useCallback((updates) => {
    if (selectionRange) {
      setRangeFormat(selectionRange.startRow, selectionRange.startCol,
                     selectionRange.endRow,   selectionRange.endCol, updates);
    } else {
      setCellFormat(selected.row, selected.col, updates);
    }
  }, [selectionRange, selected, setRangeFormat, setCellFormat]);

  /* ── Ctrl+B/I/U ── */
  useEffect(() => {
    const h = e => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const fmt = getCellFormat(selected.row, selected.col);
      switch (e.key.toLowerCase()) {
        case 'b': e.preventDefault(); handleFormatChange({ bold:      !fmt.bold });      break;
        case 'i': e.preventDefault(); handleFormatChange({ italic:    !fmt.italic });    break;
        case 'u': e.preventDefault(); handleFormatChange({ underline: !fmt.underline }); break;
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [selected, getCellFormat, handleFormatChange]);

  /* ── File handlers ── */
  const onCSVFile = useCallback(e => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => importCSV(ev.target.result);
    r.readAsText(f); e.target.value = '';
  }, [importCSV]);

  const onXLSXFile = useCallback(e => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => importXLSX(ev.target.result);
    r.readAsArrayBuffer(f); e.target.value = '';
  }, [importXLSX]);

  return (
    <div style={{ display:'flex', flexDirection:'column', width:'100vw', height:'100vh', background:bg, color:text, fontFamily:'Syne,sans-serif', overflow:'hidden' }}>

      {/* ── Top bar ── */}
      <div style={{ display:'flex', alignItems:'center', height:44, padding:'0 14px', background:toolBg, borderBottom:`1px solid ${border}`, gap:10, flexShrink:0 }}>
        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:6, marginRight:4, flexShrink:0 }}>
          <div style={{ width:26, height:26, borderRadius:7, background:`linear-gradient(135deg,${accent},${isDark?'#b060ff':'#9575cd'})`, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:`0 0 14px ${accent}55` }}>
            <span style={{ color:'#fff', fontSize:13, fontWeight:800 }}>G</span>
          </div>
          <span style={{ fontWeight:800, fontSize:15, color:text, letterSpacing:'-0.02em' }}>
            Grid<span style={{ color:accent }}>Wise</span>
          </span>
        </div>

        {/* Cell ref box */}
        <div style={{ padding:'3px 10px', background:surface, border:`1px solid ${border}`, borderRadius:6, fontFamily:'DM Mono,monospace', fontSize:12, fontWeight:700, color:accent, minWidth:54, textAlign:'center', flexShrink:0 }}>
          {cellRef}
        </div>

        {/* fx label */}
        <span style={{ fontFamily:'DM Mono,monospace', fontSize:13, color:muted, flexShrink:0, fontStyle:'italic', fontWeight:600 }}>fx</span>

        {/* Formula bar */}
        <input
          value={dispFbar}
          onFocus={() => { setFbarValue(rawCellValue); setFbarEditing(true); }}
          onChange={e => setFbarValue(e.target.value)}
          onBlur={() => { setCellValue(selected.row, selected.col, fbarValue); setFbarEditing(false); }}
          onKeyDown={e => {
            if (e.key === 'Enter') { setCellValue(selected.row, selected.col, fbarValue); setFbarEditing(false); e.target.blur(); }
            else if (e.key === 'Escape') { setFbarEditing(false); e.target.blur(); }
          }}
          placeholder="Enter value or formula  e.g. =SUM(A1:A5)  =IF(A1>0,yes,no)  =VLOOKUP(A1,B:D,2)"
          style={{ flex:1, background:surface, border:`1px solid ${border}`, borderRadius:6, padding:'4px 10px', fontFamily:'DM Mono,monospace', fontSize:12, color:text, outline:'none', height:28, boxSizing:'border-box' }}
        />

        {/* Theme toggle */}
        <button onClick={() => setTheme(t => t==='dark'?'light':'dark')} style={{ background:'transparent', border:`1px solid ${border}`, borderRadius:6, padding:'4px 12px', fontFamily:'DM Mono,monospace', fontSize:11, color:muted, cursor:'pointer', flexShrink:0 }}>
          {isDark ? '☀ Light' : '☽ Dark'}
        </button>
      </div>

      {/* ── Toolbar ── */}
      <Toolbar
        theme={theme}
        selectedFormat={selectedFmt}
        onFormatChange={handleFormatChange}
        onImportCSV={()  => csvRef.current?.click()}
        onImportXLSX={() => xlsxRef.current?.click()}
        onExportCSV={exportCSV}
        onInsertChart={() => setShowChart(true)}
      />

      {/* Hidden file inputs */}
      <input ref={csvRef}  type="file" accept=".csv,.tsv,.txt"      style={{ display:'none' }} onChange={onCSVFile}  />
      <input ref={xlsxRef} type="file" accept=".xlsx,.xls,.xlsm"    style={{ display:'none' }} onChange={onXLSXFile} />

      {/* ── Main content ── */}
      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>

        {/* ── Spreadsheet pane ── */}
        <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
          <div style={{ flex:1, overflow:'auto', background: isDark?'#0d0d1c':'#ffffff' }}>
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

          {/* Sheet tabs + status */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', height:30, background:toolBg, borderTop:`1px solid ${border}`, padding:'0 8px', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:3 }}>
              {sheets.map((s,i) => (
                <button key={i} onClick={() => setActiveSheet(i)} style={{
                  padding:'3px 12px', borderRadius:'4px 4px 0 0',
                  border:`1px solid ${border}`,
                  borderBottom: i===activeSheet ? `2px solid ${accent}` : `1px solid ${border}`,
                  background: i===activeSheet ? (isDark?'#1a1b30':'#fff') : 'transparent',
                  fontFamily:'Syne,sans-serif', fontSize:11,
                  fontWeight: i===activeSheet?700:400,
                  color: i===activeSheet?accent:muted, cursor:'pointer',
                }}>{s.name}</button>
              ))}
              <button onClick={addSheet} style={{ padding:'3px 9px', border:`1px solid ${border}`, borderRadius:4, background:'transparent', fontSize:14, color:muted, cursor:'pointer', lineHeight:1 }}>+</button>
            </div>
            {statusInfo && (
              <div style={{ display:'flex', gap:14 }}>
                {[['Count',statusInfo.count],['Sum',statusInfo.sum],['Avg',statusInfo.average]].map(([l,v]) => (
                  <span key={l} style={{ fontFamily:'DM Mono,monospace', fontSize:11, color:muted }}>
                    {l}: <span style={{ color:text }}>{v}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── AI Chat pane ── */}
        <div style={{ width:320, flexShrink:0, borderLeft:`1px solid ${border}`, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <AIChat
            theme={theme}
            sheetData={getSheetData()}
            selected={selected}
            sheetName={sheets[activeSheet].name}
            applyAICells={applyAICells}
          />
        </div>
      </div>

      {/* ── Chart panel (floating) ── */}
      {showChart && (
        <ChartPanel
          theme={theme}
          cells={currentCells}
          getCellDisplay={getCellDisplay}
          selectionRange={selectionRange}
          onClose={() => setShowChart(false)}
        />
      )}
    </div>
  );
}
