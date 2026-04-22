import { fetchPlaceholders } from '../../scripts/placeholder.js';

const PROMOTIONS_JSON = '/data/promotions.json';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function buildDateHtml(start, end, label) {
  if (!start && !end) return '';
  const parts = [start && formatDate(start), end && formatDate(end)].filter(Boolean);
  return `<p class="promo-detail-date">${label} ${parts.join(' \u2013 ')}</p>`;
}

function parseBooleanFlag(el) {
  return el?.textContent?.trim().toLowerCase() === 'true';
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
  const rows = [...block.children];
  const promoId = rows[0]?.textContent?.trim() || '';

  const [placeholders, card] = await Promise.all([
    fetchPlaceholders(),
    fetchPromoData(promoId),
  ]);

  const periodLabel = placeholders.promotionPeriodText || 'Promotion Period:';

  const titleTag = rows[2]?.textContent?.trim() || 'h2';
  const titleText = card?.title || rows[1]?.textContent?.trim() || '';
  const title = titleText ? `<${titleTag} class="promo-detail-title">${titleText}</${titleTag}>` : '';
  const imageUrl = card?.detailImageUrl || '';
  const imageHtml = imageUrl
    ? `<img src="${imageUrl}" alt="${card.title || ''}" loading="lazy">`
    : rows[3]?.querySelector('picture, img')?.outerHTML || '';
  const imageHref = imageUrl || rows[3]?.querySelector('img')?.src || '#';
  const description = card?.detailDescription || rows[5]?.innerHTML?.trim() || '';
  const startDate = card?.promotionStartDate || rows[8]?.textContent?.trim() || '';
  const endDate = card?.promotionEndDate || rows[9]?.textContent?.trim() || '';
  const disclaimerEnabled = card
    ? card.responsibleLendingDisclaimerEnabled
    : parseBooleanFlag(rows[14]);
  const disclaimerText = card?.responsibleLendingDisclaimerText || rows[15]?.innerHTML?.trim() || '';

  block.innerHTML = `
    <div class="promo-detail-inner">
      <div class="promo-detail-center">
        <div class="promo-detail-title-wrap">
          ${title}
        </div>
        <div class="promo-detail-row">
          <div class="promo-detail-image">
            <a href="${imageHref}" title="Click to view full">
              ${imageHtml}
            </a>
          </div>
          <div class="promo-detail-content">
            <div class="promo-detail-description">${description}</div>
            ${buildDateHtml(startDate, endDate, periodLabel)}
            ${buildDisclaimerHtml(disclaimerEnabled, disclaimerText)}
          </div>
        </div>
      </div>
    </div>`;
}
