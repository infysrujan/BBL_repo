import { moveInstrumentation } from '../../scripts/scripts.js';

const MATH_FUNS = {
  ln: Math.log,
  log: Math.log,
  exp: Math.exp,
  sqrt: Math.sqrt,
  abs: Math.abs,
};

function normalizeFormula(formula, varIds) {
  let f = formula;

  // [] → ()
  f = f.replace(/\[/g, '(').replace(/\]/g, ')');

  // lnA → ln(A)
  varIds.forEach((v) => {
    f = f.replace(new RegExp(`\\bln${v}\\b`, 'g'), `ln(${v})`);
  });

  // Pi → P*i
  varIds.forEach((v1) => {
    varIds.forEach((v2) => {
      if (v1 !== v2) {
        f = f.replace(new RegExp(`\\b${v1}${v2}\\b`, 'g'), `${v1}*${v2}`);
      }
    });
  });

  // 🔥 FIX: implicit multiplication

  // A( → A*(
  f = f.replace(/([A-Za-z0-9])\s*\(/g, '$1*(');

  // )( → )*(
  f = f.replace(/\)\s*\(/g, ')*(');

  // )A → )*A
  f = f.replace(/\)\s*([A-Za-z])/g, ')*$1');

  return f;
}

function safeEval(expr) {
  const tokens = [];
  let i = 0;

  while (i < expr.length) {
    const ch = expr[i];

    if (/\s/.test(ch)) i++;
    else if (/[0-9.]/.test(ch)) {
      let num = '';
      while (i < expr.length && /[0-9.]/.test(expr[i])) num += expr[i++];
      tokens.push({ t: 'n', v: parseFloat(num) });
    }
    else if (ch === '*' && expr[i + 1] === '*') {
      tokens.push({ t: 'o', v: '**' });
      i += 2;
    }
    else if (/[a-zA-Z]/.test(ch)) {
      let name = '';
      while (i < expr.length && /[a-zA-Z]/.test(expr[i])) name += expr[i++];
      tokens.push({ t: 'fn', v: name });
    }
    else if (ch === '(' || ch === ')') {
      tokens.push({ t: ch, v: ch });
      i++;
    }
    else if ('+-*/'.includes(ch)) {
      tokens.push({ t: 'o', v: ch });
      i++;
    }
    else {
      throw new Error(`Unexpected: ${ch}`);
    }
  }

  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function primary() {
    const tok = peek();

    if (tok.t === 'n') { next(); return tok.v; }

    if (tok.t === 'fn') {
      next();
      const fn = MATH_FUNS[tok.v];
      if (!fn) throw new Error(`Unknown function ${tok.v}`);

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

  function power() {
    let left = primary();
    while (peek()?.t === 'o' && peek().v === '**') {
      next();
      left = left ** primary();
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

function evaluateFormula(formula, variables) {
  if (!formula) return null;

  let expr = formula.replace(/^\s*\w+\s*=\s*/, '');
  expr = normalizeFormula(expr, Object.keys(variables));
  expr = expr.replace(/\^/g, '**');

  Object.keys(variables)
    .sort((a, b) => b.length - a.length)
    .forEach((v) => {
      expr = expr.replace(new RegExp(`\\b${v}\\b`, 'g'), variables[v]);
    });

  try {
    return safeEval(expr);
  } catch (e) {
    console.error('Formula error:', e.message);
    return null;
  }
}

function formatResult(value) {
  if (value === null) return 'Error';

  return Number(value).toLocaleString(undefined, {
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
  const formula = parentValues[4] || '';

  const fields = fieldRows.map(({ cells }) => ({
    id: cells[0]?.textContent.trim(),
    label: cells[1]?.textContent.trim(),
  }));

  block.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'sme-calc-wrapper';

  fields.forEach((field) => {
    const div = document.createElement('div');

    const label = document.createElement('label');
    label.textContent = field.label;

    const input = document.createElement('input');
    input.id = `sme-${field.id}`;
    input.placeholder = '0';

    div.append(label, input);
    wrapper.appendChild(div);
  });

  const btn = document.createElement('button');
  btn.textContent = buttonName;

  const resultBox = document.createElement('div');
  const resultLabel = document.createElement('span');
  resultLabel.textContent = 'Result value: 0.00';
  resultBox.appendChild(resultLabel);

  btn.addEventListener('click', () => {
    const vars = {};

    fields.forEach((f) => {
      vars[f.id] =
        parseFloat(wrapper.querySelector(`#sme-${f.id}`).value) || 0;
    });

    // 🔥 FIX: unit conversion
    if (formula.includes('(1+i)')) {
      if ('i' in vars) vars.i = (vars.i / 100) / 12;
    }

    const result = evaluateFormula(formula, vars);
    const formatted = formatResult(result);

    const match = formula.match(/^\s*([A-Za-z]+)/);
    const varName = match ? match[1] : '';

    let message = '';

    switch (varName) {
      case 'A':
        message = `Your Loan Payment (per month) is ${formatted} baht.`;
        break;
      case 'P':
        message = `Your Loan Balance is ${formatted} baht.`;
        break;
      case 'n':
        message = `Loan Term is ${formatted} months.`;
        break;
      case 'WC':
        message = `Working Capital Needed is ${formatted} baht.`;
        break;
      default:
        message = `Result value: ${formatted}`;
    }

    resultLabel.textContent = message;
  });

  block.append(wrapper, btn, resultBox);
}

export default async function decorate(block) {
  await buildCalculator(block);
}