import decorateCardList from '../card-list/card-list.js';
import { loadCSS } from '../../scripts/aem.js';

const INITIAL_VISIBLE = 6;
const MAX_FILTERED = 5;

function parseIncomeValue(str) {
  if (!str) return 0;
  return parseInt(str.toString().replace(/[^0-9]/g, ''), 10) || 0;
}

function norm(str) {
  return (str || '').toString().toLowerCase().trim();
}

function field(card, ...keys) {
  const found = keys.find((k) => {
    const v = card[k];
    return v !== null && v !== undefined && v !== '';
  });
  return found !== undefined ? card[found] : '';
}

function resolveImageUrl(card) {
  const raw = card.imageUrl || card.image || '';
  if (!raw) return '';
  if (typeof raw === 'string') return raw;
  // eslint-disable-next-line no-underscore-dangle
  return raw._publishUrl || raw._authorUrl || '';
}

function filterCards(cards, { income, benefit, lifestyles } = {}) {
  const userIncome = parseIncomeValue(income);
  const userBenefit = norm(benefit);
  const userLifestyles = (lifestyles || []).map(norm).filter(Boolean);

  return cards.filter((card) => {
    if (userIncome > 0) {
      const cardIncome = parseIncomeValue(field(card, 'income', 'Income', 'incomeRequirement'));
      if (cardIncome > userIncome) return false;
    }
    if (userBenefit) {
      const cardBenefit = norm(field(card, 'benefit', 'Benefit'));
      if (cardBenefit && cardBenefit !== userBenefit) return false;
    }
    if (userLifestyles.length > 0) {
      const raw = field(card, 'lifestyles', 'Lifestyles', 'lifestyle');
      const cardLifestyles = raw.toString().split(/[,;|]/).map(norm).filter(Boolean);
      const hasMatch = userLifestyles.some(
        (sel) => cardLifestyles.some((cl) => cl.includes(sel) || sel.includes(cl)),
      );
      if (!hasMatch) return false;
    }
    return true;
  });
}

function sortBySourcing(cards) {
  return [...cards].sort((a, b) => {
    const an = parseInt(field(a, 'sourcingNumber', 'Sourcing Number', 'order') || 9999, 10);
    const bn = parseInt(field(b, 'sourcingNumber', 'Sourcing Number', 'order') || 9999, 10);
    return an - bn;
  });
}

/* ── card-list block builder */
function makeRow(doc, ...cells) {
  const row = doc.createElement('div');
  cells.forEach((content) => {
    const cell = doc.createElement('div');
    if (content instanceof Node) {
      cell.appendChild(content);
    } else if (content !== null && content !== undefined) {
      cell.textContent = String(content);
    }
    row.appendChild(cell);
  });
  return row;
}

function buildCardListBlock(cards, doc) {
  const block = doc.createElement('div');
  // 'credit-card' is the EDS variation class — sits alongside 'card-list block'
  block.className = 'card-list credit-card block';
  block.dataset.blockName = 'card-list';

  // Config rows
  block.appendChild(makeRow(doc, 'scrollable')); // row 0: layout
  block.appendChild(makeRow(doc, 'center')); // row 1: alignment
  block.appendChild(makeRow(doc, 'cards-3')); // row 2: cardsPerRow — matches .cards-list.cards-3 in card-list.css

  cards.forEach((card) => {
    const nameEN = field(card, 'nameEN', 'Product Name (EN)', 'name', 'cardName');
    const nameTH = field(card, 'nameTH', 'Product Name (TH)', 'cardNameTH');
    const description = field(card, 'cardDescription', 'description');
    const imgSrc = resolveImageUrl(card);
    const learnHref = field(card, 'learnMoreUrl', 'url', 'pageUrl', 'link') || '#';

    // Cell 0 — image (x-small: object-fit contain so full card art is visible)
    const imgCell = doc.createElement('div');
    if (imgSrc) {
      const img = doc.createElement('img');
      img.src = imgSrc;
      img.alt = nameEN;
      img.loading = 'lazy';
      imgCell.appendChild(img);
    }

    // Cell 2 — title: optional Thai name as <p> + EN name as <h3>
    //   h3 is required for card-list's has-title-underline ::before pseudo-element
    const titleCell = doc.createElement('div');
    if (nameTH) {
      const sub = doc.createElement('p');
      sub.className = 'ccs-name-th';
      sub.textContent = nameTH;
      titleCell.appendChild(sub);
    }
    const h3 = doc.createElement('h3');
    h3.textContent = nameEN;
    titleCell.appendChild(h3);

    // Cell 3 — description (slogan)
    const descCell = doc.createElement('div');
    if (description && typeof description === 'string') {
      const descP = doc.createElement('p');
      descP.textContent = description;
      descCell.appendChild(descP);
    }

    // Cell 5 — Learn more link
    const btnCell = doc.createElement('div');
    const link = doc.createElement('a');
    link.href = learnHref;
    link.textContent = 'Learn more';
    btnCell.appendChild(link);

    block.appendChild(makeRow(
      doc,
      imgCell,
      null,
      titleCell,
      descCell,
      null,
      btnCell, // 5 button
      'x-small',
      'true',
      'false',
      null,
      null,
      'false',
    ));
  });

  return block;
}

/**
 * After card-list decorator runs, inject a Compare <button> alongside
 * the Learn More link inside each card's .cards-list-button wrapper.
 */
function addCompareButtons(blockEl, doc) {
  blockEl.querySelectorAll('.cards-list-button').forEach((btnWrapper) => {
    const compareBtn = doc.createElement('button');
    compareBtn.type = 'button';
    compareBtn.className = 'ccs-compare-btn';
    compareBtn.textContent = 'Compare';
    btnWrapper.appendChild(compareBtn);
  });
}

/* ── Public API ───────────────────────────────────────────────────────────── */

/**
 * Build and inject the card-results section immediately after selectorBlock.
 * Card rendering delegates entirely to the card-list block decorator.
 *
 * @param {Element} selectorBlock
 * @returns {Promise<void>}
 */
export default async function initCardResults(selectorBlock, { disclaimerHtml = '' } = {}) {
  const doc = selectorBlock.ownerDocument;

  // ── Ensure card-list CSS is loaded (not auto-loaded when called directly) ──
  await loadCSS(`${window.hlx.codeBasePath}/blocks/card-list/card-list.css`);

  // ── Fetch card data (helper.json; swap for config URL when ready) ─────────
  let allCards = [];
  try {
    const resp = await fetch('/blocks/helper/helper.json');
    if (resp.ok) {
      const json = await resp.json();
      allCards = json.data?.creditCardsList?.items
        || json.data
        || json.items
        || [];
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[credit-card-results] Failed to load card data:', err);
  }

  allCards = sortBySourcing(allCards);

  // ── Build results section ─────────────────────────────────────────────────
  const section = doc.createElement('div');
  section.className = 'ccs-results';

  const header = doc.createElement('div');
  header.className = 'ccs-results-header';
  const titleEl = doc.createElement('h2');
  titleEl.className = 'ccs-results-title';
  titleEl.textContent = 'A range of cards to suit all lifestyles';
  header.appendChild(titleEl);
  section.appendChild(header);

  // card-list renders into this container
  const cardListContainer = doc.createElement('div');
  cardListContainer.className = 'ccs-card-list-container';
  section.appendChild(cardListContainer);

  // See more / See less toggle
  const toggleWrap = doc.createElement('div');
  toggleWrap.className = 'ccs-results-toggle';
  const toggleBtn = doc.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'ccs-results-toggle-btn';
  toggleWrap.appendChild(toggleBtn);
  section.appendChild(toggleWrap);

  // Disclaimer
  const disclaimer = doc.createElement('div');
  disclaimer.className = 'ccs-results-disclaimer';
  disclaimer.innerHTML = disclaimerHtml;
  section.appendChild(disclaimer);

  selectorBlock.insertAdjacentElement('afterend', section);

  // ── State ─────────────────────────────────────────────────────────────────
  let isExpanded = false;
  let activeCards = null; // null = full unfiltered list; Array = filtered result

  /**
   * Build, decorate, and mount a fresh card-list block for the given cards.
   * Cards at index >= INITIAL_VISIBLE get .ccs-hidden in the unfiltered state.
   */
  function renderCards(cards) {
    cardListContainer.innerHTML = '';

    if (!cards || cards.length === 0) {
      const noResults = doc.createElement('p');
      noResults.className = 'ccs-no-results';
      noResults.textContent = 'No Results Found';
      cardListContainer.appendChild(noResults);
      return;
    }

    const blockEl = buildCardListBlock(cards, doc);
    cardListContainer.appendChild(blockEl);
    decorateCardList(blockEl);
    addCompareButtons(blockEl, doc);

    // Initially hide overflow cards only in the unfiltered view
    if (activeCards === null && !isExpanded) {
      [...blockEl.querySelectorAll('.cards-list-item')].forEach((item, i) => {
        if (i >= INITIAL_VISIBLE) item.classList.add('ccs-hidden');
      });
    }
  }

  function refreshToggle() {
    const canToggle = activeCards === null && allCards.length > INITIAL_VISIBLE;
    toggleWrap.style.display = canToggle ? '' : 'none';
    toggleBtn.innerHTML = '';
    const lbl = doc.createElement('span');
    lbl.textContent = isExpanded ? 'See less' : 'See more';
    const ico = doc.createElement('span');
    ico.className = `ccs-chevron ccs-chevron-${isExpanded ? 'up' : 'down'}`;
    ico.setAttribute('aria-hidden', 'true');
    toggleBtn.appendChild(lbl);
    toggleBtn.appendChild(ico);
    toggleBtn.setAttribute('aria-expanded', String(isExpanded));
  }

  function render() {
    renderCards(activeCards !== null ? activeCards : allCards);
    refreshToggle();
  }

  render();

  // ── See more / See less ───────────────────────────────────────────────────
  // Toggles visibility on existing DOM nodes — no re-decoration needed.
  toggleBtn.addEventListener('click', () => {
    isExpanded = !isExpanded;
    [...cardListContainer.querySelectorAll('.cards-list-item')].forEach((item, i) => {
      if (i >= INITIAL_VISIBLE) item.classList.toggle('ccs-hidden', !isExpanded);
    });
    refreshToggle();
  });

  // ── Filter applied ────────────────────────────────────────────────────────
  doc.addEventListener('credit-card-filter-applied', (e) => {
    let filtered = filterCards(allCards, e.detail || {});
    filtered = sortBySourcing(filtered).slice(0, MAX_FILTERED);
    activeCards = filtered;
    isExpanded = false;
    render();
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ── Filter reset (Start Over) ─────────────────────────────────────────────
  doc.addEventListener('credit-card-filter-reset', () => {
    activeCards = null;
    isExpanded = false;
    render();
  });

  // ── Compare toggle ────────────────────────────────────────────────────────
  section.addEventListener('click', (e) => {
    const btn = e.target.closest('.ccs-compare-btn');
    if (!btn) return;
    const nowComparing = btn.classList.toggle('is-comparing');
    btn.textContent = nowComparing ? 'Remove' : 'Compare';
  });
}
