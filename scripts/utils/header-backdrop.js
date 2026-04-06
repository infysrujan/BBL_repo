/**
 * Shared `.header-backdrop` inside `.header-nav` for mobile drawer, megamenu, and login.
 * Reference-counted visibility and body scroll lock.
 */

export const NAV_BACKDROP_MOBILE = 'mobile-nav';
export const NAV_BACKDROP_MEGAMENU = 'megamenu';
export const NAV_BACKDROP_LOGIN = 'login';

/**
 * @param {HTMLElement} headerNav
 * @returns {HTMLDivElement}
 */
export function ensureHeaderNavBackdrop(headerNav) {
  let el = headerNav.querySelector('.header-backdrop');
  if (!el) {
    el = document.createElement('div');
    el.className = 'header-backdrop';
    el.setAttribute('aria-hidden', 'true');
    headerNav.insertBefore(el, headerNav.firstChild);
  }
  return el;
}

/**
 * @param {HTMLElement} headerNav
 * @param {string} reason
 */
export function acquireHeaderNavBackdrop(headerNav, reason) {
  if (!headerNav) return;
  if (!headerNav.navBackdropReasons) headerNav.navBackdropReasons = new Set();
  const wasEmpty = headerNav.navBackdropReasons.size === 0;
  headerNav.navBackdropReasons.add(reason);
  if (wasEmpty) {
    headerNav.bodyOverflowBeforeNavBackdrop = document.body.style.overflowY;
    document.body.style.overflowY = 'hidden';
  }
  const overlay = ensureHeaderNavBackdrop(headerNav);
  overlay.classList.add('is-visible');
  overlay.setAttribute('aria-hidden', 'false');
}

/**
 * @param {HTMLElement} headerNav
 * @param {string} reason
 */
export function releaseHeaderNavBackdrop(headerNav, reason) {
  if (!headerNav || !headerNav.navBackdropReasons) return;
  headerNav.navBackdropReasons.delete(reason);
  if (headerNav.navBackdropReasons.size === 0) {
    document.body.style.overflowY = headerNav.bodyOverflowBeforeNavBackdrop || '';
    headerNav.bodyOverflowBeforeNavBackdrop = undefined;
    const overlay = headerNav.querySelector('.header-backdrop');
    if (overlay) {
      overlay.classList.remove('is-visible');
      overlay.setAttribute('aria-hidden', 'true');
    }
  }
}
