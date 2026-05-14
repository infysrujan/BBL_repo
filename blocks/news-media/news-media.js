import { getLang } from '../../scripts/scripts.js';
import { fetchConfigs } from '../../scripts/config.js';
import { buildCardHtml, buildPaginationHtml, bindPaginationClick } from '../../scripts/utils/cards-healpers.js';

const LOCALE_MAP = { th: 'th-TH', en: 'en-US' };
const FALLBACK_URL = '/blocks/about-news-media-details/dummy-news-data.json';
const DEFAULT_PAGE_SIZE = 10;

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

function setupPanel(panel, allCards, category, locale, pageSize) {
  panel.innerHTML = `
    <div class="anm-content">
      <div class="anm-grid"></div>
      <div class="listing-card-pagination"></div>
    </div>`;

  const gridEl = panel.querySelector('.anm-grid');
  const paginationEl = panel.querySelector('.listing-card-pagination');
  const state = { page: 1 };

  function render() {
    const { cards, total } = filterAndPage(allCards, category, state.page, pageSize);
    const totalPages = Math.ceil(total / pageSize);

    gridEl.innerHTML = cards.length
      ? cards.map((c) => {
        const ctaLink = c.ctaLink && c.aboutUsId ? `${c.ctaLink}?ID=${c.aboutUsId}` : (c.ctaLink || '');
        const normalized = { ...c, title: c.Title || '', ctaLink };
        const dateLine = formatDate(c.publishDate, locale);
        return buildCardHtml(normalized, '', {}, { dateLine });
      }).join('')
      : '<p class="listing-card-empty">No results found.</p>';

    paginationEl.innerHTML = buildPaginationHtml(state.page, totalPages);
    bindPaginationClick(paginationEl, state, render, gridEl);
  }

  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      observer.disconnect();
      render();
    }
  }, { rootMargin: '100px' });
  observer.observe(panel);
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

  document.querySelector('.tabs.block')?.classList.add('anm-tabs');

  const tabPanels = [...document.querySelectorAll('[role="tabpanel"]')];
  tabPanels.forEach((panel) => {
    const tabBtnId = panel.getAttribute('aria-labelledby');
    const tabBtn = tabBtnId ? document.getElementById(tabBtnId) : null;
    const tabText = tabBtn?.textContent?.trim() || '';

    const catMeta = categories.find((c) => c.label.toLowerCase() === tabText.toLowerCase()) || {};
    const category = catMeta.label || tabText;

    setupPanel(panel, allCards, category, locale, pageSize);
  });

  block.hidden = true;
}
