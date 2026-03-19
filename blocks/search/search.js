import { getSiteSearchResults, normalizeSearchTerm } from '../../scripts/utils/searchApi.js';

const MIN_SEARCH_LENGTH = 3;

function getLanguageFromPath() {
  const [, lang] = window.location.pathname.split('/');
  return lang || 'en';
}

function getRecentSearchesKey() {
  return `site-search-recent-${getLanguageFromPath()}`;
}

function getLastResultsKey() {
  return `site-search-last-results-${getLanguageFromPath()}`;
}

function getRecentSearches() {
  try {
    return JSON.parse(localStorage.getItem(getRecentSearchesKey())) || [];
  } catch {
    return [];
  }
}

function saveRecentSearch(term) {
  const current = getRecentSearches().filter((item) => item !== term);
  current.unshift(term);
  localStorage.setItem(getRecentSearchesKey(), JSON.stringify(current.slice(0, 5)));
}

function getLastResults() {
  try {
    return JSON.parse(sessionStorage.getItem(getLastResultsKey())) || null;
  } catch {
    return null;
  }
}

function saveLastResults(data) {
  sessionStorage.setItem(getLastResultsKey(), JSON.stringify(data));
}

function clearLastResults() {
  sessionStorage.removeItem(getLastResultsKey());
}

function escapeHtml(value = '') {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

function getBlockConfig(rows, ariaLabel) {
  return {
    placeholder: rows[0]?.textContent.trim() || 'Search Here',
    searchLabel: rows[1]?.textContent.trim() || 'Search',
    noResultsText: rows[2]?.textContent.trim() || 'No Results Found',
    recentTitle: rows[3]?.textContent.trim() || 'Recent Searches',
    loadMoreLabel: rows[4]?.textContent.trim() || 'Load More',
    loadingText: rows[5]?.textContent.trim() || 'Searching...',
    ariaLabel,
  };
}

function buildSearchPanel(item) {
  const image = item.OGImage || '';
  const title = item.Title || item.OGTitle || '';
  const description = item.Description || item.OGDescription || '';
  const url = item.URL || item.OGURL || '#';

  return `
    <div class="col-md-3 col-sm-6 col-xs-12 search-modal-panel">
      <a class="text-small" href="${escapeHtml(url)}">
        <div class="search-modal-panel-inner">
          ${image ? `
            <div class="search-modal-panel-thumb">
              <img class="search-modal-panel-image" src="${escapeHtml(image)}" alt="${escapeHtml(title)}" loading="lazy">
            </div>
          ` : ''}
          <div class="search-modal-panel-body">
            <div class="search-modal-panel-caption">
              <h3 class="search-modal-panel-title">${escapeHtml(title)}</h3>
              <div class="search-modal-panel-description">${description}</div>
            </div>
          </div>
        </div>
      </a>
    </div>
  `;
}

function renderRecentSearches(container, recentTitle, onSearch) {
  const searches = getRecentSearches();

  if (!searches.length) {
    container.innerHTML = '';
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  container.innerHTML = `
    <div class="search-modal-history-section" style="display: block;">
      <div class="inner-content">
        <h3 class="search-modal-section-title">${escapeHtml(recentTitle)}</h3>
        <div class="search-modal-results-grid">
          <div id="ulPreSearchResultsList" class="search-modal-results-list">
            ${searches.map((term) => `
              <div class="col-md-3 col-sm-6 col-xs-12 search-modal-panel">
                <a class="text-small search-modal-history-term" href="#" data-term="${escapeHtml(term)}">
                  <div class="search-modal-panel-inner">
                    <div class="search-modal-panel-body">
                      <div class="search-modal-panel-caption">
                        <h3 class="search-modal-panel-title">${escapeHtml(term)}</h3>
                      </div>
                    </div>
                  </div>
                </a>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;

  container.querySelectorAll('[data-term]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      onSearch(button.dataset.term);
    });
  });
}

function renderHeaderSearch(block, searchUrl, ariaLabel) {
  block.textContent = '';

  const searchWrapper = document.createElement('div');
  searchWrapper.className = 'search-wrapper';

  const searchLink = document.createElement('a');
  searchLink.href = searchUrl;
  searchLink.classList.add('search-link', 'icon-search');
  searchLink.setAttribute('aria-label', ariaLabel);
  searchLink.setAttribute('title', ariaLabel);

  const searchPlaceholder = document.createElement('span');
  searchPlaceholder.className = 'search-placeholder';
  searchPlaceholder.setAttribute('aria-hidden', 'true');
  searchPlaceholder.textContent = 'Search';
  searchLink.appendChild(searchPlaceholder);

  searchWrapper.appendChild(searchLink);
  block.appendChild(searchWrapper);
}

function renderPageSearch(block, config) {
  const pageLanguage = getLanguageFromPath();

  block.innerHTML = `
    <div id="search-modal" data-searchmodal="" class="search-modal search-modal-active">
      <div class="search-modal-top-block search-modal-top-block-background">
        <div class="search-modal-search-input inner-content">
          <input type="text" id="txtSearchSite" class="search-modal-input" placeholder="${escapeHtml(config.placeholder)}" autocomplete="off" aria-label="${escapeHtml(config.ariaLabel)}">
          <div class="inner-content search-modal-search-button">
            <button type="button" id="btnSearchSubmit" class="btn-primary search-modal-submit-button">${escapeHtml(config.searchLabel)}</button>
          </div>
        </div>
      </div>
      <div class="search-modal-pre-block">
        <div class="search-modal-container" id="search-result" style="display:none;">
          <div class="inner-content">
            <div class="search-modal-results-grid">
              <div id="ulSearchResultsList" class="search-modal-results-list"></div>
            </div>
          </div>
          <div id="divLoadMore" class="search-modal-load-more" style="display:none;">
            <button class="btn-default min-size search-modal-load-more-button" id="btnLoadMoreSearchResults">${escapeHtml(config.loadMoreLabel)}</button>
          </div>
        </div>
        <div class="search-modal-container" id="search-personalize"></div>
        <div class="search-modal-container" id="search-history" style="display:none;"></div>
      </div>
    </div>
  `;

  const input = block.querySelector('#txtSearchSite');
  const searchButton = block.querySelector('#btnSearchSubmit');
  const searchResult = block.querySelector('#search-result');
  const searchHistory = block.querySelector('#search-history');
  const resultsList = block.querySelector('#ulSearchResultsList');
  const messageContainer = block.querySelector('#search-personalize');
  const divLoadMore = block.querySelector('#divLoadMore');
  const loadMoreButton = block.querySelector('#btnLoadMoreSearchResults');

  let currentTerm = '';
  let currentPage = 1;
  let allResults = [];
  let loading = false;

  function setLoading(isLoading) {
    loading = isLoading;
    searchButton.disabled = isLoading;
    if (isLoading) {
      searchButton.textContent = config.loadingText;
    } else {
      searchButton.textContent = config.searchLabel;
    }
  }

  function updateUrl(term) {
    const url = new URL(window.location.href);
    if (term) {
      url.searchParams.set('q', term);
    } else {
      url.searchParams.delete('q');
    }
    window.history.replaceState({}, '', url);
  }

  function renderResults(items) {
    resultsList.innerHTML = items.map(buildSearchPanel).join('');
  }

  function showMessage(text) {
    messageContainer.innerHTML = text ? `<div class="inner-content"><p class="search-modal-message-text">${text}</p></div>` : '';
  }

  function restoreLastResults() {
    const lastResults = getLastResults();
    if (lastResults?.term && Array.isArray(lastResults.results) && lastResults.results.length) {
      currentTerm = lastResults.term;
      currentPage = lastResults.page || 1;
      allResults = lastResults.results;
      input.value = currentTerm;
      renderResults(allResults);
      searchResult.style.display = 'block';
      searchHistory.style.display = 'none';
      divLoadMore.style.display = lastResults.showLoadMore ? 'block' : 'none';
      showMessage('');
      return true;
    }
    return false;
  }

  function showRecentSearches(onSearch) {
    searchResult.style.display = 'none';
    divLoadMore.style.display = 'none';
    renderRecentSearches(searchHistory, config.recentTitle, onSearch);
  }

  async function runSearch(term, page = 1, append = false) {
    const normalized = normalizeSearchTerm(term);

    if (normalized.length < MIN_SEARCH_LENGTH) {
      if (!normalized) {
        if (!restoreLastResults()) {
          resultsList.innerHTML = '';
          showMessage('');
          showRecentSearches((recentTerm) => {
            input.value = recentTerm;
            runSearch(recentTerm, 1, false);
          });
        }
      } else {
        resultsList.innerHTML = '';
        searchResult.style.display = 'block';
        searchHistory.style.display = 'none';
        divLoadMore.style.display = 'none';
        showMessage(`Please enter at least ${MIN_SEARCH_LENGTH} characters.`);
      }
      return;
    }

    setLoading(true);
    searchHistory.style.display = 'none';
    showMessage('');

    try {
      const data = await getSiteSearchResults({
        keywords: normalized,
        pageNumber: page,
        pageLanguage,
      });

      currentTerm = normalized;
      currentPage = page;
      allResults = append ? [...allResults, ...data.searchResults] : data.searchResults;

      renderResults(allResults);
      searchResult.style.display = 'block';
      divLoadMore.style.display = data.showLoadMore ? 'block' : 'none';
      showMessage(!allResults.length ? (data.noResultsMessage || config.noResultsText) : '');

      saveRecentSearch(normalized);
      saveLastResults({
        term: normalized,
        page: currentPage,
        results: allResults,
        showLoadMore: data.showLoadMore,
      });

      updateUrl(normalized);
    } catch (error) {
      resultsList.innerHTML = '';
      searchResult.style.display = 'block';
      divLoadMore.style.display = 'none';
      showMessage('Something went wrong. Please try again.');
      // eslint-disable-next-line no-console
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  searchButton.addEventListener('click', () => runSearch(input.value, 1, false));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      runSearch(input.value, 1, false);
    }
  });

  loadMoreButton.addEventListener('click', () => {
    if (!loading && currentTerm) {
      runSearch(currentTerm, currentPage + 1, true);
    }
  });

  const initialTerm = new URLSearchParams(window.location.search).get('q');

  if (initialTerm) {
    input.value = initialTerm;
    runSearch(initialTerm, 1, false);
  } else if (!restoreLastResults()) {
    showRecentSearches((recentTerm) => {
      input.value = recentTerm;
      runSearch(recentTerm, 1, false);
    });
  }

  block.addEventListener('site-search:clear', () => {
    clearLastResults();
    input.value = '';
    currentTerm = '';
    currentPage = 1;
    allResults = [];
    resultsList.innerHTML = '';
    showMessage('');
    updateUrl('');
    showRecentSearches((recentTerm) => {
      input.value = recentTerm;
      runSearch(recentTerm, 1, false);
    });
  });
}

export default function decorate(block) {
  const rows = [...block.children];
  const isSearchPage = window.location.pathname.toLowerCase().endsWith('/search');
  const hasAuthoredLink = block.querySelector('a') !== null;

  if (!rows.length && !isSearchPage) return;

  const anchor = block.querySelector('a');
  const searchUrl = anchor?.href || `/${getLanguageFromPath()}/Search`;

  let ariaLabel = 'Search';
  if (rows.length > 1) {
    const ariaLabelCell = rows[1]?.querySelector('p');
    ariaLabel = ariaLabelCell?.textContent?.trim() || ariaLabel;
  }

  if (isSearchPage && hasAuthoredLink) {
    block.style.display = 'none';
    return;
  }

  if (isSearchPage) {
    renderPageSearch(block, getBlockConfig(rows, ariaLabel));
    return;
  }

  if (!hasAuthoredLink) {
    block.style.display = 'none';
    return;
  }

  renderHeaderSearch(block, searchUrl, ariaLabel);
}
