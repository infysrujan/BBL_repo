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
  <a href="${card.ctaLink}" target="${target}" class="promo-selector-card-link">
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
      <span class="promo-selector-cta">${cta}</span>
    </div>
  </a>
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

function buildSubOptions(subcategories) {
  const all = '<li class="promo-selector-option is-active" data-value="" role="option">All</li>';
  const opts = subcategories
    .map((s) => `<li class="promo-selector-option" data-value="${s.id}" role="option">${s.label}</li>`)
    .join('');
  return all + opts;
}

function buildCheckOptions(items) {
  return items.map((item) => `<label class="promo-selector-check-label">
      <input type="checkbox" class="promo-selector-check" value="${item.id}"> ${item.label}
    </label>`).join('');
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
    category, subcategory, cardTypes, area,
  } = filters;
  const today = new Date();

  const all = (data.cards || []).filter((card) => {
    if (category && card.category !== category) return false;
    if (card.promotionEndDate && new Date(card.promotionEndDate) < today) return false;
    if (subcategory && card.subcategory?.toLowerCase() !== subcategory) return false;
    if (cardTypes.length) {
      const ct = (card.cardTypes || []).map((t) => t.toLowerCase());
      if (!cardTypes.some((t) => ct.includes(t))) return false;
    }
    if (area.length) {
      const cardArea = card.area?.toLowerCase();
      if (cardArea !== 'all' && !area.includes(cardArea)) return false;
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
        <div class="promo-selector-dropdown promo-selector-dropdown--multi">
          ${buildCheckOptions(cardTypes)}
        </div>
      </div>
      <div class="promo-selector-filter" data-filter="area">
        <button class="promo-selector-filter-btn" aria-expanded="false" aria-haspopup="listbox">
          <span class="promo-selector-filter-label">Area</span>
          <span class="promo-selector-filter-arrow"></span>
        </button>
        <div class="promo-selector-dropdown promo-selector-dropdown--multi">
          ${buildCheckOptions(areas)}
        </div>
      </div>
    </div>
    <div class="promo-selector-grid"></div>
    <div class="promo-selector-pagination"></div>`;

  const gridEl = block.querySelector('.promo-selector-grid');
  const paginationEl = block.querySelector('.promo-selector-pagination');

  const state = {
    subcategory: '',
    cardTypes: [],
    area: [],
    page: 1,
  };

  function showSkeleton() {
    const items = Array.from({ length: pageSize }, () => '<div class="promo-selector-skeleton"></div>').join('');
    gridEl.innerHTML = items;
    paginationEl.innerHTML = '';
  }

  async function fetchAndRender() {
    showSkeleton();
    const { cards, total } = await loadPage(dataSource, {
      category,
      subcategory: state.subcategory,
      cardTypes: state.cardTypes,
      area: state.area,
    }, state.page, pageSize);

    gridEl.innerHTML = cards.length
      ? cards.map((c) => buildCardHtml(c, categoryLabel)).join('')
      : '<p class="promo-selector-empty">No promotions found.</p>';

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

  // Subcategory single-select
  block.querySelectorAll('[data-filter="subcategory"] .promo-selector-option').forEach((opt) => {
    opt.addEventListener('click', () => {
      block.querySelectorAll('[data-filter="subcategory"] .promo-selector-option')
        .forEach((o) => o.classList.remove('is-active'));
      opt.classList.add('is-active');
      state.subcategory = opt.dataset.value;
      const labelEl = block.querySelector(
        '[data-filter="subcategory"] .promo-selector-filter-label',
      );
      if (state.subcategory) {
        const match = subcategories.find((s) => s.id === state.subcategory);
        labelEl.textContent = match?.label || state.subcategory;
      } else {
        labelEl.textContent = 'Category';
      }
      block.querySelector('[data-filter="subcategory"]').classList.remove('is-open');
      state.page = 1;
      fetchAndRender();
    });
  });

  // Card type multi-select
  block.querySelectorAll('[data-filter="cardType"] .promo-selector-check').forEach((cb) => {
    cb.addEventListener('change', () => {
      const checked = [...block.querySelectorAll('[data-filter="cardType"] .promo-selector-check:checked')];
      state.cardTypes = checked.map((c) => c.value);
      const labelEl = block.querySelector(
        '[data-filter="cardType"] .promo-selector-filter-label',
      );
      labelEl.textContent = state.cardTypes.length
        ? `Card Type (${state.cardTypes.length})`
        : 'Card Type';
      state.page = 1;
      fetchAndRender();
    });
  });

  // Area multi-select
  block.querySelectorAll('[data-filter="area"] .promo-selector-check').forEach((cb) => {
    cb.addEventListener('change', () => {
      const checked = [...block.querySelectorAll('[data-filter="area"] .promo-selector-check:checked')];
      state.area = checked.map((c) => c.value);
      const labelEl = block.querySelector('[data-filter="area"] .promo-selector-filter-label');
      labelEl.textContent = state.area.length ? `Area (${state.area.length})` : 'Area';
      state.page = 1;
      fetchAndRender();
    });
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
