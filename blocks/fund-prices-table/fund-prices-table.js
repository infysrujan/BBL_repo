import { toClassName } from '../../scripts/aem.js';
import { fetchConfigs } from '../../scripts/config.js';
import { fetchGet } from '../../scripts/utils/fetchApi.js';

export async function getApiUrls() {
  const configs = await fetchConfigs();
  return {
    apiBase: configs.fundPricesApiUrl || '',
    ALL_FUND_NAMES_URL: configs.fundPricesAllFundsNameUrl || '',
    LATEST_DATE_URL: configs.fundPricesLatestDateUrl || '',
    GET_UPDATE_IN_MONTH_BASE: configs.fundPricesGetUpdateInMonthUrl || '',
    ALL_FUND_PRICES_BASE: configs.fundPricesAllFundPricesUrl || '',
  };
}

let latestMdate = null;

export function parseLocalDateFromYmd(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd).trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const valid = d.getFullYear() === Number(m[1])
    && d.getMonth() === Number(m[2]) - 1
    && d.getDate() === Number(m[3]);
  return valid ? d : null;
}

function pad2(n) { return String(n).padStart(2, '0'); }

async function fetchAllFundPrices(date) {
  const { ALL_FUND_PRICES_BASE } = await getApiUrls();
  const dd = pad2(date.getDate());
  const mm = pad2(date.getMonth() + 1);
  const yyyy = date.getFullYear();
  const data = await fetchGet(`${ALL_FUND_PRICES_BASE}/${dd}/${mm}/${yyyy}`);
  return Array.isArray(data) ? data : [];
}

export async function fetchNavEnabledDaysForMonth({ year, month }) {
  const { GET_UPDATE_IN_MONTH_BASE } = await getApiUrls();
  const data = await fetchGet(`${GET_UPDATE_IN_MONTH_BASE}/${year}/${month + 1}/0`);
  if (!Array.isArray(data)) return [];
  return data.map((i) => (i?.Day != null ? Number(i.Day) : NaN)).filter((d) => !Number.isNaN(d));
}

function getLang() {
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  const segments = path.split('/');
  if (segments.includes('th') || segments.includes('BangkokBankThai')) return 'th';
  return 'en';
}

const localizedHeaderMap = {
  fundtype: { en: 'mf_cateEng', th: 'mf_cateTha' },
  openendfund: { en: 'mf_sEng', th: 'mf_sTha' },
  nav: 'mfr_fNav',
  sellingprice: 'mfr_fSel',
  redemptionprice: 'mfr_fBuy',
  totalnetassets: 'mfr_sAUM',
};

const rawThaiHeaderKeyMap = {
  ประเภทกองทุน: 'fundtype',
  กองทุนเปิด: 'openendfund',
  กองทุน: 'openendfund',
  มูลค่าหน่วยลงทุน: 'nav',
  nav: 'nav',
  ราคาขาย: 'sellingprice',
  ราคารับซื้อคืน: 'redemptionprice',
  มูลค่าทรัพย์สินสุทธิรวม: 'totalnetassets',
  มูลค่าทรัพย์สินสุทธิ: 'totalnetassets',
};

// Normalize keys (NFC) so Thai combining-character encoding differences
// between this source file and authored content don't silently break lookup.
const thaiHeaderKeyMap = Object.fromEntries(
  Object.entries(rawThaiHeaderKeyMap).map(([k, v]) => [k.normalize('NFC'), v]),
);

// Alternate #tag names some authors have used in place of the canonical keys.
const tagAliases = {
  fund: 'openendfund',
  unitvalue: 'nav',
  buybackprice: 'redemptionprice',
  netassetvalue: 'totalnetassets',
};

function normalizeHeaderKey(header) {
  const trimmed = header.trim().normalize('NFC');
  if (thaiHeaderKeyMap[trimmed]) return thaiHeaderKeyMap[trimmed];
  // Check for a #suffix and return only the part after #
  const hashIndex = trimmed.lastIndexOf('#');
  let key;
  if (hashIndex !== -1 && hashIndex < trimmed.length - 1) {
    key = trimmed.slice(hashIndex + 1).toLowerCase().replace(/[^a-z0-9]/g, '');
  } else {
    key = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  return tagAliases[key] || key;
}

function resolveColumnKey(normalizedKey, lang) {
  const mapped = localizedHeaderMap[normalizedKey];
  if (!mapped) return normalizedKey;
  if (
    typeof mapped === 'object'
    && (normalizedKey === 'fundtype' || normalizedKey === 'openendfund')
  ) {
    return mapped[lang];
  }
  return mapped;
}

function buildCategoryOrder(rows, categoryKey) {
  const order = [];
  const seen = new Set();
  rows.forEach((row) => {
    if (row[categoryKey] !== undefined && !seen.has(row[categoryKey])) {
      order.push(row[categoryKey]);
      seen.add(row[categoryKey]);
    }
  });
  return order;
}

function groupRowsByCategory(rows, categoryKey) {
  return rows.reduce((acc, row) => {
    const cat = row[categoryKey];
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(row);
    return acc;
  }, {});
}

function clearNonHeaderRows(tbody) {
  tbody.querySelectorAll('tr:not(.header-row)').forEach((tr) => tr.remove());
}

/** Display text for a body cell
 * (open-end fund column adds date suffix when row date ≠ selected). */
function formatBodyCellText(normalizedKey, row, columnKey, selectedDate) {
  if (normalizedKey === 'openendfund') {
    const dnav = row.mfr_dDataDate || row.mf_dnav;
    if (dnav && dnav !== selectedDate && columnKey && row[columnKey] !== undefined) {
      return `${row[columnKey]} <span class="dnav">${dnav}</span>`;
    }
    return row[columnKey] !== undefined ? `${row[columnKey]}` : '';
  }
  if (columnKey && row[columnKey] !== undefined) {
    const value = String(row[columnKey]);
    const num = parseFloat(value);
    if (!Number.isNaN(num) && Math.abs(num) >= 1000) {
      return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    }
    return value === 'null' ? 'N/A' : value;
  }
  return '';
}

export function appendRowFromData(tableEl, dataArray) {
  const lang = getLang();
  const tbody = tableEl.querySelector('tbody');
  if (!tbody) return;

  const headerRow = tbody.querySelector('.header-row') || tbody.querySelector('tr');
  if (!headerRow) return;
  headerRow.classList.add('header-row');

  const headers = [...headerRow.querySelectorAll('td')];
  headers.forEach((td) => {
    const text = typeof td.textContent === 'string' ? td.textContent.trim() : '';
    if (text.includes('#')) {
      // Tag is the source of truth while present — always re-derive from it,
      // and remember the key since the tag itself is about to be stripped.
      td.dataset.colKey = normalizeHeaderKey(text);
      td.dataset.colKeyTagged = 'true';
      td.textContent = text.replace(/\s*#\w+\b/g, '');
    } else if (td.dataset.colKeyTagged === 'true') {
      // Tag was stripped from the visible text in an earlier pass —
      // keep using the key captured back then.
    } else {
      // No tag now or ever (also self-heals any stale/legacy cached key) —
      // always derive from the current visible text so edits stay in sync.
      td.dataset.colKey = normalizeHeaderKey(text);
    }
  });

  if (!Array.isArray(dataArray)) return;

  const categoryKey = lang === 'th' ? 'mf_cateTha' : 'mf_cateEng';
  const order = buildCategoryOrder(dataArray, categoryKey);
  const groups = groupRowsByCategory(dataArray, categoryKey);

  clearNonHeaderRows(tbody);

  order.forEach((category) => {
    const group = groups[category];
    group.forEach((row, idx) => {
      const tr = tableEl.ownerDocument.createElement('tr');
      headers.forEach((headerCell) => {
        const nk = headerCell.dataset.colKey;
        const ck = resolveColumnKey(nk, lang);
        if (nk === 'fundtype') {
          if (idx === 0) {
            const td = tableEl.ownerDocument.createElement('td');
            td.textContent = row[ck] !== undefined ? row[ck] : '';
            td.rowSpan = group.length;
            td.classList.add('merged-fund-type');
            tr.appendChild(td);
          }
          return;
        }
        const td = tableEl.ownerDocument.createElement('td');
        td.classList.add(`col-${nk}`);
        td.innerHTML = formatBodyCellText(nk, row, ck, latestMdate);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  });
}

async function refreshTableFromPrices(tableEl, fallbackFunds, date) {
  let prices;
  try {
    prices = await fetchAllFundPrices(date);
  } catch {
    prices = fallbackFunds;
  }
  const data = prices && prices.length ? prices : fallbackFunds;
  appendRowFromData(tableEl, data);
  return data;
}

function markHeaderRows(tableEl) {
  const rows = [...tableEl.querySelectorAll('tr')];
  if (!rows.length) return;
  const firstRow = rows[0];
  const maxRowspan = [...firstRow.querySelectorAll('td')].reduce(
    (max, td) => Math.max(max, td.rowSpan || 1),
    1,
  );
  for (let i = 0; i < maxRowspan && i < rows.length; i += 1) {
    rows[i].classList.add('header-row');
  }
}

const DEFAULT_HEADERS_EN = [
  'Fund Type', 'Open-End Fund', 'NAV', 'Selling Price', 'Redemption Price', 'Total Net Assests',
];
const DEFAULT_HEADERS_TH = [
  'ประเภทกองทุน', 'กองทุนเปิด', 'NAV', 'ราคาขาย', 'ราคารับซื้อคืน', 'มูลค่าทรัพย์สินสุทธิรวม',
];

function buildDefaultTable(doc) {
  const table = doc.createElement('table');
  const tbody = doc.createElement('tbody');
  const headerRow = doc.createElement('tr');
  headerRow.classList.add('header-row');
  const headers = getLang() === 'th' ? DEFAULT_HEADERS_TH : DEFAULT_HEADERS_EN;
  headers.forEach((text) => {
    const td = doc.createElement('td');
    td.textContent = text;
    headerRow.appendChild(td);
  });
  tbody.appendChild(headerRow);
  table.appendChild(tbody);
  return table;
}

function getCellText(cell) {
  if (!cell) return '';
  const paragraphs = [...cell.querySelectorAll('p')]
    .map((p) => p.textContent.trim())
    .filter(Boolean);
  if (paragraphs.length) return paragraphs.join(',');
  return cell.textContent.trim();
}

function parseVariationClasses(cell) {
  const raw = getCellText(cell);
  if (!raw) return [];
  const classes = raw
    .split(',')
    .map((item) => toClassName(item.trim()))
    .filter(Boolean);
  return [...new Set(classes)];
}

function applyVariationClasses(tableEl, styles, id) {
  if (!tableEl) return;
  if (styles.length) tableEl.classList.add(...styles);
  if (id) tableEl.setAttribute('id', id);
}

export default async function decorate(block) {
  const rows = [...block.children];
  const id = getCellText(rows[0]?.children[0]) || '';
  const styles = parseVariationClasses(rows[1]?.children[0]);

  let tableEl = block.querySelector('table');
  if (!tableEl) {
    tableEl = buildDefaultTable(block.ownerDocument);
  } else {
    markHeaderRows(tableEl);
  }
  applyVariationClasses(tableEl, styles, id);

  block.textContent = '';
  block.appendChild(tableEl);

  let cachedFunds = [];

  block.addEventListener('fund-prices-table:refresh', async (e) => {
    const { date } = e.detail;
    if (e.detail.latestDate) latestMdate = e.detail.latestDate;
    await refreshTableFromPrices(tableEl, cachedFunds, date);
  });
  block.dataset.ready = 'true';
  block.dispatchEvent(new CustomEvent('fund-prices-table:ready', { bubbles: true }));

  const section = block.closest('.section');
  const isControlled = !!section?.querySelector('.fund-prices');
  if (isControlled) return;

  try {
    const { ALL_FUND_NAMES_URL, LATEST_DATE_URL } = await getApiUrls();
    const [latestJson, namesData] = await Promise.all([
      fetchGet(LATEST_DATE_URL, { throwOnError: false }),
      fetchGet(ALL_FUND_NAMES_URL, { throwOnError: false }),
    ]);
    let date = new Date();
    if (latestJson) {
      const rawDate = Array.isArray(latestJson) ? latestJson[0]?.mDate : latestJson?.mDate;
      latestMdate = rawDate ? rawDate.split('T')[0] : null;
      const parsed = latestMdate ? parseLocalDateFromYmd(latestMdate) : null;
      if (parsed) date = parsed;
    }
    if (namesData) {
      cachedFunds = Array.isArray(namesData) ? namesData : [];
    }
    await refreshTableFromPrices(tableEl, cachedFunds, date);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('fund-prices-table: standalone init failed', err);
  }
}
