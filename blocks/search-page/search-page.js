import { fetchPlaceholders } from '../../scripts/placeholder.js';
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

function getBlockConfig(rows) {
  const searchBackground = rows[4]?.querySelector('img');
  return {
    searchLabel: rows[0]?.textContent.trim(),
    noResultsText: rows[1]?.textContent.trim(),
    recentTitle: rows[2]?.textContent.trim(),
    learnMoreLabel: rows[3]?.textContent.trim(),
    searchImage: searchBackground?.src || '',
    searchImageAlt: searchBackground?.alt || '',
  };
}

function getSearchConfig(rows, placeholders = {}) {
  const blockConfig = getBlockConfig(rows);

  return {
    placeholder: placeholders.searchPlaceholderText,
    searchLabel: blockConfig.searchLabel,
    noResultsText: blockConfig.noResultsText,
    recentTitle: blockConfig.recentTitle,
    learnMoreLabel: blockConfig.learnMoreLabel,
    ariaLabel: placeholders.ariaLableSearch,
    searchImage: blockConfig.searchImage,
    searchImageAlt: blockConfig.searchImageAlt,
  };
}

function buildSearchPanel(item, config) {
  const image = item.OGImage || '';
  const title = item.Title || item.OGTitle || '';
  const description = item.Description || item.OGDescription || '';
  const url = item.URL || item.OGURL || '#';

  return `
    <div class="col-md-3 col-sm-6 col-xs-12 search-modal-panel">
      <div class="search-modal-panel-inner">
        <a class="text-small search-modal-panel-link" href="${escapeHtml(url)}">
          ${image ? `
            <div class="search-modal-panel-thumb">
              <img class="search-modal-panel-image" src="${escapeHtml(image)}" alt="${escapeHtml(title)}" loading="lazy">
            </div>
          ` : ''}
        </a>
        <div class="search-modal-panel-body">
          <div class="search-modal-panel-caption">
            <h3 class="search-modal-panel-title">${escapeHtml(title)}</h3>
            <div class="search-modal-panel-description">${description}</div>
          </div>
          <a class="button primary search-modal-panel-cta" href="${escapeHtml(url)}" title="${escapeHtml(config.learnMoreLabel)}">${escapeHtml(config.learnMoreLabel)}</a>
        </div>
      </div>
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
    <div class="search-modal-history-section">
      <div class="inner-content">
        <h3 class="search-modal-section-title">${escapeHtml(recentTitle)}</h3>
        <div class="search-modal-results-grid">
          <div class="search-modal-results-list">
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

export default async function decorate(block) {
  const rows = [...block.children];
  const placeholders = await fetchPlaceholders();
  const config = getSearchConfig(rows, placeholders);
  const pageLanguage = getLanguageFromPath();

  block.innerHTML = `
    <div class="search-modal search-modal-active">
      <div class="search-modal-top-block search-modal-top-block-background">
       ${config.searchImage ? `<img class="search-modal-top-block-image" src="${config.searchImage}" alt="${escapeHtml(config.searchImageAlt)}" loading="lazy">` : ''}
        <div class="search-modal-search-input inner-content">
          <input type="text" class="search-modal-input" placeholder="${escapeHtml(config.placeholder)}" autocomplete="off" aria-label="${escapeHtml(config.ariaLabel)}">
          <div class="inner-content search-modal-search-button">
            <button type="button" class="button primary button-m search-modal-submit-button" title="${escapeHtml(config.searchLabel)}">${escapeHtml(config.searchLabel)}</button>
          </div>
        </div>
      </div>
      <div class="search-modal-pre-block">
        <div class="search-modal-container search-modal-results-section" style="display:none;">
          <div class="inner-content">
            <div class="search-modal-results-grid">
              <div class="search-modal-results-list"></div>
            </div>
          </div>
          <div class="search-modal-load-more" style="display:none;">
            <button class="btn-default min-size search-modal-load-more-button">${escapeHtml(config.loadMoreLabel)}</button>
          </div>
        </div>
        <div class="search-modal-container search-modal-message"></div>
        <div class="search-modal-container search-modal-history" style="display:none;"></div>
      </div>
    </div>
  `;

  const input = block.querySelector('.search-modal-input');
  const searchButton = block.querySelector('.search-modal-submit-button');
  const searchResult = block.querySelector('.search-modal-results-section');
  const searchHistory = block.querySelector('.search-modal-history');
  const resultsList = block.querySelector('.search-modal-results-list');
  const messageContainer = block.querySelector('.search-modal-message');
  const divLoadMore = block.querySelector('.search-modal-load-more');
  const loadMoreButton = block.querySelector('.search-modal-load-more-button');

  let currentTerm = '';
  let currentPage = 1;
  let allResults = [];
  let loading = false;

  function setLoading(isLoading) {
    loading = isLoading;
    searchButton.disabled = isLoading;
    searchButton.textContent = isLoading ? config.loadingText : config.searchLabel;
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
    resultsList.innerHTML = items.map((item) => buildSearchPanel(item, config)).join('');
  }

  function showMessage(text) {
    if (text) {
      messageContainer.innerHTML = `<div class="inner-content"><p class="search-modal-message-text">${text}</p></div>`;
      messageContainer.style.display = 'block';
    } else {
      messageContainer.innerHTML = '';
      messageContainer.style.display = 'none';
    }
  }

  function showRecentSearches(onSearch) {
    searchResult.style.display = 'none';
    divLoadMore.style.display = 'none';
    renderRecentSearches(searchHistory, config.recentTitle, onSearch);
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
    if (!loading && currentTerm) runSearch(currentTerm, currentPage + 1, true);
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
