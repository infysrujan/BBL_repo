import { loadCSS } from '../../scripts/aem.js';
import { getLang } from '../../scripts/scripts.js';
import { fetchPlaceholders } from '../../scripts/placeholder.js';
import { fetchConfigs } from '../../scripts/config.js';
import { fetchGet } from '../../scripts/utils/fetchApi.js';

const MAX_COMPARE = 3;
const ZERO_WIDTH_SPACE = String.fromCharCode(8203);

function norm(str) {
  return (str || '').toString().split(ZERO_WIDTH_SPACE).join('')
    .toLowerCase()
    .trim();
}

function getCardField(card, ...keys) {
  const key = keys.find((k) => card[k] !== null && card[k] !== undefined && card[k] !== '');
  return key !== undefined ? card[key] : '';
}

function resolveImageUrl(card) {
  const raw = card.imageUrl || card.image || '';
  if (!raw) return '';
  if (typeof raw === 'string') return raw;
  // eslint-disable-next-line no-underscore-dangle
  return raw._publishUrl || raw._authorUrl || '';
}

function extractCategoryFromTag(tagValue) {
  if (!tagValue) return '';
  const parts = tagValue.split(/[/:]/);
  return norm(parts[parts.length - 1] || '');
}

function matchesCategory(card, categorySlug) {
  if (!categorySlug) return true;
  const cardType = getCardField(card, 'cardType', 'Card Type', 'cardTypeName');
  const candidates = [
    ...(Array.isArray(cardType) ? cardType : [cardType]),
    ...(Array.isArray(card.tags) ? card.tags : []),
  ].filter(Boolean);
  return candidates.some((val) => {
    const normalized = extractCategoryFromTag(val);
    return normalized === categorySlug
      || normalized.includes(categorySlug)
      || categorySlug.includes(normalized);
  });
}

async function loadCardData(debitPrepaid) {
  try {
    const configs = await fetchConfigs();
    const configKey = debitPrepaid === 'prepaid'
      ? 'prepaidCardSelectorSuggesterData'
      : 'debitCardSelectorSuggesterData';
    const baseUrl = configs[configKey] || configs.creditCardSelectorSuggesterData;
    if (!baseUrl) return [];
    const lang = getLang();
    const url = baseUrl.replace(/;language=[^;?&]*/i, `;language=${lang}`);
    const cacheKey = `bbl-${debitPrepaid}-cards-${lang}`;
    if (!window[cacheKey]) {
      window[cacheKey] = fetchGet(url, { throwOnError: false })
        .then((json) => json?.data?.creditCardsList?.items || json?.data || json?.items || [])
        .catch(() => []);
    }
    return window[cacheKey];
  } catch {
    return [];
  }
}

function buildCardBlock(cards, doc, lang, labels) {
  const block = doc.createElement('div');
  block.className = 'card-list debit-prepaid-cards block';
  block.dataset.blockName = 'card-list';

  const list = doc.createElement('div');
  list.className = 'cards-list dp-track';

  cards.forEach((card) => {
    const nameEN = getCardField(card, 'nameEN', 'Product Name (EN)', 'name', 'cardName');
    const nameTH = getCardField(card, 'nameTH', 'Product Name (TH)', 'cardNameTH');
    const description = getCardField(card, 'cardDescription', 'description');
    const imgSrc = resolveImageUrl(card);
    const { cardPageUrl } = card;
    // eslint-disable-next-line no-underscore-dangle
    let learnMoreHref = (cardPageUrl && (cardPageUrl._publishUrl || cardPageUrl._authorUrl || cardPageUrl._path)) || '';
    if (learnMoreHref.startsWith('/content/bangkokbank')) {
      learnMoreHref = learnMoreHref.replace(/^\/content\/bangkokbank/, '');
    }
    const isTH = lang === 'th';
    const primaryName = isTH && nameTH ? nameTH : nameEN;
    const secondaryName = isTH && nameTH ? nameEN : nameTH;

    const cardEl = doc.createElement('div');
    cardEl.className = 'cards-list-item';

    const inner = doc.createElement('div');
    inner.className = 'cards-list-inner';

    if (imgSrc) {
      const imageWrapper = doc.createElement('div');
      imageWrapper.className = 'cards-list-image cards-list-image-x-small';
      const img = doc.createElement('img');
      img.src = imgSrc;
      img.alt = primaryName;
      img.loading = 'lazy';
      imageWrapper.appendChild(img);
      inner.appendChild(imageWrapper);
    }

    const content = doc.createElement('div');
    content.className = 'cards-list-content';

    if (secondaryName) {
      const sub = doc.createElement('p');
      sub.className = 'dp-name-th';
      sub.textContent = secondaryName;
      content.appendChild(sub);
    }

    const titleEl = doc.createElement('div');
    titleEl.className = 'cards-list-title has-title-underline';
    const h3 = doc.createElement('h3');
    h3.textContent = primaryName;
    h3.dataset.cardId = card.cardId || card.id || '';
    titleEl.appendChild(h3);
    content.appendChild(titleEl);

    if (description && typeof description === 'string') {
      titleEl.classList.add('has-description');
      const descEl = doc.createElement('div');
      descEl.className = 'cards-list-description';
      const p = doc.createElement('p');
      p.textContent = description;
      descEl.appendChild(p);
      content.appendChild(descEl);
    }

    inner.appendChild(content);

    const buttonWrapper = doc.createElement('div');
    buttonWrapper.className = 'cards-list-button';
    const link = doc.createElement('a');
    link.className = 'button-m primary';
    link.href = learnMoreHref || '#';
    link.textContent = labels.learnMore;
    buttonWrapper.appendChild(link);
    inner.appendChild(buttonWrapper);

    cardEl.appendChild(inner);
    list.appendChild(cardEl);
  });

  block.appendChild(list);
  return block;
}

function addCompareButtons(blockEl, doc, labels) {
  blockEl.querySelectorAll('.cards-list-button').forEach((wrapper) => {
    const item = wrapper.closest('.cards-list-item');
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.classList.add('dp-compare-btn', 'button-m', 'secondary');
    btn.textContent = labels.compare;
    const h3 = item?.querySelector('h3');
    btn.dataset.cardName = h3?.textContent?.trim() ?? '';
    btn.dataset.cardId = h3?.dataset?.cardId ?? '';
    btn.dataset.cardImage = item?.querySelector('img')?.src ?? '';
    wrapper.appendChild(btn);
  });
}

function buildArrowButton(doc, direction, label) {
  const btn = doc.createElement('button');
  btn.type = 'button';
  btn.className = `dp-arrow dp-arrow-${direction}`;
  btn.setAttribute('aria-label', label);
  return btn;
}

function buildDotsEl(doc) {
  const dotsEl = doc.createElement('div');
  dotsEl.className = 'dp-scroll-dots';
  return dotsEl;
}

function waitForOwnCss(href) {
  const link = document.querySelector(`head > link[href="${href}"]`);
  if (!link || link.sheet) return Promise.resolve();
  return new Promise((resolve) => {
    link.addEventListener('load', resolve, { once: true });
    link.addEventListener('error', resolve, { once: true });
  });
}

function initCarousel(cardsList, prevBtn, nextBtn, dotsEl, doc, labels, signal) {
  const realItems = [...cardsList.querySelectorAll('.cards-list-item')];
  const count = realItems.length;
  const loopEnabled = count > 1;

  const cloneRealSet = () => realItems.map((item) => {
    const clone = item.cloneNode(true);
    clone.classList.add('dp-clone');
    clone.setAttribute('aria-hidden', 'true');
    if ('inert' in clone) clone.inert = true;
    clone.querySelectorAll('a, button').forEach((el) => el.setAttribute('tabindex', '-1'));
    return clone;
  });

  if (loopEnabled) {
    const headFrag = doc.createDocumentFragment();
    cloneRealSet().forEach((clone) => headFrag.appendChild(clone));
    cardsList.insertBefore(headFrag, cardsList.firstChild);

    const tailFrag = doc.createDocumentFragment();
    cloneRealSet().forEach((clone) => tailFrag.appendChild(clone));
    cardsList.appendChild(tailFrag);
  }

  const allItems = [...cardsList.querySelectorAll('.cards-list-item')];

  const getItemOffset = (item) => {
    const itemRect = item.getBoundingClientRect();
    const peek = (cardsList.clientWidth - itemRect.width) / 2;
    return itemRect.left - cardsList.getBoundingClientRect().left + cardsList.scrollLeft - peek;
  };

  let bounds = { lower: 0, upper: 0, setWidth: 0 };
  const computeBounds = () => {
    if (!loopEnabled) return;
    const lower = getItemOffset(allItems[count]);
    const upper = getItemOffset(allItems[count * 2]);
    bounds = { lower, upper, setWidth: upper - lower };
  };

  const scrollToItem = (item) => {
    cardsList.scrollTo({ left: getItemOffset(item), behavior: 'smooth' });
  };

  const buildDots = () => {
    dotsEl.innerHTML = '';
    realItems.forEach((item, i) => {
      const dot = doc.createElement('button');
      dot.type = 'button';
      dot.className = 'dp-scroll-dot';
      if (i === 0) dot.classList.add('is-active');
      dot.setAttribute('aria-label', `${labels.goToCard} ${i + 1}`);
      dot.addEventListener('click', () => scrollToItem(item), { signal });
      dotsEl.appendChild(dot);
    });
  };

  const jumpIfOutsideRealBlock = () => {
    if (!loopEnabled) return;
    if (cardsList.scrollLeft < bounds.lower - 1) {
      cardsList.scrollLeft += bounds.setWidth;
    } else if (cardsList.scrollLeft >= bounds.upper - 1) {
      cardsList.scrollLeft -= bounds.setWidth;
    }
  };

  const updateNav = () => {
    const showNav = loopEnabled && bounds.setWidth > cardsList.clientWidth + 1;
    prevBtn.classList.toggle('is-hidden', !showNav);
    nextBtn.classList.toggle('is-hidden', !showNav);
    dotsEl.classList.toggle('is-hidden', !showNav);
    if (!showNav) return;

    prevBtn.disabled = false;
    nextBtn.disabled = false;

    const step = bounds.setWidth / count;
    const rawIndex = Math.round((cardsList.scrollLeft - bounds.lower) / step);
    const activeIndex = ((rawIndex % count) + count) % count;

    const dots = [...dotsEl.querySelectorAll('.dp-scroll-dot')];
    dots.forEach((dot, i) => dot.classList.toggle('is-active', i === activeIndex));
  };

  const refresh = () => { computeBounds(); updateNav(); };

  const scrollByOneCard = (direction) => {
    const step = realItems[0].getBoundingClientRect().width + 16;
    cardsList.scrollBy({ left: direction * step, behavior: 'smooth' });
  };

  const onSettled = () => {
    jumpIfOutsideRealBlock();
    updateNav();
  };

  buildDots();
  computeBounds();
  if (loopEnabled) cardsList.scrollLeft = bounds.lower;
  updateNav();

  prevBtn.addEventListener('click', () => scrollByOneCard(-1), { signal });
  nextBtn.addEventListener('click', () => scrollByOneCard(1), { signal });

  if ('onscrollend' in window) {
    cardsList.addEventListener('scrollend', onSettled, { signal });
  } else {
    let settleTimer;
    cardsList.addEventListener('scroll', () => {
      clearTimeout(settleTimer);
      settleTimer = setTimeout(onSettled, 120);
    }, { passive: true, signal });
  }
  cardsList.addEventListener('scroll', updateNav, { passive: true, signal });

  let resizeScheduled = false;
  window.addEventListener('resize', () => {
    if (resizeScheduled) return;
    resizeScheduled = true;
    requestAnimationFrame(() => { resizeScheduled = false; refresh(); });
  }, { signal });

  return { updateNav: refresh };
}

export default async function decorate(block) {
  [...block.children].forEach((el) => {
    if (el.classList.contains('dp-built')) el.remove();
  });

  if (block.dpAbortController) block.dpAbortController.abort();
  block.dpAbortController = new AbortController();
  const { signal } = block.dpAbortController;

  const rows = [...block.children];
  const readRowText = (row) => row?.children[0]?.querySelector('p')?.textContent?.trim()
    ?? row?.children[0]?.textContent?.trim()
    ?? row?.textContent?.trim()
    ?? '';

  const debitPrepaid = norm(readRowText(rows[0])) === 'prepaid' ? 'prepaid' : 'debit';
  const categorySlug = extractCategoryFromTag(readRowText(rows[1]));

  rows.forEach((row) => { row.classList.add('dp-source-row'); });

  block.classList.add('debit-prepaid-results');

  const doc = block.ownerDocument;
  const lang = getLang();

  const [, , ph, allCards] = await Promise.all([
    loadCSS(`${window.hlx.codeBasePath}/blocks/card-list/card-list.css`),
    waitForOwnCss(`${window.hlx.codeBasePath}/blocks/debit-prepaid/debit-prepaid.css`),
    fetchPlaceholders(),
    loadCardData(debitPrepaid),
  ]);

  const isTH = lang === 'th';
  const labels = {
    learnMore: ph.cardLearnMore || (isTH ? 'เรียนรู้เพิ่มเติม' : 'Learn more'),
    compare: ph.cardCompare || (isTH ? 'เปรียบเทียบ' : 'Compare'),
    noResultsFound: ph.cardNoResultsFound || (isTH ? 'ไม่พบผลลัพธ์' : 'No Results Found'),
    prevCard: ph.cardPrevious || (isTH ? 'การ์ดก่อนหน้า' : 'Previous card'),
    nextCard: ph.cardNext || (isTH ? 'การ์ดถัดไป' : 'Next card'),
    goToCard: ph.cardGoToCard || (isTH ? 'ไปที่การ์ด' : 'Go to card'),
  };

  const cards = allCards.filter((card) => matchesCategory(card, categorySlug));

  const container = doc.createElement('div');
  container.className = 'dp-card-list-container dp-built';
  block.appendChild(container);

  function restoreCompareState() {
    const selected = window.ccsSelectedCards || [];
    container.querySelectorAll('.dp-compare-btn').forEach((btn) => {
      const isSelected = selected.some((c) => c.name === btn.dataset.cardName);
      btn.classList.toggle('is-comparing', isSelected);
      btn.classList.toggle('disabled', isSelected);
    });
  }

  if (!cards.length) {
    const msg = doc.createElement('p');
    msg.className = 'dp-no-results';
    msg.textContent = labels.noResultsFound;
    container.appendChild(msg);
  } else {
    const blockEl = buildCardBlock(cards, doc, lang, labels);
    addCompareButtons(blockEl, doc, labels);

    const trackWrapper = doc.createElement('div');
    trackWrapper.className = 'dp-track-wrapper';
    const prevBtn = buildArrowButton(doc, 'prev', labels.prevCard);
    const nextBtn = buildArrowButton(doc, 'next', labels.nextCard);
    trackWrapper.appendChild(prevBtn);
    trackWrapper.appendChild(blockEl);
    trackWrapper.appendChild(nextBtn);
    container.appendChild(trackWrapper);

    const dotsEl = buildDotsEl(doc);
    container.appendChild(dotsEl);

    restoreCompareState();

    const cardsList = blockEl.querySelector('.cards-list.dp-track');
    const { updateNav } = initCarousel(cardsList, prevBtn, nextBtn, dotsEl, doc, labels, signal);
    requestAnimationFrame(updateNav);
  }

  block.addEventListener('click', (e) => {
    const btn = e.target.closest('.dp-compare-btn');
    if (!btn) return;
    e.preventDefault();

    window.ccsSelectedCards = window.ccsSelectedCards || [];
    const { cardName, cardImage, cardId } = btn.dataset;
    if (btn.classList.contains('is-comparing')) return;

    if (window.ccsSelectedCards.length >= MAX_COMPARE) {
      document.dispatchEvent(new CustomEvent('credit-card-compare-limit-reached'));
      return;
    }
    window.ccsSelectedCards.push({ id: cardId, name: cardName, image: cardImage });

    restoreCompareState();

    document.dispatchEvent(new CustomEvent('credit-card-compare-updated', {
      detail: { cards: window.ccsSelectedCards },
    }));
  }, { signal });

  doc.addEventListener('credit-card-compare-updated', restoreCompareState, { signal });
}
