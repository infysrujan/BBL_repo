import createSmartImage from '../../scripts/utils/smartcrop-helper.js';

function buildTileHTML(row) {
  const [
    imgElDesktop,
    imgElMobile,
    imgAlt,
    imageLinkDiv,
    imageLinkTitleDiv,
    titleDiv,
  ] = row.children;

  const pictureDesktop = imgElDesktop?.querySelector('picture');
  const pictureMobile = imgElMobile?.querySelector('picture');

  let pictureHTML = '';
  if (pictureDesktop || pictureMobile) {
    const picture = createSmartImage(imgElDesktop, imgElMobile, imgAlt);
    pictureHTML = picture?.outerHTML || '';
  }

  const linkAnchor = imageLinkDiv?.querySelector('a');
  const linkHref = linkAnchor?.getAttribute('href') || imageLinkDiv?.textContent?.trim() || '';
  const linkTitle = imageLinkTitleDiv?.textContent?.trim() || linkAnchor?.getAttribute('title') || '';
  const title = titleDiv?.textContent?.trim() || '';

  const imageContent = `<div class="multi-column-tiles-image">${pictureHTML}</div>`;
  const wrappedImage = linkHref
    ? `<a href="${linkHref}" class="multi-column-tiles-link"${linkTitle ? ` title="${linkTitle}"` : ''} aria-label="${title || linkTitle}">${imageContent}</a>`
    : imageContent;

  return `
    <div class="multi-column-tiles-tile">
      ${wrappedImage}
      <h2 class="multi-column-tiles-title">${title}</h2>
    </div>
  `;
}

export default function decorate(block) {
  const rows = [...block.children].slice(0, 4);

  block.innerHTML = `
    <div class="multi-column-tiles-wrapper tiles-count-${rows.length}">
      ${rows.map(buildTileHTML).join('')}
    </div>
  `;

  block.querySelectorAll('.multi-column-tiles-tile').forEach((tile) => {
    tile.addEventListener('touchstart', () => tile.classList.add('is-active'), { passive: true });
    tile.addEventListener('touchend', () => tile.classList.remove('is-active'), { passive: true });
    tile.addEventListener('touchcancel', () => tile.classList.remove('is-active'), { passive: true });
  });
}
