import { moveInstrumentation } from '../../scripts/scripts.js';
import { createModalShell, showModal, hideModal } from '../../scripts/utils/modal.js';
import createSmartImage from '../../scripts/utils/smartcrop-helper.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const BANNER_COOKIE = 'bbl-welcome-banner';
const COOKIE_DURATION_MS = 20 * 60 * 1000; // 20 minutes

// ─── Storage helpers (cookie + sessionStorage fallback) ───────────────────────

/**
 * Reads a timestamp from cookie first, then sessionStorage as fallback.
 * Silently returns 0 on any SecurityError (strict privacy modes / Incognito).
 * @returns {number} Unix timestamp in ms, or 0 if not found.
 */
function readTimestamp() {
  try {
    const key = encodeURIComponent(BANNER_COOKIE);
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${key}=([^;]*)`));
    const ts = match ? Number(match[1]) : 0;
    if (ts) return ts;
  } catch { /* noop */ }

  try {
    return Number(sessionStorage.getItem(BANNER_COOKIE)) || 0;
  } catch { /* noop */ }

  return 0;
}

/**
 * Persists the current timestamp to both cookie and sessionStorage.
 * Silently ignores write failures in restrictive environments.
 */
function writeTimestamp() {
  const ts = Date.now();

  try {
    const expires = new Date(ts + COOKIE_DURATION_MS).toUTCString();
    const key = encodeURIComponent(BANNER_COOKIE);
    document.cookie = `${key}=${ts}; expires=${expires}; path=/; SameSite=Lax`;
  } catch { /* noop */ }

  try {
    sessionStorage.setItem(BANNER_COOKIE, String(ts));
  } catch { /* noop */ }
}

/**
 * Returns the remaining milliseconds within the suppression window, or 0 if expired / unset.
 * @returns {number}
 */
function getRemainingMs() {
  const ts = readTimestamp();
  if (!ts) return 0;
  return Math.max(0, COOKIE_DURATION_MS - (Date.now() - ts));
}

// ─── Date-validity guard ──────────────────────────────────────────────────────

/**
 * Returns true if the current date falls within [startStr, endStr].
 * Boundaries are inclusive; a missing boundary is treated as open.
 * @param {string|undefined} startStr
 * @param {string|undefined} endStr
 * @returns {boolean}
 */
function isDateActive(startStr, endStr) {
  const now = Date.now();
  if (startStr) {
    const start = Date.parse(startStr);
    if (!Number.isNaN(start) && now < start) return false;
  }
  if (endStr) {
    const end = Date.parse(endStr);
    if (!Number.isNaN(end) && now > end) return false;
  }
  return true;
}

// ─── CTA extraction ───────────────────────────────────────────────────────────

/**
 * Maps a single anchor element to a plain CTA descriptor object.
 * @param {HTMLAnchorElement} a
 * @returns {{ href: string, label: string, target: string, sourceAnchor: HTMLAnchorElement }}
 */
function anchorToCtaData(a) {
  return {
    href: a.getAttribute('href') || '#',
    label: a.textContent.trim(),
    target: a.getAttribute('target') || '',
    sourceAnchor: a,
  };
}

/**
 * Extracts CTA data from the block's button rows.
 * Falls back to sibling `.default-content-wrapper` links when no rows contain anchors.
 * @param {Element[]} buttonRows
 * @param {Element}   placeholder
 * @returns {Array}
 */
function extractCtas(buttonRows, placeholder) {
  const fromRows = buttonRows
    .map((row) => row?.querySelector('a'))
    .filter(Boolean)
    .map(anchorToCtaData);

  if (fromRows.length) return fromRows;

  const fallbackAnchors = [
    ...placeholder.closest('.section')?.querySelectorAll('.default-content-wrapper a') ?? [],
  ];
  return fallbackAnchors.map(anchorToCtaData);
}

// ─── DOM builders ─────────────────────────────────────────────────────────────

/**
 * Builds the media container element.
 * @param {Document}       doc
 * @param {Element|null}   picture
 * @returns {HTMLElement}
 */
function buildMedia(doc, picture) {
  const el = doc.createElement('div');
  el.className = 'welcome-banner-media';
  if (picture) el.appendChild(picture);
  return el;
}

/**
 * Builds a single CTA anchor with navigation and dismiss logic.
 * @param {Document} doc
 * @param {object}   ctaData
 * @param {Function} dismiss
 * @returns {HTMLAnchorElement}
 */
function buildCtaAnchor(doc, ctaData, dismiss) {
  const a = doc.createElement('a');
  a.className = 'welcome-banner-cta';
  a.href = ctaData.href;
  a.textContent = ctaData.label;

  if (ctaData.target) a.setAttribute('target', ctaData.target);
  if (ctaData.sourceAnchor) moveInstrumentation(ctaData.sourceAnchor, a);

  a.addEventListener('click', (e) => {
    e.preventDefault();
    const { href, target } = ctaData;
    dismiss();
    if (!href || href === '#') return;
    if (target === '_blank') {
      window.open(href, '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = href;
    }
  });

  return a;
}

/**
 * Builds the CTA container with all action anchors.
 * @param {Document} doc
 * @param {Array}    ctaList
 * @param {Function} dismiss
 * @returns {HTMLElement}
 */
function buildCtas(doc, ctaList, dismiss) {
  const el = doc.createElement('div');
  el.className = 'welcome-banner-ctas';
  ctaList.forEach((ctaData) => el.appendChild(buildCtaAnchor(doc, ctaData, dismiss)));
  return el;
}

// ─── Block entry point ────────────────────────────────────────────────────────

export default function decorate(block) {
  const [
    desktopImgRow, mobileImgRow, isActiveRow, publishDateRow, unpublishDateRow, ...buttonRows
  ] = [...block.children];

  const doc = block.ownerDocument;

  // Replace the block with an invisible placeholder immediately so AEM
  // instrumentation is preserved and the section layout is unaffected.
  const placeholder = doc.createElement('div');
  placeholder.className = 'welcome-banner-placeholder';
  moveInstrumentation(block, placeholder);
  block.replaceWith(placeholder);

  // ── Activation guards ──────────────────────────────────────────────────────
  if (isActiveRow?.textContent?.trim().toLowerCase() === 'false') return;
  const publishDate = publishDateRow?.textContent?.trim();
  const unpublishDate = unpublishDateRow?.textContent?.trim();
  if (!isDateActive(publishDate, unpublishDate)) return;
  if (getRemainingMs() > 0) return;

  // ── Build image ────────────────────────────────────────────────────────────
  const pictureDesktop = desktopImgRow?.querySelector('picture');
  const pictureMobile = mobileImgRow?.querySelector('picture');
  const picture = (pictureDesktop || pictureMobile)
    ? createSmartImage(pictureDesktop, pictureMobile, null)
    : null;

  // ── Build modal shell ──────────────────────────────────────────────────────
  const { overlay, dialog, closeBtn } = createModalShell({
    overlayClass: 'welcome-banner-overlay',
    dialogClass: 'welcome-banner-dialog',
    closeBtnClass: 'welcome-banner-close',
    ariaLabel: 'Welcome banner',
    closeBtnAriaLabel: 'Close welcome banner',
  });

  const dismiss = () => {
    writeTimestamp();
    hideModal(overlay, 'welcome-banner-overlay-visible', () => {
      doc.body.classList.remove('modal-open');
    });
  };

  closeBtn.addEventListener('click', dismiss);

  // ── Assemble dialog ────────────────────────────────────────────────────────
  dialog.append(
    closeBtn,
    buildMedia(doc, picture),
    buildCtas(doc, extractCtas(buttonRows, placeholder), dismiss),
  );

  // ── Show banner ────────────────────────────────────────────────────────────
  // Write the timestamp immediately so the 20-minute suppression window starts.
  writeTimestamp();
  doc.body.classList.add('modal-open');
  showModal(overlay, 'welcome-banner-overlay-visible');
}
