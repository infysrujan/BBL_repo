/**
 * Login panel behavior: shared header backdrop, state, open/close.
 * Shared by header (and any other consumer) while login.js owns only DOM structure.
 */

import {
  acquireHeaderNavBackdrop,
  releaseHeaderNavBackdrop,
  NAV_BACKDROP_LOGIN,
} from '../../scripts/utils/header-backdrop.js';

const isDesktop = window.matchMedia('(min-width: 1025px)');

/**
 * Returns state for a login wrapper (button, panel, header nav root).
 * @param {HTMLElement} wrapper Element with class .login-wrapper
 * @returns {{ button: HTMLButtonElement, panel: HTMLElement, headerNav: HTMLElement|null }|null}
 */
export function getLoginState(wrapper) {
  if (!wrapper) return null;
  const button = wrapper.querySelector('.login-button');
  const panel = wrapper.querySelector('.login-panel');
  if (!button || !panel) return null;
  const headerNav = wrapper.closest('.header-nav');
  return { button, panel, headerNav };
}

/**
 * Opens the login panel and applies desktop nav state if needed.
 * @param {{ button: HTMLButtonElement, panel: HTMLElement, headerNav: HTMLElement|null }} state
 */
export function openPanel(state) {
  const { button, panel, headerNav } = state;
  button.setAttribute('aria-expanded', 'true');
  panel.setAttribute('aria-hidden', 'false');
  acquireHeaderNavBackdrop(headerNav, NAV_BACKDROP_LOGIN);

  if (isDesktop.matches) {
    const mainNavDesktop = document.querySelector('.main-nav-desktop');
    const topNav = document.querySelector('.header-nav > .top-nav');
    if (mainNavDesktop) mainNavDesktop.classList.add('is-scrolled');
    if (topNav) topNav.classList.add('is-hidden');
  }
}

/**
 * Closes the login panel and restores desktop nav state when appropriate.
 * @param {{ button: HTMLButtonElement, panel: HTMLElement, headerNav: HTMLElement|null }} state
 */
export function closePanel(state) {
  const { button, panel, headerNav } = state;
  button.setAttribute('aria-expanded', 'false');
  panel.setAttribute('aria-hidden', 'true');
  releaseHeaderNavBackdrop(headerNav, NAV_BACKDROP_LOGIN);

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
    const wrapper = btn.closest('.login-wrapper');
    const state = getLoginState(wrapper);
    if (state) closePanel(state);
  });
}

/**
 * Closes every open login panel (e.g. before opening megamenu).
 */
export function closeAllLoginPanels() {
  document.querySelectorAll('.login-button[aria-expanded="true"]').forEach((btn) => {
    const wrapper = btn.closest('.login-wrapper');
    const state = getLoginState(wrapper);
    if (state) closePanel(state);
  });
}
