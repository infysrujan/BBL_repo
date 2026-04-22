import { moveInstrumentation } from '../../scripts/scripts.js';

function createTile(row, doc) {
  const cells = [...row.children];
  const [imageDiv, imageAltDiv, imageLinkDiv, imageLinkTitleDiv, titleDiv] = cells;

  const picture = imageDiv?.querySelector('picture');
  const img = imageDiv?.querySelector('img');
  const imgAlt = imageAltDiv?.textContent?.trim() || '';
  const linkAnchor = imageLinkDiv?.querySelector('a');
  const linkHref = linkAnchor?.href || '';
  const linkTitle = imageLinkTitleDiv?.textContent?.trim() || '';
  const title = titleDiv?.textContent?.trim() || '';

  if (img && imgAlt) img.setAttribute('alt', imgAlt);

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

  if (title) {
    const overlay = doc.createElement('div');
    overlay.className = 'multi-column-tiles-overlay';

    const titleEl = doc.createElement('p');
    titleEl.className = 'multi-column-tiles-title';
    titleEl.textContent = title;
    overlay.appendChild(titleEl);

    const separator = doc.createElement('span');
    separator.className = 'multi-column-tiles-separator';
    overlay.appendChild(separator);

    tile.appendChild(overlay);
  }

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
  wrapper.className = 'multi-column-tiles-wrapper';

  rows.forEach((row) => {
    const { element, instrumentation } = createTile(row, doc);
    moveInstrumentation(row, instrumentation);
    wrapper.appendChild(element);
  });

  block.innerHTML = '';
  block.appendChild(wrapper);
}
