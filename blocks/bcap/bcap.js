import { attachCalendarPicker } from '../../scripts/utils/calendar-picker.js';

const ALL_FUND_NAMES_URL = 'https://publish-p185039-e1938068.adobeaemcloud.com/api/nav/AllFundNames';

// Helper to normalize header text as keys
function normalizeHeaderKey(header) {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ''); // removes all non-alphanumeric chars
}

// Helper to get current language - default to en (English) if unknown
function getLang() {
  if (typeof document !== 'undefined' && document.documentElement) {
    const langAttr = document.documentElement.getAttribute('lang');
    return langAttr && langAttr.toLowerCase().startsWith('th') ? 'th' : 'en';
  }
  return 'en';
}

// Map for language-aware object keys
const localizedHeaderMap = {
  fundtype: { en: 'mf_cateEng', th: 'mf_cateTha' },
  openendfund: { en: 'mf_sEng', th: 'mf_sTha' },
  nav: 'mfr_fNav',
  sellingprice: 'mfr_fBuy',
  redemptionprice: 'mfr_fSel',
  totalnetassets: 'mf_sAUM',
};

function appendRowFromData(tableElement, dataArray) {
  const lang = getLang();

  const tbody = tableElement.querySelector('tbody');
  const headerRow = tbody.querySelector('.header-row');

  if (!headerRow) {
    // eslint-disable-next-line no-console -- dev diagnostic when table markup is wrong
    console.error('Header row not found');
    return;
  }

  const headers = Array.from(headerRow.querySelectorAll('td'));

  // Ensure dataArray is an array
  if (!Array.isArray(dataArray)) {
    // eslint-disable-next-line no-console -- dev diagnostic for invalid API payload
    console.error('appendRowFromData: dataArray is not an array');
    return;
  }

  // Extract fund category order, use correct (Eng/Tha) fund type per lang
  const mfCateKey = lang === 'th' ? 'mf_cateTha' : 'mf_cateEng';
  const mfCateOrder = [];
  const seenCategories = new Set();
  dataArray.forEach((data) => {
    const cate = data[mfCateKey];
    if (cate !== undefined && !seenCategories.has(cate)) {
      mfCateOrder.push(cate);
      seenCategories.add(cate);
    }
  });

  // Group dataArray by fund category (per lang)
  const groupedByCate = {};
  dataArray.forEach((data) => {
    const cate = data[mfCateKey];
    if (!groupedByCate[cate]) {
      groupedByCate[cate] = [];
    }
    groupedByCate[cate].push(data);
  });

  // Clear all rows except header row before appending
  Array.from(tbody.querySelectorAll('tr')).forEach((tr) => {
    if (!tr.classList.contains('header-row')) tr.remove();
  });

  // Append rows in the order of fund type, each group together,
  // merge "Fund Type" tds with rowspan
  mfCateOrder.forEach((cate) => {
    const group = groupedByCate[cate];
    group.forEach((data, idx) => {
      const newRow = document.createElement('tr');
      headers.forEach((headerCell) => {
        const headerText = headerCell.textContent.trim();
        const normalizedKey = normalizeHeaderKey(headerText);

        let columnKey;
        // Get proper key per lang for columns with Eng/Tha variants (fundtype, openendfund)
        if (localizedHeaderMap[normalizedKey]) {
          if (
            typeof localizedHeaderMap[normalizedKey] === 'object'
            && (normalizedKey === 'fundtype' || normalizedKey === 'openendfund')
          ) {
            columnKey = localizedHeaderMap[normalizedKey][lang];
          } else {
            // Numeric/other columns
            columnKey = localizedHeaderMap[normalizedKey];
          }
        } else {
          // fallback: use normalizedKey directly
          columnKey = normalizedKey;
        }

        // For the "Fund Type" column, only add the td (with rowspan) on the first row in the group
        if (normalizedKey === 'fundtype') {
          if (idx === 0) {
            const td = document.createElement('td');
            td.textContent = data[columnKey] !== undefined ? data[columnKey] : '';
            td.rowSpan = group.length;
            td.classList.add('merged-fund-type');
            newRow.appendChild(td);
          }
          // skip appending a td for this header for all but the first in group
        } else {
          const td = document.createElement('td');
          td.textContent = columnKey && data[columnKey] !== undefined ? data[columnKey] : '';
          newRow.appendChild(td);
        }
      });
      tbody.appendChild(newRow);
    });
  });
}

export default async function decorate() {
  const table = document.querySelector('.table');
  const calendarLabel = document.querySelector('.table-container > .default-content-wrapper p:nth-child(2)');
  if (calendarLabel) {
    const input = document.createElement('input');
    input.id = 'date-to';
    input.type = 'text';
    input.name = 'date-to';
    calendarLabel.appendChild(input);
    attachCalendarPicker({
      input,
      value: new Date(),
      onChange: () => {
        // date picker wired; hook fetch/update here when API is ready
      },
    });
  }
  if (!table) return;

  table.classList.add('bcap-table');

  let funds = [];
  try {
    const response = await fetch(ALL_FUND_NAMES_URL);
    if (!response.ok) {
      throw new Error(`AllFundNames API returned ${response.status}`);
    }
    const data = await response.json();
    funds = Array.isArray(data) ? data : [];
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('bcap: failed to load fund list', error);
  }

  appendRowFromData(table, funds);
}
