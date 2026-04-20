import { moveInstrumentation } from '../../scripts/scripts.js';
import { fetchPlaceholders } from '../../scripts/placeholder.js';

const MIN_COMPARE = 2;
const MAX_COMPARE = 3;

// ── Cookie helpers ─────────────────────────────────────────────────────────────

// Sanitize a card name into a valid cookie token (alphanumeric / dash / underscore, max 64 chars)
function buildCookieName(cardName) {
  return cardName.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 64);
}

// Write the current card selection as a JSON cookie keyed by the first card's sanitized name
function saveComparatorCookie(selectedCards) {
  if (!selectedCards.length) return;
  const cookieName = buildCookieName(selectedCards[0].name);
  const cookieValue = selectedCards.map(({ name, image }) => ({
    id: name,
    title: name,
    photo: image,
  }));
  const expires = new Date(Date.now() + 365 * 864e5).toUTCString();
  document.cookie = `${cookieName}=${encodeURIComponent(JSON.stringify(cookieValue))}; expires=${expires}; path=/; SameSite=Lax`;
}

// ── Config ─────────────────────────────────────────────────────────────────────

// Read the CTA link, label text, and target-blank flag from the authored block rows
function readBlockConfig(block) {
  const rows = [...block.children];
  rows.forEach((row) => moveInstrumentation(row, block));
  const anchor = rows[0]?.children[0]?.querySelector('a');
  return {
    link: anchor?.href ?? '',
    linkText: anchor?.textContent?.trim() ?? 'Compare',
    targetLink: rows[1]?.children[0]?.querySelector('p')?.textContent?.trim() === 'true',
  };
}

// ── DOM builders ───────────────────────────────────────────────────────────────

// Create the hidden warning banner shown when the card-selection limit is reached
function buildErrorDiv(warningText) {
  const el = document.createElement('div');
  el.className = 'compare-error';
  el.textContent = warningText;
  el.hidden = true;
  return el;
}

// Create the compare CTA button, disabled until MIN_COMPARE cards are selected
function buildCtaButton(linkText) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-primary';
  btn.textContent = linkText;
  btn.disabled = true;
  return btn;
}

// Assemble the full comparator DOM inside block; returns the key child elements
function buildComparatorDOM(block, warningText, linkText) {
  block.innerHTML = '';
  const innerContainer = document.createElement('div');
  innerContainer.className = 'inner-container';

  const errorDiv = buildErrorDiv(warningText);
  const compareGroup = document.createElement('div');
  compareGroup.className = 'compare-group';
  const ctaBtn = buildCtaButton(linkText);

  innerContainer.appendChild(errorDiv);
  innerContainer.appendChild(compareGroup);
  innerContainer.appendChild(ctaBtn);
  block.appendChild(innerContainer);

  return { errorDiv, compareGroup, ctaBtn };
}

// ── Card bar rendering ─────────────────────────────────────────────────────────

// Build a single product-comparing item with a card thumbnail and a close (×) button
function buildCardItem(name, image) {
  const item = document.createElement('div');
  item.className = 'product-comparing';

  const thumb = document.createElement('div');
  thumb.className = 'thumb';
  if (image) thumb.style.backgroundImage = `url("${image}")`;

  const closeIcon = document.createElement('span');
  closeIcon.className = 'icon-close';
  closeIcon.textContent = 'x';
  thumb.appendChild(closeIcon);

  const info = document.createElement('div');
  info.className = 'info';
  const h3 = document.createElement('h3');
  h3.className = 'text-small';
  h3.textContent = name;
  info.appendChild(h3);

  item.appendChild(thumb);
  item.appendChild(info);

  return { item, closeIcon };
}

// Repaint the comparator bar with the current selection and wire up each close button
function renderBar(compareGroup, selectedCards) {
  compareGroup.innerHTML = '';
  selectedCards.forEach(({ name, image }) => {
    const { item, closeIcon } = buildCardItem(name, image);
    compareGroup.appendChild(item);
    closeIcon.addEventListener('click', () => {
      window.ccsSelectedCards = (window.ccsSelectedCards || []).filter((c) => c.name !== name);
      document.dispatchEvent(new CustomEvent('credit-card-compare-updated', {
        detail: { cards: window.ccsSelectedCards },
      }));
    });
  });
}

// ── Main export ────────────────────────────────────────────────────────────────

export default async function decorate(block) {
  const { link, linkText, targetLink } = readBlockConfig(block);

  const ph = await fetchPlaceholders();
  const warningText = ph.compareLimitWarning || 'Maximum 3 products can be compared at the same time.';

  const { errorDiv, compareGroup, ctaBtn } = buildComparatorDOM(block, warningText, linkText);

  let warningTimer = null;

  // Show the max-limit warning banner and auto-dismiss it after 4 seconds
  function showWarning() {
    clearTimeout(warningTimer);
    errorDiv.hidden = false;
    warningTimer = setTimeout(() => { errorDiv.hidden = true; }, 4000);
  }

  // Sync the bar, button state, cookie, and sessionStorage whenever the card selection changes
  function update(selectedCards) {
    const count = selectedCards.length;
    block.classList.toggle('active', count > 0);
    ctaBtn.disabled = count < MIN_COMPARE;
    if (count < MAX_COMPARE) {
      clearTimeout(warningTimer);
      errorDiv.hidden = true;
    }
    saveComparatorCookie(selectedCards);
    // Persist to sessionStorage so the bar survives a same-tab page refresh
    try { sessionStorage.setItem('ccs-compare-cards', JSON.stringify(selectedCards)); } catch { /* ignore */ }
    renderBar(compareGroup, selectedCards);
  }

  // Scroll to inline results if the block is on the page; otherwise navigate to the compare URL
  ctaBtn.addEventListener('click', () => {
    const cards = window.ccsSelectedCards || [];
    const resultsContainer = document.querySelector('.card-comparator-results-container');
    if (resultsContainer) {
      document.dispatchEvent(new CustomEvent('credit-card-compare-show', { detail: { cards } }));
      resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (link) {
      const cookieName = cards.length ? buildCookieName(cards[0].name) : '';
      const url = cookieName ? `${link}?compare-product-btn=${cookieName}` : link;
      window.open(url, targetLink ? '_blank' : '_self');
    }
  });

  document.addEventListener('credit-card-compare-limit-reached', showWarning);
  document.addEventListener('credit-card-compare-updated', (e) => update(e.detail?.cards ?? []));

  // On page load, restore selection from sessionStorage so the bar and card buttons
  // re-appear after a refresh
  try {
    const stored = sessionStorage.getItem('ccs-compare-cards');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length) {
        window.ccsSelectedCards = parsed;
        // Notify other blocks (e.g. card results compare buttons) about the restored state
        document.dispatchEvent(new CustomEvent('credit-card-compare-updated', {
          detail: { cards: window.ccsSelectedCards },
        }));
      }
    }
  } catch { /* ignore */ }

  update(window.ccsSelectedCards || []);
}
