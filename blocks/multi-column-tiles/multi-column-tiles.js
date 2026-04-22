import { moveInstrumentation } from '../../scripts/scripts.js';

function createTile(row, doc) {
  const cells = [...row.children];
  // Author env: AEM adds data-aue-prop attributes to each field cell — use them when present
  // Preview env: AEM embeds imageAlt into <img alt=""> (4 cells), author env renders it as its own cell (5 cells)
  const offset = cells.length >= 5 ? 1 : 0;
  const imageDiv = row.querySelector('[data-aue-prop="image"]') || cells[0];
  const imageLinkDiv = row.querySelector('[data-aue-prop="imageLink"]') || cells[1 + offset];
  const imageLinkTitleDiv = row.querySelector('[data-aue-prop="imageLinkTitle"]') || cells[2 + offset];
  const titleDiv = row.querySelector('[data-aue-prop="title"]') || cells[3 + offset];

  const picture = imageDiv?.querySelector('picture');
  const img = imageDiv?.querySelector('img');
  const linkAnchor = imageLinkDiv?.querySelector('a');
  const linkHref = linkAnchor?.getAttribute('href') || imageLinkDiv?.textContent?.trim() || '';
  const linkTitle = imageLinkTitleDiv?.textContent?.trim() || '';
  const title = titleDiv?.textContent?.trim() || '';

  const tile = doc.createElement('div');
  tile.className = 'multi-column-tiles-tile';

  const imageWrapper = doc.createElement('div');
  imageWrapper.className = 'multi-column-tiles-image';
  if (picture) {
    imageWrapper.appendChild(picture.cloneNode(true));
  } else if (img) {
    imageWrapper.appendChild(img.cloneNode(true));
  }
  tile.appendChild(imageWrapper);

  const overlay = doc.createElement('div');
  overlay.className = 'multi-column-tiles-overlay';

  const titleEl = doc.createElement('p');
  titleEl.className = 'multi-column-tiles-title';
  titleEl.textContent = title;
  // Transfer data-aue-* attributes so the UE recognises this element as the "title" field
  // and allows inline editing directly on the canvas in the author environment
  if (titleDiv) moveInstrumentation(titleDiv, titleEl);
  overlay.appendChild(titleEl);

  const separator = doc.createElement('span');
  separator.className = 'multi-column-tiles-separator';
  overlay.appendChild(separator);

  tile.appendChild(overlay);

  if (linkHref) {
    const anchor = doc.createElement('a');
    anchor.href = linkHref;
    anchor.className = 'multi-column-tiles-link';
    if (linkTitle) anchor.setAttribute('title', linkTitle);
    anchor.setAttribute('aria-label', title || linkTitle);
    anchor.appendChild(tile);
    return { element: anchor, instrumentation: tile };
  }

  return { element: tile, instrumentation: tile };
}

export default function decorate(block) {
  const doc = block.ownerDocument;
  const rows = [...block.children].slice(0, 4);

  const wrapper = doc.createElement('div');
  wrapper.className = `multi-column-tiles-wrapper tiles-count-${rows.length}`;

  rows.forEach((row) => {
    const { element, instrumentation } = createTile(row, doc);
    moveInstrumentation(row, instrumentation);
    wrapper.appendChild(element);
  });

  block.innerHTML = '';
  block.appendChild(wrapper);
}
