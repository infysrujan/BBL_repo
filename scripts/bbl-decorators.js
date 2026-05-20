import { fetchConfigs } from './config.js';

import {
  getMetadata,
  buildBlock,
  decorateBlock,
  loadBlock,
  loadCSS,
} from './aem.js';
/**
 * Helper function to parse comma-separated URL strings from config
 * @param {string} urlString - Comma-separated URL string
 * @returns {Array<string>} Array of parsed URLs
 */
function parseUrlString(urlString) {
  if (!urlString || !urlString.trim()) return [];

  // Remove outer quotes if present and trim
  const cleaned = urlString.trim().replace(/^["']|["']$/g, '');

  // Split by comma and clean each URL
  return cleaned.split(',').map((url) => url.trim().replace(/^["']|["']$/g, '')).filter((url) => url.length > 0);
}

/**
 * Check if a URL matches any hostname in the list
 * @param {string} url - URL to check
 * @param {Array<string>} hostnameList - List of hostnames to match
 * @returns {boolean} True if URL matches any hostname
 */
function matchesHostname(url, hostnameList) {
  try {
    const urlObj = new URL(url, window.location.href);
    return hostnameList.some((hostname) => {
      const cleanHostname = hostname.replace(/^https?:\/\//, '').split('/')[0];
      return urlObj.hostname === cleanHostname || urlObj.hostname.endsWith(`.${cleanHostname}`);
    });
  } catch {
    return false;
  }
}

/**
 * Check if URL exactly matches any URL in the list
 * @param {string} url - URL to check
 * @param {Array<string>} urlList - List of full URLs to match
 * @returns {boolean} True if URL matches
 */
function matchesFullUrl(url, urlList) {
  try {
    const urlObj = new URL(url, window.location.href);
    const urlString = urlObj.href;

    return urlList.some((fullUrl) => {
      try {
        const fullUrlObj = new URL(fullUrl);
        return urlString === fullUrlObj.href || urlString.startsWith(fullUrlObj.href);
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

/**
 * Check if the HRPRIVACY cookie is already accepted.
 * @returns {boolean}
 */
function isPrivacyAccepted() {
  const key = encodeURIComponent('HRPRIVACY');
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${key}=`));
  return match ? decodeURIComponent(match.split('=')[1]) === 'true' : false;
}

/**
 * Load privacy modal fragment (once) then show it for the given URL.
 * If the user already accepted (cookie set), navigate directly without the modal.
 * @param {string} pendingUrl - The URL to navigate to after user agrees
 */
async function loadPrivacyModal(pendingUrl) {
  try {
    // Cookie already accepted — skip the modal and navigate directly
    if (isPrivacyAccepted()) {
      window.open(pendingUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    if (typeof window.showPrivacyModal === 'function') {
      window.showPrivacyModal(pendingUrl);
      return;
    }

    // Fragment not loaded yet — dispatch with callback so it opens once ready
    const langPrefix = `/${document.documentElement.lang || 'en'}`;
    document.dispatchEvent(new CustomEvent('bbl:load-fragment', {
      detail: {
        path: `${langPrefix}/fragments/modals/privacy-modal`,
        callbackName: 'showPrivacyModal',
        callback: () => {
          if (typeof window.showPrivacyModal === 'function') {
            window.showPrivacyModal(pendingUrl);
          }
        },
      },
    }));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load privacy modal:', error);
  }
}

/**
 * Load external redirect popup fragment (once) then show it for the given URL.
 * The block's decorate() registers window.showExternalRedirectPopup after loading.
 * @param {string} url - The external URL the user clicked
 */
async function loadAndShowExternalRedirectPopup(url) {
  try {
    if (typeof window.showExternalRedirectPopup === 'function') {
      window.showExternalRedirectPopup(url);
      return;
    }

    // Fragment not loaded yet — dispatch with callback so it opens once ready
    const langPrefix = `/${document.documentElement.lang || 'en'}`;
    document.dispatchEvent(new CustomEvent('bbl:load-fragment', {
      detail: {
        path: `${langPrefix}/fragments/modals/external-popup`,
        callbackName: 'showExternalRedirectPopup',
        callback: () => {
          if (typeof window.showExternalRedirectPopup === 'function') {
            window.showExternalRedirectPopup(url);
          }
        },
      },
    }));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load external redirect popup:', error);
  }
}

/**
 * Add global link click tracking and URL validation
 */
function handleGlobalLinkClicks() {
  document.addEventListener('click', async (e) => {
    const link = e.target.closest('a[href]');

    if (!link) return;

    const href = link.getAttribute('href');

    // Skip internal links, hash links, and relative paths
    if (!href || href.startsWith('#') || href.startsWith('/') || href.startsWith('./') || href.startsWith('../')) {
      return;
    }

    // Check if it's an external URL
    try {
      const urlObj = new URL(href, window.location.href);

      // Skip if same origin
      if (urlObj.hostname === window.location.hostname) {
        return;
      }

      // IMPORTANT: Prevent navigation immediately for all external links
      // This must happen BEFORE any async operations
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      // Remove target attribute to prevent new tab opening
      const originalTarget = link.getAttribute('target');
      if (originalTarget) {
        link.removeAttribute('target');
      }

      // Fetch config data
      const configData = await fetchConfigs();

      // Parse config arrays
      const hostnameUrlArray = parseUrlString(configData.hostnameurl || '');
      const excludedUrlArray = parseUrlString(configData.excludedurl || '');
      const fullUrlArray = parseUrlString(configData.fullurl || '');

      // Case 1: Check if URL is in hostnameurl or fullurl
      const matchesHostnameList = matchesHostname(href, hostnameUrlArray);
      const matchesFullUrlList = matchesFullUrl(href, fullUrlArray);

      if (matchesHostnameList || matchesFullUrlList) {
        await loadPrivacyModal(href);
        return;
      }

      // Case 2: Check if URL is NOT in excluded list
      const isExcluded = matchesFullUrl(href, excludedUrlArray);

      if (!isExcluded) {
        await loadAndShowExternalRedirectPopup(href);
        return;
      }

      // Case 3: If URL is in excluded list, restore target and allow navigation
      if (originalTarget) {
        link.setAttribute('target', originalTarget);
      }
      // Re-trigger the click to allow normal navigation
      link.click();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error processing link click:', error);
    }
  }, true); // Use capture phase
}

const WELCOME_BANNER_COOKIE = 'bbl-welcome-banner';
const TWENTY_MIN_MS = 30 * 1000;

function isHomepage() {
  const p = window.location.pathname.replace(/\/$/, '') || '/';
  return ['/', '/en', '/th-TH', '/th-th'].includes(p);
}

function setBannerDismissed() {
  const expires = new Date(Date.now() + TWENTY_MIN_MS).toUTCString();
  const ts = String(Date.now());
  document.cookie = `${encodeURIComponent(WELCOME_BANNER_COOKIE)}=${ts}; expires=${expires}; path=/; SameSite=Lax`;
}

function getRemainingMs() {
  const encoded = encodeURIComponent(WELCOME_BANNER_COOKIE);
  const match = document.cookie.split('; ').find((r) => r.startsWith(`${encoded}=`));
  if (!match) return 0;
  const ts = Number(match.split('=')[1]);
  if (!ts) return 0;
  const remaining = TWENTY_MIN_MS - (Date.now() - ts);
  return remaining > 0 ? remaining : 0;
}

function isDateTimeActive(startStr, endStr) {
  const now = new Date();
  if (startStr) {
    const start = new Date(startStr);
    if (!Number.isNaN(start.getTime()) && now < start) return false;
  }
  if (endStr) {
    const end = new Date(endStr);
    if (!Number.isNaN(end.getTime()) && now > end) return false;
  }
  return true;
}

function dismissBannerOverlay(overlay) {
  setBannerDismissed();
  overlay.classList.remove('welcome-banner-overlay-visible');
  overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
}

function buildWelcomeBannerOverlay(desktopPic, mobilePic, ctaLinks) {
  const overlay = document.createElement('div');
  overlay.className = 'welcome-banner-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Welcome banner');

  const dialog = document.createElement('div');
  dialog.className = 'welcome-banner-dialog';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'welcome-banner-close';
  closeBtn.setAttribute('aria-label', 'Close welcome banner');
  closeBtn.innerHTML = '&times;';
  closeBtn.addEventListener('click', () => dismissBannerOverlay(overlay));

  const media = document.createElement('div');
  media.className = 'welcome-banner-media';

  if (desktopPic) {
    desktopPic.classList.add('welcome-banner-desktop-img');
    media.appendChild(desktopPic);
  }
  if (mobilePic) {
    mobilePic.classList.add('welcome-banner-mobile-img');
    media.appendChild(mobilePic);
  }

  const ctas = document.createElement('div');
  ctas.className = 'welcome-banner-ctas';

  ctaLinks.forEach((ctaData) => {
    const a = document.createElement('a');
    a.className = 'welcome-banner-cta';
    a.href = ctaData.href;
    a.textContent = ctaData.label;
    if (ctaData.target) a.setAttribute('target', ctaData.target);
    a.addEventListener('click', (e) => {
      e.preventDefault();
      setBannerDismissed();
      if (ctaData.href && ctaData.href !== '#') {
        window.location.href = ctaData.href;
      } else {
        dismissBannerOverlay(overlay);
      }
    });
    ctas.appendChild(a);
  });

  dialog.appendChild(closeBtn);
  dialog.appendChild(media);
  dialog.appendChild(ctas);
  overlay.appendChild(dialog);

  return overlay;
}

async function loadWelcomeBanner(doc) {
  doc.querySelectorAll('.welcome-banner-wrapper').forEach((wrapper) => {
    const section = wrapper.closest('.section');
    if (section) section.remove();
    else wrapper.remove();
  });

  if (!isHomepage()) return;

  const lang = doc.documentElement.lang || 'en';
  const fragmentPath = `/${lang}/fragments/welcome-banner/welcome-banner`;

  let html;
  try {
    const resp = await fetch(`${fragmentPath}.plain.html`);
    if (!resp.ok) return;
    html = await resp.text();
  } catch (e) {
    return;
  }

  const fragDoc = new DOMParser().parseFromString(html, 'text/html');
  const block = fragDoc.querySelector('.welcome-banner');
  if (!block) return;

  const rows = [...block.children];
  const [
    desktopImgRow, mobileImgRow, isActiveRow, publishDateRow, unpublishDateRow, ...buttonRows
  ] = rows;

  if (isActiveRow?.textContent?.trim().toLowerCase() === 'false') return;

  const publishDate = publishDateRow?.textContent?.trim() || '';
  const unpublishDate = unpublishDateRow?.textContent?.trim() || '';
  if (!isDateTimeActive(publishDate, unpublishDate)) return;

  const desktopPic = desktopImgRow?.querySelector('picture')?.cloneNode(true) ?? null;
  const mobilePic = mobileImgRow?.querySelector('picture')?.cloneNode(true) ?? null;

  const ctaLinks = buttonRows.map((row) => {
    const a = row?.querySelector('a');
    if (!a) return null;
    return {
      href: a.getAttribute('href') || '#',
      label: a.textContent.trim(),
      target: a.getAttribute('target') || '',
    };
  }).filter(Boolean);

  if (ctaLinks.length === 0) {
    const parentEl = block.parentElement;
    if (parentEl) {
      parentEl.querySelectorAll(':scope > p a').forEach((a) => {
        ctaLinks.push({
          href: a.getAttribute('href') || '#',
          label: a.textContent.trim(),
          target: a.getAttribute('target') || '',
        });
      });
    }
  }

  if (ctaLinks.length === 0) return;

  const fragmentBase = `${window.location.origin}/${lang}/fragments/welcome-banner/`;
  [desktopPic, mobilePic].forEach((pic) => {
    if (!pic) return;
    pic.querySelectorAll('source[srcset], img[src]').forEach((el) => {
      if (el.hasAttribute('srcset')) {
        el.setAttribute('srcset', el.getAttribute('srcset').replace(/\.\/media_/g, `${fragmentBase}media_`));
      }
      if (el.hasAttribute('src')) {
        el.setAttribute('src', el.getAttribute('src').replace(/\.\/media_/g, `${fragmentBase}media_`));
      }
    });
  });

  loadCSS(`${window.hlx.codeBasePath}/blocks/welcome-banner/welcome-banner.css`);
  const overlay = buildWelcomeBannerOverlay(desktopPic, mobilePic, ctaLinks);

  const showOverlay = () => {
    doc.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('welcome-banner-overlay-visible'));
  };

  const remainingMs = getRemainingMs();
  if (remainingMs > 0) {
    setTimeout(showOverlay, remainingMs);
  } else {
    showOverlay();
  }
}

async function loadBreadcrumb(doc) {
  const breadcrumbsMeta = getMetadata('breadcrumbs') || 'true';
  if (breadcrumbsMeta.toLowerCase() === 'true') {
    const footer = doc.querySelector('footer');
    if (footer) {
      const breadcrumbSection = document.createElement('div');
      breadcrumbSection.className = 'section full-bleed-special';

      const breadcrumbWrapper = document.createElement('div');
      breadcrumbWrapper.className = 'breadcrumb-wrapper';
      breadcrumbWrapper.setAttribute('aria-label', 'Breadcrumb');
      breadcrumbSection.appendChild(breadcrumbWrapper);
      footer.parentNode.insertBefore(breadcrumbSection, footer);

      const breadcrumbBlock = buildBlock('breadcrumb', '');
      breadcrumbWrapper.append(breadcrumbBlock);
      decorateBlock(breadcrumbBlock);
      await loadBlock(breadcrumbBlock);
    }
  }
}

function decorateButtonsV1(element) {
  element.querySelectorAll('a').forEach((a) => {
    a.title = a.title || a.textContent;
    if (a.href !== a.textContent) {
      const up = a.parentElement;
      const twoup = a.parentElement.parentElement;
      if (!a.querySelector('img') && !a.closest('.download-files')) {
        if (
          up.childNodes.length === 1
          && up.tagName === 'STRONG'
          && twoup.childNodes.length === 1
          && twoup.tagName === 'P'
        ) {
          a.className = 'button-m primary';
          twoup.classList.add('button-container');
        }
        if (
          up.childNodes.length === 1
          && up.tagName === 'EM'
          && twoup.childNodes.length === 1
          && twoup.tagName === 'P'
        ) {
          a.className = 'button-m secondary';
          twoup.classList.add('button-container');
        }
        if (up.childNodes.length === 1 && (up.tagName === 'P' || up.tagName === 'DIV')) {
          const alreadyVariant = a.className.includes('primary') || a.className.includes('secondary');
          if (!alreadyVariant) {
            a.className = 'button-tertiary';
            up.classList.add('button-container');
          }
        }
      }

      // Check for target link setting in adjacent element
      const hasTargetTrue = (linkParent) => {
        const nextSibling = linkParent?.nextElementSibling;
        if (nextSibling && nextSibling.tagName === 'DIV') {
          const text = nextSibling.textContent.trim().toLowerCase();
          if (text === 'true') {
            nextSibling.remove();
            return true;
          }
          // Check for nested div with "true"
          const childDiv = nextSibling.querySelector(':scope > div');
          if (childDiv && childDiv.textContent.trim().toLowerCase() === 'true') {
            nextSibling.remove();
            return true;
          }
        }
        return false;
      };

      if (a.classList.contains('button')) {
        if (hasTargetTrue(twoup) || hasTargetTrue(up) || a.target === '_blank') {
          a.target = '_blank';
        } else {
          a.target = '_self';
        }
      }
    }
  });
}

function decorateTerritoryButtons(main) {
  // Find anchors that are "button" only (no variants like primary/secondary)
  // and convert them to "button territory".
  main.querySelectorAll('a.button:not([class*=" "])').forEach((a) => {
    a.className = 'button-tertiary';
  });
}

/**
 * Decorates SVG icons with alt text separated by '-alt_-' in the icon name
 * @param {Element} element container element
 */
function decorateSvgWithAltText(element) {
  element.querySelectorAll('span.icon img[src$=".svg"]').forEach((img) => {
    const { iconName } = img.dataset;
    if (iconName && iconName.includes('-alt_-')) {
      const [srcPart, altPart] = iconName.split('-alt_-');

      // Update the src to use only the first part
      const currentSrc = img.getAttribute('src');
      const basePath = currentSrc.substring(0, currentSrc.lastIndexOf('/') + 1);
      img.setAttribute('src', `${basePath}${srcPart}.svg`);

      // Update the alt text with the second part (replace underscores and hyphens with spaces)
      const altText = altPart.replace(/[_-]/g, ' ').trim();
      img.setAttribute('alt', altText);
    }
  });
}

if (Window.LAZY_PHASE) {
  handleGlobalLinkClicks();
} else {
  document.addEventListener('lazy-phase', () => {
    handleGlobalLinkClicks();
  });
}

/**
 * Returns the value of a cookie by name, or null if not set.
 * @param {string} name
 * @returns {string|null}
 */
function getCookieValue(name) {
  const encoded = encodeURIComponent(name);
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${encoded}=`));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}

/**
 * Gets the language from the HTML tag.
 * @returns {string} The language code (e.g., 'en', 'th')
 */
function getLang() {
  return document.documentElement.lang || 'en';
}

/**
 * Builds the cookie-alert synthetic block and appends it to main
 * if the user has not yet given cookie consent.
 * @param {Element} main The container element
 */
async function buildCookieAlert(main) {
  /* Skip in Universal Editor — cookie consent UI must not appear while authoring. */
  if (window.self !== window.top) return;

  /* Skip when called for a detached fragment main (loadFragment context). */
  if (!main.isConnected) return;

  /* Skip if consent already recorded */
  if (getCookieValue('ConsentAlert') === 'ALERT') return;

  /* Skip if a cookie-alert block was manually placed by the author */
  if (main.querySelector('.cookie-alert')) return;

  const lang = getLang();
  const fragmentPath = `/${lang}/fragments/cookie-alert`;

  try {
    // Use event-based fragment loading to avoid circular dependency.
    // The listener is registered early in scripts.js so it is always available.
    document.dispatchEvent(new CustomEvent('bbl:load-fragment', {
      detail: {
        path: fragmentPath,
        callback: (fragment) => {
          if (!fragment) {
            // eslint-disable-next-line no-console
            console.warn('[cookie-alert] Fragment not found at', fragmentPath);
            return;
          }
          // Move the decorated sections directly (preserves event listeners).
          // Do NOT use innerHTML/outerHTML — that strips all JS event listeners.
          [...fragment.querySelectorAll(':scope > .section')].forEach((s) => main.append(s));
        },
      },
    }));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[cookie-alert] Could not load fragment:', error);
  }
}

export {
  decorateTerritoryButtons,
  decorateButtonsV1,
  decorateSvgWithAltText,
  loadBreadcrumb,
  loadWelcomeBanner,
  buildCookieAlert,
};
