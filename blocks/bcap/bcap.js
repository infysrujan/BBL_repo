import { moveInstrumentation } from '../../scripts/scripts.js';

const ALL_FUND_NAMES_URL = 'https://publish-p185039-e1938068.adobeaemcloud.com/api/nav/AllFundNames';

const DEFAULT_HEADERS = [
  'Fund Type',
  'Open-End Fund',
  'NAV',
  'Selling Price',
  'Redemption Price',
  'Total Net Assets',
];

/**
 * @param {unknown} val
 * @returns {string}
 */
function formatPriceLike(val) {
  if (val === null || val === undefined || val === '') return '–';
  const n = Number(val);
  if (Number.isNaN(n)) return '–';
  return n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

/**
 * @param {unknown} val
 * @returns {string}
 */
function formatAum(val) {
  if (val === null || val === undefined || val === '') return '–';
  const n = Number(val);
  if (Number.isNaN(n)) return '–';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * @param {string | undefined} iso
 * @returns {string}
 */
function formatDisplayDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * @typedef {object} FundRecord
 * @property {string} [mf_cateEng]
 * @property {string} [mf_sEng]
 * @property {string|null} [mf_linkEng]
 * @property {number|null|undefined} [mfr_fNav]
 * @property {number|null|undefined} [mfr_fBuy]
 * @property {number|null|undefined} [mfr_fSel]
 * @property {number|null|undefined} [mf_sAUM]
 * @property {string} [mfr_dDataDate]
 * @property {number} [mf_order]
 */

/**
 * @param {FundRecord[]} funds
 * @returns {{ cateEng: string, funds: FundRecord[] }[]}
 */
function groupFundsByCategory(funds) {
  const sorted = [...funds].sort((a, b) => (a.mf_order ?? 0) - (b.mf_order ?? 0));
  const categoryOrder = [];
  /** @type {Map<string, FundRecord[]>} */
  const byCategory = new Map();
  sorted.forEach((fund) => {
    const key = fund.mf_cateEng ?? '';
    if (!byCategory.has(key)) {
      categoryOrder.push(key);
      byCategory.set(key, []);
    }
    byCategory.get(key).push(fund);
  });
  return categoryOrder.map((cateEng) => ({
    cateEng,
    funds: byCategory.get(cateEng) ?? [],
  }));
}

/**
 * @param {FundRecord} fund
 * @returns {HTMLDivElement}
 */
function createOpenEndSubrow(fund) {
  const sub = document.createElement('div');
  sub.className = 'bcap-subrow';

  const line = document.createElement('span');
  line.className = 'bcap-fund-line';

  const nameEl = document.createElement(fund.mf_linkEng ? 'a' : 'span');
  if (fund.mf_linkEng) {
    nameEl.href = fund.mf_linkEng;
    nameEl.className = 'bcap-fund-name';
  } else {
    nameEl.className = 'bcap-fund-name';
  }
  nameEl.textContent = fund.mf_sEng ?? '';

  const dateEl = document.createElement('span');
  dateEl.className = 'bcap-fund-date';
  dateEl.textContent = formatDisplayDate(fund.mfr_dDataDate);

  line.append(nameEl, dateEl);
  sub.append(line);
  return sub;
}

/**
 * @param {string} text
 * @returns {HTMLDivElement}
 */
function createNumericSubrow(text) {
  const sub = document.createElement('div');
  sub.className = 'bcap-subrow bcap-subrow--num';
  sub.textContent = text;
  return sub;
}

/**
 * One table row per category; columns 2–6 use stacked sub-rows (split cells).
 * @param {{ cateEng: string, funds: FundRecord[] }} group
 * @returns {HTMLTableRowElement}
 */
function createGroupRow(group) {
  const tr = document.createElement('tr');
  tr.className = 'bcap-group-row';

  const tdType = document.createElement('td');
  tdType.className = 'bcap-cell-type';
  tdType.textContent = group.cateEng || '–';
  tr.appendChild(tdType);

  const tdOpen = document.createElement('td');
  tdOpen.className = 'bcap-cell-stack bcap-cell-open-end';
  group.funds.forEach((f) => tdOpen.appendChild(createOpenEndSubrow(f)));
  tr.appendChild(tdOpen);

  const tdNav = document.createElement('td');
  tdNav.className = 'bcap-cell-stack bcap-cell-num';
  group.funds.forEach((f) => tdNav.appendChild(createNumericSubrow(formatPriceLike(f.mfr_fNav))));
  tr.appendChild(tdNav);

  const tdBuy = document.createElement('td');
  tdBuy.className = 'bcap-cell-stack bcap-cell-num';
  group.funds.forEach((f) => tdBuy.appendChild(createNumericSubrow(formatPriceLike(f.mfr_fBuy))));
  tr.appendChild(tdBuy);

  const tdSel = document.createElement('td');
  tdSel.className = 'bcap-cell-stack bcap-cell-num';
  group.funds.forEach((f) => tdSel.appendChild(createNumericSubrow(formatPriceLike(f.mfr_fSel))));
  tr.appendChild(tdSel);

  const tdAum = document.createElement('td');
  tdAum.className = 'bcap-cell-stack bcap-cell-num';
  group.funds.forEach((f) => tdAum.appendChild(createNumericSubrow(formatAum(f.mf_sAUM))));
  tr.appendChild(tdAum);

  return tr;
}

/**
 * @param {HTMLTableElement} table
 */
function ensureThead(table) {
  let thead = table.querySelector(':scope > thead');
  if (!thead) {
    thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.className = 'header-row';
    DEFAULT_HEADERS.forEach((label, i) => {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = label;
      if (i >= 2) th.classList.add('bcap-th-num');
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.insertBefore(thead, table.firstChild);
  }
}

/**
 * @param {HTMLTableElement} table
 * @param {string} message
 */
function renderErrorRow(table, message) {
  let tbody = table.querySelector(':scope > tbody');
  if (!tbody) {
    tbody = document.createElement('tbody');
    table.appendChild(tbody);
  }
  tbody.replaceChildren();
  const tr = document.createElement('tr');
  const td = document.createElement('td');
  td.colSpan = 6;
  td.className = 'bcap-message';
  td.textContent = message;
  tr.appendChild(td);
  tbody.appendChild(tr);
}

/**
 * @param {HTMLTableElement} table
 * @param {FundRecord[]} funds
 */
function renderFundRows(table, funds) {
  let tbody = table.querySelector(':scope > tbody');
  if (!tbody) {
    tbody = document.createElement('tbody');
    table.appendChild(tbody);
  }
  tbody.replaceChildren();
  const groups = groupFundsByCategory(funds);
  groups.forEach((g) => tbody.appendChild(createGroupRow(g)));
}

/**
 * @returns {Promise<FundRecord[]>}
 */
async function fetchAllFunds() {
  const response = await fetch(ALL_FUND_NAMES_URL);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export default async function decorate(block) {
  const table = document.querySelector('table');

  if (!table) return;

  table.classList.add('bcap-table');

  ensureThead(table);
  renderErrorRow(table, 'Loading…');

  moveInstrumentation(block, table);
  block.replaceChildren(table);

  try {
    const funds = await fetchAllFunds();
    if (!funds.length) {
      renderErrorRow(table, 'No fund data available.');
      return;
    }
    renderFundRows(table, funds);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('BCAP fund table:', e);
    renderErrorRow(table, 'Unable to load fund data. Please try again later.');
  }
}
