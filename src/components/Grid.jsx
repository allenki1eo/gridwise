import { useRef, useEffect, useCallback, useState } from 'react';
import { colIndexToLetter } from '../formulaEngine';

const CELL_WIDTH = 100;
const CELL_HEIGHT = 24;
const ROW_HEADER_WIDTH = 48;

export default function Grid({
  rows,
  cols,
  cells,
  selected,
  setSelected,
  getCellDisplay,
  setCellValue,
  editing,
  setEditing,
  theme,
}) {
  const gridRef = useRef(null);
  const inputRef = useRef(null);
  const [editValue, setEditValue] = useState('');

  const startEdit = useCallback(
    (row, col) => {
      const key = `${row}-${col}`;
      const raw = cells[key]?.value ?? '';
      setEditValue(raw);
      setEditing(true);
    },
    [cells, setEditing]
  );

  const commitEdit = useCallback(
    (row, col, value) => {
      setCellValue(row, col, value.trim());
      setEditing(false);
    },
    [setCellValue, setEditing]
  );

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

  const handleKeyDown = useCallback(
    (e) => {
      const { row, col } = selected;
      if (editing) {
        if (e.key === 'Enter') {
          e.preventDefault();
          commitEdit(row, col, editValue);
          setSelected({ row: Math.min(row + 1, rows - 1), col });
        } else if (e.key === 'Tab') {
          e.preventDefault();
          commitEdit(row, col, editValue);
          setSelected({ row, col: Math.min(col + 1, cols - 1) });
        } else if (e.key === 'Escape') {
          cancelEdit();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          setSelected({ row: Math.max(row - 1, 0), col });
          break;
        case 'ArrowDown':
        case 'Enter':
          e.preventDefault();
          setSelected({ row: Math.min(row + 1, rows - 1), col });
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setSelected({ row, col: Math.max(col - 1, 0) });
          break;
        case 'ArrowRight':
        case 'Tab':
          e.preventDefault();
          setSelected({ row, col: Math.min(col + 1, cols - 1) });
          break;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          setCellValue(row, col, '');
          break;
        case 'F2':
          e.preventDefault();
          startEdit(row, col);
          break;
        default:
          // Start editing on printable character
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
            setEditValue(e.key);
            setEditing(true);
          }
      }
    },
    [editing, selected, rows, cols, editValue, commitEdit, cancelEdit, setSelected, setCellValue, startEdit, setEditing]
  );

  useEffect(() => {
    const el = gridRef.current;
    if (el) {
      el.addEventListener('keydown', handleKeyDown);
      return () => el.removeEventListener('keydown', handleKeyDown);
    }
  }, [handleKeyDown]);

  // Auto-scroll selected cell into view
  useEffect(() => {
    const container = gridRef.current?.parentElement;
    if (!container) return;
    const { row, col } = selected;
    const cellLeft = ROW_HEADER_WIDTH + col * CELL_WIDTH;
    const cellTop = row * CELL_HEIGHT + CELL_HEIGHT; // +1 for col header
    const cellRight = cellLeft + CELL_WIDTH;
    const cellBottom = cellTop + CELL_HEIGHT;
    if (cellLeft < container.scrollLeft) container.scrollLeft = cellLeft;
    if (cellRight > container.scrollLeft + container.clientWidth) container.scrollLeft = cellRight - container.clientWidth;
    if (cellTop < container.scrollTop) container.scrollTop = cellTop - CELL_HEIGHT;
    if (cellBottom > container.scrollTop + container.clientHeight) container.scrollTop = cellBottom - container.clientHeight;
  }, [selected]);

  const isDark = theme === 'dark';

  const colHeaders = Array.from({ length: cols }, (_, i) => colIndexToLetter(i));

  return (
    <div
      ref={gridRef}
      tabIndex={0}
      className="grid-focus-root"
      style={{ outline: 'none', width: '100%', height: '100%' }}
    >
      {/* Column headers row */}
      <div className="grid-header-row" style={{ display: 'flex', position: 'sticky', top: 0, zIndex: 3 }}>
        {/* Corner cell */}
        <div
          className="cell-corner"
          style={{
            width: ROW_HEADER_WIDTH,
            minWidth: ROW_HEADER_WIDTH,
            height: CELL_HEIGHT,
            flexShrink: 0,
            background: isDark ? '#1a1b2e' : '#e8eaf6',
            borderRight: `1px solid ${isDark ? '#2d2e4a' : '#c5cae9'}`,
            borderBottom: `1px solid ${isDark ? '#2d2e4a' : '#c5cae9'}`,
          }}
        />
        {colHeaders.map((letter, ci) => (
          <div
            key={letter}
            className={`col-header${selected.col === ci ? ' col-header--active' : ''}`}
            style={{
              width: CELL_WIDTH,
              minWidth: CELL_WIDTH,
              height: CELL_HEIGHT,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'Syne, sans-serif',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.05em',
              background: selected.col === ci
                ? (isDark ? '#2a2b4a' : '#c5cae9')
                : (isDark ? '#1a1b2e' : '#e8eaf6'),
              color: isDark ? '#a0a8d8' : '#5c6bc0',
              borderRight: `1px solid ${isDark ? '#2d2e4a' : '#c5cae9'}`,
              borderBottom: `1px solid ${isDark ? '#2d2e4a' : '#c5cae9'}`,
              userSelect: 'none',
              cursor: 'default',
            }}
          >
            {letter}
          </div>
        ))}
      </div>

      {/* Data rows */}
      {Array.from({ length: rows }, (_, ri) => (
        <div key={ri} style={{ display: 'flex' }}>
          {/* Row header */}
          <div
            className={`row-header${selected.row === ri ? ' row-header--active' : ''}`}
            style={{
              width: ROW_HEADER_WIDTH,
              minWidth: ROW_HEADER_WIDTH,
              height: CELL_HEIGHT,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'Syne, sans-serif',
              fontSize: 11,
              fontWeight: 600,
              background: selected.row === ri
                ? (isDark ? '#2a2b4a' : '#c5cae9')
                : (isDark ? '#1a1b2e' : '#e8eaf6'),
              color: isDark ? '#a0a8d8' : '#5c6bc0',
              borderRight: `1px solid ${isDark ? '#2d2e4a' : '#c5cae9'}`,
              borderBottom: `1px solid ${isDark ? '#2d2e4a' : '#c5cae9'}`,
              userSelect: 'none',
              cursor: 'default',
              position: 'sticky',
              left: 0,
              zIndex: 2,
            }}
          >
            {ri + 1}
          </div>

          {/* Data cells */}
          {Array.from({ length: cols }, (_, ci) => {
            const isSelected = selected.row === ri && selected.col === ci;
            const isEditing = isSelected && editing;
            const display = getCellDisplay(ri, ci, cells);

            return (
              <div
                key={ci}
                onMouseDown={() => {
                  if (editing) {
                    commitEdit(selected.row, selected.col, editValue);
                  }
                  setSelected({ row: ri, col: ci });
                  setEditing(false);
                  gridRef.current?.focus();
                }}
                onDoubleClick={() => startEdit(ri, ci)}
                style={{
                  width: CELL_WIDTH,
                  minWidth: CELL_WIDTH,
                  height: CELL_HEIGHT,
                  flexShrink: 0,
                  borderRight: `1px solid ${isDark ? '#2d2e4a' : '#e0e0e0'}`,
                  borderBottom: `1px solid ${isDark ? '#2d2e4a' : '#e0e0e0'}`,
                  background: isSelected
                    ? (isDark ? 'rgba(124,77,255,0.15)' : 'rgba(92,107,192,0.1)')
                    : (isDark ? '#0f0f1a' : '#ffffff'),
                  outline: isSelected
                    ? `2px solid ${isDark ? '#7c4dff' : '#5c6bc0'}`
                    : 'none',
                  outlineOffset: '-1px',
                  position: 'relative',
                  overflow: 'hidden',
                  cursor: 'default',
                }}
              >
                {isEditing ? (
                  <input
                    ref={inputRef}
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onBlur={() => commitEdit(ri, ci, editValue)}
                    style={{
                      width: '100%',
                      height: '100%',
                      border: 'none',
                      outline: 'none',
                      background: isDark ? '#1a0a3a' : '#e8eaf6',
                      color: isDark ? '#e8eaf6' : '#1a1a2e',
                      fontFamily: 'DM Mono, monospace',
                      fontSize: 12,
                      padding: '0 4px',
                      boxSizing: 'border-box',
                    }}
                  />
                ) : (
                  <span
                    style={{
                      display: 'block',
                      width: '100%',
                      height: '100%',
                      lineHeight: `${CELL_HEIGHT}px`,
                      padding: '0 4px',
                      fontFamily: 'DM Mono, monospace',
                      fontSize: 12,
                      color: isDark ? '#c8d0f0' : '#1a1a2e',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      boxSizing: 'border-box',
                      textAlign: typeof display === 'number' || (!isNaN(Number(display)) && display !== '') ? 'right' : 'left',
                    }}
                  >
                    {display}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
