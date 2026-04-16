import decorateCardList from '../card-list/card-list.js';
import { loadCSS } from '../../scripts/aem.js';

const INITIAL_VISIBLE = 3;
const MAX_FILTERED = 5;

function parseIncomeValue(str) {
  if (!str) return 0;
  // Extract only the first numeric sequence (handles ranges like "15,000 – 49,999 Baht")
  const match = str.toString().replace(/\u200B/g, '').match(/[\d,]+/);
  if (!match) return 0;
  return parseInt(match[0].replace(/,/g, ''), 10) || 0;
}

// Strip zero-width spaces from keys and normalize whitespace in values
function normalizeRow(row) {
  const out = {};
  Object.entries(row).forEach(([k, v]) => {
    const cleanKey = k.replace(/\u200B/g, '').trim();
    const cleanVal = typeof v === 'string'
      ? v.replace(/\u200B/g, '').replace(/\s+/g, ' ').trim()
      : v;
    out[cleanKey] = cleanVal;
  });
  return out;
}

function norm(str) {
  return (str || '').toString().replace(/\u200B/g, '').toLowerCase().trim();
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

// Map UI benefit labels to spreadsheet values
const BENEFIT_ALIASES = {
  rewards: 'point',
};

function normBenefit(str) {
  const n = norm(str);
  return BENEFIT_ALIASES[n] || n;
}

function filterSheetCards(sheetCards, { income, benefit, lifestyles } = {}) {
  const userIncome = parseIncomeValue(income);
  const userBenefit = normBenefit(benefit);
  const userLifestyles = (lifestyles || []).map(norm).filter(Boolean);

  // eslint-disable-next-line no-console
  console.log('[filterSheetCards] Parsed filter → income:', userIncome, '| benefit:', userBenefit, '| lifestyles:', userLifestyles);

  return sheetCards.filter((row) => {
    const cardName = row['Product Name (EN)'];

    if (userIncome > 0) {
      const cardIncome = parseIncomeValue(row.Income || '');
      // eslint-disable-next-line no-console
      console.log(`  [${cardName}] Income: raw="${row.Income}" parsed=${cardIncome} vs user=${userIncome} → ${cardIncome !== userIncome ? 'EXCLUDED' : 'pass'}`);
      if (cardIncome !== userIncome) return false;
    }
    if (userBenefit) {
      const cardBenefit = normBenefit(row.Benefit || '');
      // eslint-disable-next-line no-console
      console.log(`  [${cardName}] Benefit: raw="${row.Benefit}" norm="${cardBenefit}" vs user="${userBenefit}" → ${cardBenefit !== userBenefit ? 'EXCLUDED' : 'pass'}`);
      if (cardBenefit && cardBenefit !== userBenefit) return false;
    }
    if (userLifestyles.length > 0) {
      const cardLifestyles = (row.Lifestyles || '').split(/[,;|]/).map(norm).filter(Boolean);
      const hasMatch = userLifestyles.some(
        (sel) => cardLifestyles.some((cl) => cl.includes(sel) || sel.includes(cl)),
      );
      // eslint-disable-next-line no-console
      console.log(`  [${cardName}] Lifestyles: raw="${row.Lifestyles}" parsed=${JSON.stringify(cardLifestyles)} vs user=${JSON.stringify(userLifestyles)} → ${hasMatch ? 'pass' : 'EXCLUDED'}`);
      if (!hasMatch) return false;
    }
    return true;
  });
}

function sortBySourcing(cards) {
  return [...cards].sort((a, b) => {
    const an = parseInt(field(a, 'Sourcing', 'sourcingNumber', 'Sourcing Number', 'order') || 9999, 10);
    const bn = parseInt(field(b, 'Sourcing', 'sourcingNumber', 'Sourcing Number', 'order') || 9999, 10);
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

  // ── Fetch spreadsheet filter data (credit-card-suggestor sheet) ──────────
  let sheetCards = [];
  try {
    const sheetResp = await fetch('/credit-card-suggestor.json');
    // eslint-disable-next-line no-console
    console.log('[credit-card-results] Spreadsheet fetch status:', sheetResp.status, sheetResp.ok);
    if (sheetResp.ok) {
      const sheetJson = await sheetResp.json();
      // eslint-disable-next-line no-console
      console.log('[credit-card-results] credit-card-suggestor sheet data:', sheetJson);
      sheetCards = (sheetJson.data || []).map(normalizeRow);
      // eslint-disable-next-line no-console
      console.log('[credit-card-results] sheetCards loaded:', sheetCards.length, sheetCards);
      // eslint-disable-next-line no-console
      console.log('[credit-card-results] First row keys:', Object.keys(sheetCards[0] || {}));
      // eslint-disable-next-line no-console
      console.log('[credit-card-results] First row data:', sheetCards[0]);
    } else {
      // eslint-disable-next-line no-console
      console.warn('[credit-card-results] Spreadsheet fetch failed with status:', sheetResp.status);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[credit-card-results] Failed to load spreadsheet data:', err);
  }

  // ── Fetch card data from helper.json ──────────────────────────────────────
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
  let currentBuildDots = null; // rebuilt whenever cards are re-rendered

  /**
   * Build, decorate, and mount a fresh card-list block for the given cards.
   * Cards at index >= INITIAL_VISIBLE get .ccs-hidden in the unfiltered state.
   */
  function renderCards(cards) {
    cardListContainer.innerHTML = '';
    currentBuildDots = null;

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

    // Hide overflow cards on tablet+ (mobile carousel shows all cards)
    if (activeCards === null && !isExpanded && window.matchMedia('(width >= 760px)').matches) {
      [...blockEl.querySelectorAll('.cards-list-item')].forEach((item, i) => {
        if (i >= INITIAL_VISIBLE) item.classList.add('ccs-hidden');
      });
    }

    // ── Scroll dots + seamless infinite loop (mobile carousel) ───────────
    const cardsList = blockEl.querySelector('.cards-list.scrollable');
    if (cardsList) {
      const dotsEl = doc.createElement('div');
      dotsEl.className = 'ccs-scroll-dots';
      cardListContainer.appendChild(dotsEl);

      // Real cards only — clones are excluded from dots and active-index logic
      const getRealItems = () => [
        ...blockEl.querySelectorAll('.cards-list-item:not(.ccs-hidden):not([data-ccs-clone])'),
      ];

      const buildDots = () => {
        dotsEl.innerHTML = '';
        getRealItems().forEach((item, i) => {
          const dot = doc.createElement('button');
          dot.type = 'button';
          dot.className = 'ccs-scroll-dot';
          if (i === 0) dot.classList.add('is-active');
          dot.setAttribute('aria-label', `Go to card ${i + 1}`);
          dot.addEventListener('click', () => {
            const offset = item.getBoundingClientRect().left
              - cardsList.getBoundingClientRect().left
              + cardsList.scrollLeft;
            cardsList.scrollTo({ left: offset, behavior: 'smooth' });
          });
          dotsEl.appendChild(dot);
        });
      };

      buildDots();
      currentBuildDots = buildDots;

      // Update active dot — ignores clones when finding nearest real card
      cardsList.addEventListener('scroll', () => {
        const dots = [...dotsEl.querySelectorAll('.ccs-scroll-dot')];
        const realItems = getRealItems();
        if (!realItems.length || !dots.length) return;
        const containerLeft = cardsList.getBoundingClientRect().left;
        let activeIndex = 0;
        let minDistance = Infinity;
        realItems.forEach((item, i) => {
          const distance = Math.abs(item.getBoundingClientRect().left - containerLeft);
          if (distance < minDistance) {
            minDistance = distance;
            activeIndex = i;
          }
        });
        dots.forEach((dot, i) => dot.classList.toggle('is-active', i === activeIndex));
      }, { passive: true });

      // ── Seamless loop: clone first card at end, last card at start ────────
      // Only on mobile (<760px) where the carousel is active — clones must not
      // appear in the tablet/desktop grid view.
      const realItems = getRealItems();
      if (realItems.length > 1 && window.matchMedia('(width < 760px)').matches) {
        const firstClone = realItems[0].cloneNode(true);
        const lastClone = realItems[realItems.length - 1].cloneNode(true);
        [firstClone, lastClone].forEach((c) => {
          c.dataset.ccsClone = 'true';
          c.setAttribute('aria-hidden', 'true');
        });
        cardsList.appendChild(firstClone); // clone of first → at end
        cardsList.insertBefore(lastClone, realItems[0]); // clone of last → at start

        // Skip the prepended last-clone on load (instant, no animation)
        requestAnimationFrame(() => {
          cardsList.scrollLeft = realItems[0].offsetLeft;
        });

        // After scroll snaps to a clone, instantly reposition to its real counterpart
        let wrapTimer = null;
        cardsList.addEventListener('scroll', () => {
          clearTimeout(wrapTimer);
          wrapTimer = setTimeout(() => {
            const allItems = [...cardsList.querySelectorAll('.cards-list-item')];
            const containerLeft = cardsList.getBoundingClientRect().left;
            let snapIdx = 0;
            let minDist = Infinity;
            allItems.forEach((item, i) => {
              const dist = Math.abs(item.getBoundingClientRect().left - containerLeft);
              if (dist < minDist) { minDist = dist; snapIdx = i; }
            });
            const snapped = allItems[snapIdx];
            if (!snapped || !snapped.dataset.ccsClone) return;
            // Jump to real counterpart — no animation so user doesn't see the repositioning
            const real = snapped === lastClone
              ? realItems[realItems.length - 1]
              : realItems[0];
            const delta = real.getBoundingClientRect().left
              - snapped.getBoundingClientRect().left;
            cardsList.scrollLeft += delta;
          }, 100);
        }, { passive: true });
      }
    }
  }

  function refreshToggle() {
    const isMobile = window.matchMedia('(width < 760px)').matches;
    const canToggle = !isMobile && activeCards === null && allCards.length > INITIAL_VISIBLE;
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
    if (currentBuildDots) currentBuildDots();
  });

  // ── Filter applied ────────────────────────────────────────────────────────
  doc.addEventListener('credit-card-filter-applied', (e) => {
    // eslint-disable-next-line no-console
    console.log('[credit-card-results] Filter applied - filter state:', e.detail);

    // Step 1: filter spreadsheet rows by selected criteria
    const matchingSheetRows = filterSheetCards(sheetCards, e.detail || {});
    // eslint-disable-next-line no-console
    console.log('[credit-card-results] Matching sheet rows:', matchingSheetRows.length, matchingSheetRows);

    // Step 2: collect the product names from matching rows
    const matchingNames = matchingSheetRows.map((row) => norm(row['Product Name (EN)'] || ''));
    // eslint-disable-next-line no-console
    console.log('[credit-card-results] Matching product names:', matchingNames);

    // Step 3: look up those cards in helper.json by name
    let filtered = allCards.filter((card) => {
      const cardName = norm(field(card, 'nameEN', 'Product Name (EN)', 'name', 'cardName'));
      return matchingNames.includes(cardName);
    });
    // eslint-disable-next-line no-console
    console.log('[credit-card-results] Matched helper cards:', filtered.length, filtered);

    // Step 4: sort by Sourcing order from the matching sheet rows
    const sourcingMap = {};
    matchingSheetRows.forEach((row) => {
      const name = norm(row['Product Name (EN)'] || '');
      if (name) sourcingMap[name] = parseInt(row.Sourcing || 9999, 10);
    });
    filtered = [...filtered].sort((a, b) => {
      const nameA = norm(field(a, 'nameEN', 'Product Name (EN)', 'name', 'cardName'));
      const nameB = norm(field(b, 'nameEN', 'Product Name (EN)', 'name', 'cardName'));
      return (sourcingMap[nameA] ?? 9999) - (sourcingMap[nameB] ?? 9999);
    });
    filtered = filtered.slice(0, MAX_FILTERED);
    // eslint-disable-next-line no-console
    console.log('[credit-card-results] Final cards to render (sorted, max 5):', filtered.length, filtered);

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
