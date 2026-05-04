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
  decorateButtonsV1,
  loadBreadcrumb,
} from './bbl-decorators.js';

import decorateTabs from '../blocks/tabs/tabs-helper.js';

/**
 * Import the martech plugin.
 * See: https://github.com/adobe-rnd/aem-martech#launch-container-configuration for more information.
 */
import {
  initMartech,
  updateUserConsent,
  martechEager,
  martechLazy,
  martechDelayed,
} from '../plugins/martech/src/index.js';

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

  const pageVariant = getMetadata('pagevariant');
  if (pageVariant) {
    document.body.classList.add(`${pageVariant}`);
  }
}

/**
 * Resolves html lang from URL path (locale segment after host, e.g. bangkokbank.com/en/...).
 * @param {string} pathname - `window.location.pathname`
 * @returns {'en'|'th'}
 */
function getDocumentLangFromPath(pathname) {
  const first = pathname.split('/').filter(Boolean)[0];
  if (first === 'en') return 'en';
  if (first === 'th') return 'th';
  return 'th';
}

/**
 * Gets the environment from the hostname.
 * @returns {'dev'|'stage'|'prod'}
 */
const env = (() => {
  const host = window.location.hostname;
  if (host.includes('localhost') || host.includes('--preview') || host.includes('dev')) return 'dev';
  if (host.includes('stage') || host.includes('staging')) return 'stage';
  return 'prod';
})();

/**
 * Configuration for each environment.
 * @type {Object}
 */
// TODO: Update BBL's Dev, Stage and Prod datastream IDs here
const dataStreamConfig = {
  dev: 'db3b9bf1-f8e7-4d57-9fdf-94494c1459c6',
  stage: 'db3b9bf1-f8e7-4d57-9fdf-94494c1459c6',
  prod: 'db3b9bf1-f8e7-4d57-9fdf-94494c1459c6',
};

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  // TODO: Update consent logic here.
  const isConsentGiven = false;

  const martechLoadedPromise = initMartech(
    // WebSDK Configuration
    // TODO: Remove the below comment once the WebSDK Configuration is updated.
    // Docs: https://experienceleague.adobe.com/en/docs/experience-platform/web-sdk/commands/configure/overview#configure-js
    {
      datastreamId: dataStreamConfig[env],
      orgId: 'C735552962AB1A800A495FFD@AdobeOrg',
      martechConfig: {
        analytics: false, // setting to false as BBL uses GA through GTM
      }
    },
    // 2. Library Configuration
    {
      personalization: !!getMetadata('target') && isConsentGiven,
      launchUrls: [
        /* TODO: Add BBL's Launch script URLs here */
      ],
    },
  );
  
  document.documentElement.lang = getDocumentLangFromPath(window.location.pathname);
  decorateTemplateAndTheme();
  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    document.body.classList.add('appear');
    await Promise.all([
      // Load the martech library in the eager phase.
      martechLoadedPromise.then(martechEager),
      loadSection(main.querySelector('.section'), waitForFirstImage),
    ]);
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

  // Decorate buttons again after all sections are loaded (for dynamically loaded content like tabs)
  decorateButtonsV1(main);
  decorateSvgWithAltText(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  loadHeader(doc.querySelector('header'));
  loadFooter(doc.querySelector('footer'));

  // Load the martech library in the lazy phase.
  await martechLazy();

  await loadBreadcrumb(doc);
  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();

  // Add link click handler for URL validation
  setTimeout(() => {
    document.dispatchEvent(new Event('lazy-phase'));
    Window.LAZY_PHASE = true;
  }, 150);
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  // eslint-disable-next-line import/no-cycle
  window.setTimeout(() => {
    // Load the martech library in the delayed phase.
    martechDelayed();
    import('./delayed.js');
  }, 3000);
  // load anything that can be postponed to the latest here
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
}

loadPage();
