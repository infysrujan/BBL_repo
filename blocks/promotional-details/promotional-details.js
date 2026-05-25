import { fetchPlaceholders } from '../../scripts/placeholder.js';
import { getLang } from '../../scripts/scripts.js';
import { fetchConfigs } from '../../scripts/config.js';
import { readBlockConfig, toCamelCase } from '../../scripts/aem.js';
import { isAuthoringInstance } from '../../scripts/bbl-decorators.js';
import { buildPromotionsUrl } from '../../scripts/utils/card-helpers.js';

const LOCALE_MAP = { th: 'th-TH', en: 'en-GB' };
const MOBILE_APP_VIEW_CLASS = 'mobile-app-view';

function normalizeQueryLang(value) {
  const raw = (value || '').toLowerCase();
  if (raw.startsWith('th')) return 'th';
  if (raw.startsWith('en')) return 'en';
  return '';
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

function normalizePath(p) {
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
  } catch (e) {
    return '/';
  }
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
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const { cards } = await resp.json();
    const normalizedCurrent = normalizePath(window.location.pathname);
    return (
      cards?.find((c) => normalizePath(c.ctaLink) === normalizedCurrent)
      || cards?.find((c) => c.id === promoId)
      || null
    );
  } catch {
    return null;
  }
}

export default async function decorate(block) {
  const searchParams = new URLSearchParams(window.location.search);
  handleMobileAppView(searchParams);

  const { promotionType: blockPromoType, promoId } = getPromoBlockConfig(block);
  const { pathname } = window.location;
  const prelimPath = pathname.toLowerCase();
  const isBbmPathPrelim = /(promotions-?mb|mb-?promo)/i.test(prelimPath);
  const isCreditCardPathPrelim = /(credit-cards?-promotions|creditcards?)/i.test(prelimPath);

  const docLang = getLang();
  const queryLang = normalizeQueryLang(searchParams.get('sc_lang'));
  const lang = isBbmPathPrelim && queryLang ? queryLang : docLang;

  const configs = await fetchConfigs();
  const effectiveConfigs = configs || {};
  if (!configs || !configs.promotionalCardSelector || lang !== 'en') {
    try {
      const segments = pathname.split('/');
      const configPrefix = pathname.startsWith('/content/') && segments[2]
        ? `/content/${segments[2]}`
        : '';
      const resp = await fetch(`${configPrefix}/${lang}/config.json`);
      if (resp.ok) {
        const json = await resp.json();
        const targetConfigs = effectiveConfigs;
        json.data
          ?.filter((config) => config.Key)
          .forEach((config) => {
            targetConfigs[toCamelCase(config.Key)] = config.Value;
          });
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Failed to fetch local config fallback:', e);
    }
  }

  const creditBaseUrl = effectiveConfigs.promotionalCardSelector || '';
  const bbmBaseUrl = effectiveConfigs.promotionalCardSelectorBbm || '';
  const bbmNormalized = bbmBaseUrl ? normalizePath(bbmBaseUrl) : '';
  const creditNormalized = creditBaseUrl ? normalizePath(creditBaseUrl) : '';

  const pageNormalized = normalizePath(pathname);
  const isBbmPrelim = isBbmPathPrelim
    || (!isCreditCardPathPrelim && blockPromoType === 'bangkok-bank-m');

  let isBbm = isBbmPrelim;
  if (bbmNormalized) {
    isBbm = pageNormalized === bbmNormalized
      || pageNormalized.startsWith(`${bbmNormalized}/`);
  } else if (creditNormalized) {
    isBbm = !pageNormalized.startsWith(`${creditNormalized}/`);
  }

  if (blockPromoType) {
    isBbm = (blockPromoType === 'bangkok-bank-m');
  }

  const locale = LOCALE_MAP[lang] || 'en-GB';

  const baseUrl = isBbm
    ? (effectiveConfigs.promotionalCardSelectorBbm || '')
    : (effectiveConfigs.promotionalCardSelector || '');
  const promotionsUrl = buildPromotionsUrl(baseUrl, lang);

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
      const firstCell = row.children[0]?.textContent?.trim().toLowerCase();
      if (
        firstCell === 'promotion-type'
        || firstCell === 'promo-id'
        || firstCell === 'promotiontype'
        || firstCell === 'promoid'
      ) {
        row.style.display = 'none';
      }
    });

    let previewContainer = block.parentElement
      ?.querySelector('[data-preview-for="promotional-details"]');
    if (!previewContainer) {
      previewContainer = document.createElement('div');
      previewContainer.className = `${block.className} promo-detail-preview`;
      previewContainer.dataset.previewFor = 'promotional-details';
      block.insertAdjacentElement('afterend', previewContainer);
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
