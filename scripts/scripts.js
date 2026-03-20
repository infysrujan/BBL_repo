import {
  loadHeader,
  loadFooter,
  decorateIcons,
  decorateButtons,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForFirstImage,
  loadSection,
  loadSections,
  loadCSS,
  getMetadata,
} from './aem.js';

import {
  decorateSvgWithAltText,
  decorateTerritoryButtons,
} from './bbl-decorators.js';

// eslint-disable-next-line import/no-cycle
import decorateTabs from '../blocks/tabs/tabs-helper.js';
// eslint-disable-next-line import/no-cycle
import { fetchConfigs } from './config.js';
// eslint-disable-next-line import/no-cycle
import { loadFragment } from '../blocks/fragment/fragment.js';

/**
 * Gets the language from the HTML tag.
 * @returns {string} The language code (e.g., 'en', 'th')
 */
export function getLang() {
  return document.documentElement.lang || 'en';
}

/**
 * Moves all the attributes from a given elmenet to another given element.
 * @param {Element} from the element to copy attributes from
 * @param {Element} to the element to copy attributes to
 */
export function moveAttributes(from, to, attributes) {
  if (!attributes) {
    // eslint-disable-next-line no-param-reassign
    attributes = [...from.attributes].map(({ nodeName }) => nodeName);
  }
  attributes.forEach((attr) => {
    const value = from.getAttribute(attr);
    if (value) {
      to?.setAttribute(attr, value);
      from.removeAttribute(attr);
    }
  });
}

/**
 * Move instrumentation attributes from a given element to another given element.
 * @param {Element} from the element to copy attributes from
 * @param {Element} to the element to copy attributes to
 */
export function moveInstrumentation(from, to) {
  moveAttributes(
    from,
    to,
    [...from.attributes]
      .map(({ nodeName }) => nodeName)
      .filter((attr) => attr.startsWith('data-aue-') || attr.startsWith('data-richtext-')),
  );
}

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
 * Load privacy modal fragment and set pending URL for navigation after agreement
 * @param {string} pendingUrl - The URL to navigate to after user agrees
 */
async function loadPrivacyModal(pendingUrl) {
  try {
    // Load the privacy modal fragment
    const fragment = await loadFragment('/en/modals/privacy-modal');

    if (fragment) {
      // Store the pending URL globally so the privacy modal can access it
      window.pendingNavigationUrl = pendingUrl;

      // The fragment should contain the privacy-modal block which will auto-initialize
      document.body.appendChild(fragment);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load privacy modal:', error);
  }
}

/**
 * Add global link click tracking and URL validation
 */
function addLinkClickHandler() {
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

      // eslint-disable-next-line no-console
      console.log('URL Check:', {
        clickedUrl: href,
        hostnameUrls: hostnameUrlArray,
        excludedUrls: excludedUrlArray,
        fullUrls: fullUrlArray,
      });

      // Case 1: Check if URL is in hostnameurl or fullurl
      const matchesHostnameList = matchesHostname(href, hostnameUrlArray);
      const matchesFullUrlList = matchesFullUrl(href, fullUrlArray);

      if (matchesHostnameList || matchesFullUrlList) {
        // CASE 1: Show privacy modal
        // eslint-disable-next-line no-console
        console.log('Case 1: URL matches config - Loading privacy modal');
        await loadPrivacyModal(href);
        return;
      }

      // Case 2: Check if URL is NOT in excluded list
      const isExcluded = matchesFullUrl(href, excludedUrlArray);

      if (!isExcluded) {
        // CASE 2: Show alert (temporary redirect message)
        // eslint-disable-next-line no-console
        console.log('Case 2: URL not in config and not excluded - Showing redirect alert');
        // eslint-disable-next-line no-alert
        alert(`Redirect Notice\n\nYou are about to leave Bangkok Bank website.\n\nDestination: ${href}\n\nNote: This is a temporary alert. A proper redirect modal will be implemented.`);

        // Optionally proceed to the URL after alert
        // Uncomment the next line if you want to redirect after alert
        // window.location.href = href;

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

/**
 * Create HTML element from template string
 * @param {string} html - HTML template string
 * @param {Document} doc - Document reference
 * @returns {Element} The created element
 */
export function createElementFromHTML(html, doc) {
  const template = doc.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

/**
 * Set target="_blank" on external links in a container
 * Note: Links will be validated by addLinkClickHandler, so we don't set target="_blank"
 * to prevent unwanted new tab behavior before validation
 */
export function setExternalLinksTarget() {
  // Commenting out automatic target="_blank" setting since we handle external links
  // with URL validation logic that shows modals before navigation
  //
  // const links = container.querySelectorAll('a[href]');
  // links.forEach((link) => {
  //   if (isExternalUrl(link.href)) {
  //     link.setAttribute('target', '_blank');
  //     link.setAttribute('rel', 'noopener noreferrer');
  //   }
  // });
}

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks(main) {
  try {
    decorateTabs(main);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  // hopefully forward compatible button decoration
  decorateButtons(main);
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
  decorateTerritoryButtons(main);
  decorateSvgWithAltText(main);
  setExternalLinksTarget(main);

  const pageVariant = getMetadata('pagevariant');
  if (pageVariant) {
    document.body.classList.add(`${pageVariant}`);
  }
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  document.documentElement.lang = 'en';
  decorateTemplateAndTheme();
  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    document.body.classList.add('appear');
    await loadSection(main.querySelector('.section'), waitForFirstImage);
  }

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 1025 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  const main = doc.querySelector('main');
  await loadSections(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  loadHeader(doc.querySelector('header'));
  loadFooter(doc.querySelector('footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();

  // Add link click handler for URL validation
  addLinkClickHandler();
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  // eslint-disable-next-line import/no-cycle
  window.setTimeout(() => import('./delayed.js'), 3000);
  // load anything that can be postponed to the latest here
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
}

loadPage();
