// CSP on AEM blocks eval/new Function — use a custom math expression parser instead.
function safeEval(expr) {
  const tokens = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) { i += 1; continue; } // eslint-disable-line no-continue
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(expr[i + 1] || ''))) {
      let num = '';
      while (i < expr.length && /[0-9.]/.test(expr[i])) { num += expr[i]; i += 1; }
      tokens.push({ t: 'n', v: parseFloat(num) });
    } else if (ch === '*' && expr[i + 1] === '*') {
      tokens.push({ t: 'o', v: '**' }); i += 2;
    } else if (ch === '(') { tokens.push({ t: '(', v: ch }); i += 1; }
    else if (ch === ')') { tokens.push({ t: ')', v: ch }); i += 1; }
    else if ('+-*/'.includes(ch)) { tokens.push({ t: 'o', v: ch }); i += 1; }
    else throw new Error(`Unexpected: ${ch}`);
  }

  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++]; // eslint-disable-line no-plusplus

  function addSub() {
    let left = mulDiv();
    while (peek()?.t === 'o' && (peek().v === '+' || peek().v === '-')) {
      const op = next().v;
      left = op === '+' ? left + mulDiv() : left - mulDiv();
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

  function power() {
    const base = unary();
    if (peek()?.t === 'o' && peek().v === '**') {
      next();
      return base ** power();
    }
    return base;
  }

  function unary() {
    if (peek()?.t === 'o' && (peek().v === '-' || peek().v === '+')) {
      const op = next().v;
      return op === '-' ? -primary() : primary(); // eslint-disable-line no-use-before-define
    }
    return primary(); // eslint-disable-line no-use-before-define
  }

  function primary() {
    const tok = peek();
    if (!tok) throw new Error('Unexpected end');
    if (tok.t === 'n') { next(); return tok.v; }
    if (tok.t === '(') {
      next();
      const val = addSub();
      if (peek()?.t !== ')') throw new Error('Missing )');
      next();
      return val;
    }
    throw new Error(`Unexpected token: ${tok.v}`);
  }

  return addSub();
}

function evaluateFormula(formula, variables) {
  // Strip LHS assignment e.g. "A = " or "WC = "
  let expr = formula.replace(/^\s*\w+\s*=\s*/, '');
  // Replace ^ with ** for exponentiation
  expr = expr.replace(/\^/g, '**');
  // Substitute variables longest-first to avoid partial matches (e.g. WC before C)
  const sortedVars = Object.keys(variables).sort((a, b) => b.length - a.length);
  sortedVars.forEach((varName) => {
    const regex = new RegExp(`\\b${varName}\\b`, 'g');
    expr = expr.replace(regex, variables[varName]);
  });
  try {
    const result = safeEval(expr);
    return Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

function formatResult(template, value) {
  if (value === null) return 'Error';
  const formatted = Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (template && template.includes('{{result}}')) return template.replace(/\{\{result\}\}/g, formatted);
  return formatted;
}

function buildCalculator(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  if (!rows.length) return;

  // In AEM EDS, each parent model field renders as its own single-cell row.
  // Child items (sme-field) render as multi-cell rows (one cell per field).
  const parentValues = [];
  const fieldRows = [];

  rows.forEach((row) => {
    const cells = [...row.querySelectorAll(':scope > div')];
    if (cells.length <= 1) {
      parentValues.push(cells[0]?.textContent.trim() || '');
    } else {
      fieldRows.push(cells);
    }
  });

  const formula = parentValues[0] || '';
  const buttonName = parentValues[1] || 'CALCULATE';
  const resultTemplate = parentValues[2] || '';
  const description = parentValues[3] || '';
  const addToTableButtonName = parentValues[4] || 'ADD TO TABLE';

  const fields = fieldRows.map((cells, i) => ({
    id: cells[0]?.textContent.trim() || `field${i + 1}`,
    label: cells[1]?.textContent.trim() || '',
    maxLength: parseInt(cells[2]?.textContent.trim(), 10) || null,
    topText: cells[3]?.textContent.trim() || '',
    bottomText: cells[4]?.textContent.trim() || '',
    valueType: cells[5]?.textContent.trim() || 'decimal',
  }));

  block.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'sme-calc-wrapper';

  fields.forEach((field) => {
    const card = document.createElement('div');
    card.className = 'sme-calc-field';

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
    const variables = {};
    fields.forEach((field) => {
      const input = wrapper.querySelector(`#sme-${field.id}`);
      variables[field.id] = parseFloat(input?.value) || 0;
    });
    lastResult = evaluateFormula(formula, variables);
    resultLabel.textContent = `Result value: ${formatResult(resultTemplate, lastResult)}`;
    resultBox.classList.toggle('sme-calc-result--error', lastResult === null);
  });

  addTableBtn.addEventListener('click', () => {
    const variables = {};
    fields.forEach((field) => {
      const input = wrapper.querySelector(`#sme-${field.id}`);
      variables[field.id] = parseFloat(input?.value) || 0;
    });
    const result = lastResult !== null ? lastResult : evaluateFormula(formula, variables);

    const tr = document.createElement('tr');
    fields.forEach((field) => {
      const td = document.createElement('td');
      td.textContent = variables[field.id];
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

export default function decorate(block) {
  buildCalculator(block);
}
