import { fetchConfigs } from '../../scripts/config.js';
import { fetchPlaceholders } from '../../scripts/placeholder.js';
import { getLang, moveInstrumentation } from '../../scripts/scripts.js';

// ── Constants ──────────────────────────────────────────────────────────────────

/** sessionStorage keys written by mf-questionnaire block */
const SESSION = {
  riskLevel: 'mfRiskLevel',
  fxRisk: 'mfFxRisk',
  taxBenefit: 'mfTaxBenefit',
};

const MAX_COMPARE = 3;

const TABLET_MIN = getComputedStyle(document.documentElement)
  .getPropertyValue('--bbl-breakpoint-tablet-min').trim();

// ── Utilities ──────────────────────────────────────────────────────────────────

function norm(str) {
  return (str || '').toString().replace(/\u200B/g, '').toLowerCase().trim();
}

function normalizeRow(row) {
  const out = {};
  Object.entries(row).forEach(([k, v]) => {
    const key = k.replace(/\u200B/g, '').trim();
    out[key] = typeof v === 'string'
      ? v.replace(/\u200B/g, '').replace(/\s+/g, ' ').trim()
      : v;
  });
  return out;
}

// ── Row-reading helpers ────────────────────────────────────────────────────────

function readText(row) {
  return row?.children[1]?.querySelector('p')?.textContent?.trim()
    ?? row?.children[1]?.textContent?.trim()
    ?? row?.querySelector('p')?.textContent?.trim()
    ?? '';
}

function readHtml(row) {
  return row?.children[1]?.innerHTML?.trim()
    ?? row?.querySelector('p')?.outerHTML
    ?? '';
}

function readUrl(row) {
  const anchor = row?.querySelector('a');
  if (anchor) return anchor.href;
  return readText(row);
}

// ── Data fetching ──────────────────────────────────────────────────────────────

/**
 * Fetch the MF filtering matrix sheet.
 * Expected columns: Fund Type | Fund Name | Risk Level | FX Risk | RMF/SSF/Thai ESG/Thai ESGX
 */
async function loadMatrix() {
  try {
    const configs = await fetchConfigs();
    const url = configs.mfFilteringMatrixUrl;
    if (!url) return [];
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const json = await resp.json();
    return (json.data || []).map(normalizeRow);
  } catch {
    return [];
  }
}

/**
 * Fetch the MF card catalog.
 * Expected item fields: name/fundName/title, description, imageUrl/image,
 * fundLogoImage/fundCompanyLogo, readMoreUrl/cardPageUrl, id/cardId.
 */
async function loadCardData() {
  try {
    const configs = await fetchConfigs();
    const url = configs.mfSuggesterData;
    if (!url) return [];
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const json = await resp.json();
    return json.data?.mutualFundsList?.items
      || json.data?.fundsList?.items
      || json.data
      || json.items
      || [];
  } catch {
    return [];
  }
}

// ── Matrix filtering ───────────────────────────────────────────────────────────

/**
 * Match a matrix row against the three session answers.
 * All present answers must match (AND logic).
 * Empty answer values = "no filter applied" for that dimension.
 */
function matchesRow(row, { riskLevel, fxRisk, taxBenefit }) {
  // Risk Level: stored as e.g. "8" or "8,8+" (comma-separated multi-match)
  if (riskLevel) {
    const rowRisk = norm(row['Risk Level'] || '');
    const userRisks = riskLevel.split(',').map(norm).filter(Boolean);
    if (userRisks.length && !userRisks.some((r) => rowRisk === r)) return false;
  }

  // FX Risk: session stores 'yes' or 'no'; matrix stores 'Yes'/'No' or 'Y'/'N'
  if (fxRisk) {
    const rowFx = norm(row['FX Risk'] || row['Foreign Exchange Risk'] || '');
    const userFx = norm(fxRisk);
    const rowBool = rowFx === 'yes' || rowFx === 'y';
    const userBool = userFx === 'yes';
    if (rowFx && rowBool !== userBool) return false;
  }

  // Tax benefit: RMF/SSF/Thai ESG column
  if (taxBenefit) {
    const rawTax = row['RMF/SSF/Thai ESG/Thai ESGX']
      || row['RMF/SSF/Thai ESG']
      || row['Is RMF/SSF/Thai ESG/Thai ESGX Fu']
      || '';
    const rowTax = norm(rawTax);
    const rowBool = rowTax === 'yes' || rowTax === 'y';
    const userBool = norm(taxBenefit) === 'yes';
    if (rowTax && rowBool !== userBool) return false;
  }

  return true;
}

// ── URL resolvers ──────────────────────────────────────────────────────────────

function resolveImageUrl(card) {
  const raw = card.imageUrl || card.image || card.fundImage || '';
  if (!raw) return '';
  if (typeof raw === 'string') return raw;
  // eslint-disable-next-line no-underscore-dangle
  return raw._publishUrl || raw._authorUrl || '';
}

function resolveFundLogoUrl(card) {
  const raw = card.fundLogoImage || card.fundCompanyLogo || card.companyLogoUrl || card.logoImage || '';
  if (!raw) return '';
  if (typeof raw === 'string') return raw;
  // eslint-disable-next-line no-underscore-dangle
  return raw._publishUrl || raw._authorUrl || '';
}

function resolveReadMoreUrl(card) {
  const raw = card.readMoreUrl || card.cardPageUrl || card.detailUrl || card.pageUrl || '';
  if (!raw) return '';
  if (typeof raw === 'string') return raw;
  // eslint-disable-next-line no-underscore-dangle
  return raw._publishUrl || raw._authorUrl || raw._path || '';
}

// ── Card DOM builder ───────────────────────────────────────────────────────────

function buildMfCard(card, doc, labels) {
  const name = card.name || card.title || card.fundName || '';
  const description = card.description || card.cardDescription || card.fundDescription || '';
  const imgSrc = resolveImageUrl(card);
  const logoSrc = resolveFundLogoUrl(card);
  const readMoreUrl = resolveReadMoreUrl(card);
  const cardId = card.id || card.cardId || card.fundId || name;

  const cardEl = doc.createElement('div');
  cardEl.className = 'mfr-card';

  // Fund image
  const imgWrap = doc.createElement('div');
  imgWrap.className = 'mfr-card-image';
  if (imgSrc) {
    const img = doc.createElement('img');
    img.src = imgSrc;
    img.alt = name;
    img.loading = 'lazy';
    imgWrap.appendChild(img);
  }
  cardEl.appendChild(imgWrap);

  // Content area
  const content = doc.createElement('div');
  content.className = 'mfr-card-content';

  // Title + divider
  if (name) {
    const h3 = doc.createElement('h3');
    h3.className = 'mfr-card-title';
    h3.textContent = name;
    content.appendChild(h3);

    const divider = doc.createElement('span');
    divider.className = 'mfr-card-divider';
    divider.setAttribute('aria-hidden', 'true');
    content.appendChild(divider);
  }

  // Description
  if (description) {
    const descEl = doc.createElement('p');
    descEl.className = 'mfr-card-desc';
    const descText = typeof description === 'string'
      ? description
      : (description.plaintext || description.html || '');
    descEl.textContent = descText;
    content.appendChild(descEl);
  }

  // Fund management company logo
  if (logoSrc) {
    const logoWrap = doc.createElement('div');
    logoWrap.className = 'mfr-card-logo';
    const logoImg = doc.createElement('img');
    logoImg.src = logoSrc;
    logoImg.alt = 'Fund management company';
    logoImg.loading = 'lazy';
    logoWrap.appendChild(logoImg);
    content.appendChild(logoWrap);
  }

  // Action buttons
  const actions = doc.createElement('div');
  actions.className = 'mfr-card-actions';

  const readMoreBtn = doc.createElement('a');
  readMoreBtn.href = readMoreUrl || '#';
  readMoreBtn.className = 'mfr-btn mfr-btn-primary';
  readMoreBtn.textContent = labels.readMore;
  actions.appendChild(readMoreBtn);

  const compareBtn = doc.createElement('button');
  compareBtn.type = 'button';
  compareBtn.className = 'mfr-btn mfr-btn-secondary mfr-compare-btn';
  compareBtn.textContent = labels.compare;
  compareBtn.dataset.cardName = name;
  compareBtn.dataset.cardId = cardId;
  compareBtn.dataset.cardImage = imgSrc;
  actions.appendChild(compareBtn);

  content.appendChild(actions);
  cardEl.appendChild(content);

  return cardEl;
}

// ── Scroll dots — mobile carousel for card grid ────────────────────────────────

function initScrollDots(grid, doc) {
  const dotsEl = doc.createElement('div');
  dotsEl.className = 'mfr-scroll-dots';
  grid.parentElement?.appendChild(dotsEl);

  const getCards = () => [...grid.querySelectorAll('.mfr-card')];

  const scrollToCard = (card) => {
    const offset = card.getBoundingClientRect().left
      - grid.getBoundingClientRect().left
      + grid.scrollLeft;
    grid.scrollTo({ left: offset, behavior: 'smooth' });
  };

  const buildDots = () => {
    dotsEl.innerHTML = '';
    const cards = getCards();
    if (cards.length <= 1) return;
    cards.forEach((card, i) => {
      const dot = doc.createElement('button');
      dot.type = 'button';
      dot.className = `mfr-scroll-dot${i === 0 ? ' is-active' : ''}`;
      dot.setAttribute('aria-label', `Card ${i + 1}`);
      dot.addEventListener('click', () => scrollToCard(card));
      dotsEl.appendChild(dot);
    });
  };

  buildDots();

  grid.addEventListener('scroll', () => {
    const dots = [...dotsEl.querySelectorAll('.mfr-scroll-dot')];
    const cards = getCards();
    if (!cards.length || !dots.length) return;
    const containerLeft = grid.getBoundingClientRect().left;
    let activeIdx = 0;
    let minDist = Infinity;
    cards.forEach((card, i) => {
      const dist = Math.abs(card.getBoundingClientRect().left - containerLeft);
      if (dist < minDist) { minDist = dist; activeIdx = i; }
    });
    dots.forEach((dot, i) => dot.classList.toggle('is-active', i === activeIdx));
  }, { passive: true });

  return buildDots;
}

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * Block row mapping (matches _mf-results.json model):
 *   Row 0  title           – "Funds Suggestion"
 *   Row 1  description     – Richtext intro text
 *   Row 2  viewAllLabel    – "View All Categories"
 *   Row 3  viewAllUrl      – aem-content: link to MF listing page
 *   Row 4  startOverLabel  – "Start Over"
 *   Row 5  startOverUrl    – aem-content: MF listing page (fallback redirect target)
 *   Row 6  disclaimer      – Richtext: disclaimer text shown at bottom
 */
export default async function decorate(block) {
  const doc = block.ownerDocument;
  const lang = getLang();
  const isTH = lang === 'th';
  const rows = [...block.children];

  // Read config
  const cfg = {
    title: readText(rows[0]),
    description: readHtml(rows[1]),
    viewAllLabel: readText(rows[2]),
    viewAllUrl: readUrl(rows[3]),
    startOverLabel: readText(rows[4]),
    startOverUrl: readUrl(rows[5]),
    disclaimer: readHtml(rows[6]),
  };

  // Move UE instrumentation attrs from source rows to block element
  rows.forEach((row) => moveInstrumentation(row, block));
  rows.forEach((row) => row.classList.add('mfr-source-row'));

  const ph = await fetchPlaceholders();
  const labels = {
    readMore: ph.mfReadMore || (isTH ? 'อ่านเพิ่มเติม' : 'Read more'),
    compare: ph.mfCompare || (isTH ? 'เปรียบเทียบ' : 'Compare'),
    noResults: ph.mfNoResults || (isTH ? 'ไม่พบผลลัพธ์' : 'No Results Found'),
  };

  // ── Build page structure ───────────────────────────────────────────────────
  const wrapper = doc.createElement('div');
  wrapper.className = 'mfr-wrapper';

  // Header: title + divider + description
  const header = doc.createElement('div');
  header.className = 'mfr-header';

  if (cfg.title) {
    const titleEl = doc.createElement('h1');
    titleEl.className = 'mfr-title';
    titleEl.textContent = cfg.title;
    header.appendChild(titleEl);

    const divider = doc.createElement('span');
    divider.className = 'mfr-title-divider';
    divider.setAttribute('aria-hidden', 'true');
    header.appendChild(divider);
  }

  if (cfg.description) {
    const descEl = doc.createElement('div');
    descEl.className = 'mfr-description';
    descEl.innerHTML = cfg.description;
    header.appendChild(descEl);
  }

  wrapper.appendChild(header);

  // Card grid container (filled asynchronously after data loads)
  const gridContainer = doc.createElement('div');
  gridContainer.className = 'mfr-grid-container';
  wrapper.appendChild(gridContainer);

  // Footer CTAs: View All Categories + Start Over
  const footer = doc.createElement('div');
  footer.className = 'mfr-footer';

  if (cfg.viewAllLabel) {
    const viewAllBtn = doc.createElement('a');
    viewAllBtn.href = cfg.viewAllUrl || '#';
    viewAllBtn.className = 'mfr-cta mfr-cta--secondary';
    viewAllBtn.textContent = cfg.viewAllLabel;
    footer.appendChild(viewAllBtn);
  }

  if (cfg.startOverLabel) {
    const startOverBtn = doc.createElement('button');
    startOverBtn.type = 'button';
    startOverBtn.className = 'mfr-cta mfr-cta--secondary';
    startOverBtn.textContent = cfg.startOverLabel;

    startOverBtn.addEventListener('click', () => {
      // Clear all questionnaire session data
      try {
        Object.values(SESSION).forEach((key) => sessionStorage.removeItem(key));
        sessionStorage.removeItem('mfs-compare-cards');
      } catch { /* ignore */ }
      window.mfsSelectedCards = [];

      // If questionnaire block is already on this page, show it directly
      if (typeof window.mfQuestionnaire?.show === 'function') {
        window.mfQuestionnaire.show();
        return;
      }

      // Fire custom event (catches fragment-loaded questionnaire on same page)
      doc.dispatchEvent(new CustomEvent('mf:open-questionnaire'));

      // Fallback: navigate to the MF listing page with start-over flag
      if (cfg.startOverUrl) {
        const url = new URL(cfg.startOverUrl, window.location.origin);
        url.searchParams.set('mf-start-over', '1');
        window.location.href = url.toString();
      }
    });

    footer.appendChild(startOverBtn);
  }

  wrapper.appendChild(footer);

  // Disclaimer
  if (cfg.disclaimer) {
    const disclaimerEl = doc.createElement('div');
    disclaimerEl.className = 'mfr-disclaimer';
    disclaimerEl.innerHTML = cfg.disclaimer;
    wrapper.appendChild(disclaimerEl);
  }

  block.appendChild(wrapper);

  // ── Read questionnaire answers from session ────────────────────────────────
  const answers = { riskLevel: '', fxRisk: '', taxBenefit: '' };
  try {
    answers.riskLevel = sessionStorage.getItem(SESSION.riskLevel) || '';
    answers.fxRisk = sessionStorage.getItem(SESSION.fxRisk) || '';
    answers.taxBenefit = sessionStorage.getItem(SESSION.taxBenefit) || '';
  } catch { /* ignore */ }

  // ── Fetch data in parallel ─────────────────────────────────────────────────
  const [matrix, allCards] = await Promise.all([loadMatrix(), loadCardData()]);

  // ── Compare state helpers ──────────────────────────────────────────────────
  function restoreCompareState() {
    const selected = window.mfsSelectedCards || [];
    gridContainer.querySelectorAll('.mfr-compare-btn').forEach((btn) => {
      btn.classList.toggle('is-comparing', selected.some((c) => c.name === btn.dataset.cardName));
    });
  }

  // ── Render cards ───────────────────────────────────────────────────────────
  function renderCards(cards) {
    gridContainer.innerHTML = '';

    if (!cards || cards.length === 0) {
      const msg = doc.createElement('p');
      msg.className = 'mfr-no-results';
      msg.textContent = labels.noResults;
      gridContainer.appendChild(msg);
      return;
    }

    const grid = doc.createElement('div');
    grid.className = 'mfr-grid';
    cards.forEach((card) => grid.appendChild(buildMfCard(card, doc, labels)));
    gridContainer.appendChild(grid);

    restoreCompareState();

    // Mobile scroll dots (only on mobile)
    if (!window.matchMedia(`(width > ${TABLET_MIN})`).matches) {
      initScrollDots(grid, doc);
    }
  }

  // ── Apply filter ───────────────────────────────────────────────────────────
  const matchedRows = matrix.filter((row) => matchesRow(row, answers));
  const matchedNames = matchedRows.map(
    (row) => norm(row['Fund Name'] || row['Product Name (EN)'] || row['Fund Name (EN)'] || ''),
  ).filter(Boolean);

  let filteredCards;
  if (matchedNames.length > 0) {
    filteredCards = allCards.filter((card) => {
      const cardName = norm(card.name || card.title || card.fundName || '');
      return matchedNames.some((n) => cardName.includes(n) || n.includes(cardName));
    });
  } else if (!answers.riskLevel && !answers.fxRisk && !answers.taxBenefit) {
    // No session data — no questionnaire answered, show nothing
    filteredCards = [];
  } else {
    // Questionnaire answered but nothing matched
    filteredCards = [];
  }

  renderCards(filteredCards);

  // ── Compare button click handling ──────────────────────────────────────────
  gridContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.mfr-compare-btn');
    if (!btn) return;

    window.mfsSelectedCards = window.mfsSelectedCards || [];
    const { cardName, cardImage, cardId } = btn.dataset;

    if (btn.classList.contains('is-comparing')) return;

    if (window.mfsSelectedCards.length >= MAX_COMPARE) {
      doc.dispatchEvent(new CustomEvent('mf-compare-limit-reached'));
      return;
    }

    window.mfsSelectedCards.push({ id: cardId, name: cardName, image: cardImage });
    restoreCompareState();
    doc.dispatchEvent(new CustomEvent('mf-compare-updated', {
      detail: { cards: window.mfsSelectedCards },
    }));
  });

  // Sync compare button visual states when bar removes a card
  doc.addEventListener('mf-compare-updated', restoreCompareState);
}
