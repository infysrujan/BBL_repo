const PAGE_SIZE = 8;
const BBL_BASE_URL = 'https://www.bangkokbank.com';

export function normalizeSearchTerm(term = '') {
  return term.trim().replace(/\s+/g, ' ');
}

function getQueryIndexUrl() {
  const [, lang] = window.location.pathname.split('/');
  const prefix = lang ? `/${lang}` : '/en';
  return `${prefix}/query-index.json`;
}

async function fetchQueryIndex() {
  const baseUrl = getQueryIndexUrl();

  const initialRes = await fetch(`${baseUrl}?limit=100&offset=0`, { cache: 'no-store' });
  if (!initialRes.ok) throw new Error(`Index fetch failed: ${initialRes.status}`);
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

function toAbsoluteUrl(path = '') {
  const clean = path.replace(/["\\]/g, '').trim();
  if (!clean) return '';
  if (clean.startsWith('http')) return clean;
  return `${BBL_BASE_URL}${clean}`;
}

function mapQueryIndexToResult(record) {
  const relPath = (record.path || '').replace(/["\\]/g, '').trim();
  const absUrl = record.ogUrl ? toAbsoluteUrl(record.ogUrl) : toAbsoluteUrl(relPath);

  return {
    Title: (record.title || record.ogTitle || '').trim(),
    Description: (record.description || record.ogDescription || '').trim(),
    URL: relPath,
    ItemID: relPath,
    OGTitle: (record.ogTitle || '').trim(),
    OGDescription: (record.ogDescription || '').trim(),
    OGImage: toAbsoluteUrl(record.ogImage || ''),
    OGURL: absUrl,
  };
}

export async function getSiteSearchResults({ keywords, pageNumber = 1 }) {
  const normalized = normalizeSearchTerm(keywords);
  if (!normalized) return { searchResults: [], showLoadMore: false };

  const allRecords = await fetchQueryIndex();
  const matches = filterQueryIndex(allRecords, normalized);

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
