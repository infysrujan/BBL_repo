import { fetchPlaceholders } from '../../scripts/placeholder.js';
import { fetchConfigs } from '../../scripts/config.js';
import { getLang } from '../../scripts/scripts.js';

// ── Utilities ──────────────────────────────────────────────────────────────────

// Normalize a string: strip zero-width spaces, collapse whitespace, lowercase
function norm(str) {
  return (str || '').toString().replace(/\u200B/g, '').replace(/\s+/g, ' ').toLowerCase()
    .trim();
}

// Extract plain text from a field that may be a string or a structured object
function plaintext(field) {
  if (!field) return '';
  if (typeof field === 'string') return field;
  return field.plaintext || field.html || '';
}

// Resolve a card's image URL whether stored as a plain string or a publish/author URL object
function resolveImageUrl(card) {
  const raw = card.image || '';
  if (!raw) return '';
  if (typeof raw === 'string') return raw;
  // eslint-disable-next-line no-underscore-dangle
  return raw._publishUrl || raw._authorUrl || '';
}

// ── Data fetching ──────────────────────────────────────────────────────────────

// Fetch all credit card items from the card-suggester-data config endpoint
async function loadAllCards() {
  try {
    const configs = await fetchConfigs();
    const cardSuggesterData = configs.creditCardSuggesterData;
    if (!cardSuggesterData) {
      return [];
    }
    const resp = await fetch(cardSuggesterData);
    if (!resp.ok) return [];
    const json = await resp.json();
    const cards = json.data?.creditCardsList?.items || json.data || json.items || [];
    return cards;
  } catch {
    return [];
  }
}

// Strip zero-width spaces and trim all keys and string values in a sheet row
function normalizeRow(row) {
  const out = {};
  Object.entries(row).forEach(([k, v]) => {
    const key = k.replace(/\u200B/g, '').trim();
    out[key] = typeof v === 'string' ? v.replace(/\u200B/g, '').trim() : v;
  });
  return out;
}

// Build a map of normalized card name → sourcing priority number from the suggestor sheet
async function loadSourcingOrder() {
  try {
    const resp = await fetch('/credit-card-suggestor.json');
    if (!resp.ok) return null;
    const json = await resp.json();
    const lang = getLang();
    const productNameKey = lang === 'th' ? 'Product Name (TH)' : 'Product Name (EN)';
    const map = {};
    (json.data || []).map(normalizeRow).forEach((row) => {
      const key = norm(row[productNameKey] || '');
      if (key) map[key] = parseInt(row.Sourcing || 9999, 10);
    });
    return map;
  } catch {
    return null;
  }
}

// Filter allCards to those matching selectedNames, sorted by sourcing priority (or selection order)
function filterAndSortCards(allCards, selectedNames, sourcingMap) {
  const normalizedNames = selectedNames.map(norm);

  const matched = allCards.filter((card) => {
    const cardName = norm(card.name || '');
    return normalizedNames.some((n) => cardName.includes(n) || n.includes(cardName));
  });

  // No sourcing map available — preserve the user's selection order
  if (!sourcingMap || Object.keys(sourcingMap).length === 0) {
    return normalizedNames
      .map((n) => matched.find((c) => {
        const cardName = norm(c.name || '');
        return cardName.includes(n) || n.includes(cardName);
      }))
      .filter(Boolean);
  }

  return matched.sort((a, b) => {
    const sA = sourcingMap[norm(a.name || '')] ?? 9999;
    const sB = sourcingMap[norm(b.name || '')] ?? 9999;
    return sA - sB;
  });
}

// ── DOM builders ───────────────────────────────────────────────────────────────

// Resolve the learn-more URL from cardPageUrl (object with _publishUrl/_authorUrl)
function resolveCardPageUrl(card) {
  const raw = card.cardPageUrl;
  if (raw && typeof raw === 'object') {
    // eslint-disable-next-line no-underscore-dangle
    return raw._publishUrl || raw._authorUrl || raw._path || '';
  }
  return '';
}

// Build a full comparison card column matching the live site structure:
//   .ccr-card > .ccr-inner > .ccr-thumb (bg-image)
//              > .ccr-caption > h3 + .ccr-apply-area + .compare-info (dl/dt/dd)
//              > .ccr-button-group > a.ccr-learn-more
function buildCompareCard(card, doc, labels) {
  const name = card.name || '';
  const imgSrc = resolveImageUrl(card);
  const learnHref = resolveCardPageUrl(card);

  const col = doc.createElement('div');
  col.className = 'ccr-card';

  // ── Image inner (background-image + hidden print img) ──
  const inner = doc.createElement('div');
  inner.className = 'ccr-inner';
  const thumb = doc.createElement('div');
  thumb.className = 'ccr-thumb';
  if (imgSrc) {
    thumb.style.backgroundImage = `url("${imgSrc}")`;
    const img = doc.createElement('img');
    img.src = imgSrc;
    img.alt = name;
    img.loading = 'lazy';
    img.className = 'ccr-img-print';
    thumb.appendChild(img);
  }
  inner.appendChild(thumb);
  col.appendChild(inner);

  // ── Caption ──
  const caption = doc.createElement('div');
  caption.className = 'ccr-caption';

  const nameEl = doc.createElement('h3');
  nameEl.className = 'ccr-card-name';
  nameEl.textContent = name;
  caption.appendChild(nameEl);

  // Detail rows as dl/dt/dd (matching live site's .compare-info structure)
  const compareInfo = doc.createElement('div');
  compareInfo.className = 'compare-info';

  const fields = [
    { label: labels.slogan, value: plaintext(card.slogan) },
    { label: labels.privileges, value: plaintext(card.privileges) },
    { label: labels.qualification, value: plaintext(card.qualification) },
    { label: labels.rewardPoints, value: plaintext(card.rewardPointsCashback) },
    { label: labels.mileage, value: plaintext(card.mileageRedemption) },
  ];

  fields.forEach(({ label, value }) => {
    if (!value) return;
    const dl = doc.createElement('dl');
    const dt = doc.createElement('dt');
    dt.className = 'ccr-label';
    dt.textContent = label;
    const dd = doc.createElement('dd');
    dd.className = 'ccr-value';
    dd.textContent = value;
    dl.appendChild(dt);
    dl.appendChild(dd);
    compareInfo.appendChild(dl);
  });

  caption.appendChild(compareInfo);
  col.appendChild(caption);

  // ── Learn more link ──
  const learnLink = doc.createElement('a');
  learnLink.href = learnHref;
  learnLink.className = 'ccr-learn-more';
  learnLink.textContent = labels.learnMore;
  col.appendChild(learnLink);
  return col;
}

// ── Mobile carousel dots ───────────────────────────────────────────────────────

function initMobileCarousel(grid, doc) {
  const dotsEl = doc.createElement('div');
  dotsEl.className = 'ccr-scroll-dots';
  grid.parentElement.appendChild(dotsEl);

  const getItems = () => [...grid.querySelectorAll('.ccr-card')];

  const scrollToItem = (item) => {
    const offset = item.getBoundingClientRect().left
      - grid.getBoundingClientRect().left
      + grid.scrollLeft;
    grid.scrollTo({ left: offset, behavior: 'smooth' });
  };

  const buildDots = () => {
    dotsEl.innerHTML = '';
    const items = getItems();
    if (items.length <= 1) return;
    items.forEach((item, i) => {
      const dot = doc.createElement('button');
      dot.type = 'button';
      dot.className = 'ccr-scroll-dot';
      if (i === 0) dot.classList.add('is-active');
      dot.setAttribute('aria-label', `Card ${i + 1}`);
      dot.addEventListener('click', () => scrollToItem(item));
      dotsEl.appendChild(dot);
    });
  };

  grid.addEventListener('scroll', () => {
    const dots = [...dotsEl.querySelectorAll('.ccr-scroll-dot')];
    const items = getItems();
    if (!items.length || !dots.length) return;
    const containerLeft = grid.getBoundingClientRect().left;
    let activeIndex = 0;
    let minDistance = Infinity;
    items.forEach((item, i) => {
      const dist = Math.abs(item.getBoundingClientRect().left - containerLeft);
      if (dist < minDistance) { minDistance = dist; activeIndex = i; }
    });
    dots.forEach((dot, i) => dot.classList.toggle('is-active', i === activeIndex));
  }, { passive: true });

  return buildDots;
}

// ── Cookie reader ──────────────────────────────────────────────────────────────

// Read sessionStorage first; fall back to the cookie keyed by the ?compare-product-btn param
function getCardsFromStorage() {
  try {
    const stored = sessionStorage.getItem('ccs-compare-cards');
    if (stored) {
      const cards = JSON.parse(stored);
      if (Array.isArray(cards) && cards.length) return cards;
    }
  } catch { /* ignore */ }

  // Cookie fallback: read cookie name from URL param, parse stored JSON
  const cookieName = new URLSearchParams(window.location.search).get('compare-product-btn');
  if (!cookieName) return null;
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${cookieName}=`));
  if (!match) return null;
  try {
    const value = decodeURIComponent(match.split('=').slice(1).join('='));
    const items = JSON.parse(value);
    return items.map(({ id, title, photo }) => ({ name: title || id, image: photo }));
  } catch {
    return null;
  }
}

// ── Render ─────────────────────────────────────────────────────────────────────

// Populate the comparison grid with matched cards, falling back to raw cookie data if none found
function renderComparison(container, cards, allCards, sourcingMap, labels, doc) {
  container.innerHTML = '';

  if (!cards || cards.length === 0) {
    const msg = doc.createElement('p');
    msg.className = 'ccr-no-results';
    msg.textContent = labels.noResults;
    container.appendChild(msg);
    return;
  }

  const selectedNames = cards.map((c) => c.name);
  const sorted = filterAndSortCards(allCards, selectedNames, sourcingMap);

  const displayCards = sorted.length > 0
    ? sorted
    : cards.map(({ name, image }) => ({ name, image }));

  displayCards.forEach((card) => {
    container.appendChild(buildCompareCard(card, doc, labels));
  });
}

// ── Row height equalizer — matches live site JS (sets inline height) ──────────

function equalizeRowHeights(grid) {
  if (!window.matchMedia('(width > 47.5rem)').matches) return;

  const cards = [...grid.querySelectorAll('.ccr-card')];
  if (cards.length < 2) return;

  // Reset previously set heights so we remeasure from natural content height
  cards.forEach((card) => {
    card.querySelectorAll('.ccr-card-name, dl').forEach((el) => {
      // eslint-disable-next-line no-param-reassign
      el.style.height = '';
    });
  });

  // Equalize card name height
  const nameEls = cards.map((c) => c.querySelector('.ccr-card-name')).filter(Boolean);
  const maxNameH = Math.max(...nameEls.map((el) => el.offsetHeight));
  nameEls.forEach((el) => { el.style.height = `${maxNameH}px`; });

  // Equalize each dl row by position index
  const maxDls = Math.max(...cards.map((c) => c.querySelectorAll('dl').length));
  for (let i = 0; i < maxDls; i += 1) {
    const dls = cards.map((c) => c.querySelectorAll('dl')[i]).filter(Boolean);
    // eslint-disable-next-line no-continue
    if (!dls.length) continue;
    const maxH = Math.max(...dls.map((dl) => dl.offsetHeight));
    dls.forEach((dl) => { dl.style.height = `${maxH}px`; });
  }
}

// ── Decorate ───────────────────────────────────────────────────────────────────

export default async function decorate(block) {
  const doc = block.ownerDocument;
  const ph = await fetchPlaceholders();
  const labels = {
    learnMore: ph.cardLearnMore || 'Learn more',
    slogan: ph.cardSlogan || 'Slogan',
    privileges: ph.cardPrivileges || 'Privileges',
    qualification: ph.cardQualification || 'Qualification',
    rewardPoints: ph.cardRewardPoints || 'Reward Points/ Cash Back',
    mileage: ph.cardMileage || 'Mileage Redemption',
    noResults: ph.cardNoResultsFound || 'No results found',
  };

  const descriptionRow = block.children[0];
  if (descriptionRow) {
    descriptionRow.classList.add('ccr-description');
  }

  const innerContainer = doc.createElement('div');
  innerContainer.className = 'inner-container';
  block.appendChild(innerContainer);

  const container = doc.createElement('div');
  container.className = 'ccr-grid';
  innerContainer.appendChild(container);

  const buildDots = initMobileCarousel(container, doc);

  const doAlign = () => {
    doc.fonts.ready.then(() => requestAnimationFrame(() => equalizeRowHeights(container)));
  };

  const [allCards, sourcingMap] = await Promise.all([loadAllCards(), loadSourcingOrder()]);

  const renderAndAlign = (cards) => {
    renderComparison(container, cards, allCards, sourcingMap, labels, doc);
    buildDots();
    doAlign();
  };

  // On page load, restore selection from sessionStorage or cookie (survives page refresh)
  const storedCards = getCardsFromStorage();
  if (storedCards) renderAndAlign(storedCards);

  // Inline mode: render when the comparator bar fires the compare event
  doc.addEventListener('credit-card-compare-show', (e) => renderAndAlign(e.detail?.cards));

  // Re-equalize on resize (debounced) so rows stay aligned after viewport changes
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => equalizeRowHeights(container), 150);
  });
}
