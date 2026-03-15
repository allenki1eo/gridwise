import { useState, useCallback, useEffect } from 'react';
import { evaluateFormula } from './formulaEngine';
import * as XLSX from 'xlsx';

export const ROWS = 100;
export const COLS = 26;
export const DEFAULT_COL_WIDTH = 100;
export const DEFAULT_ROW_HEIGHT = 24;

function createEmptySheet(name) {
  return { name, cells: {} };
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current); current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export function useSpreadsheet() {
  const [sheets, setSheets] = useState([createEmptySheet('Sheet1')]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [selected, setSelected] = useState({ row: 0, col: 0 });
  const [editing, setEditing] = useState(false);
  const [colWidths, setColWidthsState] = useState({});
  const [rowHeights, setRowHeightsState] = useState({});
  const [formats, setFormats] = useState({});
  const [selectionRange, setSelectionRange] = useState(null); // {startRow,startCol,endRow,endCol}
  const [clipboard, setClipboard] = useState(null); // {data:[], cut:bool}

  const currentCells = sheets[activeSheet].cells;

  // Reset selection when switching sheets
  useEffect(() => {
    setSelectionRange(null);
  }, [activeSheet]);

  const getColWidth = useCallback(col => colWidths[col] ?? DEFAULT_COL_WIDTH, [colWidths]);
  const getRowHeight = useCallback(row => rowHeights[row] ?? DEFAULT_ROW_HEIGHT, [rowHeights]);

  const setColWidth = useCallback((col, w) => {
    setColWidthsState(p => ({ ...p, [col]: Math.max(30, Math.round(w)) }));
  }, []);

  const setRowHeight = useCallback((row, h) => {
    setRowHeightsState(p => ({ ...p, [row]: Math.max(14, Math.round(h)) }));
  }, []);

  const getCellFormat = useCallback((row, col) => {
    return formats[`${row}-${col}`] || {};
  }, [formats]);

  const getCellDisplay = useCallback(
    (row, col, cells) => {
      const c = cells || currentCells;
      const key = `${row}-${col}`;
      const cell = c[key];
      if (!cell) return '';
      const val = cell.value;
      let raw;
      if (typeof val === 'string' && val.startsWith('=')) {
        const result = evaluateFormula(val, c);
        raw = result === undefined ? '' : result;
      } else {
        raw = val ?? '';
      }
      // Apply number format
      const fmt = formats[key];
      if (fmt?.numberFormat && fmt.numberFormat !== 'general' && raw !== '' && !isNaN(Number(raw))) {
        const n = Number(raw);
        switch (fmt.numberFormat) {
          case 'number': return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          case 'currency': return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
          case 'percent': return (n / 100).toLocaleString('en-US', { style: 'percent', minimumFractionDigits: 2 });
          case 'integer': return Math.round(n).toLocaleString('en-US');
        }
      }
      return String(raw);
    },
    [currentCells, formats]
  );

  const setCellValue = useCallback((row, col, value) => {
    setSheets(prev => prev.map((s, i) => {
      if (i !== activeSheet) return s;
      const key = `${row}-${col}`;
      const cells = { ...s.cells };
      if (value === '' || value === undefined || value === null) {
        delete cells[key];
      } else {
        cells[key] = { value };
      }
      return { ...s, cells };
    }));
  }, [activeSheet]);

  const setCellFormat = useCallback((row, col, fmt) => {
    const key = `${row}-${col}`;
    setFormats(prev => ({ ...prev, [key]: { ...(prev[key] || {}), ...fmt } }));
  }, []);

  const setRangeFormat = useCallback((r1, c1, r2, c2, fmt) => {
    setFormats(prev => {
      const updated = { ...prev };
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
          const key = `${r}-${c}`;
          updated[key] = { ...(updated[key] || {}), ...fmt };
        }
      }
      return updated;
    });
  }, []);

  const addSheet = useCallback(() => {
    setSheets(prev => [...prev, createEmptySheet(`Sheet${prev.length + 1}`)]);
    setActiveSheet(prev => prev + 1);
  }, []);

  const getSheetData = useCallback(() => {
    const cells = currentCells;
    const usedKeys = Object.keys(cells);
    if (usedKeys.length === 0) return [];
    let maxRow = 0, maxCol = 0;
    usedKeys.forEach(key => {
      const [r, c] = key.split('-').map(Number);
      if (r > maxRow) maxRow = r;
      if (c > maxCol) maxCol = c;
    });
    const data = [];
    for (let r = 0; r <= Math.min(maxRow, ROWS - 1); r++) {
      const row = [];
      for (let c = 0; c <= Math.min(maxCol, COLS - 1); c++) {
        row.push(getCellDisplay(r, c, cells));
      }
      data.push(row);
    }
    return data;
  }, [currentCells, getCellDisplay]);

  const applyAICells = useCallback((cellUpdates) => {
    setSheets(prev => prev.map((s, i) => {
      if (i !== activeSheet) return s;
      const cells = { ...s.cells };
      for (const [ref, value] of Object.entries(cellUpdates)) {
        const match = ref.match(/^([A-Z]+)(\d+)$/);
        if (!match) continue;
        const col = match[1].split('').reduce((a, c) => a * 26 + (c.charCodeAt(0) - 64), 0) - 1;
        const row = parseInt(match[2], 10) - 1;
        if (row < 0 || row >= ROWS || col < 0 || col >= COLS) continue;
        const key = `${row}-${col}`;
        if (value === '' || value === null) delete cells[key];
        else cells[key] = { value: String(value) };
      }
      return { ...s, cells };
    }));
  }, [activeSheet]);

  const importXLSX = useCallback((arrayBuffer) => {
    try {
      const wb = XLSX.read(arrayBuffer, { type: 'array' });
      // Load all sheets
      setSheets(prev => {
        const newSheets = wb.SheetNames.map(name => {
          const ws = wb.Sheets[name];
          const json = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
          const cells = {};
          json.forEach((row, ri) => {
            if (ri >= ROWS) return;
            (row || []).forEach((val, ci) => {
              if (ci < COLS && val !== '') {
                const v = String(val).trim();
                if (v) cells[`${ri}-${ci}`] = { value: v };
              }
            });
          });
          return { name, cells };
        });
        return newSheets.length > 0 ? newSheets : prev;
      });
      setActiveSheet(0);
    } catch (err) {
      console.error('XLSX import error:', err);
    }
  }, []);

  const exportCSV = useCallback(() => {
    const cells = currentCells;
    const usedKeys = Object.keys(cells);
    if (!usedKeys.length) return;
    let maxRow = 0, maxCol = 0;
    usedKeys.forEach(k => { const [r,c]=k.split('-').map(Number); if(r>maxRow)maxRow=r; if(c>maxCol)maxCol=c; });
    const rows = [];
    for (let r = 0; r <= maxRow; r++) {
      const row = [];
      for (let c = 0; c <= maxCol; c++) {
        const v = getCellDisplay(r, c, cells);
        row.push(v.includes(',') || v.includes('"') ? `"${v.replace(/"/g,'""')}"` : v);
      }
      rows.push(row.join(','));
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'gridwise.csv'; a.click();
    URL.revokeObjectURL(url);
  }, [currentCells, getCellDisplay]);

  const importCSV = useCallback((text) => {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    const newCells = {};
    lines.forEach((line, ri) => {
      if (ri >= ROWS) return;
      parseCSVLine(line).forEach((val, ci) => {
        if (ci < COLS && val.trim()) {
          newCells[`${ri}-${ci}`] = { value: val.trim() };
        }
      });
    });
    setSheets(prev => prev.map((s, i) => i === activeSheet ? { ...s, cells: newCells } : s));
  }, [activeSheet]);

  const copySelection = useCallback((cut = false) => {
    const r = selectionRange ?? { startRow: selected.row, startCol: selected.col, endRow: selected.row, endCol: selected.col };
    const data = [];
    for (let ri = r.startRow; ri <= r.endRow; ri++) {
      const row = [];
      for (let ci = r.startCol; ci <= r.endCol; ci++) {
        row.push(currentCells[`${ri}-${ci}`]?.value ?? '');
      }
      data.push(row);
    }
    setClipboard({ data, cut });
    if (cut) {
      setSheets(prev => prev.map((s, i) => {
        if (i !== activeSheet) return s;
        const cells = { ...s.cells };
        for (let ri = r.startRow; ri <= r.endRow; ri++)
          for (let ci = r.startCol; ci <= r.endCol; ci++)
            delete cells[`${ri}-${ci}`];
        return { ...s, cells };
      }));
    }
  }, [selected, selectionRange, currentCells, activeSheet]);

  const pasteSelection = useCallback(() => {
    if (!clipboard) return;
    const { data } = clipboard;
    setSheets(prev => prev.map((s, i) => {
      if (i !== activeSheet) return s;
      const cells = { ...s.cells };
      data.forEach((row, ri) => {
        row.forEach((val, ci) => {
          const r = selected.row + ri, c = selected.col + ci;
          if (r < ROWS && c < COLS) {
            if (!val) delete cells[`${r}-${c}`];
            else cells[`${r}-${c}`] = { value: val };
          }
        });
      });
      return { ...s, cells };
    }));
  }, [clipboard, selected, activeSheet]);

  const getStatusBarInfo = useCallback(() => {
    let vals = [];
    if (selectionRange) {
      const { startRow, startCol, endRow, endCol } = selectionRange;
      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          const d = getCellDisplay(r, c, currentCells);
          const n = Number(d);
          if (!isNaN(n) && d !== '') vals.push(n);
        }
      }
    } else {
      vals = Object.values(currentCells).map(c => Number(c.value)).filter(n => !isNaN(n));
    }
    if (!vals.length) return null;
    const sum = vals.reduce((a, b) => a + b, 0);
    return { count: vals.length, sum: +sum.toFixed(6), average: +(sum / vals.length).toFixed(6) };
  }, [currentCells, selectionRange, getCellDisplay]);

  return {
    sheets, activeSheet, setActiveSheet,
    currentCells, selected, setSelected,
    editing, setEditing,
    getCellDisplay, setCellValue,
    formats, getCellFormat, setCellFormat, setRangeFormat,
    colWidths, rowHeights, getColWidth, getRowHeight, setColWidth, setRowHeight,
    selectionRange, setSelectionRange,
    clipboard, copySelection, pasteSelection,
    addSheet, getSheetData, applyAICells, importCSV, importXLSX, exportCSV,
    getStatusBarInfo,
    ROWS, COLS,
  };
}
