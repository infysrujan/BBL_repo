import { fetchPlaceholders } from '../../scripts/placeholder.js';
import { getLang } from '../../scripts/scripts.js';
import { fetchConfigs } from '../../scripts/config.js';
import { readBlockConfig, toCamelCase } from '../../scripts/aem.js';
import { isAuthoringInstance } from '../../scripts/bbl-decorators.js';

const LOCALE_MAP = { th: 'th-TH', en: 'en-GB' };
const MOBILE_APP_VIEW_CLASS = 'mobile-app-view';
const fetchCache = {};

export async function fetchJson(url) {
  if (!url) return null;
  if (!fetchCache[url]) {
    fetchCache[url] = fetch(url, { headers: { Accept: 'application/json' } })
      .then((r) => (r.ok && r.status !== 204 ? r.json() : null))
      .catch(() => null);
  }
  return fetchCache[url];
}

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

export function normalizeQueryLang(value) {
  const raw = (value || '').toLowerCase();
  if (raw.startsWith('th')) return 'th';
  if (raw.startsWith('en')) return 'en';
  return '';
}

export async function mergeLocalConfig(pathname, lang, targetConfigs, keyNormalizer) {
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
        targetConfigs[keyNormalizer(config.Key)] = config.Value;
      });
  } catch {
    // Non-fatal: page continues with the config values already loaded.
  }
}

export function buildCardHtml(card, tag, placeholders = {}, options = {}) {
  const { dateLine = '', logoHtml = '', footerExtra = '' } = options;
  const target = card.targetLink === 'true' ? '_blank' : '_self';
  const cleanAltText = card.title ? card.title.replace(/<[^>]*>/g, '').trim() : '';

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

export function normalizePromotionType(value) {
  return String(value || '').trim().toLowerCase();
}

export function getPromotionPathFlags(pathname) {
  const path = String(pathname || '').toLowerCase();
  return {
    isBbmPath: /(promotions-?mb|mb-?promo)/i.test(path),
    isCreditCardPath: /(credit-cards?-promotions|creditcards?)/i.test(path),
  };
}

export function resolvePromotionApi({
  pathname,
  configuredPromoType = '',
  bbmBaseUrl = '',
  creditBaseUrl = '',
}) {
  const { isBbmPath, isCreditCardPath } = getPromotionPathFlags(pathname);
  if (isBbmPath) return { isBbm: true, promotionType: 'bangkok-bank-m', baseUrl: bbmBaseUrl };
  if (isCreditCardPath) return { isBbm: false, promotionType: 'credit-card', baseUrl: creditBaseUrl };

  const promoType = normalizePromotionType(configuredPromoType);
  if (promoType) {
    const isBbm = promoType === 'bangkok-bank-m';
    return {
      isBbm,
      promotionType: isBbm ? 'bangkok-bank-m' : 'credit-card',
      baseUrl: isBbm ? bbmBaseUrl : creditBaseUrl,
    };
  }

  const pageNorm = normalizePath(pathname);
  const bbmDir = bbmBaseUrl ? normalizePath(bbmBaseUrl).replace(/\/[^/]+$/, '') : '';
  if (bbmDir && (pageNorm === bbmDir || pageNorm.startsWith(`${bbmDir}/`))) {
    return { isBbm: true, promotionType: 'bangkok-bank-m', baseUrl: bbmBaseUrl };
  }

  const creditDir = creditBaseUrl ? normalizePath(creditBaseUrl).replace(/\/[^/]+$/, '') : '';
  if (creditDir && (pageNorm === creditDir || pageNorm.startsWith(`${creditDir}/`))) {
    return { isBbm: false, promotionType: 'credit-card', baseUrl: creditBaseUrl };
  }

  return { isBbm: true, promotionType: 'bangkok-bank-m', baseUrl: bbmBaseUrl };
}

export function resolvePromotionLang(docLang, queryLang, isBbm) {
  return isBbm && queryLang ? queryLang : docLang;
}

export function buildPromotionDataUrl(baseUrl, lang) {
  if (!baseUrl) return '';

  const [urlWithoutHash, ...hashParts] = baseUrl.split('#');
  const hash = hashParts.length ? `#${hashParts.join('#')}` : '';
  const [pathStr, ...queryParts] = urlWithoutHash.split('?');
  const search = queryParts.length ? `?${queryParts.join('?')}` : '';

  const normalizedLang = normalizeQueryLang(lang) || 'en';
  let localized = normalizedLang !== 'en'
    ? pathStr.replace(/\/en(\/|$)/i, `/${normalizedLang}$1`)
    : pathStr;

  if (normalizedLang !== 'en') {
    const langSuffix = `.${normalizedLang}.json`;
    if (!localized.toLowerCase().endsWith(langSuffix)) {
      localized = localized.toLowerCase().endsWith('.json')
        ? localized.replace(/\.json$/i, langSuffix)
        : `${localized}${langSuffix}`;
    }
  } else if (!localized.toLowerCase().endsWith('.json')) {
    localized = `${localized}.json`;
  }

  return localized + search + hash;
}

function isRegisterEnabled(value) {
  const normalized = String(value || '').trim().toUpperCase();
  // CTA is shown ONLY when the API explicitly sets isRegister to 'N'
  return normalized !== 'N';
}

function resolveCtaLabel(isRegister, data) {
  if (!isRegisterEnabled(isRegister)) return '';
  return data?.isRegisterCtaLabel || '';
}

function resolveCtaUrl(isRegister, registerCtaUrl) {
  if (!isRegisterEnabled(isRegister)) return '';
  return registerCtaUrl || '';
}

function getPromoBlockConfig(block) {
  const firstRow = block.querySelector(':scope > div');
  const isKeyValueRows = firstRow && firstRow.children.length >= 2;

  if (isKeyValueRows) {
    const config = readBlockConfig(block);
    const promotionType = (config['promotion-type'] || config.promotiontype || '').trim();
    const promoId = (config['promo-id'] || config.promoid || '').trim();
    return { promotionType, promoId };
  }

  const rows = [...block.querySelectorAll(':scope > div')];
  const promotionType = rows[0]?.textContent?.trim() || '';
  const maybeIsRegister = rows[1]?.textContent?.trim().toLowerCase() || '';
  const isRegisterLike = ['no', 'yes', 'd'].includes(maybeIsRegister);
  const promoRow = isRegisterLike ? rows[2] : rows[1];
  const promoId = promoRow?.textContent?.trim() || '';
  return { promotionType, promoId };
}

function getAuthoringPreviewData(block) {
  const firstRow = block.querySelector(':scope > div');
  const isKeyValueRows = firstRow && firstRow.children.length >= 2;
  if (!isKeyValueRows) return {};
  const config = readBlockConfig(block);
  return {
    title: config.title || '',
    detailImageUrl: config['detail-image-url'] || config.detailimageurl || '',
    detailDescription: config['detail-description'] || config.detaildescription || '',
    promotionStartDate: config['promotion-start-date'] || config.promotionstartdate || '',
    promotionEndDate: config['promotion-end-date'] || config.promotionenddate || '',
    responsibleLendingDisclaimerEnabled: config['responsible-lending-disclaimer-enabled']
      || config.responsiblelendingdisclaimerenabled,
    responsibleLendingDisclaimerText: config['responsible-lending-disclaimer-text']
      || config.responsiblelendingdisclaimertext || '',
    isRegister: config['is-register'] || config.isregister || '',
    isRegisterCtaLabel: config['is-register-cta-label'] || config.isregisterctalabel || '',
    ctaLabel: config['cta-label'] || config.ctalabel || '',
  };
}

function formatDate(dateStr, locale = 'en-GB') {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}

function buildDateHtml(start, end, label, locale) {
  if (!start && !end) return '';
  const parts = [start && formatDate(start, locale), end && formatDate(end, locale)]
    .filter(Boolean);
  return `<p class="promo-detail-date">${label} ${parts.join(' – ')}</p>`;
}

function buildDisclaimerHtml(enabled, text) {
  if (!enabled || !text) return '';
  return `<div class="promo-detail-disclaimer pad-top-30">${text}</div>`;
}

function buildRegisterCtaHtml(label, url) {
  if (!label || !url) return '';
  return `
    <div class="promo-detail-cta button-container">
      <a class="button primary" href="${url}">${label}</a>
    </div>`;
}

function renderDetails(container, data, periodLabel, locale, clickToViewFull, registerCtaUrl) {
  const title = data?.title
    ? `<h2 class="promo-detail-title">${data.title}</h2>`
    : '';
  const imageUrl = data?.detailImageUrl || '';
  const imageHtml = imageUrl
    ? `<img src="${imageUrl}" alt="${data?.title || ''}" loading="lazy">`
    : '';
  const description = data?.detailDescription || '';
  const startDate = data?.promotionStartDate || '';
  const endDate = data?.promotionEndDate || '';
  const disclaimerEnabled = data?.responsibleLendingDisclaimerEnabled;
  const disclaimerText = data?.responsibleLendingDisclaimerText || '';
  const isRegister = data?.isRegister || '';
  const ctaLabel = resolveCtaLabel(isRegister, data);
  const ctaUrl = resolveCtaUrl(isRegister, registerCtaUrl);

  const rowClass = imageHtml ? 'promo-detail-row' : 'promo-detail-row promo-detail-row-no-image';
  const imageColHtml = imageHtml ? `
          <div class="promo-detail-image">
            <a href="${imageUrl}" title="${clickToViewFull}">
              ${imageHtml}
            </a>
          </div>` : '';

  container.innerHTML = `
    <div class="promo-detail-inner">
      <div class="promo-detail-center">
        <div class="promo-detail-title-wrap">
          ${title}
        </div>
        <div class="${rowClass}">
          ${imageColHtml}
          <div class="promo-detail-content">
            <div class="promo-detail-description">${description}</div>
            ${buildDateHtml(startDate, endDate, periodLabel, locale)}
            ${buildRegisterCtaHtml(ctaLabel, ctaUrl)}
            ${buildDisclaimerHtml(disclaimerEnabled, disclaimerText)}
          </div>
        </div>
      </div>
    </div>`;
}

export function handleMobileAppView(searchParams) {
  const hasCardRef = searchParams.has('card_ref');
  ['header', 'footer'].forEach((selector) => {
    const el = document.querySelector(selector);
    if (el) {
      if (hasCardRef) {
        el.style.display = 'none';
        el.classList.add('is-hidden');
      } else {
        el.style.display = '';
        el.classList.remove('is-hidden');
      }
    }
  });

  if (hasCardRef) {
    document.body.classList.add(MOBILE_APP_VIEW_CLASS);
  } else {
    document.body.classList.remove(MOBILE_APP_VIEW_CLASS);
  }
}

async function fetchPromoData(url, promoId) {
  if (!url) return null;
  const json = await fetchJson(url);
  if (!json) return null;
  const { cards } = json;
  const normalizedCurrent = normalizePath(window.location.pathname);
  return (
    cards?.find((c) => normalizePath(c.ctaLink) === normalizedCurrent)
    || cards?.find((c) => c.id === promoId)
    || null
  );
}

export default async function decorate(block) {
  const searchParams = new URLSearchParams(window.location.search);
  handleMobileAppView(searchParams);

  const { promotionType: blockPromoType, promoId } = getPromoBlockConfig(block);
  const { pathname } = window.location;
  const { isBbmPath, isCreditCardPath } = getPromotionPathFlags(pathname);

  const docLang = getLang();
  const queryLang = normalizeQueryLang(searchParams.get('sc_lang'));
  const isBbmPreConfig = isBbmPath
    || (!isCreditCardPath && normalizePromotionType(blockPromoType) === 'bangkok-bank-m');
  const lang = resolvePromotionLang(docLang, queryLang, isBbmPreConfig);

  const configs = await fetchConfigs();
  const effectiveConfigs = configs || {};
  if (!configs || !configs.promotionalCardSelector || lang !== 'en') {
    await mergeLocalConfig(pathname, lang, effectiveConfigs, toCamelCase);
  }

  const creditBaseUrl = effectiveConfigs.promotionalCardSelector || '';
  const bbmBaseUrl = effectiveConfigs.promotionalCardSelectorBbm || '';

  const promotionApi = resolvePromotionApi({
    pathname,
    configuredPromoType: blockPromoType,
    bbmBaseUrl,
    creditBaseUrl,
  });

  const locale = LOCALE_MAP[lang] || 'en-GB';
  const promotionsUrl = buildPromotionDataUrl(promotionApi.baseUrl, lang);

  const [placeholders, card] = await Promise.all([
    fetchPlaceholders(),
    fetchPromoData(promotionsUrl, promoId),
  ]);

  const periodLabel = placeholders.promotionPeriodText || 'Promotion Period:';
  const clickToViewFull = placeholders.promoClickToViewFull || '';
  const registerCtaUrl = effectiveConfigs.bbmIsRegister || '';
  const previewData = isAuthoringInstance(block) && !card
    ? getAuthoringPreviewData(block)
    : null;

  if (!card && !previewData) {
    const errorMsg = placeholders.promoNoResults || 'No promotion details found.';
    block.innerHTML = `<p class="promo-detail-error">${errorMsg}</p>`;
    return;
  }

  const data = card || previewData;

  if (isAuthoringInstance(block)) {
    block.querySelectorAll(':scope > div').forEach((row) => {
      const key = row.children[0]?.textContent?.trim().toLowerCase().replace(/-/g, '');
      if (key === 'promotiontype' || key === 'promoid') {
        row.dataset.configRow = '';
      }
    });
    block.classList.add('has-preview');
    let previewContainer = block.querySelector('.promo-detail-preview');
    if (!previewContainer) {
      previewContainer = document.createElement('div');
      previewContainer.className = 'promo-detail-preview';
      block.appendChild(previewContainer);
    }
    renderDetails(
      previewContainer,
      data,
      periodLabel,
      locale,
      clickToViewFull,
      registerCtaUrl,
    );
    return;
  }

  renderDetails(block, data, periodLabel, locale, clickToViewFull, registerCtaUrl);
}
