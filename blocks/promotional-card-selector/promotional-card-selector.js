const PROMOTIONS_JSON = '/data/promotions.json';
const TAGS_JSON = '/data/promo-tags.json';
const DEFAULT_PAGE_SIZE = 12;

async function fetchJson(url) {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    return resp.json();
  } catch {
    return null;
  }
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

function buildLogosHtml(logos) {
  if (!logos?.length) return '';
  const imgs = logos
    .map((src) => `<img src="${src}" alt="" class="promo-selector-logo" loading="lazy">`)
    .join('');
  return `<div class="promo-selector-logos">${imgs}</div>`;
}

function buildCardHtml(card, tag) {
  const dateLine = buildDateLine(card);
  const logoHtml = buildLogosHtml(card.cardTypeLogos);
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
    .map((s) => `<li class="promo-selector-option" data-value="${s.id}" role="option">${s.label}</li>`)
    .join('');
}

// ─── Data loader ────────────────────────────────────────────────────────────
// Single function to swap for API later.
// Future API shape:
// GET {dataSource}?category=X&subcategory=Y&cardType=visa&area=central&page=1&limit=12
// API should return: { cards: [...], total: 45 }
async function loadPage(dataSource, filters, page, pageSize) {
  const data = await fetchJson(dataSource);
  if (!data) return { cards: [], total: 0 };

  const {
    category, subcategory, cardType, area,
  } = filters;
  const today = new Date();

  const all = (data.cards || []).filter((card) => {
    if (category && card.category !== category) return false;
    if (card.promotionEndDate && new Date(card.promotionEndDate) < today) return false;
    if (subcategory && card.subcategory?.toLowerCase() !== subcategory) return false;
    if (cardType) {
      const ct = (card.cardTypes || []).map((t) => t.toLowerCase());
      if (!ct.includes(cardType)) return false;
    }
    if (area) {
      const cardArea = card.area?.toLowerCase();
      if (cardArea !== 'all' && cardArea !== area) return false;
    }
    return true;
  });

  const total = all.length;
  const start = (page - 1) * pageSize;
  return { cards: all.slice(start, start + pageSize), total };
}
// ────────────────────────────────────────────────────────────────────────────

export default async function decorate(block) {
  const rows = [...block.children];
  const category = rows[0]?.textContent?.trim() || '';
  const dataSource = rows[1]?.textContent?.trim() || PROMOTIONS_JSON;
  const tagsSource = rows[2]?.textContent?.trim() || TAGS_JSON;
  const pageSize = parseInt(rows[3]?.textContent?.trim() || '', 10) || DEFAULT_PAGE_SIZE;

  // Tags are small — load upfront to build dropdowns
  const tagsData = await fetchJson(tagsSource);

  const categoryMeta = tagsData?.categories?.find((c) => c.id === category) || {};
  const categoryLabel = categoryMeta.label || category;
  const subcategories = categoryMeta.subcategories || [];
  const cardTypes = tagsData?.cardTypes || [
    { id: 'visa', label: 'Visa' },
    { id: 'mastercard', label: 'Mastercard' },
    { id: 'unionpay', label: 'UnionPay' },
    { id: 'amex', label: 'Amex' },
  ];
  const areas = tagsData?.areas || [];

  block.innerHTML = `
    <div class="promo-selector-filters">
      <div class="promo-selector-filter" data-filter="subcategory">
        <button class="promo-selector-filter-btn" aria-expanded="false" aria-haspopup="listbox">
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

  async function fetchAndRender() {
    showSkeleton();
    await new Promise((resolve) => { requestAnimationFrame(resolve); });
    const { cards, total } = await loadPage(dataSource, {
      category,
      subcategory: state.subcategory,
      cardType: state.cardType,
      area: state.area,
    }, state.page, pageSize);

    gridEl.innerHTML = cards.length
      ? cards.map((c) => buildCardHtml(c, categoryLabel)).join('')
      : '<p class="promo-selector-empty">No results found.</p>';

    paginationEl.innerHTML = buildPaginationHtml(state.page, Math.ceil(total / pageSize));
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
      if (!isOpen) {
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

  // Disable subcategory dropdown when category has no subcategories
  if (!subcategories.length) {
    const subBtn = block.querySelector('[data-filter="subcategory"] .promo-selector-filter-btn');
    subBtn?.setAttribute('disabled', '');
    block.querySelector('[data-filter="subcategory"]')?.classList.add('is-disabled');
  }

  function makeSingleSelect(filterAttr, stateKey, defaultLabel, list) {
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
          const match = list.find((item) => item.id === opt.dataset.value);
          labelEl.textContent = match?.label || opt.dataset.value;
        }
        block.querySelector(`[data-filter="${filterAttr}"]`).classList.remove('is-open');
        state.page = 1;
        fetchAndRender();
      });
    });
  }

  makeSingleSelect('subcategory', 'subcategory', 'Category', subcategories);
  makeSingleSelect('cardType', 'cardType', 'Card Type', cardTypes);
  makeSingleSelect('area', 'area', 'Area', areas);

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
