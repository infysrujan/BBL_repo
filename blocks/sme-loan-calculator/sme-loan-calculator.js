const WC_SECTIONS = [
  {
    title: 'Account Receivable',
    fields: [
      { key: 'saleMonthly', label: 'Sale Monthly', unit: '(Baht/month)' },
      { key: 'creditTermAR', label: 'Credit Term', unit: '(Month)' },
      { key: 'creditSale', label: 'Credit Sale', unit: '(% of sale)', step: 0.01 },
    ],
  },
  {
    title: 'Account Payable',
    fields: [
      { key: 'buyMonthly', label: 'Buy Monthly', unit: '(Baht/month)' },
      { key: 'creditTermAP', label: 'Credit Term', unit: '(Month)' },
      { key: 'creditBuy', label: 'Credit Buy', unit: '(% of buy)', step: 0.01 },
    ],
  },
  {
    title: 'Stock of Goods and Raw Materials',
    fields: [
      { key: 'inventoryPolicy', label: 'Inventory/Policy', unit: '(Month)' },
    ],
  },
];

const TABS = [
  {
    id: 'monthly-payment',
    label: 'Monthly Payment',
    fields: [
      { key: 'loanBalance', label: 'Loan Balance', unit: '(Baht)' },
      { key: 'term', label: 'Term', unit: '(Month)' },
      { key: 'interestRate', label: 'Interest Rate', unit: '(Maximum 2 digits and 3 decimal points % per year)', step: 0.001 },
    ],
    calculate(inputs) {
      const pv = +inputs.loanBalance || 0;
      const n = +inputs.term || 0;
      const r = (+inputs.interestRate || 0) / 100 / 12;
      if (!n) return 0;
      return r ? (pv * r) / (1 - (1 + r) ** -n) : pv / n;
    },
  },
  {
    id: 'loan-balance',
    label: 'Loan Balance',
    fields: [
      { key: 'loanPayment', label: 'Loan Payment', unit: '(Baht/month)' },
      { key: 'term', label: 'Term', unit: '(Month)' },
      { key: 'interestRate', label: 'Interest Rate', unit: '(Maximum 2 digits and 3 decimal points % per year)', step: 0.001 },
    ],
    calculate(inputs) {
      const pmt = +inputs.loanPayment || 0;
      const n = +inputs.term || 0;
      const r = (+inputs.interestRate || 0) / 100 / 12;
      return r ? (pmt * (1 - (1 + r) ** -n)) / r : pmt * n;
    },
  },
  {
    id: 'term-period',
    label: 'Term/Period Monthly',
    fields: [
      { key: 'loanBalance', label: 'Loan Balance', unit: '(Baht)' },
      { key: 'loanPayment', label: 'Loan Payment', unit: '(Baht/month)' },
      { key: 'interestRate', label: 'Interest Rate', unit: '(Maximum 2 digits and 3 decimal points % per year)', step: 0.001 },
    ],
    calculate(inputs) {
      const pv = +inputs.loanBalance || 0;
      const pmt = +inputs.loanPayment || 0;
      const r = (+inputs.interestRate || 0) / 100 / 12;
      if (!pmt) return 0;
      if (!r) return pv / pmt;
      const inner = 1 - (r * pv) / pmt;
      return inner <= 0 ? 0 : -Math.log(inner) / Math.log(1 + r);
    },
  },
  {
    id: 'working-capital',
    label: 'Working Capital Needs',
    sections: WC_SECTIONS,
    fields: WC_SECTIONS.flatMap((s) => s.fields),
    calculate(inputs) {
      const ar = (+inputs.saleMonthly || 0) * (+inputs.creditTermAR || 0) * ((+inputs.creditSale || 0) / 100);
      const ap = (+inputs.buyMonthly || 0) * (+inputs.creditTermAP || 0) * ((+inputs.creditBuy || 0) / 100);
      const inv = (+inputs.buyMonthly || 0) * (+inputs.inventoryPolicy || 0);
      return ar + inv - ap;
    },
  },
];

function buildField(field) {
  const step = field.step !== undefined ? ` step="${field.step}"` : '';
  return `
    <div class="slc-field">
      <div class="slc-input-box">
        <span class="slc-field-label">${field.label}</span>
        <input type="number" class="slc-input" name="${field.key}" value="0"${step}>
      </div>
      <span class="slc-field-unit">${field.unit}</span>
    </div>`;
}

function buildPanel(tab, index) {
  const active = index === 0 ? ' is-active' : '';
  let fieldsHTML;

  if (tab.sections) {
    fieldsHTML = tab.sections.map((section) => `
      <div class="slc-section">
        <h3 class="slc-section-title">${section.title}</h3>
        <div class="slc-fields-row">${section.fields.map(buildField).join('')}</div>
      </div>`).join('');
  } else {
    fieldsHTML = `<div class="slc-fields-row">${tab.fields.map(buildField).join('')}</div>`;
  }

  return `
    <div class="slc-panel${active}" data-panel="${index}">
      ${fieldsHTML}
      <button class="slc-calc-btn">CALCULATE</button>
    </div>`;
}

export default function decorate(block) {
  const rows = [...block.children];
  const titleText = rows[0]?.textContent?.trim() || 'SME Loan Calculator';
  const remarkHtml = rows[1]?.firstElementChild?.innerHTML || '';

  const tabsHTML = TABS.map((tab, i) => `
    <button class="slc-tab${i === 0 ? ' is-active' : ''}" data-tab="${i}" role="tab">${tab.label}</button>`).join('');

  const panelsHTML = TABS.map(buildPanel).join('');

  block.innerHTML = `
    <div class="slc-header">
      <h1 class="slc-title">${titleText}</h1>
      <div class="slc-divider"></div>
    </div>
    <div class="slc-calculator">
      <nav class="slc-tabs" role="tablist">${tabsHTML}</nav>
      <div class="slc-panels">${panelsHTML}</div>
    </div>
    <div class="slc-result">
      <p class="slc-result-label">Your result value is <strong class="slc-result-value">0.00</strong></p>
      <p class="slc-result-sub">To compare the calculated results, click the button below to add the latest results in the table.</p>
      <button class="slc-add-btn" disabled>ADD TO TABLE</button>
      <table class="slc-compare-table" hidden>
        <thead>
          <tr><th>#</th><th>Calculator</th><th>Result</th></tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
    ${remarkHtml ? `<div class="slc-remark">${remarkHtml}</div>` : ''}
  `;

  let lastResult = null;
  let activeTabIndex = 0;
  let rowNum = 0;

  const resultValue = block.querySelector('.slc-result-value');
  const addBtn = block.querySelector('.slc-add-btn');
  const compareTable = block.querySelector('.slc-compare-table');
  const tbody = compareTable.querySelector('tbody');

  block.querySelectorAll('.slc-tab').forEach((tabBtn, i) => {
    tabBtn.addEventListener('click', () => {
      block.querySelectorAll('.slc-tab').forEach((t) => t.classList.remove('is-active'));
      block.querySelectorAll('.slc-panel').forEach((p) => p.classList.remove('is-active'));
      tabBtn.classList.add('is-active');
      block.querySelector(`.slc-panel[data-panel="${i}"]`).classList.add('is-active');
      activeTabIndex = i;
      lastResult = null;
      resultValue.textContent = '0.00';
      addBtn.disabled = true;
    });
  });

  block.querySelectorAll('.slc-calc-btn').forEach((btn, i) => {
    btn.addEventListener('click', () => {
      const inputs = {};
      block.querySelectorAll(`.slc-panel[data-panel="${i}"] .slc-input`).forEach((input) => {
        inputs[input.name] = input.value;
      });
      lastResult = TABS[i].calculate(inputs);
      resultValue.textContent = lastResult.toFixed(2);
      addBtn.disabled = false;
    });
  });

  addBtn.addEventListener('click', () => {
    if (lastResult === null) return;
    rowNum += 1;
    compareTable.hidden = false;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${rowNum}</td><td>${TABS[activeTabIndex].label}</td><td>${lastResult.toFixed(2)}</td>`;
    tbody.appendChild(tr);
  });
}
