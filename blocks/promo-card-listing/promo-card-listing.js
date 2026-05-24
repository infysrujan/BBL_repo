import { fetchPlaceholders } from '../../scripts/placeholder.js';
import { getLang } from '../../scripts/scripts.js';
import { fetchConfigs } from '../../scripts/config.js';
import {
  buildCardHtml, buildPaginationHtml, sortCards, bindPaginationClick,
} from '../../scripts/utils/card-helpers.js';

const fetchCache = {};

const LOCALE_MAP = { th: 'th-TH', en: 'en-GB' };

const LOGO_ICONS = {
  visa: '/icons/visa-new.svg',
  mastercard: '/icons/mastercard-new.svg',
  amex: '/icons/amex-new.svg',
  unionpay: '/icons/upi-new.svg',
};

const CARD_TYPE_NORMALIZE = {
  วีซ่า: 'visa',
  มาสเตอร์การ์ด: 'mastercard',
  แอมเอ็กซ์: 'amex',
  ยูเนี่ยนเพย์: 'unionpay',
};

export async function fetchJson(url) {
  if (!fetchCache[url]) {
    fetchCache[url] = fetch(url, { headers: { Accept: 'application/json' } })
      .then((r) => (r.ok && r.status !== 204 ? r.json() : null))
      .catch(() => null);
  }
  return fetchCache[url];
}

function formatDate(dateStr, locale = 'en-GB') {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function buildDateLine(card, locale) {
  const start = formatDate(card.promotionStartDate, locale);
  const end = formatDate(card.promotionEndDate, locale);
  const label = card.dateValidityLabel || 'until';
  if (start && end) return `${start} ${label} ${end}`;
  if (end) return `${label} ${end}`;
  return '';
}

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

export function buildCardOptions(card) {
  const locale = LOCALE_MAP[getLang()] || 'en-GB';
  return {
    dateLine: buildDateLine(card, locale),
    logoHtml: buildLogosHtml(
      (card.cardTypes || []).map((t) => CARD_TYPE_NORMALIZE[t] || t.toLowerCase()),
    ),
  };
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
    const cardTypesLower = (card.cardTypes || []).map((t) => t.toLowerCase());
    if (cardType && !cardTypesLower.includes(cardType.toLowerCase())) return false;
    if (area) {
      const cardAreas = Array.isArray(card.area) ? card.area : [card.area];
      if (!cardAreas.includes('All') && !cardAreas.includes(area)) return false;
    }
    return true;
  });

  const sorted = sortCards(matched);
  const total = sorted.length;
  const start = (page - 1) * pageSize;
  return { cards: sorted.slice(start, start + pageSize), total };
}

function setupPanel(
  panel,
  allCards,
  category,
  subcategories,
  cardTypes,
  areas,
  pageSize,
  placeholders,
) {
  const labelCategory = placeholders.promoFilterCategory || 'Category';
  const labelCardType = placeholders.promoFilterCardType || 'Card Type';
  const labelArea = placeholders.promoFilterArea || 'Area';
  const labelReset = placeholders.promoReset || 'Reset';
  const labelSearch = placeholders.promoSearch || 'Search';
  const subDisabled = !subcategories.length;

  panel.innerHTML = `
    <div class="promo-selector-filters">
      <div class="promo-selector-filter${subDisabled ? ' is-disabled' : ''}" data-filter="subcategory">
        <button class="promo-selector-filter-btn"${subDisabled ? ' disabled' : ''} aria-expanded="false" aria-haspopup="listbox">
          <span class="promo-selector-filter-label">${labelCategory}</span>
          <span class="icon-dropdown promo-selector-filter-arrow"></span>
        </button>
        <ul class="promo-selector-dropdown" role="listbox">
          ${buildSubOptions(subcategories)}
        </ul>
      </div>
      <div class="promo-selector-filter" data-filter="cardType">
        <button class="promo-selector-filter-btn" aria-expanded="false" aria-haspopup="listbox">
          <span class="promo-selector-filter-label">${labelCardType}</span>
          <span class="icon-dropdown promo-selector-filter-arrow"></span>
        </button>
        <ul class="promo-selector-dropdown" role="listbox">
          ${buildSubOptions(cardTypes)}
        </ul>
      </div>
      <div class="promo-selector-filter" data-filter="area">
        <button class="promo-selector-filter-btn" aria-expanded="false" aria-haspopup="listbox">
          <span class="promo-selector-filter-label">${labelArea}</span>
          <span class="icon-dropdown promo-selector-filter-arrow"></span>
        </button>
        <ul class="promo-selector-dropdown" role="listbox">
          ${buildSubOptions(areas)}
        </ul>
      </div>
      <div class="promo-selector-filter-actions">
        <div class="promo-selector-filter-action btn-reset"><button class="promo-selector-btn-reset button secondary" type="button">${labelReset}</button></div>
        <div class="promo-selector-filter-action btn-search"><button class="promo-selector-btn-search button primary" type="button">${labelSearch}</button></div>
      </div>
    </div>
    <div class="promo-selector-content pad-top-30 pad-bot-30">
      <div class="promo-selector-grid"></div>
      <div class="promo-selector-pagination"></div>
    </div>`;

  const gridEl = panel.querySelector('.promo-selector-grid');
  const paginationEl = panel.querySelector('.promo-selector-pagination');

  const state = {
    subcategory: '', cardType: '', area: '', page: 1,
  };

  function render() {
    const { cards, total } = filterCards(allCards, {
      category,
      subcategory: state.subcategory,
      cardType: state.cardType,
      area: state.area,
    }, state.page, pageSize);

    gridEl.innerHTML = cards.length
      ? cards.map((c) => buildCardHtml(c, category, placeholders, buildCardOptions(c))).join('')
      : `<p class="promo-selector-empty">${placeholders.promoNoResults || 'No results found.'}</p>`;

    paginationEl.innerHTML = buildPaginationHtml(state.page, Math.ceil(total / pageSize));
  }

  // Lazy render — only when panel becomes visible (inactive tabs are hidden = not intersecting)
  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      observer.disconnect();
      render();
    }
  }, { rootMargin: '100px' });
  observer.observe(panel);

  // Dropdown open/close
  panel.querySelectorAll('.promo-selector-filter-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const filter = btn.closest('.promo-selector-filter');
      const isOpen = filter.classList.contains('is-open');
      panel.querySelectorAll('.promo-selector-filter').forEach((f) => {
        f.classList.remove('is-open');
        f.querySelector('.promo-selector-filter-btn')?.setAttribute('aria-expanded', 'false');
      });
      if (!isOpen && !btn.disabled) {
        filter.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  const isDesktop = () => window.matchMedia('(width > 64rem)').matches;

  function makeSingleSelect(filterAttr, stateKey, defaultLabel) {
    panel.querySelectorAll(`[data-filter="${filterAttr}"] .promo-selector-option`).forEach((opt) => {
      opt.addEventListener('click', () => {
        const isActive = opt.classList.contains('is-active');
        panel.querySelectorAll(`[data-filter="${filterAttr}"] .promo-selector-option`)
          .forEach((o) => o.classList.remove('is-active'));
        const labelEl = panel.querySelector(
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
        panel.querySelector(`[data-filter="${filterAttr}"]`).classList.remove('is-open');
        state.page = 1;
        if (isDesktop()) render();
      });
    });
  }

  makeSingleSelect('subcategory', 'subcategory', labelCategory);
  makeSingleSelect('cardType', 'cardType', labelCardType);
  makeSingleSelect('area', 'area', labelArea);

  function resetFilters() {
    state.subcategory = '';
    state.cardType = '';
    state.area = '';
    state.page = 1;
    panel.querySelectorAll('.promo-selector-option').forEach((o) => o.classList.remove('is-active'));
    panel.querySelector('[data-filter="subcategory"] .promo-selector-filter-label').textContent = labelCategory;
    panel.querySelector('[data-filter="cardType"] .promo-selector-filter-label').textContent = labelCardType;
    panel.querySelector('[data-filter="area"] .promo-selector-filter-label').textContent = labelArea;
    render();
  }

  panel.querySelector('.promo-selector-btn-reset')?.addEventListener('click', resetFilters);
  panel.querySelector('.promo-selector-btn-search')?.addEventListener('click', () => {
    state.page = 1;
    render();
  });

  bindPaginationClick(paginationEl, state, render, gridEl);
}

export default async function decorate(block) {
  const lang = getLang();
  const configs = await fetchConfigs();
  const baseUrl = configs?.promoCardListingCardSelector || '';
  const promotionsUrl = baseUrl.replace(/\.json$/, lang !== 'en' ? `.${lang}.json` : '.json');
  const pageSize = parseInt(configs?.promoCardListingItemsPerPage, 10) || '';

  // Fetch all data once, shared across all tab panels
  const [tagsData, placeholders] = await Promise.all([
    fetchJson(promotionsUrl),
    fetchPlaceholders(),
  ]);
  const allCards = tagsData?.cards || [];
  const categories = tagsData?.categories || [];
  const cardTypes = tagsData?.cardTypes || [
    { label: 'Visa' },
    { label: 'Mastercard' },
    { label: 'UnionPay' },
    { label: 'Amex' },
  ];
  const areas = tagsData?.areas || [];

  // Find tab panels created by tabs.js from the empty tab sections
  const tabPanels = [...document.querySelectorAll('[role="tabpanel"]')];

  tabPanels.forEach((panel) => {
    const tabBtnId = panel.getAttribute('aria-labelledby');
    const tabBtn = tabBtnId ? document.getElementById(tabBtnId) : null;
    const tabText = tabBtn?.textContent?.trim() || '';

    const catMeta = categories.find((c) => c.label.toLowerCase() === tabText.toLowerCase()) || {};
    const category = catMeta.label || tabText;
    const subcategories = catMeta.subcategories || [];

    setupPanel(panel, allCards, category, subcategories, cardTypes, areas, pageSize, placeholders);
  });

  // Close all dropdowns on outside click (single listener for all panels)
  document.addEventListener('click', () => {
    document.querySelectorAll('.promo-selector-filter.is-open').forEach((f) => {
      f.classList.remove('is-open');
      f.querySelector('.promo-selector-filter-btn')?.setAttribute('aria-expanded', 'false');
    });
  });

  // Block is just a data-source config — hide it from view
  block.hidden = true;
}
