import { pad2 } from './date-helpers.js';

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}: ${url}`);
  return res.json();
}

function replaceTemplateTokens(url, values) {
  let output = url;
  Object.entries(values).forEach(([key, value]) => {
    output = output.split(`{{${key}}}`).join(String(value));
  });
  return output;
}

function resolveUrls(configs, isGov) {
  if (isGov) {
    return {
      lastUpdate: configs?.corpBondGetLastUpdate || '',
      latestRates: configs?.corpBondGetLatestRates || '',
      dayInMonth: configs?.corpBondGetDayInMonth || '',
      updateInDay: configs?.corpBondGetUpdateInDay || '',
      ratesByDate: configs?.corpBondGetRatesByDate || '',
      filterLess1: configs?.corpBondGetRatesFilterLess1 || '',
      filter1to5: configs?.['corpBondGetRatesFilter-1to5'] || '',
      filter6to10: configs?.['corpBondGetRatesFilter-6to10'] || '',
      filterMore10: configs?.corpBondGetRatesFilterMore10 || '',
      filterRange: configs?.corpBondGetRatesDateRange || '',
    };
  }
  return {
    lastUpdate: configs?.bondRatesServiceGetBondDateTimeLastUpdate || '',
    latestRates: configs?.bondRatesServiceGetLatestBondRates || '',
    dayInMonth: configs?.bondRatesServiceGetDayInMonth || '',
    updateInDay: configs?.bondRatesServiceGetUpdateInDay || '',
    ratesByDate: configs?.bondRatesServiceGetBondRatesByDate || '',
    filterLess1: configs?.bondRatesServiceGetBondRatesByDateWithFilterLess1 || '',
    filter1to5: configs?.['bondRatesServiceGetBondRatesByDateWithFilter-1to5'] || '',
    filter6to10: configs?.['bondRatesServiceGetBondRatesByDateWithFilter-6to10'] || '',
    filterMore10: configs?.bondRatesServiceGetBondRatesByDateWithFilterMore10 || '',
    filterRange: configs?.bondRatesServiceGetBondRatesByDateRange || '',
  };
}

export default function createApiService(configs, boardType) {
  const isGov = typeof boardType === 'string' && boardType.toLowerCase().includes('government');
  const urls = resolveUrls(configs, isGov);

  const filterTemplates = {
    less1: urls.filterLess1,
    '1to5': urls.filter1to5,
    '6to10': urls.filter6to10,
    more10: urls.filterMore10,
    '-': urls.filterRange,
  };

  return {
    getLastUpdate: () => {
      if (!urls.lastUpdate) return Promise.resolve(null);
      return fetchJson(urls.lastUpdate);
    },
    getLatestRates: () => {
      if (!urls.latestRates) return Promise.resolve(null);
      return fetchJson(urls.latestRates);
    },
    getDayInMonth: (date) => {
      if (!urls.dayInMonth) return Promise.resolve([]);
      const url = replaceTemplateTokens(urls.dayInMonth, {
        YEAR: date.getFullYear(),
        MONTH: date.getMonth() + 1,
      });
      return fetchJson(url);
    },
    getUpdatesInDay: (date) => {
      if (!urls.updateInDay) return Promise.resolve([]);
      const url = replaceTemplateTokens(urls.updateInDay, {
        DATE: pad2(date.getDate()),
        MONTH: pad2(date.getMonth() + 1),
        YEAR: date.getFullYear(),
      });
      return fetchJson(url);
    },
    getRatesByDate: (date, update) => {
      if (!urls.ratesByDate) return Promise.resolve([]);
      const url = replaceTemplateTokens(urls.ratesByDate, {
        DATE: pad2(date.getDate()),
        MONTH: pad2(date.getMonth() + 1),
        YEAR: date.getFullYear(),
        UPDATE: update,
      });
      return fetchJson(url);
    },
    getRatesByDateWithFilter: (date, update, maturity, fromDate, toDate) => {
      const template = filterTemplates[maturity] || '';
      if (!template) return Promise.resolve([]);
      const url = replaceTemplateTokens(template, {
        DATE: pad2(date.getDate()),
        MONTH: pad2(date.getMonth() + 1),
        YEAR: date.getFullYear(),
        UPDATE: update,
        FROM: fromDate,
        TO: toDate,
      });
      return fetchJson(url);
    },
  };
}
