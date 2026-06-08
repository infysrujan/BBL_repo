// {icon40-inline} → same line as text  |  {icon40-block} → own line below text
const ICON_MARKER_RE = /^\s*\{icon(\d+)-(inline|block)\}\s*$/i;
const DCW = '.default-content-wrapper';

export function decorateRteInlineImages(main) {
  main.querySelectorAll(`${DCW} p picture, ${DCW} li picture`)
    .forEach((pic) => pic.classList.add('rte-inline-image'));

  main.querySelectorAll(`${DCW} p`).forEach((markerP) => {
    const match = ICON_MARKER_RE.exec(markerP.textContent);
    if (!match) return;

    const [, size, placement] = match;
    const prev = markerP.previousElementSibling;
    const picture = prev?.querySelector('picture.rte-inline-image')
      ?? markerP.querySelector('picture.rte-inline-image');

    if (picture) {
      picture.classList.add(`icon-${size}`);
      if (placement === 'inline') {
        const picP = picture.closest('p');
        const textP = picP?.previousElementSibling;
        if (textP?.matches('p')) {
          textP.append(picture);
          picP.remove();
        }
      }
    }
    markerP.remove();
  });
}

/**
 * Finds [#x.x] markers anywhere in RTE text, replaces them with an invisible
 * anchor <span> and removes the marker from visible content.
 * Authors write [#1.2] in the doc → generates <span id="1_2"> at that position.
 * @param {Element} main
 */
function addHintPageAnchors(main) {
  // Matches [#1.2] with optional HTML tags wrapping the content inside brackets
  // e.g. [#1.2], [<u>#1.2</u>], [<strong>#1.2</strong>]
  const MARKER = /\[(?:<[^>]+>)*#([\w.]+)(?:<\/[^>]+>)*\]/g;

  main.querySelectorAll('td, p, h1, h2, h3, h4, h5, h6, li').forEach((el) => {
    if (!el.innerHTML.includes('[')) return;
    el.innerHTML = el.innerHTML.replace(MARKER, (_, id) => `<span id="${id.replace(/\./g, '_')}" class="rte-anchor" aria-hidden="true"></span>`);
  });
}

/**
 * Scrolls smoothly to the element with the given id.
 * @param {string} id
 * @param {Document} doc
 */
function scrollToHash(id, doc) {
  const target = id ? doc.getElementById(id) : null;
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Initialises RTE anchor support for the page:
 *  1. Replaces [#x.x] markers with named anchor spans.
 *  2. Scrolls to the hash on load and on every hashchange.
 * @param {Element} main
 * @param {Document} doc
 */
export default function initRteAnchors(main, doc) {
  addHintPageAnchors(main);

  const { hash } = window.location;
  if (hash) scrollToHash(hash.substring(1), doc);

  window.addEventListener('hashchange', () => {
    scrollToHash(window.location.hash.substring(1), doc);
  });
}
