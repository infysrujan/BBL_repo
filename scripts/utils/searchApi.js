const PAGE_SIZE = 8;

export function normalizeSearchTerm(term = '') {
  return term.trim().replace(/\s+/g, ' ');
}

function getLang() {
  const [, lang] = window.location.pathname.split('/');
  return lang || 'en';
}

function getQueryIndexUrl() {
  return `/${getLang()}/query-index.json`;
}

async function fetchQueryIndex(indexErrorMessage = 'Index fetch failed') {
  const baseUrl = getQueryIndexUrl();
  const initialRes = await fetch(`${baseUrl}?limit=100&offset=0`, { cache: 'no-store' });
  if (!initialRes.ok) throw new Error(`${indexErrorMessage}: ${initialRes.status}`);
  const initialData = await initialRes.json();

  const sheet = initialData['query-index'] || initialData;
  const total = sheet.total || 0;
  const limit = sheet.limit || 100;
  let allData = Array.isArray(sheet.data) ? [...sheet.data] : [];

  const requests = [];
  for (let offset = limit; offset < total; offset += limit) {
    requests.push(
      fetch(`${baseUrl}?limit=${limit}&offset=${offset}`, { cache: 'no-store' })
        .then((res) => res.json())
        .then((data) => {
          const s = data['query-index'] || data;
          return Array.isArray(s.data) ? s.data : [];
        }),
    );
  }

  const pages = await Promise.all(requests);
  pages.forEach((page) => { allData = [...allData, ...page]; });

  return allData;
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

function mapQueryIndexToResult(record) {
  const relPath = (record.path || '').replace(/["\\]/g, '').trim();

  return {
    Title: (record.title || record.ogTitle || '').trim(),
    Description: (record.description || record.ogDescription || '').trim(),
    URL: relPath,
    ItemID: relPath,
    OGTitle: (record.ogTitle || '').trim(),
    OGDescription: (record.ogDescription || '').trim(),
    OGImage: record.ogImage || record.image || '',
    OGURL: record.ogUrl || relPath,
  };
}

export async function getSiteSearchResults({ keywords, pageNumber = 1, placeholders = {} }) {
  const normalized = normalizeSearchTerm(keywords);
  if (!normalized) return { searchResults: [], showLoadMore: false };

  const allRecords = await fetchQueryIndex(placeholders.indexFetchFailed);
  const matches = filterQueryIndex(allRecords, normalized);

  const total = matches.length;
  const offset = (pageNumber - 1) * PAGE_SIZE;
  const pageRecords = matches.slice(offset, offset + PAGE_SIZE);
  const showLoadMore = offset + PAGE_SIZE < total;

  return {
    searchResults: pageRecords.map(mapQueryIndexToResult),
    showLoadMore,
    noResultsMessage: total === 0 ? placeholders.noResultsFound : undefined,
  };
}
