/**
 * In-memory promise cache — prevents duplicate in-flight requests for the
 * same URL within a page session. Storing the Promise (not the resolved
 * value) ensures concurrent callers await the same request rather than
 * issuing parallel fetches.
 * @type {Record<string, Promise<any>>}
 */
const fetchCache = {};

/**
 * Fetch JSON from a URL with in-memory deduplication.
 * Concurrent callers for the same URL share one in-flight request.
 * @param {string} url
 * @returns {Promise<any|null>}
 */
export async function fetchJson(url) {
  if (!url) return null;
  if (!fetchCache[url]) {
    fetchCache[url] = fetch(url, { headers: { Accept: 'application/json' } })
      .then((r) => (r.ok && r.status !== 204 ? r.json() : null))
      .catch(() => null);
  }
  return fetchCache[url];
}

/**
 * Normalize any path-like string (relative, absolute, or full URL) to a
 * canonical, locale-stripped, extension-free pathname used for comparisons.
 * Strips /content/<site>, language prefixes, .json/.html extensions, and
 * trailing slashes so that two representations of the same logical page
 * always compare equal.
 * @param {string} p
 * @returns {string}
 */
export function normalizePath(p) {
  if (!p) return '';
  const pathStr = p.split('?')[0].split('#')[0].toLowerCase();
  try {
    const url = new URL(pathStr, window.location.origin);
    return url.pathname
      .replace(/^\/content\/[^/]+/, '')
      .replace(/^\/(en|th)\b/, '')
      .replace(/\.json$/, '')
      .replace(/\.html$/, '')
      .replace(/\/+$/, '')
      || '/';
  } catch {
    return '/';
  }
}

/**
 * Normalize an sc_lang query-parameter value to a two-letter code.
 * Accepts values like "th", "th-TH", "en", "en-GB".
 * Returns '' when the value does not map to a known language.
 * @param {string|null} value
 * @returns {'th'|'en'|''}
 */
export function normalizeQueryLang(value) {
  const raw = (value || '').toLowerCase();
  if (raw.startsWith('th')) return 'th';
  if (raw.startsWith('en')) return 'en';
  return '';
}

/**
 * Merge locale-specific config.json into an existing config object.
 * Called as a fallback when the global /configs.json does not contain the
 * required key (e.g., on non-English pages served from a /th/ path).
 *
 * No throw — failures are swallowed so the page continues to render with
 * whatever data is available.
 *
 * @param {string}   pathname       Current window.location.pathname
 * @param {string}   lang           Two-letter language code ('th'|'en')
 * @param {object}   targetConfigs  Config object to merge values into
 * @param {Function} toCamelCase    Key normaliser from aem.js
 * @returns {Promise<void>}
 */
export async function mergeLocalConfig(pathname, lang, targetConfigs, toCamelCase) {
  try {
    const segments = pathname.split('/');
    const configPrefix = pathname.startsWith('/content/') && segments[2]
      ? `/content/${segments[2]}`
      : '';
    const resp = await fetch(`${configPrefix}/${lang}/config.json`);
    if (!resp.ok) return;
    const json = await resp.json();
    json.data
      ?.filter((config) => config.Key)
      .forEach((config) => {
        // eslint-disable-next-line no-param-reassign
        targetConfigs[toCamelCase(config.Key)] = config.Value;
      });
  } catch {
    // Non-fatal — page continues with existing config values.
  }
}

export function buildCardHtml(card, tag, placeholders = {}, options = {}) {
  const { dateLine = '', logoHtml = '', footerExtra = '' } = options;
  const target = card.targetLink === 'true' ? '_blank' : '_self';

  const cleanAltText = card.title
    ? card.title.replace(/<[^>]*>/g, '').trim()
    : '';

  return `<div class="listing-card-container">
  <div class="listing-card">
    <div class="listing-card-img-wrap">
      <span class="listing-card-tag">${tag}</span>
      <img src="${card.cardImageUrl}" alt="${cleanAltText}"
        class="listing-card-img" loading="lazy">
    </div>
    <div class="listing-card-body">
      <div class="listing-card-desc">${card.cardShortDescription || ''}</div>
      ${logoHtml}
      ${dateLine ? `<p class="listing-card-date">${dateLine}</p>` : ''}
    </div>
    <div class="listing-card-footer">
      <a href="${card.ctaLink || ''}" target="${target}" class="listing-card-cta button primary">${card.ctaLabel || placeholders.promoLearnMore || 'Learn More'}</a>
      ${footerExtra}
    </div>
  </div>
</div>`;
}

export function buildPaginationHtml(current, total) {
  if (total <= 1) return '';

  const show = new Set();
  for (let p = 1; p <= Math.min(2, total); p += 1) show.add(p);
  for (let p = Math.max(1, total - 1); p <= total; p += 1) show.add(p);
  for (let p = Math.max(1, current - 2); p <= Math.min(total, current + 2); p += 1) show.add(p);

  const sorted = [...show].sort((a, b) => a - b);
  let inner = '';
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) {
      inner += '<span class="listing-card-ellipsis">...</span>';
    }
    const cls = p === current ? 'listing-card-page is-active' : 'listing-card-page';
    inner += `<button class="${cls}" data-page="${p}">${p}</button>`;
  });

  const prevAttr = current === 1 ? ' disabled' : '';
  const nextAttr = current === total ? ' disabled' : '';
  return `
    <button class="listing-card-arrow" data-dir="prev"${prevAttr} aria-label="Previous"><i class="icon-arrow-left" aria-hidden="true"></i></button>
    <div class="listing-card-pages">${inner}</div>
    <button class="listing-card-arrow listing-card-arrow-next" data-dir="next"${nextAttr} aria-label="Next"><i class="icon-arrow-left" aria-hidden="true"></i></button>`;
}

export function bindPaginationClick(paginationEl, pageRef, onPageChange, scrollTarget) {
  paginationEl?.addEventListener('click', (e) => {
    const pageBtn = e.target.closest('.listing-card-page');
    const arrowBtn = e.target.closest('.listing-card-arrow');
    let changed = false;
    if (pageBtn) {
      pageRef.page = parseInt(pageBtn.dataset.page, 10);
      changed = true;
    } else if (arrowBtn?.dataset.dir === 'prev' && pageRef.page > 1) {
      pageRef.page -= 1;
      changed = true;
    } else if (arrowBtn?.dataset.dir === 'next') {
      pageRef.page += 1;
      changed = true;
    }
    if (changed) {
      onPageChange();
      scrollTarget?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

export function sortCards(cards) {
  return [...cards].sort((a, b) => {
    const aStart = a.promotionStartDate ? new Date(a.promotionStartDate).getTime() : 0;
    const bStart = b.promotionStartDate ? new Date(b.promotionStartDate).getTime() : 0;
    if (bStart !== aStart) return bStart - aStart;
    const aEnd = a.promotionEndDate ? new Date(a.promotionEndDate).getTime() : Infinity;
    const bEnd = b.promotionEndDate ? new Date(b.promotionEndDate).getTime() : Infinity;
    return aEnd - bEnd;
  });
}

export function buildPromotionsUrl(baseUrl, lang) {
  if (!baseUrl) return '';
  let localized = lang !== 'en' ? baseUrl.replace(/\/en\//, `/${lang}/`) : baseUrl;
  if (lang !== 'en') {
    const hasLangSuffix = new RegExp(`\\.${lang}\\.json$`, 'i').test(localized);
    if (!hasLangSuffix) {
      localized = /\.json$/i.test(localized)
        ? localized.replace(/\.json$/i, `.${lang}.json`)
        : `${localized}.${lang}.json`;
    }
  } else if (!/\.json$/i.test(localized)) {
    localized = `${localized}.json`;
  }
  return localized;
}
