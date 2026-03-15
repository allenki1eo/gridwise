import { useState, useCallback } from 'react';
import { evaluateFormula } from './formulaEngine';

const ROWS = 50;
const COLS = 26;

function createEmptySheet(name) {
  return { name, cells: {} };
}

export function useSpreadsheet() {
  const [sheets, setSheets] = useState([createEmptySheet('Sheet1')]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [selected, setSelected] = useState({ row: 0, col: 0 });
  const [editing, setEditing] = useState(false);

  const currentCells = sheets[activeSheet].cells;

  const getCellDisplay = useCallback(
    (row, col, cells) => {
      const c = cells || currentCells;
      const key = `${row}-${col}`;
      const cell = c[key];
      if (!cell) return '';
      const val = cell.value;
      if (typeof val === 'string' && val.startsWith('=')) {
        const result = evaluateFormula(val, c);
        return result === undefined ? '' : String(result);
      }
      return val ?? '';
    },
    [currentCells]
  );

  const setCellValue = useCallback(
    (row, col, value) => {
      setSheets(prev => {
        const updated = prev.map((s, i) => {
          if (i !== activeSheet) return s;
          const key = `${row}-${col}`;
          const cells = { ...s.cells };
          if (value === '' || value === undefined) {
            delete cells[key];
          } else {
            cells[key] = { value };
          }
          return { ...s, cells };
        });
        return updated;
      });
    },
    [activeSheet]
  );

  const addSheet = useCallback(() => {
    setSheets(prev => {
      const name = `Sheet${prev.length + 1}`;
      return [...prev, createEmptySheet(name)];
    });
    setActiveSheet(prev => prev + 1);
  }, []);

  const getSheetData = useCallback(() => {
    // Returns a 2D array for AI context
    const data = [];
    const cells = currentCells;
    const usedKeys = Object.keys(cells);
    if (usedKeys.length === 0) return [];

    let maxRow = 0;
    let maxCol = 0;
    usedKeys.forEach(key => {
      const [r, c] = key.split('-').map(Number);
      if (r > maxRow) maxRow = r;
      if (c > maxCol) maxCol = c;
    });

    for (let r = 0; r <= Math.min(maxRow, ROWS - 1); r++) {
      const row = [];
      for (let c = 0; c <= Math.min(maxCol, COLS - 1); c++) {
        row.push(getCellDisplay(r, c, cells));
      }
      data.push(row);
    }
    return data;
  }, [currentCells, getCellDisplay]);

  const applyAICells = useCallback(
    (cellUpdates) => {
      // cellUpdates: { "A1": "value", "B2": "=SUM(A1:A5)", ... }
      setSheets(prev => {
        const updated = prev.map((s, i) => {
          if (i !== activeSheet) return s;
          const cells = { ...s.cells };
          for (const [ref, value] of Object.entries(cellUpdates)) {
            const match = ref.match(/^([A-Z]+)(\d+)$/);
            if (!match) continue;
            const col = match[1].charCodeAt(0) - 65;
            const row = parseInt(match[2], 10) - 1;
            if (row < 0 || row >= ROWS || col < 0 || col >= COLS) continue;
            const key = `${row}-${col}`;
            if (value === '' || value === null) {
              delete cells[key];
            } else {
              cells[key] = { value: String(value) };
            }
          }
          return { ...s, cells };
        });
        return updated;
      });
    },
    [activeSheet]
  );

  const getStatusBarInfo = useCallback(() => {
    const vals = Object.values(currentCells)
      .map(c => Number(c.value))
      .filter(n => !isNaN(n));
    if (vals.length === 0) return null;
    const sum = vals.reduce((a, b) => a + b, 0);
    const avg = sum / vals.length;
    return {
      count: vals.length,
      sum: Math.round(sum * 1e6) / 1e6,
      average: Math.round(avg * 1e6) / 1e6,
    };
  }, [currentCells]);

  return {
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
  };
}
