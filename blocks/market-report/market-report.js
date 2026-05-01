const MARKET_SUMMARY_URL = [
  'https://publish-p185039-e1938068.adobeaemcloud.com',
  '/api/MarketService/GetMarketsum',
].join('');

const MARKET_LOAN_RATE_URL = 'https://publish-p185039-e1938068.adobeaemcloud.com/api/interestratesservice/GetLoanRate';
const MARKET_DEPOSIT_RATE_URL = 'https://publish-p185039-e1938068.adobeaemcloud.com/api/interestratesservice/GetDepositRate';
const ALL_MAPPED_CODES = new Set([
  'RR',
  'USIR',
  'MMR',
  'USTS',
  'TSB',
  'CMST',
  'THBUSD',
  'WI',
  'FXR',
  'THBR',
  'WGS',
  'OTHBIS',
  'GTHB',
  'FXMO',
  'TBMO',
]);

/**
 * @param {unknown} payload - Raw JSON from GetMarketsum
 * @returns {{
 *   mktdate: string | null,
 *   rows: Array<{ mktcode?: string, mktno?: string, mktvalue?: string }>,
 * }}
 */
export function parseMarketSumResponse(payload) {
  if (!Array.isArray(payload) || payload.length < 2) {
    return { mktdate: null, rows: [] };
  }
  const dateRow = payload[0]?.[0];
  const mktdate = typeof dateRow?.mktdate === 'string' ? dateRow.mktdate : null;
  const rows = Array.isArray(payload[1]) ? payload[1] : [];
  return { mktdate, rows };
}

/**
 * Split flat market rows into arrays keyed by mktcode (only mapped codes).
 * Each array is sorted by numeric mktno.
 * @param {Array<{ mktcode?: string, mktno?: string, mktvalue?: string }>} rows
 * @returns {Record<string, Array<{ mktcode: string, mktno: string, mktvalue: string }>>}
 */
export function groupMarketRowsByCode(rows) {
  /** @type {Record<string, Array<{ mktcode: string, mktno: string, mktvalue: string }>>} */
  const byCode = {};
  ALL_MAPPED_CODES.forEach((code) => {
    byCode[code] = [];
  });

  rows.forEach((row) => {
    const code = row?.mktcode;
    if (!code || !ALL_MAPPED_CODES.has(code)) return;
    byCode[code].push({
      mktcode: code,
      mktno: String(row.mktno ?? ''),
      mktvalue: String(row.mktvalue ?? ''),
    });
  });

  Object.keys(byCode).forEach((code) => {
    byCode[code].sort((a, b) => Number(a.mktno) - Number(b.mktno));
  });

  return byCode;
}

/**
 * Full model: date + column1/column2 groups + flat lookup by code.
 * @param {unknown} payload - Raw JSON from GetMarketsum
 */
export function buildMarketReportModel(payload) {
  const { mktdate, rows } = parseMarketSumResponse(payload);
  const byMktCode = groupMarketRowsByCode(rows);

  return {
    mktdate,
    byMktCode,
  };
}

async function fetchMarketSummary() {
  const response = await fetch(MARKET_SUMMARY_URL);
  if (!response.ok) {
    throw new Error(`MarketService GetMarketsum failed: ${response.status}`);
  }
  return response.json();
}

/**
 * @param {string} url
 * @returns {Promise<unknown[] | null>}
 */
async function fetchInterestRateArray(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

/**
 * @param {HTMLTableElement} table
 * @returns {HTMLTableSectionElement}
 */
function getTableBodyForDataRows(table) {
  let tbody = table.tBodies[0];
  if (!tbody) {
    tbody = document.createElement('tbody');
    const thead = table.querySelector('thead');
    if (thead) {
      table.insertBefore(tbody, thead.nextSibling);
    } else {
      table.appendChild(tbody);
    }
  }
  return tbody;
}

/**
 * @param {HTMLTableElement} table
 * @param {HTMLTableSectionElement} tbody
 */
function columnCountForInterestTable(table, tbody) {
  const firstBodyRow = tbody.querySelector('tr');
  let n = firstBodyRow?.querySelectorAll('td').length ?? 0;
  if (n === 0) {
    const headerRow = table.querySelector('thead tr');
    n = headerRow?.querySelectorAll('th, td').length ?? 0;
  }
  return n > 0 ? n : 2;
}

/**
 * @param {string[]} values
 * @param {number} colCount
 */
function padToColumnCount(values, colCount) {
  const out = values.slice(0, colCount);
  while (out.length < colCount) out.push('');
  return out;
}

/**
 * @param {HTMLTableRowElement} tr
 * @param {string[]} texts
 */
function fillInterestRateRowCells(tr, texts) {
  const cells = tr.querySelectorAll('td');
  texts.forEach((text, j) => {
    if (cells[j]) cells[j].textContent = text;
  });
}

/**
 * @param {string[]} texts
 * @returns {HTMLTableRowElement}
 */
function createInterestRateRow(texts) {
  const tr = document.createElement('tr');
  texts.forEach((text) => {
    const td = document.createElement('td');
    td.textContent = text;
    tr.appendChild(td);
  });
  return tr;
}

/**
 * @param {HTMLTableElement} table
 * @param {Array<{ LoanNameEn?: string, LoanName?: string, LoanRates?: string }>} rows
 */
function populateLoanRateTableFromApi(table, rows) {
  if (!table || !Array.isArray(rows)) return;
  const tbody = getTableBodyForDataRows(table);
  const existingRows = [...tbody.querySelectorAll('tr')];
  const colCount = columnCountForInterestTable(table, tbody);

  rows.forEach((item, i) => {
    const texts = padToColumnCount(
      [item.LoanNameEn ?? item.LoanName ?? '', item.LoanRates ?? ''],
      colCount,
    );
    if (i < existingRows.length) {
      fillInterestRateRowCells(existingRows[i], texts);
    } else {
      tbody.appendChild(createInterestRateRow(texts));
    }
  });
}

/**
 * @param {HTMLTableElement} table
 * @param {Array<{ DepositNameEn?: string, DepositName?: string, DepositRates?: string }>} rows
 */
function populateDepositRateTableFromApi(table, rows) {
  if (!table || !Array.isArray(rows)) return;
  const tbody = getTableBodyForDataRows(table);
  const existingRows = [...tbody.querySelectorAll('tr')];
  const colCount = columnCountForInterestTable(table, tbody);

  rows.forEach((item, i) => {
    const texts = padToColumnCount(
      [item.DepositNameEn ?? item.DepositName ?? '', item.DepositRates ?? ''],
      colCount,
    );
    if (i < existingRows.length) {
      fillInterestRateRowCells(existingRows[i], texts);
    } else {
      tbody.appendChild(createInterestRateRow(texts));
    }
  });
}

/**
 * @param {ParentNode} root
 * @param {unknown[] | null} loanRows
 * @param {unknown[] | null} depositRows
 */
function populateLoanAndDepositTables(root, loanRows, depositRows) {
  const lr = root.querySelector('table#lr');
  const dr = root.querySelector('table#dr');
  if (lr && loanRows) {
    populateLoanRateTableFromApi(lr, loanRows);
  }
  if (dr && depositRows) {
    populateDepositRateTableFromApi(dr, depositRows);
  }
}

/** @param {HTMLTableElement} table */
function tableUsesHeaderRowClass(table) {
  return [...table.classList].some((cls) => cls.startsWith('header-'));
}

/**
 * @param {HTMLTableElement} table
 * @param {string} tableId
 * @param {Array<{ mktvalue: string }> | undefined} tableData
 */
function populateHeaderClassTable(table, tableId, tableData) {
  if (!Array.isArray(tableData)) return;

  const bodyRows = [...table.querySelectorAll('tr')].slice(1);

  if (tableId === 'THBUSD') {
    bodyRows.forEach((row, i) => {
      const tds = row.querySelectorAll('td');
      for (let j = 1; j < tds.length - 1; j += 1) {
        const dataIndex = i * (tds.length - 2) + (j - 1);
        if (tableData[dataIndex]) {
          tds[j].textContent = tableData[dataIndex].mktvalue;
        }
      }
    });
    return;
  }

  bodyRows.forEach((row, i) => {
    const tds = row.querySelectorAll('td');
    for (let j = 1; j < tds.length; j += 1) {
      const dataIndex = i * (tds.length - 1) + (j - 1);
      if (tableData[dataIndex]) {
        tds[j].textContent = tableData[dataIndex].mktvalue;
      }
    }
  });
}

/**
 * @param {HTMLTableElement} table
 * @param {string} tableId
 * @param {Array<{ mktvalue: string }> | undefined} tableData
 */
function populateStandardLayoutTable(table, tableId, tableData) {
  if (!Array.isArray(tableData)) return;

  const rows = table.querySelectorAll('tr');

  if (tableId === 'CMST') {
    rows.forEach((row, i) => {
      const tds = row.querySelectorAll('td');
      if (i === 0 && tds[0] && tableData[0]) {
        const extra = tableData[0].mktvalue ? ` ${tableData[0].mktvalue}` : '';
        tds[0].textContent = `${tds[0].textContent}${extra}`;
      }
      for (let j = 1; j < tds.length; j += 1) {
        const dataIndex = (i * (tds.length - 1)) + (j - 1) + 1;
        if (tableData[dataIndex]) {
          tds[j].textContent = tableData[dataIndex].mktvalue;
        }
      }
    });
    return;
  }

  rows.forEach((row, i) => {
    const tds = row.querySelectorAll('td');
    for (let j = 1; j < tds.length; j += 1) {
      const dataIndex = i * (tds.length - 1) + (j - 1);
      if (tableData[dataIndex]) {
        tds[j].textContent = tableData[dataIndex].mktvalue;
      }
    }
  });
}

/**
 * @param {HTMLElement} panel
 * @param {Record<string, Array<{ mktcode: string, mktno: string, mktvalue: string }>>} byMktCode
 */
function populateTablesInPanel(panel, byMktCode) {
  [...panel.querySelectorAll('table')].forEach((table) => {
    const tableId = table.getAttribute('id')?.toUpperCase();
    if (!tableId) return;
    const tableData = byMktCode[tableId];
    if (tableUsesHeaderRowClass(table)) {
      populateHeaderClassTable(table, tableId, tableData);
    } else {
      populateStandardLayoutTable(table, tableId, tableData);
    }
  });
}

/**
 * Appends each row's mktvalue as parsed HTML (entities and tags like &nbsp;, <br>).
 * Inserts a leading space before the first non-empty row and a line break before the second.
 * @param {HTMLElement} container
 * @param {Array<{ mktvalue: string }> | undefined} rows
 */
function appendMktValuesAsHtml(container, rows) {
  if (!container || !Array.isArray(rows)) return;
  let nonEmptyIndex = 0;
  rows.forEach((r) => {
    const html = r?.mktvalue?.trim();
    if (!html) return;
    if (nonEmptyIndex === 0) {
      container.append(document.createTextNode(' '));
    } else if (nonEmptyIndex === 1) {
      container.append(document.createElement('br'));
    }
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    container.append(tpl.content);
    nonEmptyIndex += 1;
  });
}

/**
 * Appends FXMO values from the API to the first direct child of `.table-wrapper`.
 * @param {HTMLElement} tableWrapper
 * @param {Record<string, Array<{ mktcode: string, mktno: string, mktvalue: string }>>} tableData
 */
export function populateFxmo(tableWrapper, tableData) {
  const row = tableWrapper.children[0];
  if (!row) return;
  appendMktValuesAsHtml(row, tableData.FXMO);
}

/**
 * Appends TBMO values from the API to the second direct child of `.table-wrapper`.
 * @param {HTMLElement} tableWrapper
 * @param {Record<string, Array<{ mktcode: string, mktno: string, mktvalue: string }>>} tableData
 */
export function populateTbmo(tableWrapper, tableData) {
  const row = tableWrapper.children[1];
  if (!row) return;
  appendMktValuesAsHtml(row, tableData.TBMO);
}

/**
 * @param {HTMLElement[]} children
 */
function indexOfChildContainingRR(children) {
  return children.findIndex(
    (el) => el.querySelector?.('table#rr') || el.querySelector?.('table[id="RR"]'),
  );
}

/**
 * @param {HTMLElement[]} children
 * @param {number} blockIndex
 */
function indexOfPrecedingHeading(children, blockIndex) {
  for (let j = blockIndex - 1; j >= 0; j -= 1) {
    const { tagName } = children[j];
    if (tagName && /^H[1-6]$/i.test(tagName)) return j;
  }
  return blockIndex;
}

/**
 * Index of last <p> after the last div.table.block (exclusive end for right column).
 * @param {HTMLElement[]} children
 */
function indexAfterWhichRightColumnEnds(children) {
  const lastTableBlockIdx = children.reduce(
    (last, el, i) => (el.matches?.('div.table.block') ? i : last),
    -1,
  );
  if (lastTableBlockIdx < 0) return children.length;

  let lastPAfterLastTable = -1;
  for (let i = lastTableBlockIdx + 1; i < children.length; i += 1) {
    if (children[i].tagName === 'P') {
      lastPAfterLastTable = i;
    }
  }
  return lastPAfterLastTable >= 0 ? lastPAfterLastTable : children.length;
}

/**
 * @param {HTMLElement[]} leftNodes
 * @param {HTMLElement[]} rightNodes
 * @returns {HTMLDivElement}
 */
function buildTwoColumnPageLayout(leftNodes, rightNodes) {
  const pageLayout = document.createElement('div');
  pageLayout.classList.add('market-report-page');

  const leftCol = document.createElement('div');
  leftCol.className = 'market-report-col market-report-col--left';
  leftCol.style.flex = '4 1 0';
  leftNodes.forEach((node) => leftCol.appendChild(node));

  const rightCol = document.createElement('div');
  rightCol.className = 'market-report-col market-report-col--right';
  rightCol.style.flex = '1 1 0';
  rightNodes.forEach((node) => rightCol.appendChild(node));

  const inner = document.createElement('div');
  inner.className = 'market-report-page-content-inner';
  inner.style.display = 'flex';
  inner.style.gap = '2rem';
  inner.appendChild(leftCol);
  inner.appendChild(rightCol);

  const content = document.createElement('div');
  content.className = 'market-report-page-content';
  content.appendChild(inner);
  pageLayout.appendChild(content);
  return pageLayout;
}

/**
 * Split at heading before table#rr; right column excludes trailing footnote <p>.
 * @param {HTMLElement} tableWrapper
 */
function applyTableWrapperPageLayout(tableWrapper) {
  if (tableWrapper.querySelector(':scope > .market-report-page')) return;

  const wrapperChildren = [...tableWrapper.children];
  const rrBlockIndex = indexOfChildContainingRR(wrapperChildren);
  if (rrBlockIndex === -1) return;

  const splitRightStart = indexOfPrecedingHeading(wrapperChildren, rrBlockIndex);
  const rightEndExclusive = indexAfterWhichRightColumnEnds(wrapperChildren);

  const pageLayout = buildTwoColumnPageLayout(
    wrapperChildren.slice(0, splitRightStart),
    wrapperChildren.slice(splitRightStart, rightEndExclusive),
  );
  tableWrapper.insertBefore(pageLayout, tableWrapper.firstChild);
}

/**
 * @param {HTMLElement} block
 */
export default async function decorate() {
  try {
    const [summaryPayload, loanRows, depositRows] = await Promise.all([
      fetchMarketSummary(),
      fetchInterestRateArray(MARKET_LOAN_RATE_URL),
      fetchInterestRateArray(MARKET_DEPOSIT_RATE_URL),
    ]);
    const model = buildMarketReportModel(summaryPayload);
    const tabPanels = [...document.querySelectorAll('[role="tabpanel"]')];
    const firstPanel = tabPanels[0];

    if (firstPanel) {
      populateTablesInPanel(firstPanel, model.byMktCode);
      populateLoanAndDepositTables(firstPanel, loanRows, depositRows);
    }

    const tableWrapper = firstPanel?.querySelector('.table-wrapper');
    if (tableWrapper) {
      populateFxmo(tableWrapper, model.byMktCode);
      populateTbmo(tableWrapper, model.byMktCode);
      applyTableWrapperPageLayout(tableWrapper);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('market-report:', err);
  }
}
