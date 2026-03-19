const PAGE_SIZE = 8;

// Normalizes search term: trim + collapse whitespace
export function normalizeSearchTerm(term = '') {
  return term.trim().replace(/\s+/g, ' ');
}

// Simple language detection from keyword string; adjust if needed
function detectLanguage(keywords) {
  const isThai = /[\u0E00-\u0E7F]/.test(keywords);
  return isThai ? 'th' : 'en';
}

// Generate a stable ItemID from path
function generateItemId(path) {
  let hash = 0;
  const str = path || '';
  for (let i = 0; i < str.length; i += 1) {
    hash = ((hash * 31) + str.charCodeAt(i)) % 2147483647;
  }
  return `eds-${Math.abs(hash)}`;
}

// Map EDS index record (helix-query.yaml output) -> search JSON for UI
function toSearchResult(record) {
  const baseUrl = 'https://www.bangkokbank.com'; // adjust if needed

  const relPath = record.path || '';
  const canonical = record.ogUrl || '';
  const absUrl = canonical || (relPath.startsWith('http') ? relPath : `${baseUrl}${relPath}`);

  return {
    Title: record.metaTitle || record.ogTitle || '',
    Description: record.metaDescription || record.ogDescription || '',
    URL: relPath,
    ItemID: generateItemId(record.path),
    OGTitle: record.ogTitle || record.metaTitle || '',
    OGDescription: record.ogDescription || record.metaDescription || '',
    OGImage: record.ogImage || '',
    OGURL: absUrl,
  };
}

// Fetch the EDS query index JSON (preview or live)
async function fetchIndexJson() {
  // Use .page for preview, .live for published site;
  // you can make this configurable if needed.
  const url = '/query-index.json?limit=-1';

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Index fetch failed: ${res.status}`);
  }

  const data = await res.json();
  // Some setups wrap in { data: [...] }, handle both
  return Array.isArray(data) ? data : (data.data || []);
}

// Filter + rank records according to keywords and language
function filterAndRank(records, keywords, langHint) {
  const term = normalizeSearchTerm(keywords).toLowerCase();
  const tokens = term.split(' ').filter(Boolean);
  const langPref = langHint || detectLanguage(keywords);

  return records
    .filter((r) => {
      // Optional language field from index; if absent, infer from path
      // We allow cross-language, but could prefer langPref in ranking
      // For filtering, don't strictly enforce language; enforce tokens instead.

      const textBlob = [
        r.metaTitle,
        r.metaDescription,
        r.metaKeywords,
        r.ogTitle,
        r.ogDescription,
        r.bodyText,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      // All tokens must appear as substrings (exact match, no stemming)
      return tokens.every((t) => textBlob.includes(t));
    })
    .map((r) => {
      const path = r.path || '';
      const langFromPath = path.startsWith('/th/') ? 'th' : 'en';
      const pageLang = r.language || langFromPath;
      const langScore = pageLang === langPref ? 1 : 0;
      return { ...r, langScore };
    })
    .sort((a, b) => b.langScore - a.langScore);
}

/**
 * Main function used by search-modal block.
 *
 * @param {Object} params
 * @param {string} params.keywords   Search term from user
 * @param {number} params.pageNumber 1-based page number
 * @param {string} params.pageLanguage Language inferred from URL (en, th)
 *
 * @returns {Promise<{searchResults: any[], showLoadMore: boolean, noResultsMessage?: string}>}
 */
export async function getSiteSearchResults({ keywords, pageNumber = 1, pageLanguage }) {
  const normalized = normalizeSearchTerm(keywords);
  if (!normalized) {
    return { searchResults: [], showLoadMore: false };
  }

  const allRecords = await fetchIndexJson();

  // Filter and rank
  const matches = filterAndRank(allRecords, normalized, pageLanguage);

  const total = matches.length;
  const offset = (pageNumber - 1) * PAGE_SIZE;
  const pageRecords = matches.slice(offset, offset + PAGE_SIZE);
  const showLoadMore = offset + PAGE_SIZE < total;

  const searchResults = pageRecords.map(toSearchResult);

  return {
    searchResults,
    showLoadMore,
    noResultsMessage: total === 0 ? 'No results found' : undefined,
  };
}
