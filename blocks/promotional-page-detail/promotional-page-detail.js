const DATA_URL = '/data/promotions.json';

function isAuthoringMode() {
  return !!document.querySelector('[data-aue-resource],[data-aue-prop],[data-aue-type]');
}

function getPromoIdFromUrl() {
  const segments = window.location.pathname.split('/').filter(Boolean);
  return segments[segments.length - 1] || '';
}

async function fetchPromoData(promoId) {
  const resp = await fetch(DATA_URL);
  if (!resp.ok) return null;
  const { cards } = await resp.json();
  return cards?.find((c) => c.ctaLink?.split('/').pop() === promoId) || null;
}

function buildLogosHtml(logos = [], types = []) {
  return logos.map((src, i) => `<img src="${src}" alt="${types[i] || ''}" class="promo-detail-card-logo">`).join('');
}

function buildDisclaimerHtml(enabled, text) {
  if (!enabled || !text) return '';
  return `<div class="promo-detail-disclaimer">
    <input type="checkbox" id="promo-disclaimer-checkbox" class="promo-detail-disclaimer-checkbox">
    <label for="promo-disclaimer-checkbox" class="promo-detail-disclaimer-label">${text}</label>
  </div>`;
}

export default async function decorate(block) {
  if (isAuthoringMode()) {
    block.classList.add('promo-detail-authoring');
    block.innerHTML = `
      <div class="promo-detail-inner">
        <div class="promo-detail-center">
          <div class="promo-detail-title-wrap">
            <div class="promo-detail-skeleton promo-detail-skeleton-title"></div>
          </div>
          <div class="promo-detail-row">
            <div class="promo-detail-image">
              <div class="promo-detail-skeleton promo-detail-skeleton-image"></div>
            </div>
            <div class="promo-detail-content">
              <div class="promo-detail-skeleton promo-detail-skeleton-desc"></div>
              <div class="promo-detail-card-logos">
                <div class="promo-detail-skeleton promo-detail-skeleton-logo"></div>
                <div class="promo-detail-skeleton promo-detail-skeleton-logo"></div>
              </div>
              <div class="promo-detail-disclaimer">
                <div class="promo-detail-skeleton promo-detail-skeleton-checkbox"></div>
                <div class="promo-detail-skeleton promo-detail-skeleton-line"></div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
    return;
  }

  const card = await fetchPromoData(getPromoIdFromUrl());
  if (!card) {
    block.innerHTML = '<p class="promo-detail-error">Promotion not found.</p>';
    return;
  }

  block.innerHTML = `
    <div class="promo-detail-inner">
      <div class="promo-detail-center">
        <div class="promo-detail-title-wrap">
          <h2 class="promo-detail-title">${card.title}</h2>
        </div>
        <div class="promo-detail-row">
          <div class="promo-detail-image">
            <a href="${card.detailImageUrl}" title="Click to view full">
              <img src="${card.detailImageUrl}" alt="${card.title}" loading="lazy">
            </a>
          </div>
          <div class="promo-detail-content">
            <div class="promo-detail-description">${card.detailDescription || ''}</div>
            <div class="promo-detail-card-logos">${buildLogosHtml(card.cardTypeLogos, card.cardTypes)}</div>
            ${buildDisclaimerHtml(card.responsibleLendingDisclaimerEnabled, card.responsibleLendingDisclaimerText)}
          </div>
        </div>
      </div>
    </div>`;
}
