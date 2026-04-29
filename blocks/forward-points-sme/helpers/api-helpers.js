export function trimValue(value) {
  if (value === null || value === undefined) return '-';
  const normalized = String(value).trim();
  return normalized || '-';
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return response.json();
}

function replaceTemplateTokens(url, values) {
  let output = url;
  Object.entries(values).forEach(([key, value]) => {
    const replacements = [`{{${key}}}`, `{{${key}`, `{${key}}`, `{${key}`, `:${key}`];
    replacements.forEach((token) => {
      output = output.split(token).join(String(value));
    });
  });
  return output;
}

/**
 * Creates API endpoint functions from configs.
 * Config key names (camelCase from config.json Key column):
 *   Section 1 (currency rates via FwbRateService / ExchangeRateService):
 *     fwbRateServiceGetLatestFxrates       - latest FX rates with date
 *     fwbRateServiceGetDayInMonth          - days with data for a given month
 *     fwbRateServiceGetUpdateInDay         - time updates for a given day
 *     fwbRateServiceGetFxrates             - FX rates for a date+update
 *   Section 2 (forward points via FwbRateService):
 *     fwbRateServiceGetFwdDateTimeLastUpdate - latest forward points date
 *     fwbRateServiceGetFwdDayInMonth         - days with fwd data for a given month
 *     fwbRateServiceGetFwdUpdateInDay        - time updates for a given day (fwd)
 *     fwbRateServiceGetFwdfxrates            - forward point rates for a date+update
 */
export function createApiEndpoints(configs) {
  const latestFxRatesUrl = configs?.fwbRateServiceGetLatestFxrates || '';
  const dayInMonthTemplate = configs?.fwbRateServiceGetDayInMonth || '';
  const updateInDayTemplate = configs?.fwbRateServiceGetUpdateInDay || '';
  const fxRatesTemplate = configs?.fwbRateServiceGetFxrates || '';

  const fwdLatestUrl = configs?.fwbRateServiceGetFwdDateTimeLastUpdate || '';
  const fwdDayInMonthTemplate = configs?.fwbRateServiceGetFwdDayInMonth || '';
  const fwdUpdateInDayTemplate = configs?.fwbRateServiceGetFwdUpdateInDay || '';
  const fwdRatesTemplate = configs?.fwbRateServiceGetFwdfxrates || '';

  return {
    // Section 1
    latestFxRates: () => latestFxRatesUrl,
    dayInMonth: (year, month) => replaceTemplateTokens(
      dayInMonthTemplate,
      { YEAR: year, MONTH: month },
    ),
    updateInDay: (day, month, year) => replaceTemplateTokens(updateInDayTemplate, {
      DATE: day, DAY: day, MONTH: month, YEAR: year,
    }),
    fxRates: (day, month, year, update) => replaceTemplateTokens(fxRatesTemplate, {
      DATE: day, DAY: day, MONTH: month, YEAR: year, NUM: update, UPDATE: update,
    }),
    // Section 2
    fwdLatest: () => fwdLatestUrl,
    fwdDayInMonth: (year, month) => replaceTemplateTokens(
      fwdDayInMonthTemplate,
      { YEAR: year, MONTH: month },
    ),
    fwdUpdateInDay: (day, month, year) => replaceTemplateTokens(fwdUpdateInDayTemplate, {
      DATE: day, DAY: day, MONTH: month, YEAR: year,
    }),
    fwdRates: (day, month, year, update) => replaceTemplateTokens(fwdRatesTemplate, {
      DATE: day, DAY: day, MONTH: month, YEAR: year, NUM: update, UPDATE: update,
    }),
  };
}

/**
 * Normalizes FX rates response for Section 1 currency table.
 * Fields mapped per API Technical Specifications for Exchange Rates v1.0.
 * Currency column shows: Family (e.g. "USD") + flag icon.
 * Columns: Sight Bill Buying Rates | TT Buying Rates | TT Selling Rates
 */
export function normalizeFxRates(list) {
  return (Array.isArray(list) ? list : []).map((item) => ({
    family: trimValue(item.Family),
    sightBillBuying: trimValue(item.SightBill || item.SightBillBuying),
    ttBuying: trimValue(item.TTBuying || item.TT),
    ttSelling: trimValue(item.TTSelling),
  }));
}

/**
 * Normalizes forward points rates response for Section 2 tables.
 * Row order corresponds to row headings configured by the author (1M, 3M, 6M).
 * Table 1 (low revenue THB 50-200M): t1Buying / t1Selling
 * Table 2 (mid revenue THB 200-500M): t2Buying / t2Selling
 * Exact field names confirmed via "Mapping for forward point for SME.docx".
 * Falls back to same value for both tables if only one set of fields exists.
 */
export function normalizeFwdRates(list) {
  return (Array.isArray(list) ? list : []).map((item) => {
    const t1Buying = trimValue(
      item.ExportBuyingLow ?? item.ExportBuying ?? item.Buying ?? item.ExportBuyingAmt,
    );
    const t1Selling = trimValue(
      item.ImportSellingLow ?? item.ImportSelling ?? item.Selling ?? item.ImportSellingAmt,
    );
    const t2Buying = trimValue(
      item.ExportBuyingMid ?? item.ExportBuying2 ?? item.ExportBuying ?? item.Buying,
    );
    const t2Selling = trimValue(
      item.ImportSellingMid ?? item.ImportSelling2 ?? item.ImportSelling ?? item.Selling,
    );
    return {
      tenorCode: trimValue(item.TenorCode),
      t1Buying,
      t1Selling,
      t2Buying,
      t2Selling,
    };
  });
}

export async function getLatestFxRates(endpoints) {
  const url = endpoints.latestFxRates();
  if (!url) return [];
  return fetchJson(url);
}

export async function getLatestFwdUpdate(endpoints) {
  const url = endpoints.fwdLatest();
  if (!url) return null;
  try {
    const data = await fetchJson(url);
    return Array.isArray(data) ? data[0] : data;
  } catch (e) {
    return null;
  }
}

export async function getEnabledDays(url) {
  if (!url) return [];
  try {
    const data = await fetchJson(url);
    return (Array.isArray(data) ? data : [])
      .map((item) => String(item.Day || '').trim())
      .filter(Boolean)
      .map((day) => day.padStart(2, '0'));
  } catch (e) {
    return [];
  }
}

export async function getUpdatesInDay(url) {
  if (!url) return [];
  try {
    const data = await fetchJson(url);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

export async function getFxRates(url) {
  if (!url) return [];
  try {
    return await fetchJson(url);
  } catch (e) {
    return [];
  }
}
