/**
 * Privacy Modal Block
 *
 * Displays a privacy notice pop-up before redirecting the user to an
 * external or internal page. The modal includes:
 *  - A scrollable privacy text section (scroll is mandatory before acceptance)
 *  - An acknowledgement checkbox (enabled only after full scroll)
 *  - A confirmation CTA button (enabled only after checkbox is checked)
 *
 * Cookie behaviour:
 *  - On acceptance the cookie is stored for COOKIE_DURATION_DAYS days.
 *  - While the cookie is valid the modal will not reappear on the same page.
 *  - If the user closes or dismisses the modal without accepting, it will
 *    reappear on the next visit.
 *
 * External-host detection:
 *  - The block reads a data attribute (`data-external-hosts`) OR falls back
 *    to scanning the page for links whose hostname differs from the current
 *    origin. When a matching CTA is clicked the modal intercepts the
 *    navigation, shows itself, and — once the user agrees — redirects.
 */

const COOKIE_DURATION_DAYS = 30;
const COOKIE_NAME = 'privacy-modal-accepted';

/* -------------------------------------------------------------------------
 * Cookie utilities
 * ---------------------------------------------------------------------- */

/**
 * Sets a cookie with a given name, value, and expiry (in days).
 * @param {string} name
 * @param {string} value
 * @param {number} days
 */
function setCookie(name, value, days) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

/**
 * Reads the value of a cookie by name.
 * @param {string} name
 * @returns {string|null}
 */
function getCookie(name) {
  const encoded = encodeURIComponent(name);
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${encoded}=`));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}

/* -------------------------------------------------------------------------
 * DOM helpers
 * ---------------------------------------------------------------------- */

/**
 * Creates an element with optional className and textContent.
 * @param {string} tag
 * @param {Object} [opts]
 * @param {string} [opts.className]
 * @param {string} [opts.textContent]
 * @param {Object} [opts.attrs]
 * @returns {HTMLElement}
 */
function createElement(tag, { className, textContent, attrs = {} } = {}) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (textContent !== undefined) el.textContent = textContent;
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}

/* -------------------------------------------------------------------------
 * Scroll detection
 * ---------------------------------------------------------------------- */

/**
 * Returns true when the scrollable element has been scrolled to (or very
 * close to) its bottom edge.
 * @param {HTMLElement} el
 * @returns {boolean}
 */
function isScrolledToBottom(el) {
  return el.scrollHeight - el.scrollTop - el.clientHeight < 8;
}

/* -------------------------------------------------------------------------
 * Modal builder
 * ---------------------------------------------------------------------- */

/**
 * Builds and returns the full modal DOM structure.
 * @param {Object} config
 * @param {string} config.title
 * @param {string} config.privacyHTML
 * @param {string} config.checkboxLabel
 * @param {string} config.ctaLabel
 * @param {Function} config.onAgree   Called when user agrees.
 * @param {Function} config.onClose   Called when user dismisses.
 * @returns {{ overlay: HTMLElement, modal: HTMLElement, scrollBody: HTMLElement,
 *             checkbox: HTMLInputElement, ctaBtn: HTMLButtonElement }}
 */
function buildModal({
  title, privacyHTML, checkboxLabel, ctaLabel, onAgree, onClose,
}) {
  /* Overlay */
  const overlay = createElement('div', {
    className: 'privacy-modal-overlay',
    attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'privacy-modal-title' },
  });

  /* Modal container */
  const modal = createElement('div', { className: 'privacy-modal-container' });

  /* Header */
  const header = createElement('div', { className: 'privacy-modal-header' });
  const titleEl = createElement('h2', {
    className: 'privacy-modal-title',
    textContent: title,
    attrs: { id: 'privacy-modal-title' },
  });
  const closeBtn = createElement('button', {
    className: 'privacy-modal-close',
    attrs: {
      type: 'button',
      'aria-label': 'Close privacy notice',
      title: 'Close',
    },
  });
  closeBtn.innerHTML = '&times;';
  header.append(titleEl, closeBtn);

  /* Scrollable body */
  const scrollBody = createElement('div', {
    className: 'privacy-modal-body',
    attrs: { tabindex: '0', 'aria-label': 'Privacy notice content. Scroll to read all.' },
  });
  scrollBody.innerHTML = privacyHTML;

  /* Scroll hint */
  const scrollHint = createElement('div', {
    className: 'privacy-modal-scroll-hint',
    textContent: '↓ Please he scroll down to read the full notice',
  });

  /* Footer */
  const footer = createElement('div', { className: 'privacy-modal-footer' });

  /* Checkbox row */
  const checkboxRow = createElement('div', { className: 'privacy-modal-checkbox-row' });
  const checkbox = createElement('input', {
    attrs: {
      type: 'checkbox',
      id: 'privacy-modal-checkbox',
      disabled: 'true',
      'aria-label': checkboxLabel,
    },
  });
  const checkboxLabelEl = createElement('label', {
    className: 'privacy-modal-checkbox-label',
    textContent: checkboxLabel,
    attrs: { for: 'privacy-modal-checkbox' },
  });
  checkboxRow.append(checkbox, checkboxLabelEl);

  /* CTA */
  const ctaBtn = createElement('button', {
    className: 'privacy-modal-cta',
    textContent: ctaLabel,
    attrs: { type: 'button', disabled: 'true' },
  });

  footer.append(checkboxRow, ctaBtn);
  modal.append(header, scrollHint, scrollBody, footer);
  overlay.append(modal);

  /* -----------------------------------------------------------------------
   * Interaction wiring
   * -------------------------------------------------------------------- */

  /* Enable checkbox only after user has scrolled to the bottom */
  function onScroll() {
    if (isScrolledToBottom(scrollBody)) {
      checkbox.removeAttribute('disabled');
      scrollHint.classList.add('privacy-modal-scroll-hint-hidden');
      scrollBody.removeEventListener('scroll', onScroll);
    }
  }
  scrollBody.addEventListener('scroll', onScroll);

  /* If the content is short enough that no scrolling is needed, unlock immediately */
  requestAnimationFrame(() => {
    if (isScrolledToBottom(scrollBody)) {
      checkbox.removeAttribute('disabled');
      scrollHint.classList.add('privacy-modal-scroll-hint-hidden');
    }
  });

  /* Enable CTA only after checkbox is checked */
  checkbox.addEventListener('change', () => {
    if (checkbox.checked) {
      ctaBtn.removeAttribute('disabled');
    } else {
      ctaBtn.setAttribute('disabled', 'true');
    }
  });

  /* CTA click → agree */
  ctaBtn.addEventListener('click', () => {
    if (!checkbox.checked) return;
    onAgree();
  });

  /* Close button → dismiss */
  closeBtn.addEventListener('click', () => onClose());

  /* Keyboard: Escape → dismiss */
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') onClose();
  });

  return {
    overlay, modal, scrollBody, checkbox, ctaBtn,
  };
}

/* -------------------------------------------------------------------------
 * Show / hide helpers
 * ---------------------------------------------------------------------- */

/**
 * Opens the modal (appends to document body if not already attached).
 * @param {HTMLElement} overlay
 */
function openModal(overlay) {
  if (!overlay.isConnected) document.body.appendChild(overlay);
  // Allow paint before adding visible class for CSS transition
  requestAnimationFrame(() => {
    overlay.classList.add('privacy-modal-overlay-visible');
  });
  document.body.classList.add('privacy-modal-open');
  overlay.focus();
}

/**
 * Closes the modal with a CSS transition, then removes it from the DOM.
 * @param {HTMLElement} overlay
 */
function closeModal(overlay) {
  overlay.classList.remove('privacy-modal-overlay-visible');
  document.body.classList.remove('privacy-modal-open');
  overlay.addEventListener('transitionend', () => {
    overlay.remove();
  }, { once: true });
}

/* -------------------------------------------------------------------------
 * External-host detection
 * ---------------------------------------------------------------------- */

/**
 * Checks whether a given URL is considered external compared to the
 * current page's origin.
 * Returns false for relative paths, hash links, and same-origin URLs.
 * @param {string} href
 * @returns {boolean}
 */
function isExternalUrl(href) {
  if (!href || href.startsWith('#') || href.startsWith('/') || href.startsWith('./') || href.startsWith('../')) {
    return false;
  }
  try {
    const url = new URL(href);
    return url.hostname !== window.location.hostname;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------
 * Main decorate function
 * ---------------------------------------------------------------------- */

/**
 * Decorates the privacy-modal block.
 *
 * Block row layout (authored in Universal Editor / document):
 *   Row 0 → title          (text)
 *   Row 1 → privacyText    (richtext)
 *   Row 2 → checkboxLabel  (text)
 *   Row 3 → enableModal    (checkbox / boolean)
 *   Row 4 → linkText / ctaLabel  (from _button-fields.json)
 *
 * @param {HTMLElement} block
 */
export default function decorate(block) {
  const rows = [...block.children];

  const title = rows[0]?.textContent.trim() || '';
  const privacyHTML = rows[1]?.innerHTML.trim() || '';
  const checkboxLabel = rows[2]?.textContent.trim() || 'I acknowledge the purposes and details on collection, use and disclosure of personal data of the Bank stated above.';

  /* enableModal checkbox — Row 3.  'on' / 'true' / 'checked' = enabled */
  const enableModalText = rows[3]?.textContent.trim().toLowerCase() || '';
  const enableModal = enableModalText === 'true' || enableModalText === 'on' || enableModalText === 'checked' || enableModalText === '';

  /* ctaLabel — Row 4 (linkText cell from _button-fields.json) */
  const ctaLabel = rows[4]?.textContent.trim() || 'Agree';

  /* Hide the raw block content — the modal is rendered independently */
  block.style.display = 'none';

  /* If modal is disabled by author, stop here */
  if (!enableModal) return;

  /* If the user already accepted (cookie present), skip the modal entirely */
  if (getCookie(COOKIE_NAME) === 'true') return;

  /* ------------------------------------------------------------------
   * Build the modal once and cache it
   * ------------------------------------------------------------------ */
  let pendingHref = null;

  function handleAgree() {
    setCookie(COOKIE_NAME, 'true', COOKIE_DURATION_DAYS);
    closeModal(overlay); // eslint-disable-line no-use-before-define

    if (pendingHref) {
      window.location.href = pendingHref;
      pendingHref = null;
    }
  }

  function handleClose() {
    closeModal(overlay); // eslint-disable-line no-use-before-define
    pendingHref = null;
  }

  const { overlay } = buildModal({
    title,
    privacyHTML,
    checkboxLabel,
    ctaLabel,
    onAgree: handleAgree,
    onClose: handleClose,
  });

  /* ------------------------------------------------------------------
   * Show modal on page load
   * ------------------------------------------------------------------ */
  // Show the modal immediately on page load since no cookie exists
  openModal(overlay);

  /* ------------------------------------------------------------------
   * Intercept external-link clicks across the whole page
   * ------------------------------------------------------------------ */
  document.addEventListener('click', (e) => {
    /* Only intercept anchor tags */
    const anchor = e.target.closest('a[href]');
    if (!anchor) return;

    const href = anchor.getAttribute('href');
    /* isExternalUrl already handles #, relative paths, and same-origin */
    if (!isExternalUrl(href)) return;

    /* If cookie already set, let the link work normally */
    if (getCookie(COOKIE_NAME) === 'true') return;

    /* Show modal and remember the destination */
    e.preventDefault();
    pendingHref = href;

    openModal(overlay);
  }, true /* capture phase so we intercept before other handlers */);
}
