import { moveInstrumentation } from '../../scripts/scripts.js';

// Supported math functions
const MATH_FUNS = {
  ln: Math.log,
  log: Math.log,
  exp: Math.exp,
  sqrt: Math.sqrt,
  abs: Math.abs,
};

// Normalize formula
function normalizeFormula(formula, varIds) {
  let f = formula.replace(/\[/g, '(').replace(/\]/g, ')');

  // Fix function calls like lnA → ln(A)
  Object.keys(MATH_FUNS).forEach((fn) => {
    varIds.forEach((v) => {
      f = f.replace(new RegExp(`\\b${fn}${v}\\b`, 'g'), `${fn}(${v})`);
    });
  });

  // Implicit multiplication (Pi → P*i)
  const sorted = [...varIds].sort((a, b) => b.length - a.length);
  sorted.forEach((v1) => {
    sorted.forEach((v2) => {
      if (v1 !== v2) {
        f = f.replace(
          new RegExp(`(?<![a-zA-Z])${v1}${v2}(?![a-zA-Z])`, 'g'),
          `${v1}*${v2}`,
        );
      }
    });
  });

  return f;
}

// Safe expression evaluator (NO eval)
function safeEval(expr) {
  const tokens = [];
  let i = 0;

  while (i < expr.length) {
    const ch = expr[i];

    if (/\s/.test(ch)) i += 1;
    else if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(expr[i + 1] || ''))) {
      let num = '';
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        num += expr[i];
        i += 1;
      }
      tokens.push({ t: 'n', v: parseFloat(num) });
    } else if (ch === '*' && expr[i + 1] === '*') {
      tokens.push({ t: 'o', v: '**' });
      i += 2;
    } else if (/[a-zA-Z]/.test(ch)) {
      let name = '';
      while (i < expr.length && /[a-zA-Z]/.test(expr[i])) {
        name += expr[i];
        i += 1;
      }
      tokens.push({ t: 'fn', v: name });
    } else if (ch === '(' || ch === ')') {
      tokens.push({ t: ch, v: ch });
      i += 1;
    } else if ('+-*/'.includes(ch)) {
      tokens.push({ t: 'o', v: ch });
      i += 1;
    } else {
      throw new Error(`Unexpected: ${ch}`);
    }
  }

  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function primary() {
    const tok = peek();
    if (!tok) throw new Error('Unexpected end');

    if (tok.t === 'n') {
      next();
      return tok.v;
    }

    if (tok.t === 'fn') {
      next();
      const fn = MATH_FUNS[tok.v];
      if (!fn) throw new Error(`Unknown function: ${tok.v}`);

      if (peek()?.t !== '(') throw new Error('Expected (');
      next();
      const val = addSub();
      if (peek()?.t !== ')') throw new Error('Missing )');
      next();

      return fn(val);
    }

    if (tok.t === '(') {
      next();
      const val = addSub();
      if (peek()?.t !== ')') throw new Error('Missing )');
      next();
      return val;
    }

    throw new Error('Invalid expression');
  }

  function unary() {
    if (peek()?.t === 'o' && (peek().v === '-' || peek().v === '+')) {
      const op = next().v;
      return op === '-' ? -primary() : primary();
    }
    return primary();
  }

  function power() {
    let left = unary();
    while (peek()?.t === 'o' && peek().v === '**') {
      next();
      left = left ** unary();
    }
    return left;
  }

  function mulDiv() {
    let left = power();
    while (peek()?.t === 'o' && (peek().v === '*' || peek().v === '/')) {
      const op = next().v;
      left = op === '*' ? left * power() : left / power();
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

// Evaluate formula
function evaluateFormula(formula, variables) {
  if (!formula) return null;

  let expr = formula.replace(/^\s*\w+\s*=\s*/, '');
  expr = normalizeFormula(expr, Object.keys(variables));
  expr = expr.replace(/\^/g, '**');

  const sortedVars = Object.keys(variables).sort((a, b) => b.length - a.length);
  sortedVars.forEach((v) => {
    expr = expr.replace(new RegExp(`\\b${v}\\b`, 'g'), variables[v]);
  });

  try {
    const result = safeEval(expr);
    return Number.isFinite(result) ? result : null;
  } catch (e) {
    console.error('Formula error:', e.message);
    return null;
  }
}

// Format result
function formatResult(value) {
  if (value === null) return 'Error';
  return Number.isInteger(value)
    ? value.toLocaleString()
    : value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
}

async function buildCalculator(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  if (!rows.length) return;

  const parentValues = [];
  const fieldRows = [];

  rows.forEach((row) => {
    const cells = [...row.querySelectorAll(':scope > div')];
    if (cells.length <= 1) {
      parentValues.push(cells[0]?.textContent.trim() || '');
    } else {
      fieldRows.push({ row, cells });
    }
  });

  const buttonName = parentValues[0] || 'CALCULATE';
  const resultTemplate = parentValues[1] || '';
  const description = parentValues[2] || '';
  const addToTableButtonName = parentValues[3] || 'ADD TO TABLE';
  const formulaDescription = parentValues[4] || '';

  const fields = fieldRows.map(({ cells }, idx) => ({
    id: cells[0]?.textContent.trim() || `field${idx + 1}`,
    label: cells[1]?.textContent.trim() || '',
    maxLength: parseInt(cells[2]?.textContent.trim(), 10) || null,
    topText: cells[3]?.textContent.trim() || '',
    bottomText: cells[4]?.textContent.trim() || '',
    valueType: cells[5]?.textContent.trim() || 'decimal',
  }));

  const formula = formulaDescription;

  block.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'sme-calc-wrapper';

  fields.forEach((field, idx) => {
    const card = document.createElement('div');
    card.className = 'sme-calc-field';
    moveInstrumentation(fieldRows[idx].row, card);

    const row = document.createElement('div');
    const label = document.createElement('label');
    label.textContent = field.label;

    const input = document.createElement('input');
    input.id = `sme-${field.id}`;
    input.dataset.varId = field.id;
    input.placeholder = '0';

    input.addEventListener('input', () => {
      input.value = input.value.replace(/[^0-9.]/g, '');
    });

    row.append(label, input);
    card.appendChild(row);
    wrapper.appendChild(card);
  });

  const calcBtn = document.createElement('button');
  calcBtn.textContent = buttonName;

  const resultBox = document.createElement('div');
  const resultLabel = document.createElement('span');
  resultLabel.textContent = 'Result value: 0.00';
  resultBox.appendChild(resultLabel);

  calcBtn.addEventListener('click', () => {
    const vars = {};
    fields.forEach((f) => {
      const val = parseFloat(wrapper.querySelector(`#sme-${f.id}`).value) || 0;
      vars[f.id] = val;
    });

    const result = evaluateFormula(formula, vars);
    const formatted = formatResult(result);

    if (resultTemplate.includes('{{result}}')) {
      resultLabel.textContent = resultTemplate.replace('{{result}}', formatted);
    } else {
      resultLabel.textContent = `Result value: ${formatted}`;
    }
  });

  block.append(wrapper, calcBtn, resultBox);
}

export default async function decorate(block) {
  await buildCalculator(block);
}