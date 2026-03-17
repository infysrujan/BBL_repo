/**
 * Login panel behavior: overlay, state, open/close.
 * Shared by header (and any other consumer) while login.js owns only DOM structure.
 */

const isDesktop = window.matchMedia('(min-width: 1025px)');

/**
 * Creates the login overlay element and appends it to body.
 * @returns {HTMLDivElement}
 */
export function createOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'login-overlay';
  document.body.appendChild(overlay);
  return overlay;
}

/**
 * Returns state for a login wrapper (button, panel, overlay). Creates and assigns
 * an overlay when missing (e.g. for cloned blocks). Caller may attach overlay ref
 * via wrapper._loginOverlay.
 * @param {HTMLElement} wrapper Element with class .login-wrapper
 * @returns {{ button: HTMLButtonElement, panel: HTMLElement, overlay: HTMLElement }|null}
 */
export function getLoginState(wrapper) {
  if (!wrapper) return null;
  const button = wrapper.querySelector('.login-button');
  const panel = wrapper.querySelector('.login-panel');
  if (!button || !panel) return null;
  let overlay = wrapper.loginOverlay;
  if (!overlay) {
    overlay = createOverlay();
    wrapper.loginOverlay = overlay;
  }
  return { button, panel, overlay };
}

/**
 * Opens the login panel and applies desktop nav state if needed.
 * @param {{ button: HTMLButtonElement, panel: HTMLElement, overlay: HTMLElement }} state
 */
export function openPanel(state) {
  const { button, panel, overlay } = state;
  button.setAttribute('aria-expanded', 'true');
  panel.setAttribute('aria-hidden', 'false');
  overlay.classList.add('is-active');
  document.body.classList.add('login-panel-open');

  if (isDesktop.matches) {
    const mainNavDesktop = document.querySelector('.main-nav-desktop');
    const topNav = document.querySelector('.header-nav > .top-nav');
    if (mainNavDesktop) mainNavDesktop.classList.add('is-scrolled');
    if (topNav) topNav.classList.add('is-hidden');
  }
}

/**
 * Closes the login panel and restores desktop nav state when appropriate.
 * @param {{ button: HTMLButtonElement, panel: HTMLElement, overlay: HTMLElement }} state
 */
export function closePanel(state) {
  const { button, panel, overlay } = state;
  button.setAttribute('aria-expanded', 'false');
  panel.setAttribute('aria-hidden', 'true');
  overlay.classList.remove('is-active');
  document.body.classList.remove('login-panel-open');

  if (isDesktop.matches) {
    const mainNavDesktop = document.querySelector('.main-nav-desktop');
    const topNav = document.querySelector('.header-nav > .top-nav');
    const topNavHeight = topNav ? topNav.getBoundingClientRect().height : 0;
    const hasMegamenuActive = document.querySelector('.main-nav-item.is-active');

    if (!hasMegamenuActive && window.scrollY <= topNavHeight) {
      if (mainNavDesktop) mainNavDesktop.classList.remove('is-scrolled');
      if (topNav) topNav.classList.remove('is-hidden');
    }
  }
}

/**
 * Closes any other open login panels (single-open behavior).
 * @param {HTMLButtonElement} currentButton
 */
export function closeOtherLoginPanels(currentButton) {
  document.querySelectorAll('.login-button[aria-expanded="true"]').forEach((btn) => {
    if (btn === currentButton) return;
    btn.setAttribute('aria-expanded', 'false');
    btn.closest('.login-wrapper')
      ?.querySelector('.login-panel')
      ?.setAttribute('aria-hidden', 'true');
  });
  document.querySelectorAll('.login-overlay.is-active').forEach((el) => {
    el.classList.remove('is-active');
  });
}
