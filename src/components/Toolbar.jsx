const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36];

const NUMBER_FORMATS = [
  { value: 'general', label: 'General' },
  { value: 'number',  label: '1,234.56' },
  { value: 'currency', label: '$ Currency' },
  { value: 'percent', label: '% Percent' },
  { value: 'integer', label: '1,234' },
];

// Inline SVG icons — no external deps
const BoldIcon    = () => <svg width="11" height="13" viewBox="0 0 11 13" fill="currentColor"><path d="M2 1h4.5a3 3 0 010 6H2V1zm0 6h5a3 3 0 010 6H2V7z"/></svg>;
const ItalicIcon  = () => <svg width="9" height="13" viewBox="0 0 9 13" fill="none"><line x1="6" y1="1" x2="3" y2="12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><line x1="3.5" y1="1" x2="8.5" y2="1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><line x1="0.5" y1="12" x2="5.5" y2="12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>;
const UnderlineIcon = () => <svg width="11" height="14" viewBox="0 0 11 14" fill="none"><path d="M1.5 1v5a4 4 0 008 0V1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><line x1="0" y1="13.5" x2="11" y2="13.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>;
const AlignLIcon  = () => <svg width="14" height="11" viewBox="0 0 14 11" fill="none"><rect x="1" y="0"  width="12" height="1.8" rx="0.9" fill="currentColor"/><rect x="1" y="4"  width="8"  height="1.8" rx="0.9" fill="currentColor"/><rect x="1" y="8"  width="10" height="1.8" rx="0.9" fill="currentColor"/></svg>;
const AlignCIcon  = () => <svg width="14" height="11" viewBox="0 0 14 11" fill="none"><rect x="1" y="0"  width="12" height="1.8" rx="0.9" fill="currentColor"/><rect x="3" y="4"  width="8"  height="1.8" rx="0.9" fill="currentColor"/><rect x="2" y="8"  width="10" height="1.8" rx="0.9" fill="currentColor"/></svg>;
const AlignRIcon  = () => <svg width="14" height="11" viewBox="0 0 14 11" fill="none"><rect x="1" y="0"  width="12" height="1.8" rx="0.9" fill="currentColor"/><rect x="5" y="4"  width="8"  height="1.8" rx="0.9" fill="currentColor"/><rect x="3" y="8"  width="10" height="1.8" rx="0.9" fill="currentColor"/></svg>;
const UploadIcon  = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 8.5V1.5M3.5 4.5l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M1.5 10v.5A1.5 1.5 0 003 12h7a1.5 1.5 0 001.5-1.5V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;

function Sep({ isDark }) {
  return (
    <div style={{
      width: 1, height: 20, margin: '0 5px', flexShrink: 0,
      background: isDark ? '#2d2e4a' : '#d0d4f0',
    }} />
  );
}

function Btn({ active, onClick, title, children, isDark, accent, muted, wide }) {
  return (
    <button
      onMouseDown={e => { e.preventDefault(); onClick?.(); }}
      title={title}
      style={{
        background: active
          ? (isDark ? 'rgba(124,77,255,0.22)' : 'rgba(92,107,192,0.18)')
          : 'transparent',
        border: `1px solid ${active ? (isDark ? '#7c4dff60' : '#5c6bc060') : 'transparent'}`,
        borderRadius: 5,
        padding: wide ? '0 10px' : '0 6px',
        cursor: 'pointer',
        color: active ? accent : muted,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        height: 26, minWidth: wide ? undefined : 28,
        flexShrink: 0, transition: 'background 0.1s, color 0.1s',
        fontFamily: 'Syne, sans-serif',
      }}
    >
      {children}
    </button>
  );
}

export default function Toolbar({ theme, selectedFormat, onFormatChange, onImportCSV }) {
  const isDark = theme === 'dark';
  const accent = isDark ? '#7c4dff' : '#5c6bc0';
  const bg     = isDark ? '#111128' : '#eceeff';
  const border = isDark ? '#2d2e4a' : '#d0d4f0';
  const text   = isDark ? '#c8d0f0' : '#1a1a2e';
  const muted  = isDark ? '#5060a0' : '#8090c8';
  const surf   = isDark ? '#1a1b30' : '#ffffff';

  const fmt  = selectedFormat || {};
  const fsz  = fmt.fontSize ?? 12;
  const align = fmt.align || 'default';
  const nfmt = fmt.numberFormat ?? 'general';

  const sel = s => ({
    background: surf, border: `1px solid ${border}`, borderRadius: 4,
    padding: '2px 4px', fontFamily: 'DM Mono, monospace', fontSize: 11,
    color: text, cursor: 'pointer', height: 26, outline: 'none',
  });

  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      height: 36, padding: '0 10px',
      background: bg, borderBottom: `1px solid ${border}`,
      gap: 2, flexShrink: 0, overflowX: 'auto', overflowY: 'hidden',
    }}>
      {/* Import */}
      <Btn onClick={onImportCSV} title="Import CSV file" isDark={isDark} accent={accent} muted={muted} wide>
        <UploadIcon />
        <span style={{ fontSize: 11 }}>Import CSV</span>
      </Btn>

      <Sep isDark={isDark} />

      {/* Bold / Italic / Underline */}
      <Btn active={!!fmt.bold}      onClick={() => onFormatChange({ bold: !fmt.bold })}           title="Bold (Ctrl+B)"      isDark={isDark} accent={accent} muted={muted}><BoldIcon /></Btn>
      <Btn active={!!fmt.italic}    onClick={() => onFormatChange({ italic: !fmt.italic })}       title="Italic (Ctrl+I)"    isDark={isDark} accent={accent} muted={muted}><ItalicIcon /></Btn>
      <Btn active={!!fmt.underline} onClick={() => onFormatChange({ underline: !fmt.underline })} title="Underline (Ctrl+U)" isDark={isDark} accent={accent} muted={muted}><UnderlineIcon /></Btn>

      <Sep isDark={isDark} />

      {/* Alignment */}
      <Btn active={align === 'left'}   onClick={() => onFormatChange({ align: align === 'left'   ? 'default' : 'left' })}   title="Align left"   isDark={isDark} accent={accent} muted={muted}><AlignLIcon /></Btn>
      <Btn active={align === 'center'} onClick={() => onFormatChange({ align: align === 'center' ? 'default' : 'center' })} title="Align center" isDark={isDark} accent={accent} muted={muted}><AlignCIcon /></Btn>
      <Btn active={align === 'right'}  onClick={() => onFormatChange({ align: align === 'right'  ? 'default' : 'right' })}  title="Align right"  isDark={isDark} accent={accent} muted={muted}><AlignRIcon /></Btn>

      <Sep isDark={isDark} />

      {/* Font size */}
      <select value={fsz} onChange={e => onFormatChange({ fontSize: Number(e.target.value) })} style={{ ...sel(), width: 54 }} title="Font size">
        {FONT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
      </select>

      <Sep isDark={isDark} />

      {/* Text color */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }} title="Text color">
        <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 12, color: fmt.color || accent, userSelect: 'none' }}>A</span>
        <input type="color"
          value={fmt.color || (isDark ? '#c8d0f0' : '#1a1a2e')}
          onChange={e => onFormatChange({ color: e.target.value })}
          style={{ width: 20, height: 20, padding: 0, border: `1px solid ${border}`, borderRadius: 3, cursor: 'pointer', background: 'none' }}
        />
      </div>

      {/* Fill color */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }} title="Cell fill color">
        <span style={{ fontSize: 11, color: muted, userSelect: 'none', fontFamily: 'Syne, sans-serif' }}>Fill</span>
        <input type="color"
          value={fmt.bgColor || (isDark ? '#0f0f1a' : '#ffffff')}
          onChange={e => onFormatChange({ bgColor: e.target.value })}
          style={{ width: 20, height: 20, padding: 0, border: `1px solid ${border}`, borderRadius: 3, cursor: 'pointer', background: 'none' }}
        />
      </div>

      <Sep isDark={isDark} />

      {/* Number format */}
      <select value={nfmt} onChange={e => onFormatChange({ numberFormat: e.target.value })} style={{ ...sel(), width: 88 }} title="Number format">
        {NUMBER_FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
      </select>
    </div>
  );
}
