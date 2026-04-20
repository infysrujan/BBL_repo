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
    // eslint-disable-next-line no-console
    console.log('[card-comparator-results] Full config:', configs);
    if (!cardSuggesterData) {
      // eslint-disable-next-line no-console
      console.log('[card-comparator-results] cardSuggesterData key exists but value is empty — clear sessionStorage config cache and reload');
      return [];
    }
    const resp = await fetch(cardSuggesterData);
    if (!resp.ok) return [];
    const json = await resp.json();
    const cards = json.data?.creditCardsList?.items || json.data || json.items || [];
    // eslint-disable-next-line no-console
    console.log('[card-comparator-results] cards loaded:', cards.length, cards[0]);
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

// Build a single label/value detail row for a card comparison column
function buildRow(doc, label, value) {
  if (!value) return null;
  const row = doc.createElement('div');
  row.className = 'ccr-row';
  const lbl = doc.createElement('p');
  lbl.className = 'ccr-label';
  lbl.textContent = label;
  const val = doc.createElement('p');
  val.className = 'ccr-value';
  val.textContent = value;
  row.appendChild(lbl);
  row.appendChild(val);
  return row;
}

// Resolve the learn-more URL from cardPageUrl (object with _publishUrl/_authorUrl)
function resolveCardPageUrl(card) {
  const raw = card.cardPageUrl;
  if (raw && typeof raw === 'object') {
    // eslint-disable-next-line no-underscore-dangle
    return raw._publishUrl || raw._authorUrl || raw._path || '';
  }
  return '';
}

// Build a full comparison card column with image, name, apply/learn-more links, and detail rows
function buildCompareCard(card, doc, labels) {
  const name = card.name || '';
  const imgSrc = resolveImageUrl(card);
  const learnHref = resolveCardPageUrl(card);

  const col = doc.createElement('div');
  col.className = 'ccr-card';

  if (imgSrc) {
    const imgWrap = doc.createElement('div');
    imgWrap.className = 'ccr-card-image';
    const img = doc.createElement('img');
    img.src = imgSrc;
    img.alt = name;
    img.loading = 'lazy';
    imgWrap.appendChild(img);
    col.appendChild(imgWrap);
  }

  const nameEl = doc.createElement('h3');
  nameEl.className = 'ccr-card-name';
  nameEl.textContent = name;
  col.appendChild(nameEl);

  const fields = [
    { label: labels.slogan, value: plaintext(card.slogan) },
    { label: labels.privileges, value: plaintext(card.privileges) },
    { label: labels.qualification, value: plaintext(card.qualification) },
    { label: labels.rewardPoints, value: plaintext(card.rewardPointsCashback) },
    { label: labels.mileage, value: plaintext(card.mileageRedemption) },
  ];

  fields.forEach(({ label, value }) => {
    const row = buildRow(doc, label, value);
    if (row) col.appendChild(row);
  });

  const learnWrap = doc.createElement('div');
  learnWrap.className = 'ccr-learn-more';
  const learnLink = doc.createElement('a');
  learnLink.href = learnHref;
  learnLink.textContent = labels.learnMore;
  learnWrap.appendChild(learnLink);
  col.appendChild(learnWrap);

  return col;
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

// ── Decorate ───────────────────────────────────────────────────────────────────

export default async function decorate(block) {
  const doc = block.ownerDocument;
  const ph = await fetchPlaceholders();
  const labels = {
    apply: ph.cardApply || 'Apply',
    learnMore: ph.cardLearnMore || 'Learn more',
    slogan: ph.cardSlogan || 'Slogan',
    privileges: ph.cardPrivileges || 'Privileges',
    qualification: ph.cardQualification || 'Qualification',
    rewardPoints: ph.cardRewardPoints || 'Reward Points/ Cash Back',
    mileage: ph.cardMileage || 'Mileage Redemption',
    noResults: ph.cardNoResultsFound || 'No results found',
  };

  const container = doc.createElement('div');
  container.className = 'ccr-grid';
  block.appendChild(container);

  const [allCards, sourcingMap] = await Promise.all([loadAllCards(), loadSourcingOrder()]);

  // On page load, restore selection from sessionStorage or cookie (survives page refresh)
  const storedCards = getCardsFromStorage();
  if (storedCards) {
    renderComparison(container, storedCards, allCards, sourcingMap, labels, doc);
  }

  // Inline mode: render when the comparator bar fires the compare event
  doc.addEventListener('credit-card-compare-show', (e) => {
    renderComparison(container, e.detail?.cards, allCards, sourcingMap, labels, doc);
  });
}
