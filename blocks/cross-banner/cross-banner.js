import { createOptimizedPicture } from '../../scripts/aem.js';

function createElement(tag, ...classNames) {
  const el = document.createElement(tag);
  if (classNames.length) el.classList.add(...classNames);
  return el;
}

function createSmartImage(imageCellDesktop, imageCellMobile, imageAlt) {
  const imgDesktop = imageCellDesktop?.querySelector('img');
  const imgMobile = imageCellMobile?.querySelector('img');
  // Extract alt text from a cell that may contain HTML
  let altText = '';
  if (imageAlt) {
    // Try to get direct text (including from <p>, <span>, etc)
    altText = imageAlt.textContent?.trim() || '';
  }
  if (imgDesktop && imgMobile) {
    const picture = createElement('picture');

    const desktopSource = createElement('source');
    desktopSource.setAttribute('media', '(min-width: 761px)');
    const desktopSrc = imgDesktop.getAttribute('src');
    desktopSource.setAttribute('srcset', desktopSrc);

    const mobileSource = createElement('source');
    mobileSource.setAttribute('media', '(max-width: 760px)');
    const mobileSrc = imgMobile.getAttribute('src');
    mobileSource.setAttribute('srcset', mobileSrc);

    const img = createElement('img');
    img.setAttribute('loading', 'lazy');

    img.setAttribute('alt', altText || img.alt || '');
    img.setAttribute('src', mobileSrc);

    picture.appendChild(desktopSource);
    picture.appendChild(mobileSource);
    picture.appendChild(img);

    return picture;
  }
  const img = imgMobile || imgDesktop;
  if (!img) return null;
  return createOptimizedPicture(
    img.src,
    altText || '',
    false,
    [{ media: '(max-width: 760px)', width: '2000' }, { width: '750' }],
  );
}

export default function decorate(block) {
  const [imgElDesktop, imgElMobile, imgAlt, budgeTextEl, titleEl, descriptionEl, buttonEl] = block.children;
  // const pictureHTML = imgEl?.querySelector('img')?.outerHTML || '';
  const picture = createSmartImage(imgElDesktop, imgElMobile, imgAlt);
  const pictureHTML = picture?.outerHTML || '';
  const budgeText = budgeTextEl?.textContent?.trim() || '';
  const titleName = titleEl?.textContent?.trim() || '';
  const description = descriptionEl?.querySelector('p')?.innerHTML?.trim() || '';
  const anchor = buttonEl?.querySelector('a');
  if (anchor) anchor.classList.add('button-m');
  const buttonHTML = buttonEl?.innerHTML?.trim() || '';

  block.innerHTML = `
    <div class="cross-banner content">
      <div class="cross-banner-image">
        ${pictureHTML}
      </div>
      <div class="cross-banner-content">
        ${budgeText ? `<div class="cross-banner-badge">${budgeText}</div>` : ''}
        <div class="cross-banner-title">${titleName}</div>
        <div class="cross-banner-description">${description}</div>
        <div class="cross-banner-button">${buttonHTML}</div>
      </div>
    </div>
  `;
}
