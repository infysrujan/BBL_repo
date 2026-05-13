import attachCalendarPicker from '../../scripts/utils/calendar-picker.js';
import { isAuthoringInstance } from '../../scripts/bbl-decorators.js';
import {
  ALL_FUND_NAMES_URL,
  LATEST_DATE_URL,
  fetchNavEnabledDaysForMonth,
  parseLocalDateFromYmd,
} from '../fund-prices-table/fund-prices-table.js';

const FUND_DETAIL_STATS_BASE = 'https://publish-p185039-e1938068.adobeaemcloud.com/api/nav/FundMaxMinNav';
const FUND_DETAIL_HISTORY_BASE = 'https://publish-p185039-e1938068.adobeaemcloud.com/api/nav/NavHistory';

const MAX_FUND_PRICE_HISTORY_YEARS = 3;

const PERIOD_OPTIONS = [
  { code: '1W', label: '1 Week' },
  { code: '1M', label: '1 Month' },
  { code: '3M', label: '3 Months' },
  { code: '6M', label: '6 Months' },
  { code: '1Y', label: '1 Year' },
  { code: '3Y', label: '3 Years' },
  { code: 'DR', label: 'Date Range' },
];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatDMY(date) {
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function isDateOlderThanFundHistoryLimit(date) {
  const today = new Date();
  const cutoff = new Date(
    today.getFullYear() - MAX_FUND_PRICE_HISTORY_YEARS,
    today.getMonth(),
    today.getDate(),
  );
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()) < cutoff;
}

function isRangeExceedsLimit(fromDate, toDate) {
  const limitedFrom = new Date(
    toDate.getFullYear() - MAX_FUND_PRICE_HISTORY_YEARS,
    toDate.getMonth(),
    toDate.getDate(),
  );
  return fromDate < limitedFrom;
}

function formatDatePath(date) {
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

async function fetchFundDetailStats(fundId, fromDate, toDate) {
  const from = formatDatePath(fromDate);
  const to = formatDatePath(toDate);
  const res = await fetch(`${FUND_DETAIL_STATS_BASE}/${fundId}/${from}/${to}`);
  if (!res.ok) throw new Error(`FundDetailStats ${res.status}`);
  return res.json();
}

async function fetchFundDetailHistory(fundId, fromDate, toDate) {
  const from = formatDatePath(fromDate);
  const to = formatDatePath(toDate);
  const res = await fetch(`${FUND_DETAIL_HISTORY_BASE}/${fundId}/${from}/${to}`);
  if (!res.ok) throw new Error(`FundDetailHistory ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

function getLang() {
  const lang = typeof document !== 'undefined'
    ? document.documentElement.getAttribute('lang')
    : null;
  return lang && lang.toLowerCase().startsWith('th') ? 'th' : 'en';
}

function richTextFromRow(row) {
  if (!row) return '';
  const cell = row.querySelector(':scope > div');
  return (cell ?? row).innerHTML.trim();
}

function printContent(containerEl) {
  if (!containerEl) return;
  const clone = containerEl.cloneNode(true);
  const printHideSelectors = '.fund-prices-print-label, .fund-prices-error-message, .fund-prices-search-bar';
  clone.querySelectorAll(printHideSelectors).forEach((el) => el.remove());
  const inp = clone.querySelector('.calendar-input input');
  if (inp) inp.parentNode?.replaceChild(document.createTextNode(inp.value), inp);
  const orig = document.body.innerHTML;
  document.body.innerHTML = clone.outerHTML;
  window.print();
  document.body.innerHTML = orig;
  window.location.reload();
}

/* ── Detail view helpers ─────────────────────────────────────── */

function fmtNav(v) {
  return typeof v === 'number' ? v.toFixed(4) : (v ?? 'N/A');
}

function fmtHistDate(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) return ymd;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function renderStatTables(stats, highTbody, lowTbody) {
  const rows = [
    { label: 'In the selected period', hi: stats.MaxSelected_fNav, lo: stats.MinSelected_fNav },
    { label: 'During the last 12 months', hi: stats.MaxYear_fNav, lo: stats.MinYear_fNav },
    { label: 'Since Inception', hi: stats.MaxSince_fNav, lo: stats.MinSince_fNav },
  ];

  [highTbody, lowTbody].forEach((tbody) => { tbody.innerHTML = ''; });

  rows.forEach(({ label, hi, lo }) => {
    [[highTbody, hi], [lowTbody, lo]].forEach(([tbody, val]) => {
      const tr = tbody.ownerDocument.createElement('tr');
      tr.innerHTML = `<td>${label}</td><td class="stat-nav-val">${fmtNav(val)}</td>`;
      tbody.appendChild(tr);
    });
  });
}

function renderChart(svgEl, history) {
  svgEl.innerHTML = '';
  const doc = svgEl.ownerDocument;
  const ns = 'http://www.w3.org/2000/svg';

  function el(tag, attrs, parent) {
    const e = doc.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    if (parent) parent.appendChild(e);
    return e;
  }

  if (!history || history.length < 2) {
    el('text', {
      x: '50%',
      y: '50%',
      'text-anchor': 'middle',
      'font-size': 14,
      fill: '#999',
    }, svgEl).textContent = 'No data';
    return;
  }

  const W = 940; const H = 300; const padL = 58; const padR = 20; const padT = 20; const padB = 44;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const navs = history.map((d) => d.mfr_fNav);
  const rawMin = Math.min(...navs);
  const rawMax = Math.max(...navs);
  const tickStep = 0.5;
  const yMin = Math.floor(rawMin / tickStep) * tickStep - tickStep * 0.5;
  const yMax = Math.ceil(rawMax / tickStep) * tickStep + tickStep * 0.5;

  const xPos = (i) => padL + (i / (history.length - 1)) * innerW;
  const yPos = (v) => padT + (1 - (v - yMin) / (yMax - yMin)) * innerH;

  const numYTicks = Math.round((yMax - yMin) / tickStep);
  for (let i = 0; i <= numYTicks; i += 1) {
    const v = yMin + i * tickStep;
    const y = yPos(v);
    el('line', {
      x1: padL,
      y1: y,
      x2: W - padR,
      y2: y,
      stroke: '#E8E8E8',
      'stroke-width': 1,
    }, svgEl);
    el('text', {
      x: padL - 8,
      y: y + 4,
      'text-anchor': 'end',
      'font-size': 11,
      fill: '#78787D',
      'font-family': 'BangkokBank-Regular,Arial,sans-serif',
    }, svgEl).textContent = v.toFixed(1);
  }

  history.forEach((d, i) => {
    const x = xPos(i);
    el('line', {
      x1: x,
      y1: padT,
      x2: x,
      y2: H - padB,
      stroke: '#E8E8E8',
      'stroke-width': 1,
    }, svgEl);
    el('text', {
      x,
      y: H - padB + 16,
      'text-anchor': 'middle',
      'font-size': 11,
      fill: '#78787D',
      'font-family': 'BangkokBank-Regular,Arial,sans-serif',
    }, svgEl).textContent = fmtHistDate(d.mfr_dDataDate);
  });

  const pts = history.map((d, i) => `${xPos(i)},${yPos(d.mfr_fNav)}`).join(' ');
  el('polyline', {
    points: pts,
    fill: 'none',
    stroke: '#002850',
    'stroke-width': 2.5,
    'stroke-linejoin': 'round',
    'stroke-linecap': 'round',
  }, svgEl);

  const tooltipG = el('g', { style: 'display:none; pointer-events:none' }, svgEl);
  el('rect', {
    width: 120,
    height: 54,
    rx: 6,
    fill: '#1a2e4a',
  }, tooltipG);
  const tooltipDate = el('text', {
    x: 10,
    y: 20,
    fill: '#b0c4d8',
    'font-size': 11,
    'font-family': 'BangkokBank-Regular,Arial,sans-serif',
  }, tooltipG);
  const tooltipVal = el('text', {
    x: 10,
    y: 42,
    fill: '#ffffff',
    'font-size': 15,
    'font-family': 'BangkokBank-Medium,Arial,sans-serif',
  }, tooltipG);

  history.forEach((d, i) => {
    const cx = xPos(i);
    const cy = yPos(d.mfr_fNav);
    el('circle', {
      cx,
      cy,
      r: 4,
      fill: '#002850',
      stroke: '#fff',
      'stroke-width': 2,
    }, svgEl);
    const hit = el('circle', {
      cx,
      cy,
      r: 14,
      fill: 'transparent',
      style: 'cursor:pointer',
    }, svgEl);
    hit.addEventListener('mouseenter', () => {
      tooltipG.style.display = '';
      let tx = cx + 12;
      let ty = cy - 62;
      if (tx + 124 > W) tx = cx - 132;
      if (ty < 0) ty = cy + 10;
      tooltipG.setAttribute('transform', `translate(${tx},${ty})`);
      tooltipDate.textContent = fmtHistDate(d.mfr_dDataDate);
      tooltipVal.textContent = fmtNav(d.mfr_fNav);
    });
    hit.addEventListener('mouseleave', () => { tooltipG.style.display = 'none'; });
  });
}

function renderHistTable(tbody, history) {
  tbody.innerHTML = '';
  history.forEach((d) => {
    const tr = tbody.ownerDocument.createElement('tr');
    tr.innerHTML = `<td>${fmtHistDate(d.mfr_dDataDate)}</td>`
      + `<td>${fmtNav(d.mfr_fNav)}</td>`
      + `<td>${fmtNav(d.mfr_fBuy)}</td>`
      + `<td>${fmtNav(d.mfr_fSel)}</td>`;
    tbody.appendChild(tr);
  });
}

/* ── DOM builders ────────────────────────────────────────────── */

function buildFundSelectorBar(doc, funds) {
  const bar = doc.createElement('div');
  bar.className = 'fund-prices-search-bar';

  const lbl = doc.createElement('label');
  lbl.textContent = 'Search Fund';
  lbl.htmlFor = 'fund-select-btn';

  const wrapper = doc.createElement('div');
  wrapper.className = 'fund-select-wrapper';

  const btn = doc.createElement('button');
  btn.className = 'fund-select-btn';
  btn.id = 'fund-select-btn';
  btn.setAttribute('aria-haspopup', 'listbox');
  btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = 'ALL FUNDS <span class="icon-dropdown"></span>';

  const list = doc.createElement('ul');
  list.className = 'fund-dropdown';
  list.setAttribute('role', 'listbox');

  const allOption = doc.createElement('li');
  allOption.textContent = 'ALL FUNDS';
  allOption.setAttribute('role', 'option');
  allOption.classList.add('active');
  list.appendChild(allOption);

  const lang = getLang();
  funds.forEach((f) => {
    const name = lang === 'th' ? (f.mf_sTha || f.mf_sEng) : (f.mf_sEng || f.mf_sTha);
    if (!name) return;
    const li = doc.createElement('li');
    li.textContent = name;
    li.setAttribute('role', 'option');
    li.dataset.fundId = f.mf_iNumber;
    li.dataset.fundName = name;
    list.appendChild(li);
  });

  wrapper.appendChild(btn);
  wrapper.appendChild(list);

  const goBtn = doc.createElement('button');
  goBtn.className = 'fund-search-go-btn';
  goBtn.textContent = 'GO';

  bar.appendChild(lbl);
  bar.appendChild(wrapper);
  bar.appendChild(goBtn);

  let selectedFund = null;

  function selectItem(li) {
    list.querySelectorAll('li').forEach((l) => l.classList.remove('active'));
    li.classList.add('active');
    if (li === allOption) {
      btn.childNodes[0].textContent = 'ALL FUNDS ';
      selectedFund = null;
    } else {
      btn.childNodes[0].textContent = `${li.dataset.fundName} `;
      selectedFund = { id: li.dataset.fundId, name: li.dataset.fundName };
    }
    list.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = list.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
  });

  [allOption, ...list.querySelectorAll('li:not(:first-child)')].forEach((li) => {
    li.addEventListener('click', () => selectItem(li));
  });

  doc.addEventListener('click', () => {
    list.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  });

  return {
    el: bar,
    getSelected: () => selectedFund,
    goBtn,
    resetToAll: () => selectItem(allOption),
  };
}

function buildDetailView(doc) {
  const view = doc.createElement('div');
  view.className = 'fund-detail-view hidden';
  view.hidden = true;

  view.innerHTML = `
    <div class="detail-header">
      <div>
        <div class="detail-title">Fund Price Details</div>
        <div class="detail-fund-label"></div>
      </div>
      <div class="fund-prices-print-label icon-print"><p>Print</p></div>
    </div>

    <div class="detail-period-bar">
      <div class="period-select-wrapper">
        <button class="period-select-btn">
          <span class="period-select-label">1 Week</span>
          <span class="icon-dropdown"></span>
        </button>
        <ul class="period-dropdown-list">
          ${PERIOD_OPTIONS.map((p) => `<li data-period="${p.code}">${p.label}</li>`).join('')}
        </ul>
      </div>
      <div class="period-date-range hidden">
        <label>FROM</label>
        <div class="calendar-input icon-calendar"><input type="text" id="dr-from" /></div>
        <label>TO</label>
        <div class="calendar-input icon-calendar"><input type="text" id="dr-to" /></div>
      </div>
      <div class="detail-range-error hidden" role="alert"></div>
    </div>

    <div class="stat-tables-row">
      <div class="stat-table-card">
        <table class="stat-table" id="stat-high-table">
          <thead><tr><th>Highest Fund Price</th><th class="stat-th-nav">NAV</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="stat-table-card">
        <table class="stat-table" id="stat-low-table">
          <thead><tr><th>Lowest Fund Price</th><th class="stat-th-nav">NAV</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </div>

    <div class="tab-switcher">
      <button class="tab-btn active" data-tab="graph">GRAPH</button>
      <button class="tab-btn" data-tab="table">VIEW TABLE DATA</button>
    </div>

    <div class="detail-chart-panel">
      <div class="chart-wrap">
        <div class="chart-header">
          <span class="chart-subtitle"></span>
          <div class="chart-nav-labels">
            <span class="chart-nav-item">Beginning NAV <span class="chart-begin-nav"></span></span>
            <span class="chart-nav-item">Ending NAV <span class="chart-end-nav"></span></span>
          </div>
        </div>
        <svg class="detail-chart-svg" viewBox="0 0 940 300" preserveAspectRatio="xMidYMid meet"></svg>
      </div>
    </div>

    <div class="detail-table-panel hidden">
      <table class="detail-hist-table">
        <thead><tr><th>Date</th><th>NAV</th><th>Selling Price</th><th>Redemption Price</th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
  `;

  return view;
}

/* ── Main export ─────────────────────────────────────────────── */

export default async function decorate(block) {
  const doc = block.ownerDocument;
  const rows = [...block.children];
  const section = block.closest('.section');

  const dateLabelHtml = richTextFromRow(rows[0]);
  const printLabelHtml = richTextFromRow(rows[1]);
  const errorMessageHtml = richTextFromRow(rows[2]);
  const disclaimerHtml = richTextFromRow(rows[3]);

  block.innerHTML = '';

  if (isAuthoringInstance(block)) {
    const authorRoot = doc.createElement('div');
    authorRoot.className = 'fund-prices-root';
    const toolbar = doc.createElement('div');
    toolbar.className = 'fund-prices-toolbar';
    toolbar.innerHTML = dateLabelHtml;
    const printLbl = doc.createElement('div');
    printLbl.className = 'fund-prices-print-label icon-print';
    printLbl.innerHTML = printLabelHtml;
    toolbar.appendChild(printLbl);
    const dis = doc.createElement('div');
    dis.className = 'fund-prices-disclaimer-text';
    dis.innerHTML = disclaimerHtml;
    authorRoot.append(toolbar, dis);
    block.appendChild(authorRoot);
    return;
  }

  const ftBlock = section?.querySelector('.fund-prices-table');

  let funds = [];
  let latestMdate = null;
  let calendarDate = new Date();
  let currentDate = calendarDate;

  try {
    const [namesRes, latestRes] = await Promise.all([
      fetch(ALL_FUND_NAMES_URL),
      fetch(LATEST_DATE_URL),
    ]);
    if (latestRes.ok) {
      const lj = await latestRes.json();
      latestMdate = lj?.mdate;
      const parsed = lj?.mdate ? parseLocalDateFromYmd(lj.mdate) : null;
      if (parsed) { calendarDate = parsed; currentDate = parsed; }
    }
    if (namesRes.ok) {
      const data = await namesRes.json();
      funds = Array.isArray(data) ? data : [];
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('fund-prices: init failed', e);
  }

  function dispatchTableRefresh(date) {
    ftBlock?.dispatchEvent(new CustomEvent('fund-prices-table:refresh', {
      detail: { date, latestDate: latestMdate },
    }));
  }

  dispatchTableRefresh(calendarDate);

  /* ── Root ── */
  const root = doc.createElement('div');
  root.className = 'fund-prices-root';

  /* ── Fund selector bar ── */
  const fundSelector = buildFundSelectorBar(doc, funds);
  root.appendChild(fundSelector.el);

  /* ── Main view ── */
  const mainView = doc.createElement('div');
  mainView.className = 'fund-prices-main-view';

  const calendarWrapper = doc.createElement('div');
  calendarWrapper.className = 'calendar-wrapper';
  calendarWrapper.dataset.field = 'date-label';
  calendarWrapper.innerHTML = dateLabelHtml;

  const printLabel = doc.createElement('div');
  printLabel.className = 'fund-prices-print-label icon-print';
  printLabel.dataset.field = 'print-label';
  printLabel.innerHTML = printLabelHtml;

  const errorMessage = doc.createElement('div');
  errorMessage.classList.add('fund-prices-error-message', 'hidden');
  errorMessage.hidden = true;
  errorMessage.dataset.field = 'error-message';
  errorMessage.setAttribute('role', 'alert');
  errorMessage.setAttribute('aria-live', 'polite');
  errorMessage.innerHTML = errorMessageHtml;

  const disclaimer = doc.createElement('div');
  disclaimer.className = 'fund-prices-disclaimer-text';
  disclaimer.dataset.field = 'disclaimer-text';
  disclaimer.innerHTML = disclaimerHtml;

  const calendarInput = doc.createElement('div');
  const dateInput = doc.createElement('input');
  dateInput.id = 'date-to';
  dateInput.type = 'text';
  dateInput.name = 'date-to';
  calendarInput.classList.add('calendar-input', 'icon-calendar');
  calendarInput.appendChild(dateInput);
  calendarWrapper.appendChild(calendarInput);

  attachCalendarPicker({
    input: dateInput,
    value: calendarDate,
    fetchEnabledDays: fetchNavEnabledDaysForMonth,
    onChange: (selectedDate) => {
      if (isDateOlderThanFundHistoryLimit(selectedDate)) {
        errorMessage.classList.remove('hidden');
        errorMessage.hidden = false;
        return;
      }
      errorMessage.classList.add('hidden');
      errorMessage.hidden = true;
      currentDate = selectedDate;
      dispatchTableRefresh(selectedDate);
    },
  });

  const toolbar = doc.createElement('div');
  toolbar.className = 'fund-prices-toolbar';
  toolbar.appendChild(calendarWrapper);
  toolbar.appendChild(printLabel);

  mainView.append(toolbar, errorMessage, disclaimer);
  root.appendChild(mainView);

  /* ── Detail view ── */
  const detailView = buildDetailView(doc);
  root.appendChild(detailView);

  block.appendChild(root);

  /* ── Print handlers ── */
  printLabel.addEventListener('click', (e) => {
    e.preventDefault();
    printContent(section ?? root);
  });
  detailView.querySelector('.fund-prices-print-label')
    .addEventListener('click', (e) => { e.preventDefault(); printContent(detailView); });

  /* ── Detail view wiring ── */
  let currentFund = null;
  let currentPeriod = '1W';
  let drFrom = null;
  let drTo = null;

  const periodSelectBtn = detailView.querySelector('.period-select-btn');
  const periodSelectLabel = detailView.querySelector('.period-select-label');
  const periodDropList = detailView.querySelector('.period-dropdown-list');
  const periodDateRangeEl = detailView.querySelector('.period-date-range');
  const rangeError = detailView.querySelector('.detail-range-error');
  const highTbody = detailView.querySelector('#stat-high-table tbody');
  const lowTbody = detailView.querySelector('#stat-low-table tbody');
  const chartSvg = detailView.querySelector('.detail-chart-svg');
  const chartSubtitle = detailView.querySelector('.chart-subtitle');
  const chartBeginNav = detailView.querySelector('.chart-begin-nav');
  const chartEndNav = detailView.querySelector('.chart-end-nav');
  const chartPanel = detailView.querySelector('.detail-chart-panel');
  const tablePanel = detailView.querySelector('.detail-table-panel');
  const histTbody = detailView.querySelector('.detail-hist-table tbody');
  const fundLabel = detailView.querySelector('.detail-fund-label');

  const drFromInput = detailView.querySelector('#dr-from');
  const drToInput = detailView.querySelector('#dr-to');

  const todayDate = new Date();
  drFrom = new Date(todayDate.getFullYear(), todayDate.getMonth() - 1, 1);
  drTo = new Date();

  function periodDateRange(periodCode) {
    const end = latestMdate ? (parseLocalDateFromYmd(latestMdate) ?? new Date()) : new Date();
    const y = end.getFullYear();
    const mo = end.getMonth();
    const d = end.getDate();
    const from = {
      '1W': new Date(y, mo, d - 7),
      '1M': new Date(y, mo - 1, d),
      '3M': new Date(y, mo - 3, d),
      '6M': new Date(y, mo - 6, d),
      '1Y': new Date(y - 1, mo, d),
      '3Y': new Date(y - 3, mo, d),
    }[periodCode] ?? end;
    return { from, to: end };
  }

  function buildSubtitle(fromDate, toDate) {
    return `"${currentFund?.name}" Open-end Fund : ${formatDMY(fromDate)} - ${formatDMY(toDate)}`;
  }

  async function renderDetail(fromDate, toDate) {
    const subtitle = buildSubtitle(fromDate, toDate);
    fundLabel.textContent = subtitle;

    try {
      const [stats, history] = await Promise.all([
        fetchFundDetailStats(currentFund.id, fromDate, toDate),
        fetchFundDetailHistory(currentFund.id, fromDate, toDate),
      ]);
      const sorted = [...history].sort((a, b) => a.mfr_dDataDate.localeCompare(b.mfr_dDataDate));
      renderStatTables(stats, highTbody, lowTbody);
      chartSubtitle.textContent = subtitle;
      chartBeginNav.textContent = fmtNav(stats.Begin_fNav);
      chartEndNav.textContent = fmtNav(stats.End_fNav);
      renderChart(chartSvg, sorted);
      renderHistTable(histTbody, [...sorted].reverse());
    } catch {
      renderStatTables({}, highTbody, lowTbody);
      renderChart(chartSvg, []);
      renderHistTable(histTbody, []);
    }
  }

  function validateAndRenderDetail() {
    if (currentPeriod === 'DR') {
      if (drFrom && drTo && isRangeExceedsLimit(drFrom, drTo)) {
        rangeError.textContent = 'Date range should be between 3 years';
        rangeError.classList.remove('hidden');
        return;
      }
      rangeError.classList.add('hidden');
      if (drFrom && drTo) renderDetail(drFrom, drTo);
    } else {
      rangeError.classList.add('hidden');
      const { from, to } = periodDateRange(currentPeriod);
      renderDetail(from, to);
    }
  }

  attachCalendarPicker({
    input: drFromInput,
    value: drFrom,
    allDaysEnabled: true,
    onChange: (d) => { drFrom = d; validateAndRenderDetail(); },
  });
  attachCalendarPicker({
    input: drToInput,
    value: drTo,
    allDaysEnabled: true,
    onChange: (d) => { drTo = d; validateAndRenderDetail(); },
  });

  /* Period dropdown */
  periodSelectBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    periodDropList.classList.toggle('open');
  });
  doc.addEventListener('click', () => periodDropList.classList.remove('open'));

  periodDropList.addEventListener('click', (e) => {
    const li = e.target.closest('li');
    if (!li) return;
    const { period } = li.dataset;
    periodDropList.querySelectorAll('li').forEach((l) => l.classList.toggle('active', l === li));
    const opt = PERIOD_OPTIONS.find((p) => p.code === period);
    periodSelectLabel.textContent = opt?.label ?? period;
    periodDropList.classList.remove('open');
    currentPeriod = period;
    if (period === 'DR') {
      periodDateRangeEl.classList.remove('hidden');
    } else {
      periodDateRangeEl.classList.add('hidden');
      validateAndRenderDetail();
    }
  });

  /* Tab switcher */
  detailView.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      detailView.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      if (btn.dataset.tab === 'graph') {
        chartPanel.classList.remove('hidden');
        tablePanel.classList.add('hidden');
      } else {
        tablePanel.classList.remove('hidden');
        chartPanel.classList.add('hidden');
      }
    });
  });

  /* GO button */
  function showMainView() {
    mainView.classList.remove('hidden');
    if (ftBlock) ftBlock.classList.remove('hidden');
    detailView.classList.add('hidden');
    detailView.hidden = true;
  }

  function showDetailView(fund) {
    currentFund = fund;
    currentPeriod = '1W';
    periodSelectLabel.textContent = '1 Week';
    periodDropList.querySelectorAll('li')
      .forEach((l) => l.classList.toggle('active', l.dataset.period === '1W'));
    periodDateRangeEl.classList.add('hidden');
    rangeError.classList.add('hidden');
    detailView.querySelector('.tab-btn[data-tab="graph"]').classList.add('active');
    detailView.querySelector('.tab-btn[data-tab="table"]').classList.remove('active');
    chartPanel.classList.remove('hidden');
    tablePanel.classList.add('hidden');

    mainView.classList.add('hidden');
    if (ftBlock) ftBlock.classList.add('hidden');
    detailView.classList.remove('hidden');
    detailView.hidden = false;

    validateAndRenderDetail();
  }

  fundSelector.goBtn.addEventListener('click', () => {
    const selected = fundSelector.getSelected();
    if (selected) {
      showDetailView(selected);
    } else {
      showMainView();
      dispatchTableRefresh(currentDate);
    }
  });
}
