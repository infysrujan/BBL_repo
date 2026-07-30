const ICON_MARKER_RE = /#icon(\d*)(?:x(\d+))?(?:-(inline|block))?/i;
const DCW = '.default-content-wrapper';

function processInlineImageMarkers(paragraphs) {
  paragraphs.forEach((markerP) => {
    if (!/#inlineimage/i.test(markerP.textContent)) return;
    [...markerP.childNodes].forEach((node) => {
      if (node.nodeType !== Node.TEXT_NODE || !/#inlineimage/i.test(node.nodeValue)) return;
      let pic = node.nextSibling;
      while (pic && pic.nodeName !== 'PICTURE') pic = pic.nextSibling;
      if (pic) pic.classList.add('rte-inline-image');
      node.nodeValue = node.nodeValue.replace(/#inlineimage\s*/gi, '');
    });
  });
}

function processIconMarkers(paragraphs) {
  paragraphs.forEach((markerP) => {
    if (!ICON_MARKER_RE.test(markerP.textContent)) return;
    let hasIcon = false;
    [...markerP.childNodes].forEach((node) => {
      if (node.nodeType !== Node.TEXT_NODE) return;
      const match = ICON_MARKER_RE.exec(node.nodeValue);
      if (!match) return;
      const [fullMatch, width, height] = match;
      const widthPx = `${parseInt(width, 10) || 40}px`;
      const heightPx = `${parseInt(height, 10) || parseInt(width, 10) || 40}px`;

      // Try inline first (picture in same paragraph after marker text)
      let pic = node.nextSibling;
      while (pic && pic.nodeName !== 'PICTURE') pic = pic.nextSibling;

      // Fallback: picture in adjacent sibling paragraph (standalone #icon case)
      if (!pic) {
        const prev = markerP.previousElementSibling;
        const next = markerP.nextElementSibling;
        const prevPic = prev?.tagName === 'P' ? prev.querySelector('picture') : null;
        const nextPic = next?.tagName === 'P' ? next.querySelector('picture') : null;
        pic = (prevPic && !prevPic.style.width ? prevPic : null) ?? nextPic ?? prevPic;
      }

      if (pic) {
        pic.style.width = widthPx;
        pic.style.height = heightPx;
        const img = pic.querySelector('img');
        if (img) {
          img.style.width = widthPx;
          img.style.height = heightPx;
        }
        node.nodeValue = node.nodeValue.replace(fullMatch, '');
        pic.closest('p')?.classList.add('rte-has-icon');
        hasIcon = true;
      }
    });

    if (hasIcon) {
      // Remove marker paragraph if now empty (standalone #icon case)
      if (!markerP.textContent.trim() && !markerP.querySelector('picture, a')) {
        markerP.remove();
      } else {
        markerP.classList.add('rte-has-icon');
      }
    }
  });
}

function processImageLinks(paragraphs) {
  paragraphs.forEach((markerP) => {
    if (!/#imagelink/i.test(markerP.textContent)) return;
    let hasImageLink = false;
    [...markerP.childNodes].forEach((node) => {
      if (node.nodeType !== Node.TEXT_NODE || !/#imagelink/i.test(node.nodeValue)) return;
      let pic = node.nextSibling;
      while (pic && pic.nodeName !== 'PICTURE') pic = pic.nextSibling;
      if (!pic) return;
      let anchor = pic.nextSibling;
      while (anchor && anchor.nodeName !== 'A') anchor = anchor.nextSibling;
      if (!anchor) return;
      const link = anchor.cloneNode(false);
      link.removeAttribute('class');
      pic.replaceWith(link);
      link.append(pic);
      anchor.remove();
      node.nodeValue = node.nodeValue.replace(/#imagelink\s*/i, '');
      hasImageLink = true;
    });
    if (hasImageLink) markerP.classList.add('rte-image-link');
  });
}

export function decorateIconInContainer(container) {
  const paragraphs = [...container.querySelectorAll('p')];
  processInlineImageMarkers(paragraphs);
  processIconMarkers(paragraphs);
  processImageLinks(paragraphs);
}

export function decoratePictureLinks(container) {
  processImageLinks([...container.querySelectorAll('p')]);
}

export function decorateNewTabLinks(container) {
  container.querySelectorAll('a').forEach((a) => {
    const href = a.getAttribute('href') || '';
    const prev = a.previousSibling;
    const inHref = href.toLowerCase().endsWith('#newtab');
    const inText = prev?.nodeType === Node.TEXT_NODE && /#newtab/i.test(prev.nodeValue);
    if (!inHref && !inText) return;
    if (inHref) a.setAttribute('href', href.slice(0, -'#newtab'.length));
    if (inText) prev.nodeValue = prev.nodeValue.replace(/#newtab\s*/i, '');
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  });
}

export function decorateRteInlineImages(main) {
  main.querySelectorAll(`${DCW} p, ${DCW} li, ${DCW} td`).forEach((el) => {
    if (!el.innerHTML.includes('&amp;nbsp;')) return;
    el.innerHTML = el.innerHTML.replace(/&amp;nbsp;/g, '&nbsp;');
  });

  const paragraphs = [...main.querySelectorAll(`${DCW} p`)];
  processInlineImageMarkers(paragraphs);
  processIconMarkers(paragraphs);
  processImageLinks(paragraphs);
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
  decorateNewTabLinks(main);

  const { hash } = window.location;
  if (hash) scrollToHash(hash.substring(1), doc);

  window.addEventListener('hashchange', () => {
    scrollToHash(window.location.hash.substring(1), doc);
  });
}
