import { moveInstrumentation } from '../../scripts/scripts.js';

function initCarousel(carousel, track) {
  const total = track.children.length;
  if (total <= 4) return;

  const autoplay = carousel.dataset.autoplay !== 'false';
  const speed = parseInt(carousel.dataset.autoplaySpeed, 10) || 3000;
  const infinite = carousel.dataset.infinite !== 'false';
  const maxIndex = total - 4;
  const STEP = 4;

  let currentIndex = 0;
  let autoplayTimer = null;
  let isDragging = false;
  let startX = 0;

  function getSlideWidth() {
    const item = track.firstElementChild;
    if (!item) return 0;
    return item.getBoundingClientRect().width
      + (parseFloat(getComputedStyle(track).columnGap) || 0);
  }

  function slideTo(index) {
    currentIndex = Math.max(0, Math.min(index, maxIndex));
    track.style.transform = `translate3d(${-currentIndex * getSlideWidth()}px, 0, 0)`;
  }

  function stopAutoplay() {
    clearInterval(autoplayTimer);
    autoplayTimer = null;
  }

  function next() {
    if (!infinite && currentIndex >= maxIndex) {
      stopAutoplay();
      return;
    }
    const nextIndex = currentIndex + STEP;
    slideTo(infinite && nextIndex > maxIndex ? 0 : nextIndex);
  }

  function startAutoplay() {
    if (!autoplay || autoplayTimer) return;
    autoplayTimer = setInterval(next, speed);
  }

  if (autoplay) startAutoplay();

  carousel.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    carousel.classList.add('is-dragging');
    stopAutoplay();
    e.preventDefault();
  });

  document.addEventListener('mouseup', (e) => {
    if (!isDragging) return;
    isDragging = false;
    carousel.classList.remove('is-dragging');
    const diff = e.clientX - startX;
    if (diff < -50) slideTo(currentIndex + STEP);
    else if (diff > 50) slideTo(currentIndex - STEP);
    startAutoplay();
  });

  carousel.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    stopAutoplay();
  }, { passive: true });

  carousel.addEventListener('touchend', (e) => {
    const diff = e.changedTouches[0].clientX - startX;
    if (diff < -50) slideTo(currentIndex + STEP);
    else if (diff > 50) slideTo(currentIndex - STEP);
    startAutoplay();
  }, { passive: true });
}

export default function decorate(block) {
  const existingWrapper = block.querySelector(':scope > .header-banner-slide-wrapper');
  if (existingWrapper) existingWrapper.remove();

  const blockResource = block.dataset.aueResource;
  if (blockResource) {
    block.ownerDocument.querySelectorAll('.header-banner-slide.block').forEach((other) => {
      if (other !== block
        && other.dataset.aueResource === blockResource
        && other.querySelector(':scope > .header-banner-slide-wrapper')) {
        other.remove();
      }
    });
  }

  const allRows = [...block.children];

  const configRows = [];
  const creditCardcells = [];

  allRows.forEach((row) => {
    const hasImage = row.querySelector('img, picture');
    const isUEItem = row.querySelector('[data-aue-resource]') || row.dataset.aueResource;
    if (hasImage || isUEItem) {
      creditCardcells.push(row);
    } else {
      configRows.push(row);
    }
  });

  const [titleEl, isAutoPlayEl, scrollTimeDelayEl, infiniteLoopEl] = configRows;

  const title = titleEl?.textContent?.trim();
  const isAutoPlay = isAutoPlayEl?.textContent?.trim();
  const scrollTimeDelay = scrollTimeDelayEl?.textContent?.trim();
  const infiniteLoop = infiniteLoopEl?.textContent?.trim();

  configRows.forEach((row) => row?.remove());

  const wrapper = document.createElement('div');
  wrapper.className = 'header-banner-slide-wrapper';

  const titleDiv = document.createElement('div');
  titleDiv.className = 'header-banner-slide-title';
  if (title) titleDiv.textContent = title;
  wrapper.appendChild(titleDiv);

  const carousel = document.createElement('div');
  carousel.className = 'header-banner-slide-carousel';
  carousel.dataset.autoplay = isAutoPlay ?? 'true';
  carousel.dataset.autoplaySpeed = scrollTimeDelay ?? '3000';
  carousel.dataset.infinite = infiniteLoop ?? 'true';

  const track = document.createElement('div');
  track.className = 'header-banner-slide-track';

  creditCardcells.forEach((item) => {
    const [creditCardImagesEl] = item.children || [];

    const cardItem = document.createElement('div');
    cardItem.className = 'header-banner-slide-item';
    if (creditCardImagesEl) {
      const picture = creditCardImagesEl.querySelector('picture');
      const img = creditCardImagesEl.querySelector('img');
      if (picture) {
        cardItem.appendChild(picture);
      } else if (img) {
        cardItem.appendChild(img);
      }
    }

    moveInstrumentation(item, cardItem);
    track.appendChild(cardItem);
    item.hidden = true;
    item.style.display = 'none';
  });

  carousel.appendChild(track);
  wrapper.appendChild(carousel);
  block.appendChild(wrapper);

  requestAnimationFrame(() => requestAnimationFrame(() => initCarousel(carousel, track)));
}
