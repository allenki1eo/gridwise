import { useRef, useEffect, useCallback, useState } from 'react';
import { colIndexToLetter } from '../formulaEngine';

const ROW_HEADER_W = 50;
const COL_HEADER_H = 24;

export default function Grid({
  rows, cols, cells,
  selected, setSelected,
  getCellDisplay, setCellValue,
  editing, setEditing,
  theme,
  // Resize
  getColWidth, getRowHeight, setColWidth, setRowHeight,
  // Formatting
  formats, getCellFormat,
  // Range selection
  selectionRange, setSelectionRange,
  // Copy/paste
  copySelection, pasteSelection,
}) {
  const gridRef   = useRef(null);
  const inputRef  = useRef(null);
  const [editValue, setEditValue] = useState('');
  const isDragging  = useRef(false);
  const dragAnchor  = useRef(null);

  const isDark   = theme === 'dark';
  const accent   = isDark ? '#7c4dff' : '#5c6bc0';
  const border   = isDark ? '#252640' : '#e0e0ee';
  const hdrBg    = isDark ? '#181830' : '#eceeff';
  const hdrActBg = isDark ? '#252648' : '#c5cae9';
  const hdrColor = isDark ? '#9098cc' : '#5c6bc0';
  const cellBg   = isDark ? '#0d0d1c' : '#ffffff';
  const cellText = isDark ? '#c8d0f0' : '#1a1a2e';

  /* ── Edit helpers ── */
  const startEdit = useCallback((row, col) => {
    setEditValue(cells[`${row}-${col}`]?.value ?? '');
    setEditing(true);
  }, [cells, setEditing]);

  const commitEdit = useCallback((row, col, value) => {
    setCellValue(row, col, value.trim());
    setEditing(false);
  }, [setCellValue, setEditing]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
    setEditValue('');
  }, [setEditing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing, selected]);

  /* ── Keyboard handler ── */
  const handleKeyDown = useCallback((e) => {
    const { row, col } = selected;

    if (editing) {
      if (e.key === 'Enter')  { e.preventDefault(); commitEdit(row, col, editValue); setSelected({ row: Math.min(row + 1, rows - 1), col }); }
      else if (e.key === 'Tab')    { e.preventDefault(); commitEdit(row, col, editValue); setSelected({ row, col: Math.min(col + 1, cols - 1) }); }
      else if (e.key === 'Escape') cancelEdit();
      return;
    }

    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'c': e.preventDefault(); copySelection(false); return;
        case 'x': e.preventDefault(); copySelection(true);  return;
        case 'v': e.preventDefault(); pasteSelection();     return;
      }
      return; // let other ctrl combos (B/I/U) bubble to App
    }

    switch (e.key) {
      case 'ArrowUp':    e.preventDefault(); setSelected({ row: Math.max(row - 1, 0), col });           setSelectionRange(null); break;
      case 'ArrowDown':
      case 'Enter':      e.preventDefault(); setSelected({ row: Math.min(row + 1, rows - 1), col });    setSelectionRange(null); break;
      case 'ArrowLeft':  e.preventDefault(); setSelected({ row, col: Math.max(col - 1, 0) });           setSelectionRange(null); break;
      case 'ArrowRight':
      case 'Tab':        e.preventDefault(); setSelected({ row, col: Math.min(col + 1, cols - 1) });    setSelectionRange(null); break;
      case 'Delete':
      case 'Backspace':  e.preventDefault(); setCellValue(row, col, ''); break;
      case 'F2':         e.preventDefault(); startEdit(row, col); break;
      case 'Escape':     setSelectionRange(null); break;
      default:
        if (e.key.length === 1) { setEditValue(e.key); setEditing(true); }
    }
  }, [editing, selected, rows, cols, editValue, commitEdit, cancelEdit, setSelected, setCellValue, startEdit, setEditing, copySelection, pasteSelection, setSelectionRange]);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    el.addEventListener('keydown', handleKeyDown);
    return () => el.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  /* ── Drag selection (mouse) ── */
  const onCellMouseDown = useCallback((e, ri, ci) => {
    if (editing) commitEdit(selected.row, selected.col, editValue);
    setSelected({ row: ri, col: ci });
    if (e.shiftKey && dragAnchor.current) {
      setSelectionRange({
        startRow: Math.min(dragAnchor.current.row, ri),
        startCol: Math.min(dragAnchor.current.col, ci),
        endRow:   Math.max(dragAnchor.current.row, ri),
        endCol:   Math.max(dragAnchor.current.col, ci),
      });
    } else {
      setSelectionRange(null);
      dragAnchor.current = { row: ri, col: ci };
      isDragging.current = true;
    }
    gridRef.current?.focus();
  }, [editing, selected, editValue, commitEdit, setSelected, setSelectionRange]);

  const onCellMouseEnter = useCallback((ri, ci) => {
    if (!isDragging.current || !dragAnchor.current) return;
    const a = dragAnchor.current;
    setSelectionRange({
      startRow: Math.min(a.row, ri), startCol: Math.min(a.col, ci),
      endRow:   Math.max(a.row, ri), endCol:   Math.max(a.col, ci),
    });
  }, [setSelectionRange]);

  useEffect(() => {
    const up = () => { isDragging.current = false; };
    document.addEventListener('mouseup', up);
    return () => document.removeEventListener('mouseup', up);
  }, []);

  /* ── Auto-scroll selected cell into view ── */
  useEffect(() => {
    const container = gridRef.current?.parentElement;
    if (!container) return;
    const { row, col } = selected;
    let cellLeft = ROW_HEADER_W;
    for (let c = 0; c < col; c++) cellLeft += getColWidth(c);
    let cellTop = COL_HEADER_H;
    for (let r = 0; r < row; r++) cellTop += getRowHeight(r);
    const cw = getColWidth(col), rh = getRowHeight(row);
    if (cellLeft < container.scrollLeft)                              container.scrollLeft = cellLeft;
    if (cellLeft + cw > container.scrollLeft + container.clientWidth) container.scrollLeft = cellLeft + cw - container.clientWidth;
    if (cellTop  < container.scrollTop)                               container.scrollTop  = cellTop - COL_HEADER_H;
    if (cellTop + rh > container.scrollTop + container.clientHeight)  container.scrollTop  = cellTop + rh - container.clientHeight;
  }, [selected, getColWidth, getRowHeight]);

  const inRange = useCallback((ri, ci) => {
    if (!selectionRange) return false;
    const { startRow, startCol, endRow, endCol } = selectionRange;
    return ri >= startRow && ri <= endRow && ci >= startCol && ci <= endCol;
  }, [selectionRange]);

  /* ── Resize handlers ── */
  const startColResize = (e, ci) => {
    e.stopPropagation(); e.preventDefault();
    const startX = e.clientX, startW = getColWidth(ci);
    const onMove = e => setColWidth(ci, startW + e.clientX - startX);
    const onUp   = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const startRowResize = (e, ri) => {
    e.stopPropagation(); e.preventDefault();
    const startY = e.clientY, startH = getRowHeight(ri);
    const onMove = e => setRowHeight(ri, startH + e.clientY - startY);
    const onUp   = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const colHeaders = Array.from({ length: cols }, (_, i) => colIndexToLetter(i));

  return (
    <div ref={gridRef} tabIndex={0} style={{ outline: 'none', userSelect: 'none', display: 'inline-block', minWidth: '100%' }}>
      {/* ── Column headers ── */}
      <div style={{ display: 'flex', position: 'sticky', top: 0, zIndex: 4 }}>
        {/* Corner */}
        <div style={{
          width: ROW_HEADER_W, minWidth: ROW_HEADER_W, height: COL_HEADER_H, flexShrink: 0,
          background: hdrBg, borderRight: `1px solid ${border}`, borderBottom: `2px solid ${border}`,
        }} />
        {colHeaders.map((letter, ci) => {
          const w = getColWidth(ci);
          const isActive = selected.col === ci;
          return (
            <div key={letter} style={{
              width: w, minWidth: w, height: COL_HEADER_H, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Syne, sans-serif', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
              background: isActive ? hdrActBg : hdrBg,
              color: isActive ? accent : hdrColor,
              borderRight: `1px solid ${border}`, borderBottom: `2px solid ${border}`,
              cursor: 'default', position: 'relative',
            }}>
              {letter}
              {/* Col resize handle */}
              <div
                style={{ position: 'absolute', right: 0, top: 0, width: 5, height: '100%', cursor: 'col-resize', zIndex: 1 }}
                onMouseDown={e => startColResize(e, ci)}
              />
            </div>
          );
        })}
      </div>

      {/* ── Data rows ── */}
      {Array.from({ length: rows }, (_, ri) => {
        const rh = getRowHeight(ri);
        const isActiveRow = selected.row === ri;
        return (
          <div key={ri} style={{ display: 'flex' }}>
            {/* Row header */}
            <div style={{
              width: ROW_HEADER_W, minWidth: ROW_HEADER_W, height: rh, flexShrink: 0,
              display: 'flex', flexDirection: 'column',
              background: isActiveRow ? hdrActBg : hdrBg,
              borderRight: `1px solid ${border}`, borderBottom: `1px solid ${border}`,
              cursor: 'default', position: 'sticky', left: 0, zIndex: 2,
            }}>
              <div style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Syne, sans-serif', fontSize: 11, fontWeight: 600,
                color: isActiveRow ? accent : hdrColor,
              }}>
                {ri + 1}
              </div>
              {/* Row resize handle */}
              <div
                style={{ height: 4, cursor: 'row-resize', flexShrink: 0 }}
                onMouseDown={e => startRowResize(e, ri)}
              />
            </div>

            {/* Cells */}
            {Array.from({ length: cols }, (_, ci) => {
              const w = getColWidth(ci);
              const isSelected = selected.row === ri && selected.col === ci;
              const inSel      = inRange(ri, ci);
              const isEditing  = isSelected && editing;
              const display    = getCellDisplay(ri, ci, cells);
              const fmt        = getCellFormat(ri, ci);

              const bgColor  = fmt.bgColor  || cellBg;
              const txtColor = fmt.color    || cellText;
              const fSize    = fmt.fontSize ?? 12;
              const isNum    = !isNaN(Number(display)) && display !== '';
              const tAlign   = fmt.align && fmt.align !== 'default'
                ? fmt.align
                : (isNum ? 'right' : 'left');

              return (
                <div
                  key={ci}
                  onMouseDown={e => onCellMouseDown(e, ri, ci)}
                  onMouseEnter={() => onCellMouseEnter(ri, ci)}
                  onDoubleClick={() => startEdit(ri, ci)}
                  style={{
                    width: w, minWidth: w, height: rh, flexShrink: 0,
                    borderRight: `1px solid ${border}`,
                    borderBottom: `1px solid ${border}`,
                    background: isSelected
                      ? (isDark ? 'rgba(124,77,255,0.18)' : 'rgba(92,107,192,0.13)')
                      : inSel
                      ? (isDark ? 'rgba(124,77,255,0.09)' : 'rgba(92,107,192,0.07)')
                      : bgColor,
                    outline: isSelected ? `2px solid ${accent}` : 'none',
                    outlineOffset: '-1px',
                    position: 'relative', overflow: 'hidden', cursor: 'cell',
                  }}
                >
                  {isEditing ? (
                    <input
                      ref={inputRef}
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onBlur={() => commitEdit(ri, ci, editValue)}
                      style={{
                        width: '100%', height: '100%', border: 'none', outline: 'none',
                        background: isDark ? '#1e0f40' : '#eef0ff',
                        color: isDark ? '#e8eaf6' : '#1a1a2e',
                        fontFamily: 'DM Mono, monospace', fontSize: fSize,
                        padding: '0 5px', boxSizing: 'border-box',
                        fontWeight: fmt.bold ? 700 : 400,
                        fontStyle: fmt.italic ? 'italic' : 'normal',
                      }}
                    />
                  ) : (
                    <span style={{
                      display: 'block', width: '100%', height: '100%',
                      lineHeight: `${rh}px`,
                      padding: '0 5px',
                      fontFamily: 'DM Mono, monospace', fontSize: fSize,
                      color: txtColor,
                      fontWeight:     fmt.bold      ? 700 : 400,
                      fontStyle:      fmt.italic    ? 'italic' : 'normal',
                      textDecoration: fmt.underline ? 'underline' : 'none',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      boxSizing: 'border-box', textAlign: tAlign,
                    }}>
                      {display}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
