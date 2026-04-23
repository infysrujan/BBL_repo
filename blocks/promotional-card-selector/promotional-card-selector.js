const PROMOTIONS_JSON = '/data/promotions.json';
const DEFAULT_PAGE_SIZE = 12;

const fetchCache = {};

async function fetchJson(url) {
  if (!fetchCache[url]) {
    fetchCache[url] = fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  }
  return fetchCache[url];
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function buildDateLine(card) {
  const start = formatDate(card.promotionStartDate);
  const end = formatDate(card.promotionEndDate);
  const label = card.dateValidityLabel || 'until';
  if (start && end) return `${start} ${label} ${end}`;
  if (end) return `${label} ${end}`;
  return '';
}

const LOGO_ICONS = {
  visa: '/icons/visa-new.svg',
  mastercard: '/icons/mastercard-new.svg',
  amex: '/icons/amex-new.svg',
  unionpay: '/icons/upi-new.svg',
};

function buildLogosHtml(logos) {
  if (!logos?.length) return '';
  const imgs = logos
    .map((key) => {
      const src = LOGO_ICONS[key];
      return src ? `<img src="${src}" alt="${key}" class="promo-selector-logo" loading="lazy">` : '';
    })
    .join('');
  return `<div class="promo-selector-logos">${imgs}</div>`;
}

function buildCardHtml(card, tag) {
  const dateLine = buildDateLine(card);
  const logoHtml = buildLogosHtml((card.cardTypes || []).map((t) => t.toLowerCase()));
  const cta = card.ctaLabel || 'Learn More';
  const target = card.linkTarget || '_self';
  return `<div class="promo-selector-card">
  <div class="promo-selector-card-img-wrap">
    <span class="promo-selector-card-tag">${tag}</span>
    <img src="${card.cardImageUrl}" alt="${card.title || ''}"
      class="promo-selector-card-img" loading="lazy">
  </div>
  <div class="promo-selector-card-body">
    <p class="promo-selector-card-desc">${card.shortDescription || ''}</p>
    ${logoHtml}
    ${dateLine ? `<p class="promo-selector-card-date">${dateLine}</p>` : ''}
  </div>
  <div class="promo-selector-card-footer">
    <a href="${card.ctaLink}" target="${target}" class="promo-selector-cta button primary">${cta}</a>
  </div>
</div>`;
}

function buildPaginationHtml(current, total) {
  if (total <= 1) return '';
  const pages = [];
  for (let i = 1; i <= total; i += 1) {
    if (i === 1 || i === total || Math.abs(i - current) <= 1) pages.push(i);
  }
  const items = [];
  pages.forEach((p, idx) => {
    if (idx > 0 && p - pages[idx - 1] > 1) items.push('ellipsis');
    items.push(p);
  });
  const pageButtons = items.map((item) => {
    if (item === 'ellipsis') return '<span class="promo-selector-ellipsis">&hellip;</span>';
    const cls = item === current ? 'promo-selector-page is-active' : 'promo-selector-page';
    return `<button class="${cls}" data-page="${item}">${item}</button>`;
  }).join('');
  const prevAttr = current === 1 ? ' disabled' : '';
  const nextAttr = current === total ? ' disabled' : '';
  return `
    <button class="promo-selector-arrow" data-dir="prev"${prevAttr} aria-label="Previous">&#8249;</button>
    <div class="promo-selector-pages">${pageButtons}</div>
    <button class="promo-selector-arrow" data-dir="next"${nextAttr} aria-label="Next">&#8250;</button>`;
}

function buildSubOptions(items) {
  return items
    .map((s) => `<li class="promo-selector-option" data-value="${s.label}" role="option">${s.label}</li>`)
    .join('');
}

function filterCards(allCards, filters, page, pageSize) {
  const {
    category, subcategory, cardType, area,
  } = filters;
  const today = new Date();

  const matched = allCards.filter((card) => {
    if (category && card.category?.toLowerCase() !== category.toLowerCase()) return false;
    if (card.promotionEndDate && new Date(card.promotionEndDate) < today) return false;
    if (subcategory && card.subcategory !== subcategory) return false;
    if (cardType && !(card.cardTypes || []).includes(cardType.toLowerCase())) return false;
    if (area && card.area !== 'All' && card.area !== area) return false;
    return true;
  });

  const total = matched.length;
  const start = (page - 1) * pageSize;
  return { cards: matched.slice(start, start + pageSize), total };
}

export default async function decorate(block) {
  const rows = [...block.children];
  const dataSource = rows[0]?.textContent?.trim() || PROMOTIONS_JSON;
  const pageSize = parseInt(rows[1]?.textContent?.trim() || '', 10) || DEFAULT_PAGE_SIZE;

  // Read tab label BEFORE async fetch so DOM is in its original state.
  // Use role="tabpanel" (set by tabs.js) — more reliable than class name.
  const tabPanel = block.closest('[role="tabpanel"]');
  const tabBtnId = tabPanel?.getAttribute('aria-labelledby');
  const tabBtn = tabBtnId ? document.getElementById(tabBtnId) : null;
  const tabText = tabBtn?.textContent?.trim() || '';

  const tagsData = await fetchJson(dataSource);

  const categories = tagsData?.categories || [];
  const cardTypes = tagsData?.cardTypes || [
    { label: 'Visa' },
    { label: 'Mastercard' },
    { label: 'UnionPay' },
    { label: 'Amex' },
  ];
  const areas = tagsData?.areas || [];

  // Match tab text to a known category label (case-insensitive)
  const catMeta = categories.find((c) => c.label.toLowerCase() === tabText.toLowerCase()) || {};
  // If inside a tab panel, always use a non-empty category so unmatched tabs show
  // "No results found" instead of bypassing the filter and showing all cards.
  const category = tabPanel ? (catMeta.label || tabText) : (catMeta.label || '');
  const subcategories = catMeta.subcategories || [];

  const subDisabled = !subcategories.length;

  block.innerHTML = `
    <div class="promo-selector-filters">
      <div class="promo-selector-filter${subDisabled ? ' is-disabled' : ''}" data-filter="subcategory">
        <button class="promo-selector-filter-btn"${subDisabled ? ' disabled' : ''} aria-expanded="false" aria-haspopup="listbox">
          <span class="promo-selector-filter-label">Category</span>
          <span class="promo-selector-filter-arrow"></span>
        </button>
        <ul class="promo-selector-dropdown" role="listbox">
          ${buildSubOptions(subcategories)}
        </ul>
      </div>
      <div class="promo-selector-filter" data-filter="cardType">
        <button class="promo-selector-filter-btn" aria-expanded="false" aria-haspopup="listbox">
          <span class="promo-selector-filter-label">Card Type</span>
          <span class="promo-selector-filter-arrow"></span>
        </button>
        <ul class="promo-selector-dropdown" role="listbox">
          ${buildSubOptions(cardTypes)}
        </ul>
      </div>
      <div class="promo-selector-filter" data-filter="area">
        <button class="promo-selector-filter-btn" aria-expanded="false" aria-haspopup="listbox">
          <span class="promo-selector-filter-label">Area</span>
          <span class="promo-selector-filter-arrow"></span>
        </button>
        <ul class="promo-selector-dropdown" role="listbox">
          ${buildSubOptions(areas)}
        </ul>
      </div>
      <div class="promo-selector-filter-actions">
        <button class="promo-selector-btn-reset button secondary" type="button">Reset</button>
        <button class="promo-selector-btn-search button primary" type="button">Search</button>
      </div>
    </div>
    <div class="promo-selector-grid"></div>
    <div class="promo-selector-pagination"></div>`;

  const gridEl = block.querySelector('.promo-selector-grid');
  const paginationEl = block.querySelector('.promo-selector-pagination');

  const state = {
    subcategory: '',
    cardType: '',
    area: '',
    page: 1,
  };

  function showSkeleton() {
    const card = `<div class="promo-selector-skeleton">
      <div class="promo-selector-skeleton-img"></div>
      <div class="promo-selector-skeleton-body">
        <div class="promo-selector-skeleton-line"></div>
        <div class="promo-selector-skeleton-line"></div>
        <div class="promo-selector-skeleton-line promo-selector-skeleton-line-short"></div>
        <div class="promo-selector-skeleton-logos">
          <div class="promo-selector-skeleton-logo"></div>
          <div class="promo-selector-skeleton-logo"></div>
        </div>
      </div>
      <div class="promo-selector-skeleton-footer">
        <div class="promo-selector-skeleton-cta"></div>
      </div>
    </div>`;
    gridEl.innerHTML = Array.from({ length: pageSize }, () => card).join('');
    paginationEl.innerHTML = '';
  }

  let allCards = null;

  function render() {
    const { cards, total } = filterCards(allCards, {
      category,
      subcategory: state.subcategory,
      cardType: state.cardType,
      area: state.area,
    }, state.page, pageSize);

    gridEl.innerHTML = cards.length
      ? cards.map((c) => buildCardHtml(c, category)).join('')
      : '<p class="promo-selector-empty">No results found.</p>';

    paginationEl.innerHTML = buildPaginationHtml(state.page, Math.ceil(total / pageSize));
  }

  async function fetchAndRender() {
    if (!allCards) {
      showSkeleton();
      await new Promise((resolve) => { requestAnimationFrame(resolve); });
      const data = await fetchJson(dataSource);
      allCards = data?.cards || [];
    }
    render();
  }

  // Lazy load — only fetch when block becomes visible (inactive tabs don't load)
  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      observer.disconnect();
      fetchAndRender();
    }
  }, { rootMargin: '100px' });
  observer.observe(block);

  // Dropdown open/close
  block.querySelectorAll('.promo-selector-filter-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const filter = btn.closest('.promo-selector-filter');
      const isOpen = filter.classList.contains('is-open');
      block.querySelectorAll('.promo-selector-filter').forEach((f) => {
        f.classList.remove('is-open');
        f.querySelector('.promo-selector-filter-btn')?.setAttribute('aria-expanded', 'false');
      });
      if (!isOpen && !btn.disabled) {
        filter.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  document.addEventListener('click', () => {
    block.querySelectorAll('.promo-selector-filter').forEach((f) => {
      f.classList.remove('is-open');
      f.querySelector('.promo-selector-filter-btn')?.setAttribute('aria-expanded', 'false');
    });
  });

  function makeSingleSelect(filterAttr, stateKey, defaultLabel) {
    block.querySelectorAll(`[data-filter="${filterAttr}"] .promo-selector-option`).forEach((opt) => {
      opt.addEventListener('click', () => {
        const isActive = opt.classList.contains('is-active');
        block.querySelectorAll(`[data-filter="${filterAttr}"] .promo-selector-option`)
          .forEach((o) => o.classList.remove('is-active'));
        const labelEl = block.querySelector(
          `[data-filter="${filterAttr}"] .promo-selector-filter-label`,
        );
        if (isActive) {
          state[stateKey] = '';
          labelEl.textContent = defaultLabel;
        } else {
          opt.classList.add('is-active');
          state[stateKey] = opt.dataset.value;
          labelEl.textContent = opt.dataset.value;
        }
        block.querySelector(`[data-filter="${filterAttr}"]`).classList.remove('is-open');
        state.page = 1;
        fetchAndRender();
      });
    });
  }

  makeSingleSelect('subcategory', 'subcategory', 'Category');
  makeSingleSelect('cardType', 'cardType', 'Card Type');
  makeSingleSelect('area', 'area', 'Area');

  function resetFilters() {
    state.subcategory = '';
    state.cardType = '';
    state.area = '';
    state.page = 1;
    block.querySelectorAll('.promo-selector-option').forEach((o) => o.classList.remove('is-active'));
    block.querySelector('[data-filter="subcategory"] .promo-selector-filter-label').textContent = 'Category';
    block.querySelector('[data-filter="cardType"] .promo-selector-filter-label').textContent = 'Card Type';
    block.querySelector('[data-filter="area"] .promo-selector-filter-label').textContent = 'Area';
    fetchAndRender();
  }

  block.querySelector('.promo-selector-btn-reset')?.addEventListener('click', resetFilters);
  block.querySelector('.promo-selector-btn-search')?.addEventListener('click', () => {
    state.page = 1;
    fetchAndRender();
  });

  // Pagination
  paginationEl.addEventListener('click', (e) => {
    const pageBtn = e.target.closest('.promo-selector-page');
    const arrowBtn = e.target.closest('.promo-selector-arrow');
    let changed = false;
    if (pageBtn) {
      state.page = parseInt(pageBtn.dataset.page, 10);
      changed = true;
    } else if (arrowBtn?.dataset.dir === 'prev' && state.page > 1) {
      state.page -= 1;
      changed = true;
    } else if (arrowBtn?.dataset.dir === 'next') {
      state.page += 1;
      changed = true;
    }
    if (changed) {
      fetchAndRender();
      gridEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}
