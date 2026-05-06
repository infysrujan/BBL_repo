import { fetchPlaceholders } from '../../scripts/placeholder.js';
import { fetchConfigs } from '../../scripts/config.js';
import {
  buildCardHtml,
  buildPaginationHtml,
} from '../../scripts/utils/card-helpers.js';

function initFilterToggles(container) {
  container.querySelectorAll('[aria-haspopup="listbox"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const filter = btn.closest('[data-filter]');
      if (!filter) return;
      const isOpen = filter.classList.contains('is-open');
      container.querySelectorAll('[data-filter].is-open').forEach((f) => {
        f.classList.remove('is-open');
        f.querySelector('[aria-haspopup="listbox"]')?.setAttribute('aria-expanded', 'false');
      });
      if (!isOpen && !btn.disabled) {
        filter.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });
}

// eslint-disable-next-line max-len
function setupFilterDropdown(container, filterAttr, state, stateKey, defaultLabel, onChange) {
  const filterEl = container.querySelector(`[data-filter="${filterAttr}"]`);
  const btn = filterEl?.querySelector('[aria-haspopup="listbox"]');
  const labelEl = filterEl?.querySelector('[data-filter-label]');
  const dropdown = filterEl?.querySelector('[role="listbox"]');
  if (!filterEl || !btn || !dropdown) return;

  dropdown.addEventListener('click', (e) => {
    const opt = e.target.closest('[role="option"]');
    if (!opt) return;
    e.stopPropagation();
    const wasActive = opt.classList.contains('is-active');
    dropdown.querySelectorAll('[role="option"]').forEach((o) => o.classList.remove('is-active'));
    filterEl.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');
    if (wasActive) {
      // eslint-disable-next-line no-param-reassign
      state[stateKey] = '';
      if (labelEl) labelEl.textContent = defaultLabel;
    } else {
      opt.classList.add('is-active');
      // eslint-disable-next-line no-param-reassign
      state[stateKey] = opt.dataset.value;
      if (labelEl) labelEl.textContent = opt.textContent.trim();
    }
    if (onChange) onChange(state[stateKey]);
  });
}

function closeFiltersOnOutsideClick(container) {
  document.addEventListener('click', () => {
    container.querySelectorAll('[data-filter].is-open').forEach((f) => {
      f.classList.remove('is-open');
      f.querySelector('[aria-haspopup="listbox"]')?.setAttribute('aria-expanded', 'false');
    });
  });
}

const PAGE_SIZE = 12;

/*
 * SearchProperty URL pattern (0-based page):
 * /SearchProperty/{page}/{regionId}/{province}/{assetTypeId}/{priceRange}/{keyword}/{category}
 *
 * - page         : 0-based page index
 * - regionId     : RegionID from GetRegion (0 = all)
 * - province     : province name URL-encoded (0 = all)
 * - assetTypeId  : AssetTypeID from GetAssetType (0 = all)
 * - priceRange   : price range key (all = no filter)
 * - keyword      : search text URL-encoded (0 = none)
 * - category     : tab category in English (all / promotion / highlight / new / investment)
 */

// Maps Thai tab button text → API category segment
const TAB_CATEGORY_MAP = {
  ทรัพย์ทั้งหมด: 'all',
  โปรโมชัน: 'promotion',
  ทรัพย์เด่น: 'highlight',
  ทรัพย์ใหม่: 'new',
  ทรัพย์สินเพื่อการลงทุน: 'investment',
};

const PRICE_RANGES = [
  { label: 'ไม่เกิน 500,000', key: '1' },
  { label: '500,001 - 1,000,000', key: '2' },
  { label: '1,000,001 - 3,000,000', key: '3' },
  { label: '3,000,001 - 5,000,000', key: '4' },
  { label: 'มากกว่า 5,000,000', key: '5' },
];

function getImageMimeType(base64) {
  if (base64.startsWith('R0lGOD')) return 'image/gif';
  if (base64.startsWith('/9j/')) return 'image/jpeg';
  if (base64.startsWith('iVBORw0K')) return 'image/png';
  return 'image/jpeg';
}

function formatPrice(price) {
  if (!price) return '';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

function buildOptions(items) {
  return items
    .map((item) => `<li class="pfs-option" data-value="${item.value}" role="option">${item.label}</li>`)
    .join('');
}

function buildFilterHtml(p) {
  const priceOpts = buildOptions(PRICE_RANGES.map((r, i) => ({ value: i, label: r.label })));
  return `
    <div class="pfs-filter-row">
      <div class="pfs-search-wrap">
        <input type="text" class="pfs-search-input"
          placeholder="${p.pfsSearchPlaceholder || 'ค้นหาด้วยรหัสแฟ้ม, ที่ตั้ง...'}"
          autocomplete="off">
      </div>
      <div class="pfs-filter" data-filter="type">
        <button class="pfs-filter-btn" aria-expanded="false" aria-haspopup="listbox">
          <span class="pfs-filter-label" data-filter-label>${p.pfsTypeLabel || 'ประเภททรัพย์'}</span>
          <span class="icon-dropdown pfs-filter-arrow" aria-hidden="true"></span>
        </button>
        <ul class="pfs-filter-dropdown" role="listbox"></ul>
      </div>
      <div class="pfs-filter" data-filter="region">
        <button class="pfs-filter-btn" aria-expanded="false" aria-haspopup="listbox">
          <span class="pfs-filter-label" data-filter-label>${p.pfsRegionLabel || 'ภาค'}</span>
          <span class="icon-dropdown pfs-filter-arrow" aria-hidden="true"></span>
        </button>
        <ul class="pfs-filter-dropdown" role="listbox"></ul>
      </div>
      <div class="pfs-filter is-disabled" data-filter="province">
        <button class="pfs-filter-btn" disabled aria-expanded="false" aria-haspopup="listbox">
          <span class="pfs-filter-label" data-filter-label>${p.pfsProvinceLabel || 'จังหวัด'}</span>
          <span class="icon-dropdown pfs-filter-arrow" aria-hidden="true"></span>
        </button>
        <ul class="pfs-filter-dropdown" role="listbox"></ul>
      </div>
      <div class="pfs-filter is-hidden" data-filter="district">
        <button class="pfs-filter-btn" aria-expanded="false" aria-haspopup="listbox">
          <span class="pfs-filter-label" data-filter-label>${p.pfsDistrictLabel || 'เขต/อำเภอ'}</span>
          <span class="icon-dropdown pfs-filter-arrow" aria-hidden="true"></span>
        </button>
        <ul class="pfs-filter-dropdown" role="listbox"></ul>
      </div>
      <div class="pfs-filter" data-filter="price">
        <button class="pfs-filter-btn" aria-expanded="false" aria-haspopup="listbox">
          <span class="pfs-filter-label" data-filter-label>${p.pfsPriceLabel || 'ช่วงราคา'}</span>
          <span class="icon-dropdown pfs-filter-arrow" aria-hidden="true"></span>
        </button>
        <ul class="pfs-filter-dropdown" role="listbox">${priceOpts}</ul>
      </div>
    </div>
    <div class="pfs-filter-actions">
      <button class="pfs-btn-reset button secondary" type="button">${p.pfsReset || 'ล้างข้อมูล'}</button>
      <button class="pfs-btn-search button primary" type="button" disabled>${p.pfsSearch || 'ค้นหา'}</button>
    </div>`;
}

function buildPropCardHtml(item, detailPath, p) {
  const photo = item.PHOTO_FILE_1;
  const currency = p.pfsCurrency || 'บาท';
  const price = item.PR_PRICE ? `${formatPrice(item.PR_PRICE)} ${currency}` : '';
  const specialPrice = item.SPECIAL_PRICE ? `${formatPrice(item.SPECIAL_PRICE)} ${currency}` : '';
  const location = [item.LOCATION_AMPHUR, item.LOCATION_PROVINCE].filter(Boolean).join(', ');

  const descParts = [
    item.FILE_ID ? `<p class="pfs-card-id">${p.pfsFileId || 'รหัสแฟ้ม'}: ${item.FILE_ID}</p>` : '',
    location ? `<p class="pfs-card-location">${location}</p>` : '',
    price ? `<p class="pfs-card-price">${price}</p>` : '',
    specialPrice ? `<p class="pfs-card-price pfs-card-special-price">${specialPrice}</p>` : '',
  ].filter(Boolean).join('');

  const mapUrl = item.GPS_LATITUDE && item.GPS_LONGTITUDE
    ? `https://www.google.co.th/maps/place/N ${item.GPS_LATITUDE} E ${item.GPS_LONGTITUDE}`
    : '';

  const card = {
    cardImageUrl: photo ? `data:${getImageMimeType(photo)};base64,${photo}` : '',
    title: item.FILE_ID || '',
    cardShortDescription: descParts,
    ctaLink: `${detailPath}?FILE_ID=${encodeURIComponent(item.FILE_ID || '')}`,
    ctaLabel: p.pfsDetails || 'รายละเอียด',
    targetLink: 'false',
  };

  const footerExtra = mapUrl
    ? `<a href="${mapUrl}" target="_blank" class="listing-card-cta button secondary pfs-map-btn">${p.pfsMapLocation || 'ตำแหน่งที่ตั้ง'}</a>`
    : '';

  return buildCardHtml(card, item.MAIN_ASSET || '', p, { footerExtra });
}

async function fetchJson(url) {
  const resp = await fetch(url, { headers: { Accept: 'application/json' } }).catch(() => null);
  if (!resp?.ok) return null;
  return resp.json().catch(() => null);
}

function buildSearchUrl(apiBase, {
  page, regionId, province, assetTypeId, priceRangeKey, keyword, category,
}) {
  const segments = [
    page,
    regionId || 0,
    province ? encodeURIComponent(province) : 0,
    assetTypeId || 0,
    priceRangeKey || 'all',
    keyword ? encodeURIComponent(keyword) : 0,
    category || 'all',
  ];
  return `${apiBase}/SearchProperty/${segments.join('/')}`;
}

async function searchProperties(apiBase, params) {
  const url = buildSearchUrl(apiBase, params);
  const json = await fetchJson(url);
  if (!json) return { items: [], total: 0 };
  let items;
  if (Array.isArray(json)) {
    items = json;
  } else {
    items = Array.isArray(json.data) ? json.data : [];
  }
  return { items, total: json.total ?? items.length };
}

function setupPanel(panel, tabName, state, apiBase, detailPath, placeholders) {
  const gridEl = document.createElement('div');
  gridEl.className = 'pfs-grid listing-card-grid';
  const paginationEl = document.createElement('div');
  paginationEl.className = 'pfs-pagination listing-card-pagination';
  panel.appendChild(gridEl);
  panel.appendChild(paginationEl);

  // Map Thai tab name → English API category segment
  const category = TAB_CATEGORY_MAP[tabName] || 'all';

  let currentPage = 1;
  let observer;

  async function render() {
    const priceRangeKey = state.priceRangeIdx !== ''
      ? (PRICE_RANGES[parseInt(state.priceRangeIdx, 10)]?.key || 'all')
      : 'all';

    const { items, total } = await searchProperties(apiBase, {
      page: currentPage - 1,
      regionId: state.regionId,
      province: state.province,
      assetTypeId: state.type,
      priceRangeKey,
      keyword: state.keyword,
      category,
    });

    gridEl.innerHTML = items.length
      ? items.map((item) => buildPropCardHtml(item, detailPath, placeholders)).join('')
      : `<p class="listing-card-empty">${placeholders.pfsNotFound || "Sorry, we couldn't find any information matching your request."}</p>`;

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    paginationEl.innerHTML = buildPaginationHtml(currentPage, totalPages);
  }

  observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      observer.disconnect();
      render();
    }
  }, { rootMargin: '100px' });
  observer.observe(panel);

  paginationEl.addEventListener('click', (e) => {
    const pageBtn = e.target.closest('.listing-card-page');
    const arrowBtn = e.target.closest('.listing-card-arrow');
    let changed = false;
    if (pageBtn) {
      currentPage = parseInt(pageBtn.dataset.page, 10);
      changed = true;
    } else if (arrowBtn?.dataset.dir === 'prev' && currentPage > 1) {
      currentPage -= 1;
      changed = true;
    } else if (arrowBtn?.dataset.dir === 'next') {
      currentPage += 1;
      changed = true;
    }
    if (changed) {
      render();
      gridEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  function reset() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    currentPage = 1;
    render();
  }

  return reset;
}

export default async function decorate(block) {
  const [placeholders, configs] = await Promise.all([
    fetchPlaceholders(),
    fetchConfigs(),
  ]);

  const apiBase = configs?.propertyForSaleApi
    || 'https://publish-p185039-e1938068.adobeaemcloud.com/api/PropertyForSaleService';
  const detailPath = configs?.propertyForSaleDetailPage || '';

  const section = block.closest('.section');
  const tabsBlock = section?.querySelector('[data-block-name="tabs"]')
    || document.querySelector('[data-block-name="tabs"]');

  if (!tabsBlock) {
    block.hidden = true;
    return;
  }

  const filterWrapper = document.createElement('div');
  filterWrapper.className = 'pfs-filters';
  filterWrapper.innerHTML = buildFilterHtml(placeholders);
  tabsBlock.before(filterWrapper);

  const tabPanels = [...tabsBlock.querySelectorAll('[role="tabpanel"]')];

  const state = {
    keyword: '',
    type: '',
    regionId: '',
    province: '', // stores province NAME (used directly in URL)
    priceRangeIdx: '', // index into PRICE_RANGES; '' = no filter
  };

  // Each panel reads its tab button text to resolve the API category
  const panelResets = tabPanels.map((panel) => {
    const tabBtnId = panel.getAttribute('aria-labelledby');
    const tabBtn = tabBtnId ? document.getElementById(tabBtnId) : null;
    const tabName = tabBtn?.textContent?.trim() || '';
    return setupPanel(panel, tabName, state, apiBase, detailPath, placeholders);
  });

  const searchInput = filterWrapper.querySelector('.pfs-search-input');
  const searchBtn = filterWrapper.querySelector('.pfs-btn-search');
  const resetBtn = filterWrapper.querySelector('.pfs-btn-reset');

  const typeDefault = placeholders.pfsTypeLabel || 'ประเภททรัพย์';
  const regionDefault = placeholders.pfsRegionLabel || 'ภาค';
  const provinceDefault = placeholders.pfsProvinceLabel || 'จังหวัด';
  const priceDefault = placeholders.pfsPriceLabel || 'ช่วงราคา';

  const provinceFilter = filterWrapper.querySelector('[data-filter="province"]');
  const provinceBtn = provinceFilter.querySelector('[aria-haspopup="listbox"]');
  const provinceDropdown = provinceFilter.querySelector('[role="listbox"]');
  const provinceLabelEl = provinceFilter.querySelector('[data-filter-label]');
  const districtFilter = filterWrapper.querySelector('[data-filter="district"]');

  function hasAnyFilter() {
    return (
      searchInput.value.trim()
      || state.type
      || state.regionId
      || state.province
      || state.priceRangeIdx !== ''
    );
  }

  function updateSearchBtn() {
    searchBtn.disabled = !hasAnyFilter();
  }

  searchInput.addEventListener('input', updateSearchBtn);

  initFilterToggles(filterWrapper);

  setupFilterDropdown(filterWrapper, 'type', state, 'type', typeDefault, () => updateSearchBtn());

  setupFilterDropdown(filterWrapper, 'region', state, 'regionId', regionDefault, async (regionId) => {
    state.province = '';
    provinceLabelEl.textContent = provinceDefault;
    provinceDropdown.querySelectorAll('[role="option"]').forEach((o) => o.classList.remove('is-active'));
    districtFilter.classList.add('is-hidden');

    if (regionId) {
      const provinces = await fetchJson(`${apiBase}/GetProvince/${regionId}`);
      if (Array.isArray(provinces) && provinces.length) {
        // Use province NAME as value so it can be used directly in the search URL
        provinceDropdown.innerHTML = buildOptions(
          provinces.map((pv) => {
            const name = pv.ProvinceName ?? pv.Name ?? pv.ProvinceTH ?? '';
            return { value: name, label: name };
          }),
        );
        provinceFilter.classList.remove('is-disabled');
        provinceBtn.disabled = false;
      } else {
        provinceFilter.classList.add('is-disabled');
        provinceBtn.disabled = true;
        provinceDropdown.innerHTML = '';
      }
    } else {
      provinceFilter.classList.add('is-disabled');
      provinceBtn.disabled = true;
      provinceDropdown.innerHTML = '';
    }
    updateSearchBtn();
  });

  setupFilterDropdown(filterWrapper, 'province', state, 'province', provinceDefault, (province) => {
    if (province) {
      districtFilter.classList.remove('is-hidden');
    } else {
      districtFilter.classList.add('is-hidden');
    }
    updateSearchBtn();
  });

  // Price stores the index into PRICE_RANGES; the URL key is resolved at render time
  setupFilterDropdown(filterWrapper, 'price', state, 'priceRangeIdx', priceDefault, (idx) => {
    // When deselected, idx = '' which means no price filter (key = 'all')
    if (idx === '') state.priceRangeIdx = '';
    updateSearchBtn();
  });

  searchBtn.addEventListener('click', () => {
    state.keyword = searchInput.value.trim();
    panelResets.forEach((reset) => reset());
  });

  resetBtn.addEventListener('click', () => {
    searchInput.value = '';
    state.keyword = '';
    state.type = '';
    state.regionId = '';
    state.province = '';
    state.priceRangeIdx = '';

    filterWrapper.querySelectorAll('[role="option"]').forEach((o) => o.classList.remove('is-active'));
    filterWrapper.querySelector('[data-filter="type"] [data-filter-label]').textContent = typeDefault;
    filterWrapper.querySelector('[data-filter="region"] [data-filter-label]').textContent = regionDefault;
    provinceLabelEl.textContent = provinceDefault;
    provinceFilter.classList.add('is-disabled');
    provinceBtn.disabled = true;
    provinceDropdown.innerHTML = '';
    districtFilter.classList.add('is-hidden');
    filterWrapper.querySelector('[data-filter="price"] [data-filter-label]').textContent = priceDefault;
    searchBtn.disabled = true;

    panelResets.forEach((reset) => reset());
  });

  closeFiltersOnOutsideClick(filterWrapper);

  const [regions, assetTypes] = await Promise.all([
    fetchJson(`${apiBase}/GetRegion`),
    fetchJson(`${apiBase}/GetAssetType`),
  ]);

  if (Array.isArray(regions) && regions.length) {
    filterWrapper.querySelector('[data-filter="region"] [role="listbox"]').innerHTML = buildOptions(
      regions.map((r) => ({ value: r.RegionID, label: r.RegionName })),
    );
  }

  if (Array.isArray(assetTypes) && assetTypes.length) {
    filterWrapper.querySelector('[data-filter="type"] [role="listbox"]').innerHTML = buildOptions(
      assetTypes.map((t) => ({
        value: t.AssetTypeID ?? t.AssetTypeCode ?? t.ID,
        label: t.AssetTypeName ?? t.Name ?? t.AssetTypeTH ?? '',
      })),
    );
  }

  block.hidden = true;
}
