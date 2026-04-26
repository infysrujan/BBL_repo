import { fetchPlaceholders } from '../../scripts/placeholder.js';

const PROMOTIONS_JSON = '/data/promotions.json';

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function buildDateHtml(start, end, label) {
  if (!start && !end) return '';
  const parts = [start && formatDate(start), end && formatDate(end)].filter(Boolean);
  return `<p class="promo-detail-date">${label} ${parts.join(' – ')}</p>`;
}

function buildDisclaimerHtml(enabled, text) {
  if (!enabled || !text) return '';
  return `<div class="promo-detail-disclaimer"><p class="promo-detail-disclaimer-text">${text}</p></div>`;
}

async function fetchPromoData(promoId) {
  try {
    const resp = await fetch(PROMOTIONS_JSON);
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
  const promoId = block.children[0]?.textContent?.trim() || '';

  const [placeholders, card] = await Promise.all([
    fetchPlaceholders(),
    fetchPromoData(promoId),
  ]);

  const periodLabel = placeholders.promotionPeriodText || 'Promotion Period:';

  const title = card?.title
    ? `<h2 class="promo-detail-title">${card.title}</h2>`
    : '';
  const imageUrl = card?.detailImageUrl || '';
  const imageHtml = imageUrl
    ? `<img src="${imageUrl}" alt="${card?.title || ''}" loading="lazy">`
    : '';
  const description = card?.detailDescription || '';
  const startDate = card?.promotionStartDate || '';
  const endDate = card?.promotionEndDate || '';
  const disclaimerEnabled = card?.responsibleLendingDisclaimerEnabled;
  const disclaimerText = card?.responsibleLendingDisclaimerText || '';

  const rowClass = imageHtml ? 'promo-detail-row' : 'promo-detail-row promo-detail-row-no-image';
  const imageColHtml = imageHtml ? `
          <div class="promo-detail-image">
            <a href="${imageUrl}" title="Click to view full">
              ${imageHtml}
            </a>
          </div>` : '';

  block.innerHTML = `
    <div class="promo-detail-inner">
      <div class="promo-detail-center">
        <div class="promo-detail-title-wrap">
          ${title}
        </div>
        <div class="${rowClass}">
          ${imageColHtml}
          <div class="promo-detail-content">
            <div class="promo-detail-description">${description}</div>
            ${buildDateHtml(startDate, endDate, periodLabel)}
            ${buildDisclaimerHtml(disclaimerEnabled, disclaimerText)}
          </div>
        </div>
      </div>
    </div>`;
}
