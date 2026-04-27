const MARKET_SUMMARY_URL = [
  'https://publish-p185039-e1938068.adobeaemcloud.com',
  '/api/MarketService/GetMarketsum',
].join('');

/**
 * API codes for the first column (Reference Rate → World Index).
 * RR Reference Rate · USIR U.S. Interest Rate · MMR Money Market Rate at 9:00 am ·
 * USTS U.S. Treasury · TSB Treasury Bill · CMST Commodities at 8:00 am ·
 * THBUSD THB/USD Fwd Rate · WI World Index
 */
export const MARKET_CODES_COLUMN_1 = Object.freeze([
  'RR',
  'USIR',
  'MMR',
  'USTS',
  'TSB',
  'CMST',
  'THBUSD',
  'WI',
]);

/**
 * API codes for the second column (FX → Gov't THB Bonds).
 * FXR FX Rate · THBR Monetary Policy Rate · WGS World Government Security ·
 * OTHBIS Onshore THB Implied Swap · GTHB Gov't THB Bonds
 */
export const MARKET_CODES_COLUMN_2 = Object.freeze([
  'FXR',
  'THBR',
  'WGS',
  'OTHBIS',
  'GTHB',
]);

const ALL_MAPPED_CODES = new Set([
  ...MARKET_CODES_COLUMN_1,
  ...MARKET_CODES_COLUMN_2,
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

  const column1 = {};
  MARKET_CODES_COLUMN_1.forEach((code) => {
    column1[code] = byMktCode[code];
  });

  const column2 = {};
  MARKET_CODES_COLUMN_2.forEach((code) => {
    column2[code] = byMktCode[code];
  });

  return {
    mktdate,
    column1,
    column2,
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
 * @param {HTMLElement} block
 */
export default async function decorate(block) {
  try {
    const payload = await fetchMarketSummary();
    const model = buildMarketReportModel(payload);
    block.marketReportData = model;
    block.dataset.marketReportLoaded = 'true';
    delete block.dataset.marketReportError;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('market-report:', err);
    block.marketReportData = null;
    block.dataset.marketReportLoaded = 'false';
    block.dataset.marketReportError = 'true';
  }
}
