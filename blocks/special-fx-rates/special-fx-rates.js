import { fetchConfigs } from '../../scripts/config.js';
import { normalizeRates } from '../forex-rates/helpers/api-helpers.js';
import { parseApiDate } from '../forex-rates/helpers/date-helpers.js';

const SORT_ORDER = ['JPY', 'USD1', 'USD5', 'USD50', 'EUR', 'GBP', 'SGD', 'HKD', 'AUD', 'CNY'];

const REDUCE_CONFIG = {
  AUD: { reduce: 0.10, decimal: 2 },
  CNY: { reduce: 0.02, decimal: 2 },
  EUR: { reduce: 0.10, decimal: 2 },
  GBP: { reduce: 0.10, decimal: 2 },
  HKD: { reduce: 0.02, decimal: 2 },
  JPY: { reduce: 0.10, decimal: 2 },
  SGD: { reduce: 0.10, decimal: 2 },
  USD1: { reduce: 0.10, decimal: 2 },
  USD5: { reduce: 0.10, decimal: 2 },
  USD50: { reduce: 0.10, decimal: 2 },
};

function getFamilyLabel(family) {
  if (family === 'USD1') return 'USD: 1-2';
  if (family === 'USD5') return 'USD: 5-20';
  if (family === 'USD50') return 'USD: 50-100';
  if (family === 'JPY') return 'JPY (:100)';
  return family.split(' ')[0];
}

function getFlagFamily(family) {
  return family;
}

function calculateDiscountedRate(sellingRates, family) {
  const config = REDUCE_CONFIG[family];
  if (!config) return sellingRates;
  const selling = parseFloat(sellingRates);
  if (Number.isNaN(selling)) return sellingRates;
  return (((selling * 10000) - (config.reduce * 10000)) / 10000).toFixed(config.decimal);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseColumns(cell) {
  const items = cell?.querySelectorAll('li');
  if (items?.length) return [...items].map((li) => li.textContent.trim());
  return [...(cell?.querySelectorAll('p, strong, span') || [])]
    .map((el) => el.textContent.trim())
    .filter(Boolean);
}

function parseAuthoring(block) {
  const rows = [...block.children];
  const columns = parseColumns(rows[1]?.children[0]);
  return {
    updateDateLabel: rows[0]?.children[0]?.textContent.trim() || '',
    currencyHeading: columns[0] || '',
    ratesHeading: columns[1] || '',
    disclaimerHtml: rows[2]?.children[0]?.innerHTML || '',
  };
}

async function fetchFxBannerRates(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

function renderBlock(block, rates, timestamp, authoring) {
  const { currencyHeading, ratesHeading, disclaimerHtml } = authoring;

  block.innerHTML = `
    <div class="special-fx-rates-content">
      <div class="special-fx-rates-table-wrap">
        <table class="special-fx-rates-table">
          <thead>
            <tr>
              <th class="special-fx-rates-th-currency">${escapeHtml(currencyHeading)}</th>
              <th class="special-fx-rates-th-rates">${escapeHtml(ratesHeading)}</th>
            </tr>
          </thead>
          <tbody>
            ${rates.map(({ family, discountedRate }) => `
              <tr>
                <td>
                  <div class="special-fx-rates-currency">
                    <img
                      src="/icons/${escapeHtml(getFlagFamily(family))}.svg"
                      alt="${escapeHtml(family)} flag"
                      loading="lazy"
                      class="special-fx-rates-flag"
                    >
                    <span>${escapeHtml(getFamilyLabel(family))}</span>
                  </div>
                </td>
                <td class="special-fx-rates-rate">${escapeHtml(discountedRate)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ${timestamp ? `<p class="special-fx-rates-timestamp">${escapeHtml(timestamp)}</p>` : ''}
      ${disclaimerHtml ? `<div class="special-fx-rates-disclaimer">${disclaimerHtml}</div>` : ''}
    </div>
  `;

  block.querySelectorAll('.special-fx-rates-flag').forEach((img) => {
    img.addEventListener('error', (e) => {
      e.target.style.display = 'none';
    });
  });
}

export default async function decorate(block) {
  const authoring = parseAuthoring(block);
  const configs = await fetchConfigs();
  const apiUrl = configs?.specialDiscountFxRate || '';

  block.textContent = '';

  try {
    const latest = await fetchFxBannerRates(apiUrl);
    const allRates = normalizeRates(latest);

    const sorted = SORT_ORDER
      .map((fam) => {
        const apiRate = allRates.find((r) => r.family === fam);
        if (!apiRate) return null;
        return {
          family: fam,
          discountedRate: calculateDiscountedRate(apiRate.sellingRates, fam),
        };
      })
      .filter(Boolean);

    const dateObj = parseApiDate(latest?.[0]?.Ddate);
    const timeStr = String(latest?.[0]?.DTime || '').trim();

    let timestamp = '';
    if (dateObj) {
      const d = String(dateObj.day).padStart(2, '0');
      const m = String(dateObj.month).padStart(2, '0');
      timestamp = `${authoring.updateDateLabel} ${d}/${m}/${dateObj.year}, ${timeStr}`.trim();
    }

    renderBlock(block, sorted, timestamp, authoring);
  } catch {
    renderBlock(block, [], '', authoring);
  }
}
