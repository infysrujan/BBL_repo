import { getLang } from '../../scripts/scripts.js';
import { fetchConfigs } from '../../scripts/config.js';
import { buildCardHtml, buildPaginationHtml, bindPaginationClick } from '../../scripts/utils/cards-healpers.js';

const LOCALE_MAP = { th: 'th-TH', en: 'en-US' };
const FALLBACK_URL = '/blocks/about-news-media-details/dummy-news-data.json';
const DEFAULT_PAGE_SIZE = 20;

const fetchCache = {};

async function fetchJson(url) {
  if (!fetchCache[url]) {
    fetchCache[url] = fetch(url, { headers: { Accept: 'application/json' } })
      .then((r) => (r.ok && r.status !== 204 ? r.json() : null))
      .catch(() => null);
  }
  return fetchCache[url];
}

function formatDate(dateStr, locale = 'en-US') {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' });
}

function filterAndPage(allCards, category, page, pageSize) {
  const filtered = category
    ? allCards.filter((c) => {
      const cats = Array.isArray(c.category) ? c.category : [c.category];
      return cats.includes(category);
    })
    : allCards;

  const sorted = [...filtered].sort((a, b) => {
    const aDate = a.publishDate ? new Date(a.publishDate).getTime() : 0;
    const bDate = b.publishDate ? new Date(b.publishDate).getTime() : 0;
    return bDate - aDate;
  });

  const total = sorted.length;
  const start = (page - 1) * pageSize;
  return { cards: sorted.slice(start, start + pageSize), total };
}

function render(block, allCards, categories, state, locale, pageSize) {
  const { category, page } = state;
  const { cards, total } = filterAndPage(allCards, category, page, pageSize);
  const totalPages = Math.ceil(total / pageSize);

  const pillsHtml = categories.map(({ label }) => {
    const active = label === category ? ' is-active' : '';
    return `<button class="anm-category-pill${active}" data-category="${label}">${label}</button>`;
  }).join('');

  const gridHtml = cards.length
    ? cards.map((c) => {
      const normalized = { ...c, title: c.Title || '' };
      const tag = Array.isArray(c.category) ? c.category[0] : (c.category || '');
      const dateLine = formatDate(c.publishDate, locale);
      return buildCardHtml(normalized, tag, {}, { dateLine });
    }).join('')
    : '<p class="listing-card-empty">No results found.</p>';

  block.innerHTML = `
    <div class="anm-filters">
      <div class="anm-category-pills">${pillsHtml}</div>
    </div>
    <div class="anm-content">
      <div class="anm-grid">${gridHtml}</div>
      <div class="listing-card-pagination">${buildPaginationHtml(page, totalPages)}</div>
    </div>`;

  block.querySelectorAll('.anm-category-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      const isActive = pill.classList.contains('is-active');
      state.category = isActive ? '' : pill.dataset.category;
      state.page = 1;
      render(block, allCards, categories, state, locale, pageSize);
    });
  });

  bindPaginationClick(
    block.querySelector('.listing-card-pagination'),
    state,
    () => render(block, allCards, categories, state, locale, pageSize),
    block.querySelector('.anm-grid'),
  );
}

export default async function decorate(block) {
  const lang = getLang();
  const locale = LOCALE_MAP[lang] || 'en-US';
  const configs = await fetchConfigs();
  const configUrl = configs?.aboutNewsMedia;
  const dataUrl = configUrl
    ? configUrl.replace(/\.json$/, lang !== 'en' ? `.${lang}.json` : '.json')
    : FALLBACK_URL;
  const pageSize = parseInt(configs?.aboutNewsMediaPageSize, 10) || DEFAULT_PAGE_SIZE;

  const primary = await fetchJson(dataUrl);
  const data = primary || (dataUrl !== FALLBACK_URL ? await fetchJson(FALLBACK_URL) : null);
  const allCards = data?.cards || [];
  const categories = data?.categories || [];

  const state = { category: '', page: 1 };
  render(block, allCards, categories, state, locale, pageSize);
}
