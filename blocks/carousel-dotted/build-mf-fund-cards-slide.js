import { loadCSS } from '../../scripts/aem.js';
import { fetchConfigs } from '../../scripts/config.js';
import { fetchPlaceholders } from '../../scripts/placeholder.js';
import { getLang, moveInstrumentation } from '../../scripts/scripts.js';
import decorateCardList from '../card-list/card-list.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

function norm(str) {
  return (str || '').toString().toLowerCase().trim().replace(/\s+/g, '-');
}

/**
 * Extract the last URL path segment and normalise it as a category slug.
 * e.g. /en/mutual-funds/fixed-income-funds  →  "fixed-income-funds"
 */
function extractCategoryFromPath(pathname) {
  const segments = pathname.split('/').filter(Boolean);
  return norm(segments[segments.length - 1] || '');
}

/**
 * Loose category match that handles plural/singular differences.
 * e.g. page slug "fixed-income-funds" matches FundCategory "fixed-income-fund"
 */
function matchesCategory(fundCategory, pageCategory) {
  const fc = norm(fundCategory);
  const pc = norm(pageCategory);
  return fc === pc || pc.includes(fc) || fc.includes(pc);
}

// ── Data fetching ──────────────────────────────────────────────────────────────

async function loadFundsData() {
  try {
    const configs = await fetchConfigs();
    // TODO: remove dummy override before go-live
    // eslint-disable-next-line no-unused-vars
    const url = '/blocks/mf-results/dummy.json' || configs.mfFundsDataUrl;
    const resp = await fetch(url);
    if (resp.ok) {
      const json = await resp.json();
      return json.data?.mutualFundsList?.items || [];
    }
  } catch {
    // fall through to dummy fallback
  }

  try {
    const resp = await fetch(`${window.hlx.codeBasePath}/blocks/mf-results/dummy.json`);
    if (!resp.ok) return [];
    const json = await resp.json();
    return json.data?.mutualFundsList?.items || [];
  } catch {
    return [];
  }
}

// ── Card block builder ─────────────────────────────────────────────────────────

function makeCell(doc, content) {
  const cell = doc.createElement('div');
  if (content instanceof Node) cell.appendChild(content);
  else if (content !== null && content !== undefined) cell.textContent = String(content);
  return cell;
}

function makeRow(doc, ...contents) {
  const row = doc.createElement('div');
  contents.forEach((c) => row.appendChild(makeCell(doc, c)));
  return row;
}

/**
 * Build a card-list block element from fund items.
 *
 * Cell layout matches the current card-list.js decorate() expectations:
 *   0  image               6  actionTypeText ('default')
 *   1  promoTag            7  defaultButton (link <a>)
 *   2  title               8  multipleDownloadLinks (null)
 *   3  subtitle            9  imageLayout  (base)
 *   4  description        10  enableTitleUnderline
 *   5  remark (logo)      11  isCardClickable
 *                         12  cardLink
 *                         13  enableOverlayModal
 */
function buildFundCardsBlock(funds, doc, readMoreLabel) {
  const block = doc.createElement('div');
  block.className = 'card-list mf-card-list block';
  block.dataset.blockName = 'card-list';

  // First 3 rows are layout config consumed by card-list.js decorate()
  block.appendChild(makeRow(doc, 'scrollable'));
  block.appendChild(makeRow(doc, 'center'));
  block.appendChild(makeRow(doc, 'cards-3'));

  // eslint-disable-next-line no-underscore-dangle
  const getImgUrl = (val) => val?._publishUrl || (typeof val === 'string' ? val : '');

  funds.forEach((fund) => {
    const name = fund.FundName || '';
    // eslint-disable-next-line no-underscore-dangle
    const readMoreUrl = fund._path || '#';
    const productId = fund.ProductID || name;
    const compareEnabled = fund.CompareButton === 'true';

    const fundImgSrc = getImgUrl(fund.FundImage);
    const logoSrc = getImgUrl(fund.LogoImage) || getImgUrl(fund.ManagementCompanyLogo);
    const imgSrc = fundImgSrc || logoSrc;

    // Cell 0 — fund image
    const imgCell = doc.createElement('div');
    if (imgSrc) {
      const img = doc.createElement('img');
      img.src = imgSrc;
      img.alt = name;
      img.loading = 'lazy';
      imgCell.appendChild(img);
    }

    // Cell 2 — title
    const titleCell = doc.createElement('div');
    const h3 = doc.createElement('h3');
    h3.textContent = name;
    h3.dataset.cardId = productId;
    h3.dataset.compareEnabled = compareEnabled ? 'true' : 'false';
    titleCell.appendChild(h3);

    // Cell 4 — description
    const descCell = doc.createElement('div');
    if (fund.FundDescription) {
      const p = doc.createElement('p');
      p.textContent = fund.FundDescription;
      descCell.appendChild(p);
    }

    // Cell 5 — remark (logo)
    const remarkCell = doc.createElement('div');
    if (logoSrc) {
      const logo = doc.createElement('img');
      logo.src = logoSrc;
      logo.alt = name;
      logo.loading = 'lazy';
      logo.className = 'mfr-logo';
      remarkCell.appendChild(logo);
    }

    // Cell 7 — button
    const btnCell = doc.createElement('div');
    const link = doc.createElement('a');
    link.href = readMoreUrl;
    link.textContent = readMoreLabel;
    btnCell.appendChild(link);

    block.appendChild(makeRow(
      doc,
      imgCell,    // 0  image
      null,       // 1  promoTag
      titleCell,  // 2  title
      null,       // 3  subtitle
      descCell,   // 4  description
      remarkCell, // 5  remark (logo)
      'default',  // 6  actionTypeText
      btnCell,    // 7  defaultButton
      null,       // 8  multipleDownloadLinks
      'default',  // 9  imageLayout  (base)
      'false',    // 10 enableTitleUnderline
      'false',    // 11 isCardClickable
      null,       // 12 cardLink
      'false',    // 13 enableOverlayModal
    ));
  });

  return block;
}

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * Build a carousel slide that shows mutual fund cards filtered by the
 * current page's URL category slug.
 *
 * Used by carousel-dotted.js when slideType === 'mfCardListCarousel'.
 */
export default async function buildMfFundCardsSlide(row, index) {
  const doc = row.ownerDocument;

  const slide = doc.createElement('div');
  slide.className = 'carousel-dotted-item mf-fund-cards-item';
  slide.dataset.index = index;
  moveInstrumentation(row, slide);

  const pageCategory = extractCategoryFromPath(window.location.pathname);
  // eslint-disable-next-line no-console
  console.log('[mfCardListCarousel] page path:', window.location.pathname, '| category:', pageCategory);

  // Load card-list & mf-results styles so cards render correctly
  await Promise.all([
    loadCSS(`${window.hlx.codeBasePath}/blocks/card-list/card-list.css`),
    loadCSS(`${window.hlx.codeBasePath}/blocks/mf-results/mf-results.css`),
  ]);

  const lang = getLang();
  const isTH = lang === 'th';
  const [allFunds, ph] = await Promise.all([loadFundsData(), fetchPlaceholders()]);

  const readMoreLabel = ph.mfReadMoreText || (isTH ? 'อ่านเพิ่มเติม' : 'Read more');
  const compareLabel = ph.mfCompareText || (isTH ? 'เปรียบเทียบ' : 'Compare');
  const noResultsLabel = ph.mfNoResultsText || (isTH ? 'ไม่พบผลลัพธ์' : 'No results found');

  const filteredFunds = allFunds.filter(
    (fund) => matchesCategory(fund.FundCategory || '', pageCategory),
  );

  // eslint-disable-next-line no-console
  console.log('[mfCardListCarousel] category:', pageCategory, '| matched funds:', filteredFunds.length);

  if (!filteredFunds.length) {
    const msg = doc.createElement('p');
    msg.className = 'mfr-no-results';
    msg.textContent = noResultsLabel;
    slide.appendChild(msg);
    return slide;
  }

  const blockEl = buildFundCardsBlock(filteredFunds, doc, readMoreLabel);
  slide.appendChild(blockEl);
  decorateCardList(blockEl);

  // Inject compare buttons (mirrors addCompareButtons in mf-results.js)
  blockEl.querySelectorAll('.cards-list-button').forEach((wrapper) => {
    const item = wrapper.closest('.cards-list-item');
    const h3 = item?.querySelector('h3');
    if (h3?.dataset?.compareEnabled === 'false') return;
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = 'mfr-compare-btn';
    btn.textContent = compareLabel;
    btn.dataset.cardName = h3?.textContent?.trim() ?? '';
    btn.dataset.cardId = h3?.dataset?.cardId ?? '';
    btn.dataset.cardImage = item?.querySelector('img')?.src ?? '';
    wrapper.appendChild(btn);
  });

  return slide;
}
