import { fetchConfigs } from '../config.js';
import { getLang } from '../scripts.js';

const DEFAULT_QUERY_INDEX_URL = '/query-index.json';
const RESULTS_PER_PAGE = 8;

function getQueryIndexCacheKey(lang) {
  return `query-index-${lang}`;
}

function normalizeSearchTerm(value = '') {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeForMatch(value = '') {
  return normalizeSearchTerm(value).toLowerCase();
}

function splitSearchTokens(value = '') {
  return normalizeForMatch(value)
    .split(' ')
    .filter(Boolean);
}

async function fetchFirstAvailableIndex(candidateUrls) {
  const responses = await Promise.all(candidateUrls.map(async (url) => {
    try {
      const response = await fetch(url);
      return response.ok ? response : null;
    } catch {
      return null;
    }
  }));

  return responses.find(Boolean) || null;
}

async function fetchQueryIndex() {
  const lang = getLang();
  window.queryIndex = window.queryIndex || {};

  if (!window.queryIndex[lang]) {
    window.queryIndex[lang] = (async () => {
      const cacheKey = getQueryIndexCacheKey(lang);
      const cachedIndexJSON = window.sessionStorage.getItem(cacheKey);

      if (cachedIndexJSON) {
        try {
          const json = JSON.parse(cachedIndexJSON);
          return Array.isArray(json?.data) ? json.data : [];
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('Failed to parse cached query index, fetching fresh:', e);
        }
      }

      const configs = await fetchConfigs();
      const configuredIndexUrl = configs?.queryIndexUrl || '';
      const candidateUrls = [
        configuredIndexUrl,
        `/${lang}/query-index.json`,
        DEFAULT_QUERY_INDEX_URL,
      ].filter(Boolean);

      const response = await fetchFirstAvailableIndex(candidateUrls);
      if (response) {
        const json = await response.json();

        try {
          window.sessionStorage.setItem(cacheKey, JSON.stringify(json));
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('Failed to store query index in sessionStorage:', e);
        }

        return Array.isArray(json?.data) ? json.data : [];
      }

      throw new Error('Query index fetch failed');
    })();
  }

  return window.queryIndex[lang];
}

function matchesTokens(item, tokens) {
  if (!tokens.length) return true;

  const searchableFields = [
    item.title,
    item.description,
    item.keywords,
    item.path,
  ];

  const haystack = normalizeForMatch(searchableFields.filter(Boolean).join(' '));
  return tokens.every((token) => haystack.includes(token));
}

function mapResult(item) {
  return {
    Title: item.title || '',
    Description: item.description || '',
    URL: item.path || '#',
    OGTitle: item.title || '',
    OGDescription: item.description || '',
    OGURL: item.path || '#',
    OGImage: item.image || '',
    Keywords: item.keywords || '',
  };
}

export async function getSiteSearchResults({
  keywords,
  pageNumber = 1,
  pageLanguage = 'en',
}) {
  const normalizedKeywords = normalizeSearchTerm(keywords);
  const tokens = splitSearchTokens(normalizedKeywords);
  const rows = await fetchQueryIndex();

  const filteredResults = rows
    .filter((item) => item?.path)
    .filter((item) => matchesTokens(item, tokens))
    .map((item) => mapResult(item, pageLanguage));

  const startIndex = (pageNumber - 1) * RESULTS_PER_PAGE;
  const endIndex = startIndex + RESULTS_PER_PAGE;
  const pagedResults = filteredResults.slice(startIndex, endIndex);

  return {
    totalRecord: filteredResults.length,
    showLoadMore: endIndex < filteredResults.length,
    noResultsMessage: 'No Results Found',
    searchResults: pagedResults,
  };
}

export { normalizeSearchTerm };
