// GridWise Formula Engine — supports 40+ Excel-compatible functions

const COL_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function colIndexToLetter(idx) { return COL_LETTERS[idx] || ''; }

export function cellRefToIndex(ref) {
  const match = ref.replace(/\$/g, '').match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  const col = match[1].split('').reduce((a, c) => a * 26 + (c.charCodeAt(0) - 64), 0) - 1;
  return { col, row: parseInt(match[2], 10) - 1 };
}

// ── Core cell access ──────────────────────────────────────────────────────────

export function getCellValue(cells, ref) {
  const idx = cellRefToIndex(ref);
  if (!idx) return 0;
  const raw = cells[`${idx.row}-${idx.col}`]?.value ?? '';
  if (!raw) return 0;
  if (typeof raw === 'string' && raw.startsWith('=')) {
    const r = evaluateFormula(raw, cells);
    const n = Number(r);
    return isNaN(n) ? (r ?? 0) : n;
  }
  const n = Number(raw);
  return isNaN(n) ? raw : n;
}

function getCellRange(cells, r1, r2) {
  const s = cellRefToIndex(r1), e = cellRefToIndex(r2);
  if (!s || !e) return [];
  const out = [];
  for (let r = s.row; r <= e.row; r++)
    for (let c = s.col; c <= e.col; c++) {
      const raw = cells[`${r}-${c}`]?.value ?? '';
      if (raw === '') continue;
      out.push(typeof raw === 'string' && raw.startsWith('=') ? evaluateFormula(raw, cells) : raw);
    }
  return out;
}

function getNumRange(cells, r1, r2) {
  return getCellRange(cells, r1, r2).map(Number).filter(n => !isNaN(n));
}

// ── Argument helpers ──────────────────────────────────────────────────────────

// Split fn arguments respecting nested parens and quoted strings
function splitArgs(str) {
  const args = []; let cur = '', depth = 0, inStr = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (inStr)      { cur += ch; if (ch === '"') inStr = false; }
    else if (ch === '"') { inStr = true; cur += ch; }
    else if (ch === '(') { depth++; cur += ch; }
    else if (ch === ')') { depth--; cur += ch; }
    else if (ch === ',' && depth === 0) { args.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  if (cur.trim() !== '') args.push(cur.trim());
  return args;
}

function isRangeRef(arg) { return /^\$?[A-Z]+\$?\d+:\$?[A-Z]+\$?\d+$/.test(arg.trim()); }

function cleanRef(r) { return r.replace(/\$/g, ''); }

function getNumArgs(arg, cells) {
  if (isRangeRef(arg)) {
    const [r1, r2] = arg.trim().split(':').map(cleanRef);
    return getNumRange(cells, r1, r2);
  }
  const v = evalExpr(arg, cells);
  const n = Number(v);
  return isNaN(n) ? [] : [n];
}

function getAllArgs(arg, cells) {
  if (isRangeRef(arg)) {
    const [r1, r2] = arg.trim().split(':').map(cleanRef);
    return getCellRange(cells, r1, r2);
  }
  return [evalExpr(arg, cells)];
}

// ── Expression evaluator ──────────────────────────────────────────────────────

function evalExpr(expr, cells) {
  expr = expr.trim();
  if (!expr) return 0;
  if (expr.startsWith('"') && expr.endsWith('"')) return expr.slice(1, -1);
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(expr)) return Number(expr);
  const up = expr.toUpperCase();
  if (up === 'TRUE') return true;
  if (up === 'FALSE') return false;
  if (/^\$?[A-Z]+\$?\d+$/.test(expr)) return getCellValue(cells, cleanRef(expr));

  // Outermost function call: NAME(…)
  const fnM = expr.match(/^([A-Z_][A-Z_0-9]*)\s*\((.*)\)$/s);
  if (fnM) return evalFn(fnM[1].toUpperCase(), fnM[2], cells);

  return evalArith(expr, cells);
}

// Evaluate arithmetic / comparison expressions with function pre-processing
function evalArith(expr, cells) {
  let s = expr;

  // 1. Replace innermost function calls iteratively (inside-out)
  for (let i = 0; i < 200; i++) {
    const m = s.match(/([A-Z_][A-Z_0-9]*)\(([^()]*)\)/);
    if (!m) break;
    const r = evalFn(m[1].toUpperCase(), m[2], cells);
    const rep = r === null || r === undefined ? '""'
      : typeof r === 'boolean' ? String(r)
      : typeof r === 'string' ? JSON.stringify(r)
      : String(r);
    s = s.slice(0, m.index) + rep + s.slice(m.index + m[0].length);
  }

  // 2. Char-by-char: replace cell refs & translate operators to JS
  let js = ''; let i = 0;
  while (i < s.length) {
    if (s[i] === '"') {                          // string literal
      let j = i + 1;
      while (j < s.length && s[j] !== '"') j++;
      js += s.slice(i, j + 1); i = j + 1;
    } else {
      const cr = s.slice(i).match(/^(\$?[A-Z]+\$?\d+)/);
      if (cr && !s.slice(i + cr[1].length).trimStart().startsWith('(')) {
        const v = getCellValue(cells, cleanRef(cr[1]));
        js += typeof v === 'string' ? JSON.stringify(v) : String(v);
        i += cr[1].length;
      } else if (s.slice(i, i+2) === '<>') { js += '!=='; i += 2; }
      else if (s.slice(i, i+2) === '>=') { js += '>=';  i += 2; }
      else if (s.slice(i, i+2) === '<=') { js += '<=';  i += 2; }
      else if (s[i] === '=' && (i === 0 || !'!<>='.includes(s[i-1]))) { js += '==='; i++; }
      else if (s[i] === '^') { js += '**'; i++; }
      else if (s[i] === '&') { js += '+';  i++; }
      else { js += s[i]; i++; }
    }
  }

  try {
    // eslint-disable-next-line no-new-func
    const r = Function('"use strict";return(' + js + ')')();
    if (typeof r === 'number') return Number.isFinite(r) ? r : '#DIV/0!';
    return r;
  } catch { return '#ERROR!'; }
}

// ── CRITERIA matching (for COUNTIF/SUMIF) ────────────────────────────────────

function matchCriteria(val, crit) {
  if (typeof crit === 'string') {
    const op = crit.match(/^(>=|<=|<>|>|<|=)(.*)/);
    if (op) {
      const n = Number(op[2]); const v = Number(val);
      switch (op[1]) {
        case '>':  return !isNaN(v) && v > n;
        case '<':  return !isNaN(v) && v < n;
        case '>=': return !isNaN(v) && v >= n;
        case '<=': return !isNaN(v) && v <= n;
        case '<>': return String(val) !== op[2];
        case '=':  return String(val) === op[2];
      }
    }
    if (crit.includes('*') || crit.includes('?')) {
      const re = new RegExp('^' + crit.replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
      return re.test(String(val));
    }
    return String(val).toLowerCase() === crit.toLowerCase();
  }
  return val == crit;
}

// ── Function library ──────────────────────────────────────────────────────────

function evalFn(name, argsStr, cells) {
  const args = splitArgs(argsStr);
  const ea   = a => evalExpr(a, cells);
  const en   = a => Number(ea(a));
  const nums = (...as) => as.flatMap(a => getNumArgs(a, cells));
  const all  = (...as) => as.flatMap(a => getAllArgs(a, cells));

  switch (name) {
    // ── Aggregation ────────────────────────────────────────────────────────
    case 'SUM':     return nums(...args).reduce((a, b) => a + b, 0);
    case 'AVERAGE': case 'AVG': { const v = nums(...args); return v.length ? v.reduce((a,b)=>a+b,0)/v.length : 0; }
    case 'MAX':     { const v = nums(...args); return v.length ? Math.max(...v) : 0; }
    case 'MIN':     { const v = nums(...args); return v.length ? Math.min(...v) : 0; }
    case 'COUNT':   return nums(...args).length;
    case 'COUNTA':  return all(...args).filter(v => v !== '' && v != null).length;
    case 'COUNTBLANK': return all(...args).filter(v => v === '' || v == null).length;
    case 'PRODUCT': return nums(...args).reduce((a, b) => a * b, 1);
    case 'SUMPRODUCT': {
      // SUMPRODUCT(array1, array2)
      const arrs = args.map(a => getNumArgs(a, cells));
      const len = Math.min(...arrs.map(a => a.length));
      let sum = 0;
      for (let i = 0; i < len; i++) sum += arrs.reduce((p, a) => p * a[i], 1);
      return sum;
    }
    case 'LARGE': { const v = nums(args[0]); const k = en(args[1]); return v.sort((a,b)=>b-a)[k-1] ?? '#NUM!'; }
    case 'SMALL': { const v = nums(args[0]); const k = en(args[1]); return v.sort((a,b)=>a-b)[k-1] ?? '#NUM!'; }

    // ── Conditional aggregation ────────────────────────────────────────────
    case 'SUMIF': case 'COUNTIF': {
      if (!isRangeRef(args[0])) return '#VALUE!';
      const [r1, r2] = args[0].trim().split(':').map(cleanRef);
      const crit = ea(args[1]);
      const rangeVals = getCellRange(cells, r1, r2);
      if (name === 'COUNTIF') return rangeVals.filter(v => matchCriteria(v, crit)).length;
      const sumVals = args[2] && isRangeRef(args[2])
        ? getCellRange(cells, ...args[2].trim().split(':').map(cleanRef))
        : rangeVals;
      return rangeVals.reduce((s, v, i) => matchCriteria(v, crit) ? s + (Number(sumVals[i]) || 0) : s, 0);
    }
    case 'AVERAGEIF': {
      if (!isRangeRef(args[0])) return '#VALUE!';
      const [r1, r2] = args[0].trim().split(':').map(cleanRef);
      const crit = ea(args[1]);
      const rangeVals = getCellRange(cells, r1, r2);
      const nums2 = rangeVals.filter(v => matchCriteria(v, crit)).map(Number).filter(n => !isNaN(n));
      return nums2.length ? nums2.reduce((a,b)=>a+b,0)/nums2.length : 0;
    }

    // ── Logic ─────────────────────────────────────────────────────────────
    case 'IF': {
      const c = ea(args[0]);
      const t = c === true || (typeof c === 'number' && c !== 0) || (typeof c === 'string' && c && c !== '0' && c !== 'FALSE');
      return t ? ea(args[1] ?? '"TRUE"') : ea(args[2] ?? '""');
    }
    case 'IFS': {
      for (let i = 0; i + 1 < args.length; i += 2) {
        const c = ea(args[i]);
        if (c === true || (typeof c === 'number' && c !== 0)) return ea(args[i+1]);
      }
      return '#N/A';
    }
    case 'IFERROR': {
      try {
        const r = ea(args[0] ?? '""');
        return (typeof r === 'string' && r.startsWith('#')) ? ea(args[1] ?? '""') : r;
      } catch { return ea(args[1] ?? '""'); }
    }
    case 'IFNA': {
      const r = ea(args[0]);
      return r === '#N/A' ? ea(args[1] ?? '""') : r;
    }
    case 'AND': return args.every(a => { const v = ea(a); return v === true || (typeof v === 'number' && v !== 0); });
    case 'OR':  return args.some(a  => { const v = ea(a); return v === true || (typeof v === 'number' && v !== 0); });
    case 'NOT': { const v = ea(args[0]); return !(v === true || (typeof v === 'number' && v !== 0)); }
    case 'XOR': {
      let t = 0;
      args.forEach(a => { const v = ea(a); if (v === true || (typeof v === 'number' && v !== 0)) t++; });
      return t % 2 === 1;
    }

    // ── Type checks ────────────────────────────────────────────────────────
    case 'ISERROR': { const v = ea(args[0]); return typeof v === 'string' && v.startsWith('#'); }
    case 'ISBLANK': {
      const m = args[0]?.trim().match(/^\$?([A-Z]+\$?\d+)$/);
      if (m) { const idx = cellRefToIndex(cleanRef(m[1])); return idx ? !(cells[`${idx.row}-${idx.col}`]?.value) : true; }
      return false;
    }
    case 'ISNUMBER': { const v = ea(args[0]); return typeof v === 'number' || (!isNaN(Number(v)) && String(v).trim() !== ''); }
    case 'ISTEXT':   { const v = ea(args[0]); return typeof v === 'string' && isNaN(Number(v)); }

    // ── String ─────────────────────────────────────────────────────────────
    case 'CONCATENATE': case 'CONCAT': return args.map(a => all(a).map(String).join('')).join('');
    case 'TEXTJOIN': {
      const [delimArg, ignoreArg, ...rest] = args;
      const delim = ea(delimArg);
      const ignore = String(ea(ignoreArg)).toUpperCase() !== 'FALSE';
      const vals = rest.flatMap(a => getAllArgs(a, cells)).map(String);
      return (ignore ? vals.filter(v => v !== '') : vals).join(delim);
    }
    case 'LEN':     return String(ea(args[0])).length;
    case 'LEFT':    { const s = String(ea(args[0])); return s.slice(0, args[1] ? en(args[1]) : 1); }
    case 'RIGHT':   { const s = String(ea(args[0])); const n = args[1] ? en(args[1]) : 1; return s.slice(-n); }
    case 'MID':     { const s = String(ea(args[0])); return s.slice(en(args[1]) - 1, en(args[1]) - 1 + en(args[2])); }
    case 'UPPER':   return String(ea(args[0])).toUpperCase();
    case 'LOWER':   return String(ea(args[0])).toLowerCase();
    case 'PROPER':  return String(ea(args[0])).replace(/\b\w/g, c => c.toUpperCase());
    case 'TRIM':    return String(ea(args[0])).replace(/\s+/g, ' ').trim();
    case 'REPT':    return String(ea(args[0])).repeat(en(args[1]));
    case 'SUBSTITUTE': {
      const [s, old, nw, instArg] = args.map(a => ea(a));
      const str = String(s), olds = String(old), news = String(nw);
      if (instArg !== undefined) {
        let cnt = 0;
        return str.replace(new RegExp(olds.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'), m => ++cnt === Number(instArg) ? news : m);
      }
      return str.split(olds).join(news);
    }
    case 'REPLACE': { const s = String(ea(args[0])); const start = en(args[1])-1, len = en(args[2]); return s.slice(0,start)+String(ea(args[3]))+s.slice(start+len); }
    case 'FIND': case 'SEARCH': {
      const f = String(ea(args[0])), ins = String(ea(args[1])), st = args[2] ? en(args[2])-1 : 0;
      const i = name==='FIND' ? ins.indexOf(f, st) : ins.toLowerCase().indexOf(f.toLowerCase(), st);
      return i === -1 ? '#VALUE!' : i+1;
    }
    case 'VALUE': { const n = Number(String(ea(args[0])).replace(/[,$%]/g,'')); return isNaN(n) ? '#VALUE!' : n; }
    case 'TEXT': { const v = ea(args[0]), fmt = String(ea(args[1])); const n = Number(v); if (!isNaN(n)) { if (fmt.includes('%')) return (n*100).toFixed(2)+'%'; if (/0\.0+/.test(fmt)) { const dec = (fmt.match(/0\.(0+)/)||[])[1]?.length||2; return n.toFixed(dec); } } return String(v); }
    case 'CHAR':   return String.fromCharCode(en(args[0]));
    case 'CODE':   return String(ea(args[0])).charCodeAt(0);
    case 'EXACT':  return String(ea(args[0])) === String(ea(args[1]));
    case 'T':      { const v = ea(args[0]); return typeof v === 'string' ? v : ''; }

    // ── Math ───────────────────────────────────────────────────────────────
    case 'ROUND':     { const v = en(args[0]), d = args[1]?en(args[1]):0; return Math.round(v*10**d)/10**d; }
    case 'ROUNDUP':   { const v = en(args[0]), d = args[1]?en(args[1]):0; return Math.ceil(v*10**d)/10**d; }
    case 'ROUNDDOWN': { const v = en(args[0]), d = args[1]?en(args[1]):0; return Math.floor(v*10**d)/10**d; }
    case 'CEILING':   { const v = en(args[0]), s = en(args[1]); return s===0?'#DIV/0!':Math.ceil(v/s)*s; }
    case 'FLOOR':     { const v = en(args[0]), s = en(args[1]); return s===0?'#DIV/0!':Math.floor(v/s)*s; }
    case 'MROUND':    { const v = en(args[0]), m = en(args[1]); return m===0?'#DIV/0!':Math.round(v/m)*m; }
    case 'INT':    return Math.floor(en(args[0]));
    case 'ABS':    return Math.abs(en(args[0]));
    case 'SIGN':   return Math.sign(en(args[0]));
    case 'MOD':    { const a = en(args[0]), b = en(args[1]); return b===0?'#DIV/0!':a%b; }
    case 'POWER':  return Math.pow(en(args[0]), en(args[1]));
    case 'SQRT':   { const v = en(args[0]); return v<0?'#NUM!':Math.sqrt(v); }
    case 'SQRTPI': { const v = en(args[0]); return v<0?'#NUM!':Math.sqrt(v*Math.PI); }
    case 'LOG':    { const v = en(args[0]), b = args[1]?en(args[1]):10; return v<=0?'#NUM!':Math.log(v)/Math.log(b); }
    case 'LOG10':  { const v = en(args[0]); return v<=0?'#NUM!':Math.log10(v); }
    case 'LN':     { const v = en(args[0]); return v<=0?'#NUM!':Math.log(v); }
    case 'EXP':    return Math.exp(en(args[0]));
    case 'PI':     return Math.PI;
    case 'E':      return Math.E;
    case 'RAND':   return Math.random();
    case 'RANDBETWEEN': { const lo = en(args[0]), hi = en(args[1]); return Math.floor(Math.random()*(hi-lo+1))+lo; }
    case 'FACT':   { const n = en(args[0]); if(n<0)return'#NUM!'; let f=1; for(let i=2;i<=n;i++)f*=i; return f; }
    case 'COMBIN': { const n=en(args[0]),k=en(args[1]); let r=1; for(let i=0;i<k;i++)r=r*(n-i)/(i+1); return Math.round(r); }
    case 'GCD': {
      const gcd = (a,b) => b===0?a:gcd(b,a%b);
      return nums(...args).reduce(gcd);
    }
    case 'LCM': {
      const gcd = (a,b) => b===0?a:gcd(b,a%b);
      return nums(...args).reduce((a,b)=>a*b/gcd(a,b));
    }
    // Trig
    case 'SIN':    return Math.sin(en(args[0]));
    case 'COS':    return Math.cos(en(args[0]));
    case 'TAN':    return Math.tan(en(args[0]));
    case 'ASIN':   return Math.asin(en(args[0]));
    case 'ACOS':   return Math.acos(en(args[0]));
    case 'ATAN':   return Math.atan(en(args[0]));
    case 'ATAN2':  return Math.atan2(en(args[0]), en(args[1]));
    case 'DEGREES': return en(args[0]) * 180 / Math.PI;
    case 'RADIANS': return en(args[0]) * Math.PI / 180;

    // ── Date ──────────────────────────────────────────────────────────────
    case 'TODAY':  return new Date().toLocaleDateString('en-US');
    case 'NOW':    return new Date().toLocaleString('en-US');
    case 'YEAR':   { const d=new Date(ea(args[0])); return isNaN(d)?'#VALUE!':d.getFullYear(); }
    case 'MONTH':  { const d=new Date(ea(args[0])); return isNaN(d)?'#VALUE!':d.getMonth()+1; }
    case 'DAY':    { const d=new Date(ea(args[0])); return isNaN(d)?'#VALUE!':d.getDate(); }
    case 'HOUR':   { const d=new Date(ea(args[0])); return isNaN(d)?'#VALUE!':d.getHours(); }
    case 'MINUTE': { const d=new Date(ea(args[0])); return isNaN(d)?'#VALUE!':d.getMinutes(); }
    case 'DATE':   return new Date(en(args[0]), en(args[1])-1, en(args[2])).toLocaleDateString('en-US');
    case 'DAYS':   { const d1=new Date(ea(args[0])), d2=new Date(ea(args[1])); return Math.round((d1-d2)/(86400000)); }

    // ── Lookup ────────────────────────────────────────────────────────────
    case 'VLOOKUP': {
      const lookupVal = ea(args[0]);
      if (!isRangeRef(args[1])) return '#VALUE!';
      const [r1, r2] = args[1].trim().split(':').map(cleanRef);
      const colIdx = en(args[2]) - 1;
      const exact = args[3] ? String(ea(args[3])).toUpperCase() !== 'FALSE' && ea(args[3]) !== 0 : true;
      const s = cellRefToIndex(r1), e = cellRefToIndex(r2);
      for (let r = s.row; r <= e.row; r++) {
        const cellRaw = cells[`${r}-${s.col}`]?.value ?? '';
        const cellVal = typeof cellRaw === 'string' && cellRaw.startsWith('=') ? evaluateFormula(cellRaw, cells) : cellRaw;
        const match = exact ? String(cellVal) === String(lookupVal) || cellVal == lookupVal
          : Number(cellVal) <= Number(lookupVal);
        if (match) {
          const tc = s.col + colIdx;
          if (tc > e.col) return '#REF!';
          const raw = cells[`${r}-${tc}`]?.value ?? '';
          if (typeof raw === 'string' && raw.startsWith('=')) return evaluateFormula(raw, cells);
          const n = Number(raw); return isNaN(n) ? raw : n;
        }
      }
      return '#N/A';
    }
    case 'HLOOKUP': {
      const lookupVal = ea(args[0]);
      if (!isRangeRef(args[1])) return '#VALUE!';
      const [r1, r2] = args[1].trim().split(':').map(cleanRef);
      const rowIdx = en(args[2]) - 1;
      const s = cellRefToIndex(r1), e = cellRefToIndex(r2);
      for (let c = s.col; c <= e.col; c++) {
        const cellRaw = cells[`${s.row}-${c}`]?.value ?? '';
        const cellVal = typeof cellRaw === 'string' && cellRaw.startsWith('=') ? evaluateFormula(cellRaw, cells) : cellRaw;
        if (String(cellVal) === String(lookupVal) || cellVal == lookupVal) {
          const tr = s.row + rowIdx;
          if (tr > e.row) return '#REF!';
          const raw = cells[`${tr}-${c}`]?.value ?? '';
          if (typeof raw === 'string' && raw.startsWith('=')) return evaluateFormula(raw, cells);
          const n = Number(raw); return isNaN(n) ? raw : n;
        }
      }
      return '#N/A';
    }
    case 'INDEX': {
      if (!isRangeRef(args[0])) return '#VALUE!';
      const [r1, r2] = args[0].trim().split(':').map(cleanRef);
      const s = cellRefToIndex(r1);
      const tr = s.row + en(args[1]) - 1;
      const tc = s.col + (args[2] ? en(args[2]) - 1 : 0);
      const raw = cells[`${tr}-${tc}`]?.value ?? '';
      if (typeof raw === 'string' && raw.startsWith('=')) return evaluateFormula(raw, cells);
      const n = Number(raw); return isNaN(n) ? raw : n;
    }
    case 'MATCH': {
      const lookupVal = ea(args[0]);
      if (!isRangeRef(args[1])) return '#VALUE!';
      const [r1, r2] = args[1].trim().split(':').map(cleanRef);
      const vals = getCellRange(cells, r1, r2);
      const idx = vals.findIndex(v => String(v) === String(lookupVal) || v == lookupVal);
      return idx === -1 ? '#N/A' : idx + 1;
    }
    case 'CHOOSE': {
      const n = en(args[0]);
      return n >= 1 && n < args.length ? ea(args[n]) : '#VALUE!';
    }
    case 'OFFSET': {
      const base = cellRefToIndex(cleanRef(args[0]));
      if (!base) return '#REF!';
      const r = base.row + en(args[1]);
      const c = base.col + en(args[2]);
      const raw = cells[`${r}-${c}`]?.value ?? '';
      if (typeof raw === 'string' && raw.startsWith('=')) return evaluateFormula(raw, cells);
      const n = Number(raw); return isNaN(n) ? raw : n;
    }
    case 'ROW':    { if (!args[0]) return 1; const idx = cellRefToIndex(cleanRef(args[0])); return idx ? idx.row+1 : '#REF!'; }
    case 'COLUMN': { if (!args[0]) return 1; const idx = cellRefToIndex(cleanRef(args[0])); return idx ? idx.col+1 : '#REF!'; }
    case 'ROWS':   { if (!isRangeRef(args[0])) return 1; const [r1,r2]=args[0].split(':').map(s=>cellRefToIndex(cleanRef(s))); return r2.row-r1.row+1; }
    case 'COLUMNS':{ if (!isRangeRef(args[0])) return 1; const [r1,r2]=args[0].split(':').map(s=>cellRefToIndex(cleanRef(s))); return r2.col-r1.col+1; }

    // ── Statistical ────────────────────────────────────────────────────────
    case 'MEDIAN': {
      const v = nums(...args).sort((a,b)=>a-b);
      const m = Math.floor(v.length/2);
      return v.length%2 ? v[m] : (v[m-1]+v[m])/2;
    }
    case 'MODE': {
      const v = nums(...args);
      const freq = {}; v.forEach(n => freq[n]=(freq[n]||0)+1);
      return v.reduce((a,b) => (freq[b]||0)>(freq[a]||0)?b:a, v[0]) ?? '#N/A';
    }
    case 'STDEV': case 'STDEVS': {
      const v = nums(...args); if (v.length<2) return '#DIV/0!';
      const mean = v.reduce((a,b)=>a+b,0)/v.length;
      return Math.sqrt(v.reduce((a,b)=>a+(b-mean)**2,0)/(v.length-1));
    }
    case 'STDEVP': {
      const v = nums(...args); if (!v.length) return '#DIV/0!';
      const mean = v.reduce((a,b)=>a+b,0)/v.length;
      return Math.sqrt(v.reduce((a,b)=>a+(b-mean)**2,0)/v.length);
    }
    case 'VAR': case 'VARS': {
      const v = nums(...args); if (v.length<2) return '#DIV/0!';
      const mean = v.reduce((a,b)=>a+b,0)/v.length;
      return v.reduce((a,b)=>a+(b-mean)**2,0)/(v.length-1);
    }
    case 'PERCENTILE': {
      const v = nums(args[0]).sort((a,b)=>a-b), k = en(args[1]);
      const idx = k*(v.length-1), lo = Math.floor(idx);
      return lo>=v.length-1 ? v[v.length-1] : v[lo]+(idx-lo)*(v[lo+1]-v[lo]);
    }
    case 'RANK': {
      const val = en(args[0]);
      const v = getNumArgs(args[1], cells);
      const order = args[2] ? en(args[2]) : 0;
      const sorted = [...v].sort((a,b) => order===0 ? b-a : a-b);
      return sorted.indexOf(val)+1;
    }

    default: return '#NAME?';
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function evaluateFormula(formula, cells) {
  if (!formula || !formula.startsWith('=')) return formula;
  try {
    const r = evalExpr(formula.slice(1).trim(), cells);
    if (r === null || r === undefined) return '';
    if (typeof r === 'boolean') return r ? 'TRUE' : 'FALSE';
    return r;
  } catch { return '#ERROR!'; }
}
