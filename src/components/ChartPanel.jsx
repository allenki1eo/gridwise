import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale,
  BarElement, LineElement, PointElement,
  ArcElement, Filler,
  Title, Tooltip, Legend,
} from 'chart.js';
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2';
import { cellRefToIndex, colIndexToLetter } from '../formulaEngine';

ChartJS.register(
  CategoryScale, LinearScale,
  BarElement, LineElement, PointElement,
  ArcElement, Filler,
  Title, Tooltip, Legend
);

const CHART_TYPES = [
  { id: 'bar',       label: 'Bar' },
  { id: 'line',      label: 'Line' },
  { id: 'pie',       label: 'Pie' },
  { id: 'doughnut',  label: 'Donut' },
  { id: 'area',      label: 'Area' },
];

const PALETTE = [
  'rgba(124,77,255,0.8)',  'rgba(64,180,255,0.8)',  'rgba(80,220,140,0.8)',
  'rgba(255,160,60,0.8)',  'rgba(255,80,120,0.8)',  'rgba(160,220,80,0.8)',
  'rgba(200,100,255,0.8)', 'rgba(40,200,200,0.8)',
];
const PALETTE_BORDER = PALETTE.map(c => c.replace('0.8', '1'));

function parseRange(rangeStr) {
  const m = rangeStr.toUpperCase().match(/^([A-Z]+\d+):([A-Z]+\d+)$/);
  if (!m) return null;
  const s = cellRefToIndex(m[1]), e = cellRefToIndex(m[2]);
  if (!s || !e) return null;
  return { sr: s.row, sc: s.col, er: e.row, ec: e.col };
}

function extractChartData(cells, rangeStr, getCellDisplay) {
  const r = parseRange(rangeStr);
  if (!r) return null;
  const { sr, sc, er, ec } = r;
  const numCols = ec - sc + 1;
  const numRows = er - sr + 1;

  // Detect if first row/col has headers (non-numeric)
  const firstCellVal = getCellDisplay(sr, sc, cells);
  const hasRowHeaders = isNaN(Number(firstCellVal)) && firstCellVal !== '';

  // Extract column headers from first row if they exist
  const colHeaders = [];
  const startDataCol = hasRowHeaders ? sc + 1 : sc;
  for (let c = startDataCol; c <= ec; c++) {
    const v = getCellDisplay(sr, sc === startDataCol - 1 ? sr : sr, c, cells);
    colHeaders.push(getCellDisplay(sr, c, cells) || colIndexToLetter(c) + (sr + 1));
  }

  // Extract row labels from first column if headers present
  const labels = [];
  const startDataRow = hasRowHeaders ? sr + 1 : sr;
  for (let r2 = startDataRow; r2 <= er; r2++) {
    if (hasRowHeaders) {
      labels.push(getCellDisplay(r2, sc, cells) || String(r2 - sr));
    } else {
      labels.push(colIndexToLetter(sc) + (r2 + 1));
    }
  }

  // Build datasets — each column is a series
  const datasets = [];
  let colIdx = 0;
  for (let c = startDataCol; c <= ec; c++) {
    const data = [];
    for (let row = startDataRow; row <= er; row++) {
      const v = getCellDisplay(row, c, cells);
      data.push(Number(v) || 0);
    }
    datasets.push({
      label: hasRowHeaders ? getCellDisplay(sr, c, cells) || `Series ${colIdx + 1}` : `Series ${colIdx + 1}`,
      data,
      backgroundColor: PALETTE[colIdx % PALETTE.length],
      borderColor:     PALETTE_BORDER[colIdx % PALETTE_BORDER.length],
      borderWidth: 2,
      fill: false,
      tension: 0.4,
      pointRadius: 3,
    });
    colIdx++;
  }

  return { labels, datasets };
}

export default function ChartPanel({ theme, cells, getCellDisplay, selectionRange, onClose }) {
  const isDark = theme === 'dark';
  const accent  = isDark ? '#7c4dff' : '#5c6bc0';
  const bg      = isDark ? '#0e0e26' : '#f0f0ff';
  const surface = isDark ? '#141432' : '#ffffff';
  const border  = isDark ? '#252640' : '#d0d4f0';
  const text    = isDark ? '#c8d0f0' : '#1a1a2e';
  const muted   = isDark ? '#5060a0' : '#8090c8';

  // Default range from selection
  const defaultRange = useMemo(() => {
    if (!selectionRange) return 'A1:D5';
    const { startRow, startCol, endRow, endCol } = selectionRange;
    const r1 = colIndexToLetter(startCol) + (startRow + 1);
    const r2 = colIndexToLetter(endCol)   + (endRow   + 1);
    return `${r1}:${r2}`;
  }, [selectionRange]);

  const [chartType, setChartType] = useState('bar');
  const [range,     setRange]     = useState(defaultRange);
  const [title,     setTitle]     = useState('');
  const [rangeInput, setRangeInput] = useState(defaultRange);

  useEffect(() => { setRange(defaultRange); setRangeInput(defaultRange); }, [defaultRange]);

  const chartData = useMemo(() => {
    try { return extractChartData(cells, range, getCellDisplay); } catch { return null; }
  }, [cells, range, getCellDisplay]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: text, font: { family: 'DM Mono, monospace', size: 11 } } },
      title:  title ? { display: true, text: title, color: text, font: { family: 'Syne, sans-serif', size: 13, weight: '700' } } : { display: false },
      tooltip: { backgroundColor: isDark ? '#1a1b30' : '#ffffff', titleColor: text, bodyColor: muted, borderColor: border, borderWidth: 1 },
    },
    scales: chartType === 'pie' || chartType === 'doughnut' ? {} : {
      x: { ticks: { color: muted, font: { family: 'DM Mono, monospace', size: 10 } }, grid: { color: isDark ? '#1e1f38' : '#e8e8f5' } },
      y: { ticks: { color: muted, font: { family: 'DM Mono, monospace', size: 10 } }, grid: { color: isDark ? '#1e1f38' : '#e8e8f5' } },
    },
  };

  const areaData = useMemo(() => {
    if (!chartData) return null;
    return {
      ...chartData,
      datasets: chartData.datasets.map(d => ({ ...d, fill: true, backgroundColor: d.backgroundColor.replace('0.8', '0.25') })),
    };
  }, [chartData]);

  const renderChart = () => {
    if (!chartData) return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color: muted, fontFamily:'DM Mono,monospace', fontSize:12 }}>
        Enter a valid range to preview chart
      </div>
    );
    const d = chartType === 'area' ? (areaData || chartData) : chartData;
    switch (chartType) {
      case 'bar':      return <Bar      data={d} options={chartOptions} />;
      case 'line':     return <Line     data={d} options={chartOptions} />;
      case 'area':     return <Line     data={d} options={chartOptions} />;
      case 'pie':      return <Pie      data={{...d, datasets:[{...d.datasets[0], backgroundColor:PALETTE,borderColor:PALETTE_BORDER,borderWidth:2}]}} options={chartOptions} />;
      case 'doughnut': return <Doughnut data={{...d, datasets:[{...d.datasets[0], backgroundColor:PALETTE,borderColor:PALETTE_BORDER,borderWidth:2}]}} options={chartOptions} />;
      default:         return null;
    }
  };

  const panelRef = useRef(null);
  const [pos,    setPos]    = useState({ x: 80, y: 80 });
  const [size,   setSize]   = useState({ w: 640, h: 480 });
  const dragging = useRef(false);
  const dragStart = useRef({});

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed', left: pos.x, top: pos.y, width: size.w, height: size.h,
        background: surface, border: `1.5px solid ${border}`,
        borderRadius: 12, boxShadow: isDark ? '0 8px 40px rgba(0,0,0,0.7)' : '0 8px 32px rgba(92,107,192,0.3)',
        display: 'flex', flexDirection: 'column', zIndex: 1000, overflow: 'hidden',
        resize: 'both',
      }}
    >
      {/* ── Header (draggable) ── */}
      <div
        style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'10px 14px', background: isDark ? '#111130' : '#eceeff',
          borderBottom:`1px solid ${border}`, cursor:'grab', flexShrink:0, userSelect:'none',
        }}
        onMouseDown={e => {
          dragging.current = true;
          dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
          const onMove = e => {
            if (!dragging.current) return;
            setPos({ x: dragStart.current.px + e.clientX - dragStart.current.mx, y: dragStart.current.py + e.clientY - dragStart.current.my });
          };
          const onUp = () => { dragging.current = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        }}
      >
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <svg width="16" height="14" viewBox="0 0 16 14" fill="none">
            <rect x="1" y="9"  width="3" height="4" rx=".5" fill={accent}/>
            <rect x="6" y="5"  width="3" height="8" rx=".5" fill={accent} opacity=".8"/>
            <rect x="11" y="1" width="3" height="12" rx=".5" fill={accent} opacity=".6"/>
          </svg>
          <span style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:13, color:text }}>Chart Builder</span>
        </div>
        <button onClick={onClose} style={{ background:'transparent', border:`1px solid ${border}`, borderRadius:5, width:24, height:24, cursor:'pointer', color:muted, fontSize:14, display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
      </div>

      {/* ── Controls ── */}
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', borderBottom:`1px solid ${border}`, flexShrink:0, flexWrap:'wrap' }}>
        {/* Chart type pills */}
        <div style={{ display:'flex', gap:0 }}>
          {CHART_TYPES.map((t, i) => (
            <button key={t.id} onClick={() => setChartType(t.id)} style={{
              padding:'4px 12px', cursor:'pointer',
              background: chartType === t.id ? accent : (isDark?'#1a1b30':'#e8eaff'),
              color: chartType === t.id ? '#fff' : muted,
              border:`1px solid ${chartType===t.id?accent:border}`,
              borderLeft: i > 0 ? 'none' : `1px solid ${chartType===t.id?accent:border}`,
              borderRadius: i===0?'6px 0 0 6px':i===CHART_TYPES.length-1?'0 6px 6px 0':'0',
              fontFamily:'Syne,sans-serif', fontSize:11, fontWeight: chartType===t.id?700:400,
            }}>{t.label}</button>
          ))}
        </div>

        {/* Range input */}
        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
          <span style={{ fontFamily:'DM Mono,monospace', fontSize:10, color:muted }}>Range</span>
          <input
            value={rangeInput}
            onChange={e => setRangeInput(e.target.value.toUpperCase())}
            onBlur={() => setRange(rangeInput)}
            onKeyDown={e => e.key === 'Enter' && setRange(rangeInput)}
            style={{ background:isDark?'#0f0f1a':'#f0f0ff', border:`1px solid ${border}`, borderRadius:5, padding:'3px 8px', fontFamily:'DM Mono,monospace', fontSize:11, color:text, outline:'none', width:90 }}
          />
        </div>

        {/* Title input */}
        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
          <span style={{ fontFamily:'DM Mono,monospace', fontSize:10, color:muted }}>Title</span>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Optional…"
            style={{ background:isDark?'#0f0f1a':'#f0f0ff', border:`1px solid ${border}`, borderRadius:5, padding:'3px 8px', fontFamily:'DM Mono,monospace', fontSize:11, color:text, outline:'none', width:120 }}
          />
        </div>
      </div>

      {/* ── Chart canvas ── */}
      <div style={{ flex:1, padding:16, minHeight:0 }}>
        {renderChart()}
      </div>
    </div>
  );
}
