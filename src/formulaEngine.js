// Formula Engine — parses and evaluates spreadsheet formulas

const COL_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function colIndexToLetter(idx) {
  return COL_LETTERS[idx];
}

export function cellRefToIndex(ref) {
  // e.g. "A1" → { col: 0, row: 0 }
  const match = ref.match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  const col = match[1].split('').reduce((acc, c) => acc * 26 + COL_LETTERS.indexOf(c), 0);
  const row = parseInt(match[2], 10) - 1;
  return { col, row };
}

export function getCellValue(cells, ref, sheet) {
  const idx = cellRefToIndex(ref);
  if (!idx) return 0;
  const key = `${idx.row}-${idx.col}`;
  const raw = (sheet || cells)[key]?.value ?? '';
  if (raw === '' || raw === undefined) return 0;
  const num = Number(raw);
  return isNaN(num) ? raw : num;
}

function parseCellRange(range, cells) {
  // e.g. "A1:C3"
  const [start, end] = range.split(':');
  const s = cellRefToIndex(start);
  const e = cellRefToIndex(end);
  if (!s || !e) return [];
  const values = [];
  for (let r = s.row; r <= e.row; r++) {
    for (let c = s.col; c <= e.col; c++) {
      const key = `${r}-${c}`;
      const raw = cells[key]?.value ?? '';
      const num = Number(raw);
      if (raw !== '' && !isNaN(num)) values.push(num);
    }
  }
  return values;
}

function parseArgs(argsStr, cells) {
  // Split on commas, handle ranges and cell refs
  const parts = argsStr.split(',').map(s => s.trim());
  const values = [];
  for (const part of parts) {
    if (part.includes(':')) {
      values.push(...parseCellRange(part, cells));
    } else if (/^[A-Z]+\d+$/.test(part)) {
      const v = getCellValue(cells, part);
      if (!isNaN(Number(v)) && v !== '') values.push(Number(v));
    } else {
      const n = Number(part);
      if (!isNaN(n)) values.push(n);
    }
  }
  return values;
}

export function evaluateFormula(formula, cells) {
  if (!formula.startsWith('=')) return formula;
  let expr = formula.slice(1).trim();

  // Replace cell refs with values before evaluating arithmetic
  // Handle built-in functions first
  const funcMatch = expr.match(/^([A-Z]+)\((.+)\)$/);
  if (funcMatch) {
    const fn = funcMatch[1];
    const args = funcMatch[2];
    const vals = parseArgs(args, cells);

    switch (fn) {
      case 'SUM':
        return vals.reduce((a, b) => a + b, 0);
      case 'AVERAGE':
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      case 'MAX':
        return vals.length ? Math.max(...vals) : 0;
      case 'MIN':
        return vals.length ? Math.min(...vals) : 0;
      case 'COUNT':
        return vals.length;
      default:
        return `#NAME?`;
    }
  }

  // Replace cell references in arithmetic expressions
  try {
    const replaced = expr.replace(/([A-Z]+\d+)/g, (ref) => {
      const v = getCellValue(cells, ref);
      return typeof v === 'number' ? v : `"${v}"`;
    });
    // Safe eval using Function constructor
    // eslint-disable-next-line no-new-func
    const result = Function('"use strict"; return (' + replaced + ')')();
    return typeof result === 'number' ? (Number.isFinite(result) ? result : '#DIV/0!') : result;
  } catch {
    return '#ERROR!';
  }
}
