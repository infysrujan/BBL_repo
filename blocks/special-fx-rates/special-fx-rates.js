import { fetchConfigs } from '../../scripts/config.js';
import {
  createApiEndpoints,
  getLatestRates,
  normalizeRates,
} from '../forex-rates/helpers/api-helpers.js';
import { parseApiDate } from '../forex-rates/helpers/date-helpers.js';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseColumns(cell) {
  const ul = cell?.querySelector('ul');
  if (ul) return [...ul.querySelectorAll('li')].map((li) => li.textContent.trim());
  return [...(cell?.querySelectorAll('p, strong, span') || [])]
    .map((el) => el.textContent.trim())
    .filter(Boolean);
}

function parseAuthoring(block) {
  const rows = [...block.children];
  const columns = parseColumns(rows[1]?.children[0]);
  return {
    updateDateLabel: rows[0]?.children[0]?.textContent.trim() || 'Update as of',
    currencyHeading: columns[0] || 'Currency',
    disclaimerHtml: rows[2]?.children[0]?.innerHTML || '',
  };
}

function renderBlock(block, apiRates, timestamp, authoring) {
  const { currencyHeading, disclaimerHtml } = authoring;

  const rowsHtml = apiRates.map(({ family, description, sellingRates }) => `
    <tr>
      <td class="special-fx-rates-currency">
        <img
          src="/icons/${escapeHtml(family.toLowerCase())}.svg"
          alt="${escapeHtml(family)} flag"
          loading="lazy"
          class="special-fx-rates-flag"
        >
        <span>${escapeHtml(description || family)}</span>
      </td>
      <td class="special-fx-rates-rate">${escapeHtml(sellingRates)}</td>
    </tr>
  `).join('');

  const timestampHtml = timestamp
    ? `<p class="special-fx-rates-timestamp">${escapeHtml(timestamp)}</p>`
    : '';

  block.innerHTML = `
    <div class="special-fx-rates-content">
      <div class="special-fx-rates-table-wrap">
        <table class="special-fx-rates-table">
          <thead>
            <tr>
              <th class="special-fx-rates-th-currency">${escapeHtml(currencyHeading)}</th>
              <th class="special-fx-rates-th-rates">Rates</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
      ${timestampHtml}
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
  const endpoints = createApiEndpoints(configs);

  block.textContent = '';

  try {
    const latest = await getLatestRates(endpoints);
    const apiRates = normalizeRates(latest);

    const dateObj = parseApiDate(latest?.[0]?.Ddate);
    const timeStr = String(latest?.[0]?.Time || '').trim();

    let timestamp = '';
    if (dateObj) {
      const d = String(dateObj.day).padStart(2, '0');
      const m = String(dateObj.month).padStart(2, '0');
      timestamp = `${authoring.updateDateLabel} ${d}/${m}/${dateObj.year}, ${timeStr}`.trim();
    }

    renderBlock(block, apiRates, timestamp, authoring);
  } catch {
    block.textContent = '';
  }
}
