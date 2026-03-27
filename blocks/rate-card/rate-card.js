import { fetchConfigs } from '../../scripts/config.js';

/**
 * Format date string from API format to display format
 * @param {string} dateString - Date string in format DD/MM/YYYY or YYYY-MM-DD
 * @param {string} timeString - Optional time string in format HH:MM
 * @returns {string} - Formatted date string
 */
function formatDate(dateString, timeString = '') {
  if (!dateString) return '';

  try {
    let formattedDate = '';

    // Handle DD/MM/YYYY format
    if (dateString.includes('/')) {
      const [day, month, year] = dateString.split('/');
      const date = new Date(year, month - 1, day);
      formattedDate = `as of ${day} ${date.toLocaleString('en-US', { month: 'long' })} ${year}`;
    } else if (dateString.includes('-')) {
      // Handle YYYY-MM-DD format
      const date = new Date(dateString);
      formattedDate = `as of ${date.getDate()} ${date.toLocaleString('en-US', { month: 'long' })} ${date.getFullYear()}`;
    } else {
      formattedDate = `as of ${dateString}`;
    }

    // Add time if provided
    if (timeString && timeString.trim()) {
      formattedDate += ` at ${timeString.trim()}`;
    }

    return formattedDate;
  } catch (error) {
    return dateString ? `as of ${dateString}` : '';
  }
}

/**
 * Fetch data from API
 * @param {string} url - API URL
 * @returns {Promise<any>} - API response data
 */
async function fetchAPIData(url) {
  try {
    if (!url) {
      throw new Error('API URL not provided');
    }

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('API fetch error:', error);
    return null;
  }
}

/**
 * Create table HTML with data
 * @param {Array} columnNames - Column names from RTE
 * @param {Array} data - Data array from API
 * @param {string} dataType - Type of data: 'exchange', 'deposit', 'loan', 'fund'
 * @returns {string} - HTML string for table
 */
function createTableHTML(columnNames, data, dataType) {
  if (!data || data.length === 0) {
    return '<p class="no-data">No data available</p>';
  }

  const thead = `
    <thead>
      <tr>
        ${columnNames.map((name) => `<th>${name}</th>`).join('')}
      </tr>
    </thead>
  `;

  let tbody = '<tbody>';

  if (dataType === 'exchange') {
    tbody += data.map((item) => `
      <tr>
        <td>
          <div class="country-select">
            <img src="/icons/${item.Family}.svg" alt="${item.Family}" loading="lazy">
            <span>${item.Family}</span>
          </div>
        </td>
        <td>${item.BuyingRates?.trim() || '-'}</td>
        <td>${item.SellingRates?.trim() || '-'}</td>
      </tr>
    `).join('');
  } else if (dataType === 'deposit') {
    tbody += data.map((item) => `
      <tr>
        <td>${item.DepositNameEn || '-'}</td>
        <td class="text-right"><span class="percent">${item.DepositRates || '0.00'}</span></td>
      </tr>
    `).join('');
  } else if (dataType === 'loan') {
    tbody += data.map((item) => `
      <tr>
        <td>${item.LoanNameEn || '-'}</td>
        <td class="text-right"><span class="percent">${item.LoanRates || '0.00'}</span></td>
      </tr>
    `).join('');
  } else if (dataType === 'fund') {
    tbody += data.map((item) => `
      <tr>
        <td>${item.mf_sEng || item.FundName || '-'}</td>
        <td>${item.mfr_fNav || item.NAV || '-'}</td>
      </tr>
    `).join('');
  }

  tbody += '</tbody>';

  return `<table>${thead}${tbody}</table>`;
}

/**
 * Create button HTML
 * @param {Object} buttonData - Button data from block
 * @returns {string} - HTML string for button
 */
function createButtonHTML(buttonData) {
  const {
    link,
    linkText,
    linkTitle,
    targetLink,
  } = buttonData;

  if (!link || !linkText) {
    return '';
  }

  const target = targetLink ? 'target="_blank"' : 'target="_self"';
  const title = linkTitle ? `title="${linkTitle}"` : `title="${linkText}"`;

  return `
    <a class="link-primary white pull-right" href="${link}" ${title} ${target}>
      ${linkText}
      <span class="icon-arrow-left"></span>
    </a>
  `;
}

/**
 * Parse column names from RTE content
 * @param {Element} rteElement - RTE element containing column names
 * @returns {Array} - Array of column name strings
 */
function parseColumnNames(rteElement) {
  if (!rteElement) return [];

  const ul = rteElement.querySelector('ul');
  if (!ul) return [];

  const listItems = ul.querySelectorAll('li');
  return Array.from(listItems).map((li) => li.textContent.trim());
}

/**
 * Create tab content with tables
 * @param {Object} tabData - Tab data object
 * @param {Object} apiData - API data for all endpoints
 * @returns {string} - HTML string for tab content
 */
function createTabContent(tabData, apiData) {
  const {
    cardName,
    tableCount,
    table1Data,
    table2Data,
  } = tabData;

  // Determine data type based on card name
  let dataType1 = 'exchange';
  let dataType2 = 'exchange';
  let apiData1 = apiData.exchange || [];
  let apiData2 = apiData.exchange || [];
  let dateString1 = '';
  let timeString1 = '';
  let dateString2 = '';
  const timeString2 = '';

  const cardNameLower = cardName.toLowerCase();

  if (cardNameLower.includes('exchange')) {
    dataType1 = 'exchange';
    apiData1 = apiData.exchange || [];
    dateString1 = apiData.exchangeDate || '';
    timeString1 = apiData.exchangeTime || '';
  } else if (cardNameLower.includes('rate')) {
    // Rates tab has both deposit and loan
    dataType1 = 'deposit';
    dataType2 = 'loan';
    apiData1 = apiData.deposit || [];
    apiData2 = apiData.loan || [];
    dateString1 = apiData.depositDate || '';
    dateString2 = apiData.loanDate || '';
  } else if (cardNameLower.includes('nav')) {
    // NAV tab has both BBL and BCAP funds
    dataType1 = 'fund';
    dataType2 = 'fund';
    apiData1 = apiData.bblFund || [];
    apiData2 = apiData.bcapFund || [];
    dateString1 = apiData.bblFundDate || '';
    dateString2 = apiData.bcapFundDate || '';
  }

  let content = '<div class="inner">';

  // Table 1
  if (table1Data) {
    content += '<div class="currency-list">';
    content += createTableHTML(table1Data.columnNames, apiData1, dataType1);

    const table1DateHTML = dateString1
      ? `
          <span class="text-x-small">
            <span class="date-update">${formatDate(dateString1, timeString1)}</span>
          </span>
        `
      : '';
    const table1ButtonHTML = createButtonHTML(table1Data.button);

    if (table1DateHTML || table1ButtonHTML) {
      content += `
        <div class="default-wrap">
          ${table1DateHTML}
          ${table1ButtonHTML}
        </div>
      `;
    }

    content += '</div>';
  }

  // Table 2 (if tableCount is 2)
  if (tableCount === '2' && table2Data) {
    content += '<div class="currency-list full">';
    content += createTableHTML(table2Data.columnNames, apiData2, dataType2);

    const table2DateHTML = dateString2
      ? `
          <span class="text-x-small">
            <span class="date-update">${formatDate(dateString2, timeString2)}</span>
          </span>
        `
      : '';
    const table2ButtonHTML = createButtonHTML(table2Data.button);

    if (table2DateHTML || table2ButtonHTML) {
      content += `
        <div class="default-wrap">
          ${table2DateHTML}
          ${table2ButtonHTML}
        </div>
      `;
    }

    content += '</div>';
  }

  content += '</div>';

  return content;
}

/**
 * Activate a specific tab
 * @param {Element} block - Rate card block element
 * @param {number} index - Index of tab to activate
 */
function activateTab(block, index) {
  const tabHeaders = block.querySelectorAll('.tab-header li');
  const tabContents = block.querySelectorAll('[data-tab-content] > div');

  tabHeaders.forEach((header, i) => {
    const link = header.querySelector('a');
    if (i === index) {
      link?.classList.add('active');
    } else {
      link?.classList.remove('active');
    }
  });

  tabContents.forEach((content, i) => {
    if (i === index) {
      content.classList.add('active');
    } else {
      content.classList.remove('active');
    }
  });
}

/**
 * Decorate the rate card block
 * @param {Element} block - The rate card block element
 */
export default async function decorate(block) {
  // Fetch configs for API URLs
  const configs = await fetchConfigs();

  const exchangeRateAPI = configs?.getFxBanner || '';
  const depositRateAPI = configs?.getDepositeRate || '';
  const loanRateAPI = configs?.getLoanRate || '';
  const bblFundAPI = configs?.getFundPriceService || '';
  const bcapFundAPI = configs?.getFundBanner || '';

  // Parse block content
  const items = Array.from(block.children);
  const tabsData = [];

  items.forEach((item) => {
    const divs = Array.from(item.children);

    const cardName = divs[0]?.textContent.trim() || '';
    const tableCount = divs[1]?.textContent.trim() || '1';

    // Table 1 data
    const table1ColumnNamesDiv = divs[2];
    const table1ButtonDiv = divs[3];
    const table1ColumnNames = parseColumnNames(table1ColumnNamesDiv);

    const table1Link = table1ButtonDiv?.querySelector('a');
    const table1Button = {
      link: table1Link?.href || '',
      linkText: table1Link?.textContent.trim() || '',
      linkTitle: table1Link?.title || '',
      linkType: table1Link?.className.replace('button-', '') || 'tertiary',
      targetLink: table1Link?.target === '_blank',
    };

    const tabData = {
      cardName,
      tableCount,
      table1Data: {
        columnNames: table1ColumnNames,
        button: table1Button,
      },
    };

    // Table 2 data (if tableCount is 2)
    if (tableCount === '2' && divs.length > 5) {
      const table2ColumnNamesDiv = divs[5];
      const table2ButtonDiv = divs[6];
      const table2ColumnNames = parseColumnNames(table2ColumnNamesDiv);

      const table2Link = table2ButtonDiv?.querySelector('a');
      const table2Button = {
        link: table2Link?.href || '',
        linkText: table2Link?.textContent.trim() || '',
        linkTitle: table2Link?.title || '',
        linkType: table2Link?.className.replace('button-', '') || 'tertiary',
        targetLink: table2Link?.target === '_blank',
      };

      tabData.table2Data = {
        columnNames: table2ColumnNames,
        button: table2Button,
      };
    }

    tabsData.push(tabData);
  });

  // Fetch all API data
  const apiData = {
    exchange: [],
    exchangeDate: '',
    exchangeTime: '',
    deposit: [],
    depositDate: '',
    loan: [],
    loanDate: '',
    bblFund: [],
    bblFundDate: '',
    bcapFund: [],
    bcapFundDate: '',
  };

  try {
    const [exchangeData, depositData, loanData, bblFundData, bcapFundData] = await Promise.all([
      fetchAPIData(exchangeRateAPI),
      fetchAPIData(depositRateAPI),
      fetchAPIData(loanRateAPI),
      fetchAPIData(bblFundAPI),
      fetchAPIData(bcapFundAPI),
    ]);

    if (exchangeData && Array.isArray(exchangeData) && exchangeData.length > 0) {
      apiData.exchange = exchangeData.slice(0, 5); // Limit to 5 items
      apiData.exchangeDate = exchangeData[0]?.Ddate || '';
      apiData.exchangeTime = exchangeData[0]?.DTime || '';
    }

    if (depositData && Array.isArray(depositData) && depositData.length > 0) {
      apiData.deposit = depositData;
      apiData.depositDate = depositData[0]?.EffectiveDate || '';
    }

    if (loanData && Array.isArray(loanData) && loanData.length > 0) {
      apiData.loan = loanData;
      apiData.loanDate = loanData[0]?.EffectiveDate || '';
    }

    if (bblFundData && Array.isArray(bblFundData) && bblFundData.length > 0) {
      apiData.bblFund = bblFundData.slice(0, 4); // Limit to 4 items
      apiData.bblFundDate = bblFundData[0]?.mfr_dDataDate || '';
    }

    if (bcapFundData && Array.isArray(bcapFundData) && bcapFundData.length > 0) {
      apiData.bcapFund = bcapFundData.slice(0, 4); // Limit to 4 items
      apiData.bcapFundDate = bcapFundData[0]?.mfr_dDataDate || '';
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error fetching API data:', error);
  }

  // Build rate card HTML
  const rateCardHTML = `
    <article class="currency-info" data-tab="">
      <ul class="tab-header" data-tab-header="">
        ${tabsData.map((tab, index) => `
          <li>
            <a href="#${tab.cardName.toLowerCase().replace(/\s+/g, '-')}" 
               title="${tab.cardName}" 
               class="${index === 0 ? 'active' : ''}">
              ${tab.cardName}
            </a>
          </li>
        `).join('')}
      </ul>
      <section data-tab-content="">
        ${tabsData.map((tab, index) => `
          <div id="${tab.cardName.toLowerCase().replace(/\s+/g, '-')}" 
               class="inner${index === 0 ? ' active' : ''}">
            ${createTabContent(tab, apiData)}
          </div>
        `).join('')}
      </section>
    </article>
  `;

  // Clear block and add new content
  block.innerHTML = rateCardHTML;

  // Add tab click handlers
  const tabLinks = block.querySelectorAll('.tab-header a');
  tabLinks.forEach((link, index) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      activateTab(block, index);
    });
  });

  // Handle hash navigation
  const { hash } = window.location;
  if (hash) {
    const tabIndex = tabsData.findIndex(
      (tab) => `#${tab.cardName.toLowerCase().replace(/\s+/g, '-')}` === hash,
    );
    if (tabIndex >= 0) {
      activateTab(block, tabIndex);
    }
  }
}
