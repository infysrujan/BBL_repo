import { moveInstrumentation } from '../../scripts/scripts.js';

function createTile(row, doc) {
  const cells = [...row.children];
  // Preview: 3 cells — imageAlt in img.alt, imageLinkTitle in a.title (neither a separate cell)
  // Author:  5 cells — each field has its own cell with data-aue-prop
  const imageDiv = row.querySelector('[data-aue-prop="image"]') || cells[0];
  const imageLinkDiv = row.querySelector('[data-aue-prop="imageLink"]') || cells[1];
  const imageLinkTitleDiv = row.querySelector('[data-aue-prop="imageLinkTitle"]');
  const titleDiv = row.querySelector('[data-aue-prop="title"]') || cells[cells.length - 1];

  const linkAnchor = imageLinkDiv?.querySelector('a');
  const linkHref = linkAnchor?.getAttribute('href') || imageLinkDiv?.textContent?.trim() || '';
  // In preview, imageLinkTitle is embedded in the anchor's title attribute
  const linkTitle = imageLinkTitleDiv?.textContent?.trim() || linkAnchor?.getAttribute('title') || '';
  const title = titleDiv?.textContent?.trim() || '';

  const tile = doc.createElement('div');
  tile.className = 'multi-column-tiles-tile';

  const imageWrapper = doc.createElement('div');
  imageWrapper.className = 'multi-column-tiles-image';
  if (imageDiv) imageWrapper.appendChild(imageDiv);

  if (linkHref) {
    const anchor = doc.createElement('a');
    anchor.href = linkHref;
    anchor.className = 'multi-column-tiles-link';
    if (linkTitle) anchor.setAttribute('title', linkTitle);
    anchor.setAttribute('aria-label', title || linkTitle);
    anchor.appendChild(imageWrapper);
    tile.appendChild(anchor);
  } else {
    tile.appendChild(imageWrapper);
  }

  const titleEl = doc.createElement('h2');
  titleEl.className = 'multi-column-tiles-title';
  titleEl.textContent = title;
  if (titleDiv) moveInstrumentation(titleDiv, titleEl);
  tile.appendChild(titleEl);

  const separator = doc.createElement('span');
  separator.className = 'multi-column-tiles-separator';
  tile.appendChild(separator);

  return { element: tile, instrumentation: tile, titleEl };
}

export default function decorate(block) {
  const doc = block.ownerDocument;
  const rows = [...block.children].slice(0, 4);

  const wrapper = doc.createElement('div');
  wrapper.className = `multi-column-tiles-wrapper tiles-count-${rows.length}`;

  rows.forEach((row) => {
    const { element, instrumentation, titleEl } = createTile(row, doc);
    moveInstrumentation(row, instrumentation);
    const resource = instrumentation.getAttribute('data-aue-resource');
    if (resource && titleEl) titleEl.setAttribute('data-aue-resource', resource);
    wrapper.appendChild(element);
  });

  block.innerHTML = '';
  block.appendChild(wrapper);
}
