import { fetchPlaceholders } from '../../scripts/placeholder.js';
import { getLang } from '../../scripts/scripts.js';
import { fetchConfigs } from '../../scripts/config.js';
import { readBlockConfig } from '../../scripts/aem.js';
import { isAuthoringInstance } from '../../scripts/bbl-decorators.js';

const LOCALE_MAP = { th: 'th-TH', en: 'en-GB' };
const HIDE_CHROME_CLASS = 'promo-details-hide-chrome';

function isRegisterEnabled(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return normalized && normalized !== 'N';
}

function resolveCtaLabel(isRegister, data) {
  if (isRegisterEnabled(isRegister)) {
    return data?.isRegisterCtaLabel || '';
  }
  return data?.ctaLabel || '';
}

function resolveCtaUrl(isRegister, data, registerCtaUrl) {
  if (isRegisterEnabled(isRegister)) {
    return registerCtaUrl || '';
  }
  return data?.ctaLink || '';
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
  const ctaUrl = resolveCtaUrl(isRegister, data, registerCtaUrl);

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

async function fetchPromoData(url, promoId) {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const { cards } = await resp.json();
    const currentPath = window.location.pathname;
    return (
      cards?.find((c) => c.ctaLink === currentPath)
      || cards?.find((c) => c.id === promoId)
      || null
    );
  } catch {
    return null;
  }
}

export default async function decorate(block) {
  const searchParams = new URLSearchParams(window.location.search);
  if (searchParams.has('card_ref')) {
    const header = document.querySelector('header');
    if (header) {
      header.style.display = 'none';
      header.classList.add('is-hidden');
    }
    const footer = document.querySelector('footer');
    if (footer) {
      footer.style.display = 'none';
      footer.classList.add('is-hidden');
    }
    const main = document.querySelector('main');
    if (main) {
      main.style.setProperty('padding-top', '0', 'important');
      main.style.setProperty('margin-top', '0', 'important');
    }
    document.body.style.setProperty('padding-top', '0', 'important');
    document.body.style.setProperty('margin-top', '0', 'important');
  }

  const { promotionType, promoId } = getPromoBlockConfig(block);
  const lang = getLang();
  const configs = await fetchConfigs();

  const path = window.location.pathname.toLowerCase();
  const isBbmPath = path.includes('/promotionsmb');
  const isCreditCardPath = path.includes('/credit-card-promotions');
  const isBbm = isBbmPath || (!isCreditCardPath && promotionType === 'bangkok-bank-m');
  const locale = LOCALE_MAP[lang] || 'en-GB';
  const hasCardRef = isBbmPath && Boolean(searchParams.get('card_ref'));

  if (hasCardRef) {
    document.body.classList.add(HIDE_CHROME_CLASS);
  } else {
    document.body.classList.remove(HIDE_CHROME_CLASS);
  }

  const baseUrl = isBbm
    ? (configs?.promotionalCardSelectorBbm || '')
    : (configs?.promotionalCardSelector || '');
  const promotionsUrl = baseUrl.replace(/\.json$/, lang !== 'en' ? `.${lang}.json` : '.json');

  const [placeholders, card] = await Promise.all([
    fetchPlaceholders(),
    fetchPromoData(promotionsUrl, promoId),
  ]);

  const periodLabel = placeholders.promotionPeriodText || 'Promotion Period:';
  const clickToViewFull = placeholders.promoClickToViewFull || '';
  const registerCtaUrl = configs?.bbmIsRegister || '';
  const previewData = isAuthoringInstance(block) && !card
    ? getAuthoringPreviewData(block)
    : null;
  const data = card || previewData || {};

  if (isAuthoringInstance(block)) {
    let previewContainer = block.parentElement?.querySelector('[data-preview-for="promotional-details"]');
    if (!previewContainer) {
      previewContainer = document.createElement('div');
      previewContainer.className = 'promo-detail-preview';
      previewContainer.dataset.previewFor = 'promotional-details';
      block.insertAdjacentElement('afterend', previewContainer);
    }
    renderDetails(previewContainer, data, periodLabel, locale, clickToViewFull, registerCtaUrl);
    return;
  }

  renderDetails(block, data, periodLabel, locale, clickToViewFull, registerCtaUrl);
}
