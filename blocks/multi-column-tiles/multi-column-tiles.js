import { moveInstrumentation } from '../../scripts/scripts.js';
import createSmartImage from '../../scripts/utils/smartcrop-helper.js';

function buildTile(row, doc) {
  const [
    imgElDesktop,
    imageLinkDiv,
    imageLinkTitleDiv,
    titleDiv,
  ] = row.children;

  const pictureDesktop = imgElDesktop?.querySelector('picture');
  const existingAlt = imgElDesktop?.querySelector('img')?.getAttribute('alt') || '';

  let pictureHTML = '';
  if (pictureDesktop) {
    const picture = createSmartImage(imgElDesktop, null, { textContent: existingAlt });
    pictureHTML = picture?.outerHTML || '';
  }

  const linkAnchor = imageLinkDiv?.querySelector('a');
  const linkHref = linkAnchor?.getAttribute('href') || imageLinkDiv?.textContent?.trim() || '';
  const linkTitle = imageLinkTitleDiv?.textContent?.trim() || linkAnchor?.getAttribute('title') || '';
  const title = titleDiv?.textContent?.trim() || '';

  const tile = doc.createElement('div');
  tile.className = 'multi-column-tiles-tile';
  tile.addEventListener('touchstart', () => tile.classList.add('is-active'), { passive: true });
  tile.addEventListener('touchend', () => tile.classList.remove('is-active'), { passive: true });
  tile.addEventListener('touchcancel', () => tile.classList.remove('is-active'), { passive: true });

  const imageWrapper = doc.createElement('div');
  imageWrapper.className = 'multi-column-tiles-image';
  imageWrapper.innerHTML = pictureHTML;

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

  const separatorEl = doc.createElement('span');
  separatorEl.className = 'multi-column-tiles-separator';
  titleEl.appendChild(separatorEl);

  tile.appendChild(titleEl);

  return tile;
}

export default function decorate(block) {
  const doc = block.ownerDocument;
  const rows = [...block.children].slice(0, 4);

  const wrapper = doc.createElement('div');
  wrapper.className = `multi-column-tiles-wrapper tiles-count-${rows.length}`;

  rows.forEach((row) => {
    const tile = buildTile(row, doc);
    moveInstrumentation(row, tile);
    wrapper.appendChild(tile);
  });

  block.innerHTML = '';
  block.appendChild(wrapper);
}
