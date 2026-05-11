import { moveInstrumentation } from '../../scripts/scripts.js';
import { decorateButtonsV1 } from '../../scripts/bbl-decorators.js';
import createSmartImage from '../../scripts/utils/smartcrop-helper.js';

function getYouTubeId(url) {
  const regex = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

function getAssetSrc(cell) {
  return cell?.querySelector('a')?.href
    || cell?.querySelector('img')?.src
    || cell?.textContent?.trim()
    || '';
}

function changeBanner(block) {
  block.addEventListener('mouseenter', (e) => {
    const thumbnail = e.target.closest('.hero-banner-thumbnail-item');
    if (!thumbnail) return;
    const { index } = thumbnail.dataset;
    block.querySelectorAll('[data-index]').forEach((el) => {
      el.classList.toggle('hero-banner-item-active', el.classList.contains('hero-banner-item') && el.dataset.index === index);
      el.classList.toggle('hero-banner-thumbnail-item-active', el.classList.contains('hero-banner-thumbnail-item') && el.dataset.index === index);
    });
  }, true);
}

function lazyLoadThumbnails(block) {
  const load = () => {
    block.querySelector('.hero-banner-thumbnail-outer')?.classList.add('hero-banner-thumbnail-outer-active');
    window.removeEventListener('scroll', load);
  };
  window.addEventListener('scroll', load, { passive: true });
}

function stripInstrumentation(el) {
  [...el.querySelectorAll('*'), el].forEach((node) => {
    [...node.attributes]
      .filter(({ nodeName }) => nodeName.startsWith('data-aue-') || nodeName.startsWith('data-richtext-'))
      .forEach(({ nodeName }) => node.removeAttribute(nodeName));
  });
}

function createElement(tag, ...classNames) {
  const el = document.createElement(tag);
  if (classNames.length) el.classList.add(...classNames);
  return el;
}

function createThumbItem(picture, index, { strip = false, active = false } = {}) {
  const item = createElement('li', 'hero-banner-thumbnail-item');
  if (active) item.classList.add('hero-banner-thumbnail-item-active');
  item.dataset.index = index;
  if (picture) {
    if (strip) stripInstrumentation(picture);
    const img = picture.querySelector('img');
    if (img) { img.className = 'hero-banner-thumbnail-img'; img.loading = 'lazy'; item.append(img); }
  }
  return item;
}

export default function decorate(block) {
  const variant = block.children[0]?.textContent?.trim() || 'default';
  const bannerList = createElement('ul', 'hero-banner-list');
  let thumbnailList = '';

  if (variant === 'hero-with-thumbnail-images') {
    thumbnailList = createElement('ul', 'hero-banner-thumbnail-list', 'content');
  }

  [...block.children].slice(1, 9).forEach((row, i) => {
    const [
      mediaTypeCell,
      imageCellDesktop,
      imageCellMobile,
      imageAlt,
      youtubeUrlCell,
      damVideoCell,
      logoImageCell,
      thumbImgCell,
      headingCell,
      textCell,
      linkCell,
    ] = row.children;

    const bannerItem = createElement('li', 'hero-banner-item');
    if (i === 0) bannerItem.classList.add('hero-banner-item-active');
    bannerItem.dataset.index = i;

    const mediaType = mediaTypeCell?.textContent?.trim() || 'images';

    if (mediaType === 'bg-video') {
      const youtubeUrl = youtubeUrlCell?.querySelector('a')?.href
        || youtubeUrlCell?.textContent?.trim()
        || '';
      const damVideoSrc = getAssetSrc(damVideoCell);

      if (youtubeUrl) {
        const ytId = getYouTubeId(youtubeUrl);
        const iframe = document.createElement('iframe');
        iframe.src = ytId ? `https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&loop=1&playlist=${ytId}` : youtubeUrl;
        iframe.className = 'hero-banner-video';
        iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
        iframe.setAttribute('allowfullscreen', '');
        iframe.setAttribute('loading', 'lazy');
        bannerItem.append(iframe);
      } else if (damVideoSrc) {
        const video = document.createElement('video');
        video.className = 'hero-banner-video';
        video.autoplay = true;
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        const source = document.createElement('source');
        source.src = damVideoSrc;
        source.type = 'video/mp4';
        video.append(source);
        bannerItem.append(video);
      }
    } else {
      const pictureDesktop = imageCellDesktop?.querySelector('picture');
      const pictureMobile = imageCellMobile?.querySelector('picture');

      if (pictureDesktop || pictureMobile) {
        const heroPicture = createSmartImage(pictureDesktop, pictureMobile, imageAlt);
        if (heroPicture) {
          const img = heroPicture?.querySelector('img');
          img.className = 'hero-banner-img';
          img.loading = 'lazy';
          bannerItem.append(heroPicture);
        }
      }
    }

    const contentInner = createElement('div', 'hero-banner-content-inner');
    const logoImg = logoImageCell?.querySelector('img');
    if (logoImg) {
      logoImg.className = 'hero-banner-logo';
      const logoWrapper = createElement('div', 'hero-banner-logo-wrapper');
      logoWrapper.append(logoImg);
      contentInner.append(logoWrapper);
    }

    const contentGroup = createElement('div', 'hero-banner-content-group');
    if (textCell?.firstElementChild) textCell.firstElementChild.classList.add('hero-banner-content-inner-text');
    [headingCell, textCell, linkCell].forEach((cell) => {
      if (cell) contentGroup.innerHTML += cell.innerHTML;
    });
    decorateButtonsV1(contentGroup);

    contentInner.append(contentGroup);
    const content = createElement('div', 'hero-banner-content', 'content');
    content.append(contentInner);
    bannerItem.append(content);

    if (variant === 'hero-with-thumbnail-images') {
      const thumbPicture = thumbImgCell?.querySelector('picture');
      const cloned = thumbPicture?.cloneNode(true);
      const thumbImg = thumbPicture?.querySelector('img');
      if (thumbImg) {
        thumbImg.className = 'hero-banner-thumbnail-img';
        thumbImg.style.display = 'none';
        thumbImg.setAttribute('aria-hidden', 'true');
        bannerItem.append(thumbImg);
      }
      thumbnailList.append(createThumbItem(cloned, i, { strip: true, active: i === 0 }));
    }

    moveInstrumentation(row, bannerItem);
    bannerList.append(bannerItem);
  });

  const mainImgContainer = createElement('div', 'hero-banner-container');
  mainImgContainer.append(bannerList);

  const wrapper = createElement('div', 'hero-banner', `hero-banner-${variant}`);
  wrapper.append(mainImgContainer);

  if (variant === 'hero-with-thumbnail-images') {
    const thumbnailOuter = createElement('div', 'hero-banner-thumbnail-outer');
    thumbnailOuter.append(thumbnailList);
    wrapper.append(thumbnailOuter);
  }

  block.replaceChildren(wrapper);
  changeBanner(block);
  lazyLoadThumbnails(block);
}
