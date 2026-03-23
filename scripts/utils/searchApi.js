export function normalizeSearchTerm(term = '') {
  return term.trim().replace(/\s+/g, ' ');
}

function toAbsoluteUrl(baseUrl, path = '') {
  const clean = path.replace(/["\\]/g, '').trim();
  if (!clean) return '';
  if (clean.startsWith('http')) return clean;
  return `${baseUrl}${clean}`;
}

async function getResultsFromApi({
  apiUrl,
  baseUrl,
  keywords,
  pageNumber = 1,
  pageLanguage,
}) {
  if (!apiUrl) {
    throw new Error('Search API URL is not configured. Please set getSearchResult in config.json');
  }

  const formData = new FormData();
  formData.append('keywords', keywords);
  formData.append('pageNumber', pageNumber);
  formData.append('pageLanguage', pageLanguage);

  const res = await fetch(apiUrl, { method: 'POST', body: formData });
  if (!res.ok) throw new Error(`Search API failed: ${res.status}`);

  const data = await res.json();

  let rawResults = [];
  if (typeof data.SearchResults === 'string' && data.SearchResults) {
    try {
      rawResults = JSON.parse(data.SearchResults);
    } catch (parseError) {
      rawResults = [];
    }
  } else if (Array.isArray(data.SearchResults)) {
    rawResults = data.SearchResults;
  }

  rawResults = rawResults.map((item) => ({
    Title: item.Title || item.OGTitle || '',
    Description: item.Description || item.OGDescription || '',
    URL: item.URL || '',
    ItemID: item.ItemID || item.URL || '',
    OGTitle: item.OGTitle || '',
    OGDescription: item.OGDescription || '',
    OGImage: toAbsoluteUrl(baseUrl, item.OGImage || ''),
    OGURL: toAbsoluteUrl(baseUrl, item.OGURL || item.URL || ''),
  }));

  const showLoadMore = data.ShowLoadMore === '1' || data.ShowLoadMore === true;

  return {
    searchResults: rawResults,
    showLoadMore,
    noResultsMessage: rawResults.length === 0
      ? (data.NoResultsMessage || 'No Results Found')
      : undefined,
  };
}

export async function getSiteSearchResults({
  apiUrl,
  baseUrl,
  keywords,
  pageNumber = 1,
  pageLanguage,
}) {
  const normalized = normalizeSearchTerm(keywords);
  if (!normalized) return { searchResults: [], showLoadMore: false };

  return getResultsFromApi({
    apiUrl,
    baseUrl,
    keywords: normalized,
    pageNumber,
    pageLanguage,
  });
}
