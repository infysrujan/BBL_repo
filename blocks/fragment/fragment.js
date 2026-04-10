/*
 * Fragment Block
 * Include content on a page as a fragment.
 * https://www.aem.live/developer/block-collection/fragment
 */

import {
  loadSections,
} from '../../scripts/aem.js';

/**
 * Dispatches a 'bbl:decorate-main' event and waits for scripts.js to call
 * decorateMain() on the element. This avoids a direct import of scripts.js
 * which would create a circular dependency.
 * @param {HTMLElement} main
 * @returns {Promise<void>}
 */
function requestDecorateMain(main) {
  return new Promise((resolve) => {
    document.dispatchEvent(new CustomEvent('bbl:decorate-main', {
      detail: { main, resolve },
    }));
  });
}

/**
 * Loads a fragment.
 * @param {string} path The path to the fragment
 * @returns {HTMLElement} The root element of the fragment
 */
export async function loadFragment(path) {
  if (path && path.startsWith('/')) {
    // eslint-disable-next-line no-param-reassign
    path = path.replace(/(\.plain)?\.html/, '');
    const resp = await fetch(`${path}.plain.html`);
    if (resp.ok) {
      const main = document.createElement('main');
      main.innerHTML = await resp.text();

      // reset base path for media to fragment base
      const resetAttributeBase = (tag, attr) => {
        main.querySelectorAll(`${tag}[${attr}^="./media_"]`).forEach((elem) => {
          elem[attr] = new URL(elem.getAttribute(attr), new URL(path, window.location)).href;
        });
      };
      resetAttributeBase('img', 'src');
      resetAttributeBase('source', 'srcset');

      await requestDecorateMain(main);
      await loadSections(main);
      return main;
    }
  }
  return null;
}

/**
 * Event listener for 'bbl:load-fragment' custom events.
 * Allows other modules to load fragments without creating cyclic dependencies.
 * @listens bbl:load-fragment
 */
// Note: the 'bbl:load-fragment' event listener is registered in scripts.js early
// to avoid a timing issue where this module loads after the event is dispatched.

export default async function decorate(block) {
  const link = block.querySelector('a');
  const path = link ? link.getAttribute('href') : block.textContent.trim();
  const fragment = await loadFragment(path);
  if (fragment) {
    const fragmentSection = fragment.querySelector(':scope .section');
    if (fragmentSection) {
      block.classList.add(...fragmentSection.classList);
      block.classList.remove('section');
      block.replaceChildren(...fragmentSection.childNodes);
    }
  }
}
