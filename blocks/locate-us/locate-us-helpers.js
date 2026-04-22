// ─── Utilities ────────────────────────────────────────────────────────────────

export function buildUrl(template, params) {
  return Object.entries(params).reduce(
    (url, [key, val]) => url.replace(`{{${key}}}`, encodeURIComponent(String(val))),
    template,
  );
}

export function createEl(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild;
}

export function showToast(message) {
  let container = document.getElementById('locate-us-toast-container');
  if (!container) {
    container = createEl('<div id="locate-us-toast-container" class="locate-us-toast-container"></div>');
    document.body.appendChild(container);
  }

  const toast = createEl(`
    <div class="locate-us-toast" aria-live="assertive">
      <span class="locate-us-toast-message"></span>
      <button type="button" class="locate-us-toast-close" aria-label="Close">×</button>
    </div>`);

  toast.querySelector('.locate-us-toast-message').textContent = message;
  toast.querySelector('.locate-us-toast-close').addEventListener('click', () => toast.remove());
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

export function getUserLocation(defaultLat, defaultLng) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ lat: defaultLat, lng: defaultLng });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve({ lat: defaultLat, lng: defaultLng }),
      { timeout: 5000 },
    );
  });
}

// ─── Google Maps iframe ───────────────────────────────────────────────────────

function buildEmbedUrl(lat, lng, configs, zoom = 15) {
  const template = configs?.googleMapsEmbedUrl;
  if (!template) {
    // eslint-disable-next-line no-console
    console.error('[locate-us] Missing config key: google-maps-embed-url');
    return '';
  }
  return buildUrl(template, { LAT: lat, LNG: lng, ZOOM: zoom });
}

export function updateMapIframe(iframe, loc, configs) {
  const lat = parseFloat(loc.Lat);
  const lng = parseFloat(loc.Lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return;
  const src = buildEmbedUrl(lat, lng, configs);
  if (src) iframe.src = src;
}

export function populateSidebar(sidebar, loc, placeholders, configs) {
  const address = [loc.Address1, loc.Address2, loc.Address3, loc.Province, loc.Postcode]
    .filter(Boolean).join(' ');
  const dirTemplate = configs?.googleMapsDirectionsUrl;
  if (!dirTemplate) {
    // eslint-disable-next-line no-console
    console.error('[locate-us] Missing config key: google-maps-directions-url');
  }
  const directionsUrl = dirTemplate ? buildUrl(dirTemplate, { LAT: loc.Lat, LNG: loc.Lng }) : '';
  const getDirectionText = placeholders?.getDirectionText || 'Get Direction';
  const branchBookingText = placeholders?.branchBookingText || 'Branch Booking';
  const nearestLabel = placeholders?.nearestLocationTag || 'Nearest';
  const isNearest = loc.Range === 0;
  const hasStatus = loc.BranchStatus || loc.MicroBranchHours;

  const card = createEl(`
    <article class="locate-us-card">
      <button type="button" class="locate-us-card-header" aria-expanded="true">
        <span class="locate-us-card-name"></span>
        <span class="icon-dropdown locate-us-card-chevron" aria-hidden="true"></span>
      </button>
      <div class="locate-us-card-body">
        <hr class="locate-us-card-hr">
        <div class="locate-us-card-detail">
          ${isNearest ? '<div class="locate-us-card-nearest-tag"></div>' : ''}
          ${hasStatus ? `
            <div class="locate-us-card-row">
              <span class="locate-us-card-label">Status:</span>
              <div class="locate-us-card-status-col">
                ${loc.BranchStatus ? '<span class="locate-us-card-status"></span>' : ''}
                ${loc.MicroBranchHours ? '<span class="locate-us-card-hours"></span>' : ''}
              </div>
            </div>` : ''}
          ${loc.Tel ? '<div class="locate-us-card-row"><span class="locate-us-card-label">Tel:</span><span class="locate-us-card-tel"></span></div>' : ''}
          ${loc.Fax ? '<div class="locate-us-card-row"><span class="locate-us-card-label">Fax:</span><span class="locate-us-card-fax"></span></div>' : ''}
          ${address ? '<p class="locate-us-card-address"></p>' : ''}
          ${directionsUrl ? '<a class="locate-us-card-directions" target="_blank" rel="noopener noreferrer"></a>' : ''}
          ${loc.BranchAppointment ? '<a class="locate-us-card-appointment" target="_blank" rel="noopener noreferrer"></a>' : ''}
        </div>
      </div>
    </article>`);

  card.querySelector('.locate-us-card-name').textContent = loc.BranchName;
  if (isNearest) card.querySelector('.locate-us-card-nearest-tag').textContent = nearestLabel;
  if (loc.BranchStatus) {
    const statusEl = card.querySelector('.locate-us-card-status');
    statusEl.textContent = loc.BranchStatus;
    statusEl.classList.add(`locate-us-card-status-${loc.BranchStatus.toLowerCase()}`);
  }
  if (loc.MicroBranchHours) card.querySelector('.locate-us-card-hours').textContent = loc.MicroBranchHours;
  if (loc.Tel) card.querySelector('.locate-us-card-tel').textContent = loc.Tel;
  if (loc.Fax) card.querySelector('.locate-us-card-fax').textContent = loc.Fax;
  if (address) card.querySelector('.locate-us-card-address').textContent = address;
  if (directionsUrl) {
    const dirEl = card.querySelector('.locate-us-card-directions');
    dirEl.href = directionsUrl;
    dirEl.textContent = getDirectionText;
  }
  if (loc.BranchAppointment) {
    const appointmentEl = card.querySelector('.locate-us-card-appointment');
    appointmentEl.href = loc.BranchAppointment;
    appointmentEl.textContent = branchBookingText;
  }

  sidebar.innerHTML = '';
  sidebar.appendChild(card);
}

// ─── API calls ────────────────────────────────────────────────────────────────

let provincesCache = null;

export async function fetchNearMe(lat, lng, code, configs) {
  const template = configs?.getNearMe;
  if (!template) {
    // eslint-disable-next-line no-console
    console.error('[locate-us] Missing config key: get-near-me');
    return [];
  }
  const url = buildUrl(template, { LAT: lat, LONG: lng, CODE: code });
  const resp = await fetch(url);
  if (!resp.ok) return [];
  return resp.json();
}

export async function fetchProvinces(configs) {
  if (provincesCache) return provincesCache;
  const url = configs?.getProvidence;
  if (!url) {
    // eslint-disable-next-line no-console
    console.error('[locate-us] Missing config key: get-providence');
    return [];
  }
  const resp = await fetch(url);
  if (!resp.ok) return [];
  const data = await resp.json();
  provincesCache = data.map((p) => p.Province);
  return provincesCache;
}

export async function fetchDistricts(province, configs) {
  const template = configs?.getDistrict;
  if (!template) {
    // eslint-disable-next-line no-console
    console.error('[locate-us] Missing config key: get-district');
    return [];
  }
  const url = buildUrl(template, { PROVINCE: province });
  const resp = await fetch(url);
  if (!resp.ok) return [];
  const data = await resp.json();
  return data.map((d) => d.District);
}

export async function fetchByProvince(province, district, lat, lng, code, configs) {
  const template = configs?.searchThailandWithLocation;
  if (!template) {
    // eslint-disable-next-line no-console
    console.error('[locate-us] Missing config key: search-thailand-with-location');
    return [];
  }
  const url = buildUrl(template, {
    PROVINCE: province,
    DISTRICT: district || '0',
    LAT: lat,
    LONG: lng,
    CODE: code,
  });
  const resp = await fetch(url);
  if (!resp.ok) return [];
  const data = await resp.json();
  return Array.isArray(data) ? data : [data];
}

export async function fetchByKeyword(lat, lng, keyword, district, code, configs) {
  const template = configs?.searchKeywordWithLocation;
  if (!template) {
    // eslint-disable-next-line no-console
    console.error('[locate-us] Missing config key: search-keyword-with-location');
    return [];
  }
  const url = buildUrl(template, {
    LAT: lat,
    LONG: lng,
    KEYWORD: keyword,
    DISTRICT: district || '0',
    CODE: code,
  });
  const resp = await fetch(url);
  if (!resp.ok) return [];
  return resp.json();
}

// ─── Cards & pagination ───────────────────────────────────────────────────────

export const CARDS_PER_PAGE = 12;

export function buildAddressCard(loc, isNearest, placeholders, configs) {
  const address = [loc.Address1, loc.Address2, loc.Address3, loc.Province, loc.Postcode]
    .filter(Boolean).join(' ');
  const nearestLabel = placeholders?.nearestLocationTag || 'Nearest';
  const getDirectionText = placeholders?.getDirectionText || 'Get Direction';

  const dirTemplate = configs?.googleMapsDirectionsUrl;
  const directionsUrl = (dirTemplate && loc.Lat && loc.Lng)
    ? buildUrl(dirTemplate, { LAT: loc.Lat, LNG: loc.Lng })
    : '';

  const hasStatus = loc.BranchStatus || loc.MicroBranchHours;

  const card = createEl(`
    <article class="locate-us-card">
      <button type="button" class="locate-us-card-header" aria-expanded="false">
        <span class="locate-us-card-name"></span>
        <span class="icon-dropdown locate-us-card-chevron" aria-hidden="true"></span>
      </button>
      <div class="locate-us-card-body" hidden>
        <hr class="locate-us-card-hr">
        <div class="locate-us-card-detail">
          ${isNearest ? '<div class="locate-us-card-nearest-tag"></div>' : ''}
          ${hasStatus ? `
            <div class="locate-us-card-row">
              <span class="locate-us-card-label">Status:</span>
              <div class="locate-us-card-status-col">
                ${loc.BranchStatus ? '<span class="locate-us-card-status"></span>' : ''}
                ${loc.MicroBranchHours ? '<span class="locate-us-card-hours"></span>' : ''}
              </div>
            </div>` : ''}
          ${loc.Tel ? '<div class="locate-us-card-row"><span class="locate-us-card-label">Tel:</span><span class="locate-us-card-tel"></span></div>' : ''}
          ${loc.Fax ? '<div class="locate-us-card-row"><span class="locate-us-card-label">Fax:</span><span class="locate-us-card-fax"></span></div>' : ''}
          ${address ? '<p class="locate-us-card-address"></p>' : ''}
          ${directionsUrl ? '<a class="locate-us-card-directions" target="_blank" rel="noopener noreferrer"></a>' : ''}
        </div>
      </div>
    </article>`);

  card.querySelector('.locate-us-card-name').textContent = loc.BranchName;
  if (isNearest) card.querySelector('.locate-us-card-nearest-tag').textContent = nearestLabel;
  if (loc.BranchStatus) {
    const statusEl = card.querySelector('.locate-us-card-status');
    statusEl.textContent = loc.BranchStatus;
    statusEl.classList.add(`locate-us-card-status-${loc.BranchStatus.toLowerCase()}`);
  }
  if (loc.MicroBranchHours) card.querySelector('.locate-us-card-hours').textContent = loc.MicroBranchHours;
  if (loc.Tel) card.querySelector('.locate-us-card-tel').textContent = loc.Tel;
  if (loc.Fax) card.querySelector('.locate-us-card-fax').textContent = loc.Fax;
  if (address) card.querySelector('.locate-us-card-address').textContent = address;
  if (directionsUrl) {
    const dirEl = card.querySelector('.locate-us-card-directions');
    dirEl.href = directionsUrl;
    dirEl.textContent = getDirectionText;
  }

  return card;
}

export function renderPagination(paginationEl, total, page, onPageChange) {
  const totalPages = Math.ceil(total / CARDS_PER_PAGE);
  if (totalPages <= 1) {
    paginationEl.innerHTML = '';
    return;
  }

  // Build 4-page window around current, matching BBL pagination behaviour
  const winStart = Math.max(1, Math.min(page - 2, totalPages - 3));
  const winEnd = Math.min(totalPages, winStart + 3);

  const show = new Set();
  [1, 2, totalPages - 1, totalPages].forEach((p) => {
    if (p >= 1 && p <= totalPages) show.add(p);
  });
  for (let p = winStart; p <= winEnd; p += 1) show.add(p);

  const sorted = [...show].sort((a, b) => a - b);

  // ── Build pagination container ──────────────────────────────
  paginationEl.innerHTML = '';

  // Prev button
  const prevBtn = createEl(`
    <button class="locate-us-page-nav locate-us-page-prev" aria-label="Previous page"
      ${page <= 1 ? 'disabled' : ''}>
      <span class="icon-arrow-left locate-us-page-nav-icon" aria-hidden="true"></span>
    </button>`);
  prevBtn.addEventListener('click', () => onPageChange(page - 1));
  paginationEl.appendChild(prevBtn);

  // Numbers wrapper
  const numbersEl = createEl('<div class="locate-us-page-numbers"></div>');

  // Page buttons + clickable ellipsis
  function addEllipsis() {
    const ellipsis = createEl('<span class="locate-us-page-ellipsis" role="button" tabindex="0">…</span>');
    ellipsis.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'number';
      input.min = 1;
      input.max = totalPages;
      input.className = 'locate-us-page-input';
      ellipsis.replaceWith(input);
      input.focus();

      function commitInput() {
        const val = parseInt(input.value, 10);
        if (val >= 1 && val <= totalPages) {
          onPageChange(val);
        } else {
          input.replaceWith(ellipsis);
        }
      }
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') commitInput(); });
      input.addEventListener('blur', commitInput);
    });
    numbersEl.appendChild(ellipsis);
  }

  sorted.forEach((p, idx) => {
    if (idx > 0 && p - sorted[idx - 1] > 1) addEllipsis();

    const btn = createEl(
      `<button class="locate-us-page-btn${p === page ? ' locate-us-page-btn-active' : ''}"
        aria-label="Page ${p}">${p}</button>`,
    );
    btn.addEventListener('click', () => onPageChange(p));
    numbersEl.appendChild(btn);
  });

  paginationEl.appendChild(numbersEl);

  // Next button
  const nextBtn = createEl(`
    <button class="locate-us-page-nav locate-us-page-next" aria-label="Next page"
      ${page >= totalPages ? 'disabled' : ''}>
      <span class="icon-arrow-left locate-us-page-nav-icon" aria-hidden="true"></span>
    </button>`);
  nextBtn.addEventListener('click', () => onPageChange(page + 1));
  paginationEl.appendChild(nextBtn);
}

export function renderCards(
  allResults,
  cardsContainer,
  paginationEl,
  page,
  placeholders,
  onSelect,
  configs,
) {
  cardsContainer.innerHTML = '';
  const start = (page - 1) * CARDS_PER_PAGE;
  const pageResults = allResults.slice(start, start + CARDS_PER_PAGE);

  function scrollToMap() {
    const keywordWrapper = cardsContainer.closest('.locate-us-wrapper')?.querySelector('.locate-us-keyword-wrapper');
    if (keywordWrapper) keywordWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function collapseAll() {
    cardsContainer.querySelectorAll('.locate-us-card-body').forEach((b) => { b.hidden = true; });
    cardsContainer.querySelectorAll('.locate-us-card-header').forEach((h) => h.setAttribute('aria-expanded', 'false'));
  }

  function restoreOrder(activeCard) {
    // Sort all cards except activeCard back to original index, then prepend activeCard
    const others = [...cardsContainer.querySelectorAll('.locate-us-card')]
      .filter((c) => c !== activeCard)
      .sort((a, b) => Number(a.dataset.cardIndex) - Number(b.dataset.cardIndex));
    cardsContainer.innerHTML = '';
    cardsContainer.appendChild(activeCard);
    others.forEach((c) => cardsContainer.appendChild(c));
  }

  pageResults.forEach((loc, idx) => {
    const isNearest = loc.Range === 0;
    const card = buildAddressCard(loc, isNearest, placeholders, configs);
    card.dataset.cardIndex = idx;
    const header = card.querySelector('.locate-us-card-header');
    const body = card.querySelector('.locate-us-card-body');

    header.addEventListener('click', () => {
      if (window.matchMedia('(width > 47.5rem)').matches) {
        onSelect(loc);
        scrollToMap();
        return;
      }
      const isExpanded = header.getAttribute('aria-expanded') === 'true';
      collapseAll();
      if (!isExpanded) {
        body.hidden = false;
        header.setAttribute('aria-expanded', 'true');
        restoreOrder(card);
        onSelect(loc);
        scrollToMap();
      }
    });

    if (idx === 0) {
      body.hidden = false;
      header.setAttribute('aria-expanded', 'true');
      onSelect(loc);
    }

    cardsContainer.appendChild(card);
  });

  renderPagination(paginationEl, allResults.length, page, (newPage) => {
    renderCards(allResults, cardsContainer, paginationEl, newPage, placeholders, onSelect, configs);
    scrollToMap();
  });
}
