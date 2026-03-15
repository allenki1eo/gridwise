import { useRef } from 'react';

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36];
const NUM_FMTS   = [
  { v: 'general',  l: 'General' },
  { v: 'number',   l: '1,234.56' },
  { v: 'currency', l: '$ Dollar' },
  { v: 'percent',  l: '% Percent' },
  { v: 'integer',  l: '# Integer' },
];

/* ── tiny SVG icon set ─────────────────────────────────────────────────── */
const I = {
  bold:      <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor"><path d="M1 1h4a3 3 0 010 6H1zm0 6h4.5a3 3 0 010 6H1z" opacity=".01"/><text x="1" y="11" fontFamily="Georgia,serif" fontSize="12" fontWeight="900">B</text></svg>,
  italic:    <svg width="9"  height="12" viewBox="0 0 9 12"  fill="currentColor"><text x="1" y="11" fontFamily="Georgia,serif" fontSize="12" fontStyle="italic">I</text></svg>,
  under:     <svg width="10" height="14" viewBox="0 0 10 14" fill="none"><path d="M1.5 1v5a3.5 3.5 0 007 0V1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="0" y1="13.5" x2="10" y2="13.5" stroke="currentColor" strokeWidth="1.5"/></svg>,
  alL:       <svg width="14" height="12" viewBox="0 0 14 12" fill="none"><rect x="1" y="0.5" width="12" height="1.5" rx=".75" fill="currentColor"/><rect x="1" y="4.5" width="7"  height="1.5" rx=".75" fill="currentColor"/><rect x="1" y="8.5" width="10" height="1.5" rx=".75" fill="currentColor"/></svg>,
  alC:       <svg width="14" height="12" viewBox="0 0 14 12" fill="none"><rect x="1" y="0.5" width="12" height="1.5" rx=".75" fill="currentColor"/><rect x="3.5" y="4.5" width="7" height="1.5" rx=".75" fill="currentColor"/><rect x="2" y="8.5" width="10" height="1.5" rx=".75" fill="currentColor"/></svg>,
  alR:       <svg width="14" height="12" viewBox="0 0 14 12" fill="none"><rect x="1" y="0.5" width="12" height="1.5" rx=".75" fill="currentColor"/><rect x="6" y="4.5" width="7"  height="1.5" rx=".75" fill="currentColor"/><rect x="3" y="8.5" width="10" height="1.5" rx=".75" fill="currentColor"/></svg>,
  csv:       <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 9V2M3.5 5l3-3 3 3M2 10.5v.5A1 1 0 003 12h7a1 1 0 001-1v-.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  xlsx:      <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1.5" y="1.5" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M4 5l5 5M9 5L4 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  chart:     <svg width="14" height="13" viewBox="0 0 14 13" fill="none"><rect x="1"  y="8"  width="3" height="4" rx=".5" fill="currentColor"/><rect x="5.5" y="5"  width="3" height="7" rx=".5" fill="currentColor"/><rect x="10" y="2"  width="3" height="10" rx=".5" fill="currentColor"/></svg>,
  export:    <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 4v7M3.5 8l3 3 3-3M2 2.5v-.5A1 1 0 013 1h7a1 1 0 011 1v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
};

function Sep({ isDark }) {
  return <div style={{ width:1, height:22, margin:'0 5px', background: isDark ? '#2a2b48' : '#d4d8f0', flexShrink:0 }} />;
}

function Btn({ on, click, title, children, isDark, accent, muted, wide, color }) {
  const bg = on
    ? (isDark ? 'rgba(124,77,255,0.22)' : 'rgba(92,107,192,0.18)')
    : 'transparent';
  const bd = on ? `1px solid ${isDark?'#7c4dff55':'#5c6bc055'}` : '1px solid transparent';
  return (
    <button
      onMouseDown={e => { e.preventDefault(); click?.(); }}
      title={title}
      style={{
        background: bg, border: bd, borderRadius: 5,
        padding: wide ? '0 10px' : '0 7px',
        color: on ? (color || accent) : muted,
        display:'flex', alignItems:'center', justifyContent:'center', gap:5,
        height:28, minWidth: wide ? undefined : 28, flexShrink:0,
        cursor:'pointer', transition:'all 0.1s', fontFamily:'Syne,sans-serif', fontSize:11,
      }}
    >{children}</button>
  );
}

function Label({ children, muted }) {
  return <span style={{ fontSize:9, color: muted, fontFamily:'Syne,sans-serif', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', flexShrink:0, userSelect:'none' }}>{children}</span>;
}

export default function Toolbar({ theme, selectedFormat, onFormatChange, onImportCSV, onImportXLSX, onExportCSV, onInsertChart }) {
  const isDark = theme === 'dark';
  const accent = isDark ? '#7c4dff' : '#5c6bc0';
  const bg     = isDark ? '#0e0e26' : '#e8eaff';
  const border = isDark ? '#252640' : '#c8cce8';
  const text   = isDark ? '#c8d0f0' : '#1a1a2e';
  const muted  = isDark ? '#525890' : '#7880b8';
  const surf   = isDark ? '#181838' : '#ffffff';

  const fmt   = selectedFormat || {};
  const fsz   = fmt.fontSize ?? 12;
  const align = fmt.align    || 'default';
  const nfmt  = fmt.numberFormat ?? 'general';

  const selStyle = {
    background: surf, border: `1px solid ${border}`, borderRadius: 5,
    padding: '2px 5px', fontFamily: 'DM Mono,monospace', fontSize: 11,
    color: text, cursor: 'pointer', height: 26, outline: 'none', flexShrink:0,
  };

  return (
    <div style={{
      display:'flex', alignItems:'center',
      minHeight:42, padding:'0 12px',
      background: bg, borderBottom:`2px solid ${border}`,
      gap:3, flexShrink:0, overflowX:'auto', overflowY:'hidden',
      boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.4)' : '0 2px 6px rgba(92,107,192,0.12)',
    }}>

      {/* ── File group ── */}
      <Label muted={muted}>File</Label>
      <div style={{ display:'flex', gap:2, marginLeft:4 }}>
        <Btn click={onImportCSV}  title="Import CSV file (.csv)"  isDark={isDark} accent={accent} muted={muted} wide>
          {I.csv}<span>CSV</span>
        </Btn>
        <Btn click={onImportXLSX} title="Import Excel file (.xlsx/.xls)" isDark={isDark} accent={accent} muted={muted} wide>
          {I.xlsx}<span>Excel</span>
        </Btn>
        <Btn click={onExportCSV} title="Export as CSV" isDark={isDark} accent={accent} muted={muted} wide>
          {I.export}<span>Export</span>
        </Btn>
      </div>

      <Sep isDark={isDark} />

      {/* ── Text format ── */}
      <Label muted={muted}>Format</Label>
      <div style={{ display:'flex', gap:1, marginLeft:4 }}>
        <Btn on={!!fmt.bold}      click={() => onFormatChange({bold:      !fmt.bold})}      title="Bold (Ctrl+B)"      isDark={isDark} accent={accent} muted={muted}>
          <span style={{ fontFamily:'Georgia,serif', fontWeight:900, fontSize:13 }}>B</span>
        </Btn>
        <Btn on={!!fmt.italic}    click={() => onFormatChange({italic:    !fmt.italic})}    title="Italic (Ctrl+I)"    isDark={isDark} accent={accent} muted={muted}>
          <span style={{ fontFamily:'Georgia,serif', fontStyle:'italic', fontSize:13 }}>I</span>
        </Btn>
        <Btn on={!!fmt.underline} click={() => onFormatChange({underline: !fmt.underline})} title="Underline (Ctrl+U)" isDark={isDark} accent={accent} muted={muted}>
          {I.under}
        </Btn>
      </div>

      <Sep isDark={isDark} />

      {/* ── Alignment ── */}
      <Label muted={muted}>Align</Label>
      <div style={{ display:'flex', gap:1, marginLeft:4 }}>
        <Btn on={align==='left'}   click={() => onFormatChange({align: align==='left'   ?'default':'left'})}   title="Align left"   isDark={isDark} accent={accent} muted={muted}>{I.alL}</Btn>
        <Btn on={align==='center'} click={() => onFormatChange({align: align==='center' ?'default':'center'})} title="Align center" isDark={isDark} accent={accent} muted={muted}>{I.alC}</Btn>
        <Btn on={align==='right'}  click={() => onFormatChange({align: align==='right'  ?'default':'right'})}  title="Align right"  isDark={isDark} accent={accent} muted={muted}>{I.alR}</Btn>
      </div>

      <Sep isDark={isDark} />

      {/* ── Font size ── */}
      <Label muted={muted}>Size</Label>
      <select value={fsz} onChange={e => onFormatChange({fontSize:Number(e.target.value)})} style={{...selStyle, width:52, marginLeft:4}} title="Font size">
        {FONT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
      </select>

      <Sep isDark={isDark} />

      {/* ── Colors ── */}
      <Label muted={muted}>Color</Label>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginLeft:4 }}>
        <label style={{ display:'flex', flexDirection:'column', alignItems:'center', cursor:'pointer', gap:1 }} title="Text color">
          <span style={{ fontFamily:'Georgia,serif', fontWeight:700, fontSize:12, color: fmt.color || text, lineHeight:1 }}>A</span>
          <div style={{ width:14, height:3, background: fmt.color || accent, borderRadius:1 }} />
          <input type="color" value={fmt.color||(isDark?'#c8d0f0':'#1a1a2e')} onChange={e=>onFormatChange({color:e.target.value})} style={{position:'absolute',opacity:0,width:0,height:0}}/>
        </label>
        <label style={{ display:'flex', flexDirection:'column', alignItems:'center', cursor:'pointer', gap:1 }} title="Fill color">
          <div style={{ width:16, height:12, background: fmt.bgColor||(isDark?'#0f0f1a':'#ffffff'), border:`1px solid ${border}`, borderRadius:2 }} />
          <span style={{ fontSize:8, color:muted, fontFamily:'Syne,sans-serif' }}>Fill</span>
          <input type="color" value={fmt.bgColor||(isDark?'#0f0f1a':'#ffffff')} onChange={e=>onFormatChange({bgColor:e.target.value})} style={{position:'absolute',opacity:0,width:0,height:0}}/>
        </label>
      </div>

      <Sep isDark={isDark} />

      {/* ── Number format ── */}
      <Label muted={muted}>Number</Label>
      <select value={nfmt} onChange={e=>onFormatChange({numberFormat:e.target.value})} style={{...selStyle, width:90, marginLeft:4}}>
        {NUM_FMTS.map(f => <option key={f.v} value={f.v}>{f.l}</option>)}
      </select>

      <Sep isDark={isDark} />

      {/* ── Insert ── */}
      <Label muted={muted}>Insert</Label>
      <Btn click={onInsertChart} title="Insert a chart from selected data" isDark={isDark} accent={accent} muted={muted} wide color={isDark?'#a78bfa':'#7c6bc0'}>
        {I.chart}
        <span style={{ fontWeight:700 }}>Chart</span>
      </Btn>
    </div>
  );
}
