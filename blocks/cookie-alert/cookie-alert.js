/**
 * Cookie Alert Block
 *
 * Shows a fixed bottom banner asking for cookie consent.
 * - "Cookies setting" opens the cookie-modal fragment as an overlay.
 * - "Accept all cookies" stores all consent cookies and hides the banner.
 * - The banner is hidden once ConsentAlert cookie is already set.
 */

import { loadFragment } from '../fragment/fragment.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

const COOKIE_DURATION_DAYS = 30;
const COOKIE_CONSENT = 'ConsentAlert';
const COOKIE_ANALYTIC = 'AnalysisCookie';
const COOKIE_ADVERTISING = 'AdvertisingCookie';
const CONSENT_SAVED_EVENT = 'cookie:consent-saved';
const MODAL_PROMISE_KEY = 'cookieModalLoadPromise';
const MODAL_PATH_KEY = 'cookieModalPath';

function setCookie(name, value, days) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function getCookie(name) {
  const encoded = encodeURIComponent(name);
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${encoded}=`));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}

function copyAnchorAttributes(anchor, element) {
  ['title', 'aria-label'].forEach((attribute) => {
    const value = anchor?.getAttribute(attribute);
    if (value) element.setAttribute(attribute, value);
  });
}

function dispatchConsentSaved(preferences) {
  document.dispatchEvent(new CustomEvent(CONSENT_SAVED_EVENT, {
    detail: { preferences },
  }));
}

function acceptAll(section) {
  const preferences = {
    [COOKIE_ANALYTIC]: true,
    [COOKIE_ADVERTISING]: true,
  };

  Object.entries(preferences).forEach(([cookieName, enabled]) => {
    setCookie(cookieName, String(enabled), COOKIE_DURATION_DAYS);
  });

  setCookie(COOKIE_CONSENT, 'true', COOKIE_DURATION_DAYS);
  dispatchConsentSaved(preferences);
  section?.remove();
}

async function ensureCookieModal(fragmentPath) {
  // eslint-disable-next-line no-console
  console.log('[cookie-modal] ensureCookieModal called, path:', fragmentPath);
  // eslint-disable-next-line no-console
  console.log('[cookie-modal] window.showCookieModal exists?', typeof window.showCookieModal);

  if (typeof window.showCookieModal === 'function') {
    return true;
  }

  if (!window[MODAL_PROMISE_KEY] || window[MODAL_PATH_KEY] !== fragmentPath) {
    // eslint-disable-next-line no-console
    console.log('[cookie-modal] Fetching cookie-modal fragment:', fragmentPath);
    window[MODAL_PATH_KEY] = fragmentPath;
    window[MODAL_PROMISE_KEY] = loadFragment(fragmentPath)
      .then((fragment) => {
        // eslint-disable-next-line no-console
        console.log('[cookie-modal] loadFragment result:', fragment);
        // eslint-disable-next-line no-console
        console.log('[cookie-modal] window.showCookieModal after load:', typeof window.showCookieModal);
        if (!fragment && typeof window.showCookieModal !== 'function') {
          // eslint-disable-next-line no-console
          console.error('[cookie-alert] Cookie modal fragment not found at', fragmentPath);
        }
        return fragment;
      })
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error('[cookie-alert] Failed to load cookie modal fragment', error);
        return null;
      });
  }

  const fragment = await window[MODAL_PROMISE_KEY];
  // eslint-disable-next-line no-console
  console.log('[cookie-modal] after await, fragment:', fragment, '| showCookieModal:', typeof window.showCookieModal);
  if (!fragment && typeof window.showCookieModal !== 'function') {
    window[MODAL_PROMISE_KEY] = null;
    return false;
  }

  return true;
}

export default async function decorate(block) {
  if (getCookie(COOKIE_CONSENT) === 'true') {
    block.closest('.section')?.remove();
    return;
  }

  // Create banner structure while preserving block attributes
  const banner = document.createElement('div');
  banner.className = 'cookie-alert-banner';
  banner.setAttribute('role', 'region');
  banner.setAttribute('aria-label', 'Cookie consent');
  banner.setAttribute('aria-live', 'polite');

  // Move instrumentation from block to banner
  moveInstrumentation(block, banner);

  const inner = document.createElement('div');
  inner.className = 'cookie-alert-inner';

  const textEl = document.createElement('div');
  textEl.className = 'cookie-alert-text';

  const btnsEl = document.createElement('div');
  btnsEl.className = 'cookie-alert-buttons';

  // Process each row in the block
  [...block.children].forEach((row) => {
    const content = row.firstElementChild || row;

    // Check if it's a button container or not
    if (row.querySelector('.button-container') || row.querySelector('a')) {
      const anchor = row.querySelector('a');
      if (anchor) {
        const text = anchor.textContent?.toLowerCase() || '';
        const href = anchor.getAttribute('href')?.toLowerCase() || '';

        // Convert anchors to buttons based on content
        if (text.includes('policy')) {
          // Keep policy links as links
          anchor.className = 'cookie-alert-policy-link';
          textEl.append(anchor);
        } else if (text.includes('setting') || href.includes('cookie-modal')) {
          // Settings button
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'cookie-alert-btn cookie-alert-btn--secondary';
          btn.textContent = anchor.textContent?.trim();
          btn.setAttribute('aria-haspopup', 'dialog');
          copyAnchorAttributes(anchor, btn);
          moveInstrumentation(anchor, btn);

          const fragmentPath = anchor.getAttribute('href') || `/${document.documentElement.lang || 'en'}/fragments/cookie-modal`;
          // eslint-disable-next-line no-console
          console.log('[cookie-alert] "Cookies setting" button created, modal fragment path:', fragmentPath);
          btn.addEventListener('click', async () => {
            // eslint-disable-next-line no-console
            console.log('[cookie-alert] "Cookies setting" button clicked');
            const loaded = await ensureCookieModal(fragmentPath);
            // eslint-disable-next-line no-console
            console.log('[cookie-alert] ensureCookieModal returned:', loaded, '| showCookieModal:', typeof window.showCookieModal);
            if (loaded && typeof window.showCookieModal === 'function') {
              window.showCookieModal(btn);
            } else {
              // eslint-disable-next-line no-console
              console.error('[cookie-alert] Modal not shown — loaded:', loaded, ', showCookieModal:', typeof window.showCookieModal);
            }
          });

          btnsEl.append(btn);
        } else if (text.includes('accept')) {
          // Accept button
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'cookie-alert-btn cookie-alert-btn--primary';
          btn.textContent = anchor.textContent?.trim();
          copyAnchorAttributes(anchor, btn);
          moveInstrumentation(anchor, btn);

          btn.addEventListener('click', () => acceptAll(banner));
          btnsEl.append(btn);
        }
      }
    } else {
      // Regular content (description text)
      textEl.append(content);
    }
  });

  inner.append(textEl, btnsEl);
  banner.append(inner);

  // Append directly to body so position:fixed always works relative to the
  // viewport, regardless of any CSS transforms on ancestor section/main elements.
  const section = block.closest('.section');
  document.body.appendChild(banner);
  section?.remove();

  document.addEventListener(CONSENT_SAVED_EVENT, () => {
    banner.remove();
  }, { once: true });
}
