const PAGE_SIZE = 8;
const BBL_BASE_URL = 'https://www.bangkokbank.com';

// Normalizes search term: trim + collapse whitespace
export function normalizeSearchTerm(term = '') {
  return term.trim().replace(/\s+/g, ' ');
}

function isLocalhost() {
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

// ─── Query Index (localhost fallback) ────────────────────────────────────────

async function fetchQueryIndex() {
  const res = await fetch('/query-index.json?limit=-1', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Index fetch failed: ${res.status}`);
  const data = await res.json();

  // Handle multi-sheet format: { "query-index": { data: [...] } }
  if (data['query-index'] && Array.isArray(data['query-index'].data)) {
    return data['query-index'].data;
  }
  return Array.isArray(data) ? data : (data.data || []);
}

function filterQueryIndex(records, keywords) {
  const tokens = normalizeSearchTerm(keywords).toLowerCase().split(' ').filter(Boolean);

  return records.filter((r) => {
    const blob = [
      r.ogTitle,
      r.ogDescription,
      r.title,
      r.description,
      r.keywords,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return tokens.every((t) => blob.includes(t));
  });
}

// Fix relative paths → full BBL URLs
function toAbsoluteUrl(path = '') {
  const clean = path.replace(/["\\]/g, '').trim();
  if (!clean) return '';
  if (clean.startsWith('http')) return clean;
  return `${BBL_BASE_URL}${clean}`;
}

function mapQueryIndexToResult(record) {
  const relPath = (record.path || '').replace(/["\\]/g, '').trim();
  const absUrl = record.ogUrl ? toAbsoluteUrl(record.ogUrl) : toAbsoluteUrl(relPath);

  const title = (record.ogTitle || record.title || '').trim();
  const description = (record.ogDescription || '').trim();
  const ogTitle = (record.ogTitle || '').trim();
  const ogDescription = (record.ogDescription || '').trim();
  const ogImage = toAbsoluteUrl(record.ogImage || '');

  return {
    Title: title,
    Description: description,
    URL: relPath,
    ItemID: relPath,
    OGTitle: ogTitle,
    OGDescription: ogDescription,
    OGImage: ogImage,
    OGURL: absUrl,
  };
}

async function getResultsFromQueryIndex({ keywords, pageNumber = 1 }) {
  const allRecords = await fetchQueryIndex();
  const matches = filterQueryIndex(allRecords, keywords);

  const total = matches.length;
  const offset = (pageNumber - 1) * PAGE_SIZE;
  const pageRecords = matches.slice(offset, offset + PAGE_SIZE);
  const showLoadMore = offset + PAGE_SIZE < total;

  return {
    searchResults: pageRecords.map(mapQueryIndexToResult),
    showLoadMore,
    noResultsMessage: total === 0 ? 'No Results Found' : undefined,
  };
}

// ─── Production API ───────────────────────────────────────────────────────────

async function getResultsFromApi({ keywords, pageNumber = 1, pageLanguage }) {
  const apiUrl = `${BBL_BASE_URL}/api/sitecore/BBLCorporateSearch/GetSearchResults`;

  const formData = new FormData();
  formData.append('keywords', keywords);
  formData.append('pageNumber', pageNumber);
  formData.append('pageLanguage', pageLanguage);

  const res = await fetch(apiUrl, { method: 'POST', body: formData });
  if (!res.ok) throw new Error(`Search API failed: ${res.status}`);

  const data = await res.json();

  // SearchResults comes back as a JSON string — must parse it
  let rawResults = [];
  if (typeof data.SearchResults === 'string' && data.SearchResults) {
    try {
      rawResults = JSON.parse(data.SearchResults);
    } catch {
      rawResults = [];
    }
  } else if (Array.isArray(data.SearchResults)) {
    rawResults = data.SearchResults;
  }

  // ✅ Fix image paths for production results too
  rawResults = rawResults.map((item) => ({
    ...item,
    OGImage: toAbsoluteUrl(item.OGImage || ''),
    OGURL: toAbsoluteUrl(item.OGURL || item.URL || ''),
  }));

  const showLoadMore = data.ShowLoadMore === '1' || data.ShowLoadMore === true;

  return {
    searchResults: rawResults,
    showLoadMore,
    noResultsMessage: rawResults.length === 0 ? (data.NoResultsMessage || 'No Results Found') : undefined,
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function getSiteSearchResults({ keywords, pageNumber = 1, pageLanguage }) {
  const normalized = normalizeSearchTerm(keywords);
  if (!normalized) return { searchResults: [], showLoadMore: false };

  if (isLocalhost()) {
    return getResultsFromQueryIndex({ keywords: normalized, pageNumber });
  }

  return getResultsFromApi({ keywords: normalized, pageNumber, pageLanguage });
}
