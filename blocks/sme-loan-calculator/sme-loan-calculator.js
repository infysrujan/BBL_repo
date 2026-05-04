function evaluateFormula(formula, variables) {
  let expr = formula.replace(/\^/g, '**');
  const sortedVars = Object.keys(variables).sort((a, b) => b.length - a.length);
  sortedVars.forEach((varName) => {
    const regex = new RegExp(`\\b${varName}\\b`, 'g');
    expr = expr.replace(regex, variables[varName]);
  });
  try {
    // eslint-disable-next-line no-new-func
    const result = new Function(`return (${expr})`)();
    return Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

function formatResult(template, value) {
  if (value === null) return 'Error';
  const formatted = Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return template ? template.replace(/\{\{result\}\}/g, formatted) : formatted;
}

function buildCalculator(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  if (!rows.length) return;

  const parentCells = rows[0].querySelectorAll(':scope > div');
  const formula = parentCells[0]?.textContent.trim() || '';
  const buttonName = parentCells[1]?.textContent.trim() || 'CALCULATE';
  const resultTemplate = parentCells[2]?.textContent.trim() || '{{result}}';
  const description = parentCells[3]?.textContent.trim() || '';
  const addToTableButtonName = parentCells[4]?.textContent.trim() || 'ADD TO TABLE';

  const fields = [];
  for (let i = 1; i < rows.length; i += 1) {
    const cells = rows[i].querySelectorAll(':scope > div');
    fields.push({
      id: cells[0]?.textContent.trim() || `field${i}`,
      label: cells[1]?.textContent.trim() || '',
      maxLength: parseInt(cells[2]?.textContent.trim(), 10) || null,
      topText: cells[3]?.textContent.trim() || '',
      bottomText: cells[4]?.textContent.trim() || '',
      valueType: cells[5]?.textContent.trim() || 'decimal',
    });
  }

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
  resultLabel.textContent = 'RESULT VALUE';
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
    resultLabel.textContent = formatResult(resultTemplate, lastResult);
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
