import { fetchPlaceholders } from '../../scripts/placeholder.js';

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

export default async function decorate(block) {
  const rows = [...block.children];
  const placeholders = await fetchPlaceholders();
  const periodLabel = placeholders.promotionPeriodText || 'Promotion Period:';

  const title = rows[1]?.innerHTML?.trim() || '';
  const imageHtml = rows[4]?.querySelector('picture, img')?.outerHTML || '';
  const imageHref = rows[4]?.querySelector('img')?.src || '#';
  const description = rows[6]?.innerHTML?.trim() || '';
  const startDate = rows[9]?.textContent?.trim() || '';
  const endDate = rows[10]?.textContent?.trim() || '';
  const disclaimerEnabled = parseBooleanFlag(rows[18]);
  const disclaimerText = rows[19]?.innerHTML?.trim() || '';

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
