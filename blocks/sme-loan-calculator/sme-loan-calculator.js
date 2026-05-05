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

  // Pi → P*i (known variable pairs)
  varIds.forEach((v1) => {
    varIds.forEach((v2) => {
      if (v1 !== v2) {
        f = f.replace(new RegExp(`\\b${v1}${v2}\\b`, 'g'), `${v1}*${v2}`);
      }
    });
  });

  // fallback: split any remaining 2-letter identifier that isn't a math function
  // handles Pi → P*i when one variable isn't in varIds
  f = f.replace(/\b([A-Za-z])([A-Za-z])\b(?!\s*\()/g, (match, l1, l2) => {
    if (MATH_FUNS[match] || MATH_FUNS[match.toLowerCase()]) return match;
    return `${l1}*${l2}`;
  });

  // implicit multiplication
  f = f.replace(/([A-Za-z0-9])\s*\(/g, '$1*(');
  f = f.replace(/\)\s*\(/g, ')*(');
  f = f.replace(/\)\s*([A-Za-z])/g, ')*$1');

  // restore math function calls broken by implicit multiplication (ln*( → ln()
  Object.keys(MATH_FUNS).forEach((fn) => {
    f = f.replace(new RegExp(`\\b${fn}\\*\\(`, 'g'), `${fn}(`);
  });

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

  if (expr.includes('ln') && expr.includes('-') && expr.includes('/')) {
    expr = expr.replace(
      /ln\(([^)]+)\)\s*-\s*ln\(([^)]+)\)\s*\/\s*ln\(([^)]+)\)/,
      '(ln($1) - ln($2)) / ln($3)',
    );
  }

  expr = normalizeFormula(expr, Object.keys(variables));
  expr = expr.replace(/\^/g, '**');

  Object.keys(variables)
    .sort((a, b) => b.length - a.length)
    .forEach((v) => {
      expr = expr.replace(new RegExp(`\\b${v}\\b`, 'g'), variables[v]);
    });

  // Detect unresolved variables (letters remaining after substitution)
  const unresolved = [...new Set(
    (expr.match(/\b[A-Za-z]+\b/g) || []).filter((t) => !MATH_FUNS[t]),
  )];
  if (unresolved.length) {
    // eslint-disable-next-line no-console
    console.warn('[SME] Unresolved variables in formula:', unresolved, '— check field IDs in UE');
  }

  try {
    return safeEval(expr);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Formula error:', e.message);
    return null;
  }
}

function substituteFormula(formula, variables) {
  if (!formula) return '';
  const lhs = formula.match(/^\s*([A-Za-z]+)\s*=/)?.[1] || '';
  let rhs = formula.replace(/^\s*\w+\s*=\s*/, '');
  rhs = normalizeFormula(rhs, Object.keys(variables));

  Object.keys(variables)
    .sort((a, b) => b.length - a.length)
    .forEach((v) => {
      const val = variables[v];
      const display = Number.isInteger(val) ? val : parseFloat(val.toFixed(6));
      rhs = rhs.replace(new RegExp(`\\b${v}\\b`, 'g'), display);
    });

  return lhs ? `${lhs} = ${rhs}` : rhs;
}

function formatResult(value) {
  if (value === null || !isFinite(value)) return 'Cannot Calculate';

  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function isInvalid(value) {
  return value === null || !isFinite(value);
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
  const addTableBtnName = parentValues[3] || '';
  const formula = parentValues[4] || '';

  const fields = fieldRows.map(({ cells }) => ({
    id: cells[0]?.textContent.trim(),
    label: cells[1]?.textContent.trim(),
    maxLength: cells[2]?.textContent.trim(),
    topText: cells[3]?.textContent.trim(),
    bottomText: cells[4]?.textContent.trim(),
  }));

  // Save data-aue-* instrumentation from each field row before clearing DOM
  const fieldInstrumentations = fieldRows.map(({ row }) => {
    const attrs = {};
    [...row.attributes].forEach((a) => {
      if (a.name.startsWith('data-aue-') || a.name.startsWith('data-richtext-')) {
        attrs[a.name] = a.value;
      }
    });
    return attrs;
  });

  block.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'sme-calc-wrapper';

  fields.forEach((field, index) => {
    const card = document.createElement('div');
    card.className = 'sme-calc-field';

    // Re-apply instrumentation so UE content tree shows this child item
    const instr = fieldInstrumentations[index] || {};
    Object.entries(instr).forEach(([k, v]) => card.setAttribute(k, v));

    if (field.topText) {
      const top = document.createElement('span');
      top.className = 'sme-calc-field-top';
      top.textContent = field.topText;
      card.appendChild(top);
    }

    const row = document.createElement('div');
    row.className = 'sme-calc-field-row';

    const label = document.createElement('label');
    label.textContent = field.label;
    label.htmlFor = `sme-${field.id}`;

    const input = document.createElement('input');
    input.id = `sme-${field.id}`;
    input.type = 'text';
    input.value = '0';
    if (field.maxLength) input.maxLength = Number(field.maxLength);

    row.append(label, input);
    card.appendChild(row);

    if (field.bottomText) {
      const bottom = document.createElement('span');
      bottom.className = 'sme-calc-field-bottom';
      bottom.textContent = field.bottomText;
      card.appendChild(bottom);
    }

    wrapper.appendChild(card);
  });

  const btn = document.createElement('button');
  btn.className = 'sme-calc-btn';
  btn.textContent = buttonName;

  const resultBox = document.createElement('div');
  resultBox.className = 'sme-calc-result';
  const resultLabel = document.createElement('span');
  resultLabel.className = 'sme-calc-result-label';
  if (resultTemplate.includes('{{result}}')) {
    const parts = resultTemplate.split('{{result}}');
    if (parts[0]) resultLabel.appendChild(document.createTextNode(parts[0]));
    const initStrong = document.createElement('strong');
    initStrong.textContent = '0.00';
    resultLabel.appendChild(initStrong);
    if (parts[1]) resultLabel.appendChild(document.createTextNode(parts[1]));
  } else {
    resultLabel.textContent = resultTemplate;
  }
  resultBox.appendChild(resultLabel);

  const substitutedBox = document.createElement('p');
  substitutedBox.className = 'sme-calc-formula-description';
  substitutedBox.hidden = true;

  const descPara = document.createElement('p');
  descPara.className = 'sme-calc-description';
  descPara.textContent = description;

  let addTableBtn = null;
  let tableSection = null;
  let tableBody = null;
  let lastResult = null;
  let lastVars = {};

  if (addTableBtnName) {
    addTableBtn = document.createElement('button');
    addTableBtn.className = 'sme-calc-add-table-btn';
    addTableBtn.textContent = addTableBtnName;

    tableSection = document.createElement('div');
    tableSection.className = 'sme-calc-table-section';
    tableSection.hidden = true;

    const table = document.createElement('table');
    table.className = 'sme-calc-table';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    fields.forEach((f) => {
      const th = document.createElement('th');
      th.textContent = f.label || f.id;
      headerRow.appendChild(th);
    });
    const thResult = document.createElement('th');
    thResult.textContent = 'Result';
    headerRow.appendChild(thResult);
    thead.appendChild(headerRow);

    tableBody = document.createElement('tbody');
    table.append(thead, tableBody);
    tableSection.appendChild(table);

    addTableBtn.addEventListener('click', () => {
      if (lastResult === null) return;
      const tr = document.createElement('tr');
      fields.forEach((f) => {
        const td = document.createElement('td');
        td.textContent = lastVars[f.id] ?? '';
        tr.appendChild(td);
      });
      const tdResult = document.createElement('td');
      tdResult.textContent = formatResult(lastResult);
      tr.appendChild(tdResult);
      tableBody.appendChild(tr);
      tableSection.hidden = false;
    });
  }

  btn.addEventListener('click', () => {
    const vars = {};
    fields.forEach((f) => {
      vars[f.id] = parseFloat(wrapper.querySelector(`#sme-${f.id}`).value) || 0;
    });

    // If the formula doesn't already divide i by 100 (or 1200), convert annual % → monthly decimal
    if (vars.i !== undefined && !/i\s*\/\s*10{2,4}/.test(formula)) {
      vars.i = vars.i / 100 / 12;
    }

    lastVars = { ...vars };

    const result = evaluateFormula(formula, vars);
    lastResult = result;
    const formatted = formatResult(result);

    const setResultText = (prefix, value, suffix) => {
      resultLabel.textContent = '';
      if (prefix) resultLabel.appendChild(document.createTextNode(prefix));
      const strong = document.createElement('strong');
      strong.textContent = value;
      resultLabel.appendChild(strong);
      if (suffix) resultLabel.appendChild(document.createTextNode(suffix));
    };

    if (isInvalid(result)) {
      resultLabel.textContent = 'Cannot Calculate';
    } else if (resultTemplate && resultTemplate.includes('{{result}}')) {
      const parts = resultTemplate.split('{{result}}');
      setResultText(parts[0], formatted, parts[1] || '');
    } else {
      const match = formula.match(/^\s*([A-Za-z]+)/);
      const varName = match ? match[1] : '';
      switch (varName) {
        case 'A':
          setResultText('Your Loan Payment (per month) is ', formatted, ' baht.');
          break;
        case 'P':
          setResultText('Your Loan Balance is ', formatted, ' baht.');
          break;
        case 'n':
          setResultText('Your Term/Period is ', String(Math.round(result)), ' months.');
          break;
        case 'WC':
          setResultText('Working Capital Need is ', formatted, ' baht.');
          break;
        default:
          setResultText('Result: ', formatted, '');
      }
    }

    substitutedBox.textContent = substituteFormula(formula, vars);
    substitutedBox.hidden = false;
  });

  const darkSection = document.createElement('div');
  darkSection.className = 'sme-calc-dark-section';
  darkSection.append(wrapper, btn);

  block.append(darkSection, resultBox, substitutedBox, descPara);
  if (addTableBtn) block.append(addTableBtn, tableSection);
}

export default async function decorate(block) {
  moveInstrumentation(block);
  await buildCalculator(block);
}
