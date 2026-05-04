import { moveInstrumentation } from '../../scripts/scripts.js';

// Maps sorted field IDs to the config.json key for the formula
const FIELD_KEY_MAP = {
  'P,i,n': 'monthly-payment',
  'A,i,n': 'loan-balance',
  'A,P,i': 'term-period-monthly',
  'B,C,D,E,F,G,H': 'working-capital-needs',
};

// Supported math functions in formulas
const MATH_FUNS = {
  ln: Math.log,
  log: Math.log,
  exp: Math.exp,
  sqrt: Math.sqrt,
  abs: Math.abs,
};

// Normalise informal math notation before substitution:
//  - [ ] → ( )
//  - lnA  → ln(A)   (function name immediately followed by a variable letter)
//  - Pi   → P*i     (two adjacent variable letters, implicit multiplication)
function normalizeFormula(formula, varIds) {
  let f = formula.replace(/\[/g, '(').replace(/\]/g, ')');

  Object.keys(MATH_FUNS).forEach((fn) => {
    varIds.forEach((v) => {
      f = f.replace(new RegExp(`\\b${fn}${v}\\b`, 'g'), `${fn}(${v})`);
    });
  });

  const sorted = [...varIds].sort((a, b) => b.length - a.length);
  sorted.forEach((v1) => {
    sorted.forEach((v2) => {
      if (v1 !== v2) {
        f = f.replace(new RegExp(`(?<![a-zA-Z])${v1}${v2}(?![a-zA-Z])`, 'g'), `${v1}*${v2}`);
      }
    });
  });

  return f;
}

// CSP-safe math expression parser — no eval / new Function used.
function safeEval(expr) {
  const tokens = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i += 1;
    } else if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(expr[i + 1] || ''))) {
      let num = '';
      while (i < expr.length && /[0-9.]/.test(expr[i])) { num += expr[i]; i += 1; }
      tokens.push({ t: 'n', v: parseFloat(num) });
    } else if (ch === '*' && expr[i + 1] === '*') {
      tokens.push({ t: 'o', v: '**' }); i += 2;
    } else if (/[a-zA-Z]/.test(ch)) {
      let name = '';
      while (i < expr.length && /[a-zA-Z]/.test(expr[i])) { name += expr[i]; i += 1; }
      tokens.push({ t: 'fn', v: name });
    } else if (ch === '(') {
      tokens.push({ t: '(', v: ch }); i += 1;
    } else if (ch === ')') {
      tokens.push({ t: ')', v: ch }); i += 1;
    } else if ('+-*/'.includes(ch)) {
      tokens.push({ t: 'o', v: ch }); i += 1;
    } else {
      throw new Error(`Unexpected: ${ch}`);
    }
  }

  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++]; // eslint-disable-line no-plusplus

  function primary() {
    const tok = peek();
    if (!tok) throw new Error('Unexpected end of expression');
    if (tok.t === 'n') { next(); return tok.v; }
    if (tok.t === 'fn') {
      next();
      const fn = MATH_FUNS[tok.v];
      if (!fn) throw new Error(`Unknown function: ${tok.v}`);
      if (peek()?.t !== '(') throw new Error(`Expected ( after ${tok.v}`);
      next();
      const arg = addSub(); // eslint-disable-line no-use-before-define
      if (peek()?.t !== ')') throw new Error(`Missing ) after ${tok.v}(`);
      next();
      return fn(arg);
    }
    if (tok.t === '(') {
      next();
      const val = addSub(); // eslint-disable-line no-use-before-define
      if (peek()?.t !== ')') throw new Error('Missing closing )');
      next();
      return val;
    }
    throw new Error(`Unexpected token: ${tok.v}`);
  }

  function unary() {
    if (peek()?.t === 'o' && (peek().v === '-' || peek().v === '+')) {
      const op = next().v;
      return op === '-' ? -primary() : primary();
    }
    return primary();
  }

  function power() {
    const base = unary();
    if (peek()?.t === 'o' && peek().v === '**') {
      next();
      return base ** power();
    }
    return base;
  }

  function mulDiv() {
    let left = power();
    for (;;) { // eslint-disable-line no-constant-condition
      if (peek()?.t === 'o' && (peek().v === '*' || peek().v === '/')) {
        const op = next().v;
        left = op === '*' ? left * power() : left / power();
      } else if (peek()?.t === '(' || peek()?.t === 'fn') {
        left *= power(); // implicit multiplication: a(b+c) or a ln(x)
      } else {
        break;
      }
    }
    return left;
  }

  function addSub() {
    let left = mulDiv();
    while (peek()?.t === 'o' && (peek().v === '+' || peek().v === '-')) {
      const op = next().v;
      left = op === '+' ? left + mulDiv() : left - mulDiv();
    }
    return left;
  }

  return addSub();
}

function evaluateFormula(formula, variables) {
  if (!formula) return null;
  const varIds = Object.keys(variables);
  // Strip LHS assignment e.g. "A = " or "WC = "
  let expr = formula.replace(/^\s*\w+\s*=\s*/, '');
  // Normalise informal notation before substitution
  expr = normalizeFormula(expr, varIds);
  // Replace ^ with ** for exponentiation
  expr = expr.replace(/\^/g, '**');
  // Substitute variables, longest names first to avoid partial matches (WC before C)
  const sortedVars = [...varIds].sort((a, b) => b.length - a.length);
  sortedVars.forEach((varName) => {
    const regex = new RegExp(`\\b${varName}\\b`, 'g');
    expr = expr.replace(regex, variables[varName]);
  });
  // Auto-close any unclosed parentheses (tolerate minor authoring mistakes)
  let depth = 0;
  for (let k = 0; k < expr.length; k += 1) {
    if (expr[k] === '(') depth += 1;
    else if (expr[k] === ')') depth -= 1;
  }
  if (depth > 0) expr += ')'.repeat(depth);

  try {
    const result = safeEval(expr);
    // eslint-disable-next-line no-console
    console.log('[SME Calc] formula key:', Object.keys(variables).sort().join(','), '| expr:', expr, '| result:', result);
    return Number.isFinite(result) ? result : null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[SME Calc] parse error:', err.message, '| expr:', expr);
    return null;
  }
}

async function fetchFormulaConfig() {
  try {
    const resp = await fetch('/en/config.json');
    if (!resp.ok) return {};
    const json = await resp.json();
    const map = {};
    (json.data || []).forEach(({ Key, Value }) => { map[Key] = Value; });
    return map;
  } catch {
    return {};
  }
}

function formatResult(template, value) {
  if (value === null) return 'Error';
  const formatted = Number.isInteger(value)
    ? value.toLocaleString()
    : value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (template && template.includes('{{result}}')) return template.replace(/\{\{result\}\}/g, formatted);
  return formatted;
}

// The monthly-payment formula uses n in years (it internally does n*12).
// Users enter n in months, so divide by 12 before evaluation.
function applyInputConversions(variables, key) {
  if (key === 'monthly-payment' && 'n' in variables) {
    return { ...variables, n: variables.n / 12 };
  }
  return variables;
}

async function buildCalculator(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  if (!rows.length) return;

  // In AEM EDS each parent model field renders as its own single-cell row;
  // child items (sme-field) render as multi-cell rows.
  const parentValues = [];
  const fieldRows = []; // each entry: { row, cells }
  rows.forEach((row) => {
    const cells = [...row.querySelectorAll(':scope > div')];
    if (cells.length <= 1) {
      parentValues.push(cells[0]?.textContent.trim() || '');
    } else {
      fieldRows.push({ row, cells });
    }
  });

  // Strip any stale formula values left over from old authored content
  // (old model had a formula field; those strings look like "VAR = expression")
  const filteredParentValues = parentValues.filter((v) => !/^\s*\w+\s*=/.test(v));
  const buttonName = filteredParentValues[0] || 'CALCULATE';
  const resultTemplate = filteredParentValues[1] || '';
  const description = filteredParentValues[2] || '';
  const addToTableButtonName = filteredParentValues[3] || 'ADD TO TABLE';

  const fields = fieldRows.map(({ cells }, idx) => ({
    id: cells[0]?.textContent.trim() || `field${idx + 1}`,
    label: cells[1]?.textContent.trim() || '',
    maxLength: parseInt(cells[2]?.textContent.trim(), 10) || null,
    topText: cells[3]?.textContent.trim() || '',
    bottomText: cells[4]?.textContent.trim() || '',
    valueType: cells[5]?.textContent.trim() || 'decimal',
  }));

  // Determine which config key to use based on the set of field IDs
  const formulaKey = fields.map((f) => f.id).sort().join(',');
  const configKey = FIELD_KEY_MAP[formulaKey] || '';

  // Fetch formula from /en/config.json
  const config = await fetchFormulaConfig();
  const formula = configKey ? (config[configKey] || '') : '';

  block.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'sme-calc-wrapper';

  fields.forEach((field, idx) => {
    const card = document.createElement('div');
    card.className = 'sme-calc-field';
    moveInstrumentation(fieldRows[idx].row, card);

    if (field.topText) {
      const top = document.createElement('span');
      top.className = 'sme-calc-field-top';
      top.textContent = field.topText;
      card.appendChild(top);
    }

    const row = document.createElement('div');
    row.className = 'sme-calc-field-row';

    const label = document.createElement('label');
    label.htmlFor = `sme-${field.id}`;
    label.textContent = field.label;

    const input = document.createElement('input');
    input.type = 'text';
    input.id = `sme-${field.id}`;
    input.dataset.varId = field.id;
    input.inputMode = field.valueType === 'integer' ? 'numeric' : 'decimal';
    if (field.maxLength) input.maxLength = field.maxLength;
    input.placeholder = '0';

    input.addEventListener('input', () => {
      let val = input.value.replace(/[^0-9.]/g, '');
      if (field.valueType === 'integer') val = val.replace(/\./g, '');
      input.value = val;
    });

    row.appendChild(label);
    row.appendChild(input);
    card.appendChild(row);

    if (field.bottomText) {
      const bottom = document.createElement('span');
      bottom.className = 'sme-calc-field-bottom';
      bottom.textContent = field.bottomText;
      card.appendChild(bottom);
    }

    wrapper.appendChild(card);
  });

  const calcBtn = document.createElement('button');
  calcBtn.className = 'sme-calc-btn';
  calcBtn.textContent = buttonName;

  const resultBox = document.createElement('div');
  resultBox.className = 'sme-calc-result';
  const resultLabel = document.createElement('span');
  resultLabel.className = 'sme-calc-result-label';
  resultLabel.textContent = `Result value: ${resultTemplate || '0.00'}`;
  resultBox.appendChild(resultLabel);

  const descEl = document.createElement('p');
  descEl.className = 'sme-calc-description';
  descEl.textContent = description;

  const addTableBtn = document.createElement('button');
  addTableBtn.className = 'sme-calc-add-table-btn';
  addTableBtn.textContent = addToTableButtonName;

  const tableSection = document.createElement('div');
  tableSection.className = 'sme-calc-table-section';
  tableSection.hidden = true;

  const table = document.createElement('table');
  table.className = 'sme-calc-table';
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  fields.forEach((field) => {
    const th = document.createElement('th');
    th.textContent = field.label || field.id;
    headerRow.appendChild(th);
  });
  const resultTh = document.createElement('th');
  resultTh.textContent = 'Result';
  headerRow.appendChild(resultTh);
  thead.appendChild(headerRow);
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  table.appendChild(tbody);
  tableSection.appendChild(table);

  let lastResult = null;

  calcBtn.addEventListener('click', () => {
    const rawVars = {};
    fields.forEach((field) => {
      const input = wrapper.querySelector(`#sme-${field.id}`);
      rawVars[field.id] = parseFloat(input?.value) || 0;
    });
    const variables = applyInputConversions(rawVars, configKey);
    lastResult = evaluateFormula(formula, variables);
    resultLabel.textContent = `Result value: ${formatResult(resultTemplate, lastResult)}`;
    resultBox.classList.toggle('sme-calc-result-error', lastResult === null);
  });

  addTableBtn.addEventListener('click', () => {
    const rawVars = {};
    fields.forEach((field) => {
      const input = wrapper.querySelector(`#sme-${field.id}`);
      rawVars[field.id] = parseFloat(input?.value) || 0;
    });
    const variables = applyInputConversions(rawVars, configKey);
    const result = lastResult !== null ? lastResult : evaluateFormula(formula, variables);

    const tr = document.createElement('tr');
    fields.forEach((field) => {
      const td = document.createElement('td');
      td.textContent = rawVars[field.id];
      tr.appendChild(td);
    });
    const resultTd = document.createElement('td');
    resultTd.textContent = formatResult(resultTemplate, result);
    tr.appendChild(resultTd);
    tbody.appendChild(tr);

    tableSection.hidden = false;
  });

  block.appendChild(wrapper);
  block.appendChild(calcBtn);
  block.appendChild(resultBox);
  block.appendChild(descEl);
  block.appendChild(addTableBtn);
  block.appendChild(tableSection);
}

export default async function decorate(block) {
  await buildCalculator(block);
}
