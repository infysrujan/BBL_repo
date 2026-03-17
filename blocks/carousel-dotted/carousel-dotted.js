import { moveInstrumentation } from '../../scripts/scripts.js';
import {
  readBoolean,
  readDotsAlignment,
  readPosition,
  readArrowsAlignment,
} from '../../scripts/helper-files/carousel-helpers.js';
import { decorateButtonsV1 } from '../../scripts/bbl-decorators.js';

/**
 * Build a slide WITH IMAGE variation
 * Structure: Badge Text | Image | Description | Link
 */
function buildSlideWithImage(row, index, cells) {
  const slide = document.createElement('div');
  slide.className = 'carousel-dotted-item with-image';
  slide.dataset.index = index;
  moveInstrumentation(row, slide);

  // Create and append background image if it exists
  const picture = cells[3]?.querySelector('picture');
  if (picture) {
    const media = document.createElement('div');
    media.className = 'carousel-bg';
    media.append(picture);
    slide.append(media);
  }

  // Create content container
  const content = document.createElement('div');
  content.className = 'carousel-dotted-content';

  // Badge text (cell 2)
  const badgeText = cells[2]?.textContent.trim();
  if (badgeText) {
    const badge = document.createElement('div');
    badge.className = 'carousel-badge';
    badge.textContent = badgeText;
    content.append(badge);
  }

  // Description (cell 4)
  if (cells[4]) {
    const description = document.createElement('div');
    description.className = 'carousel-dotted-description';
    while (cells[4].firstChild) description.append(cells[4].firstChild);
    content.append(description);
  }

  // Link/Button (cell 5)
  const link = cells[5]?.querySelector('a');
  if (link) {
    content.append(link);
  }

  slide.append(content);
  return slide;
}

/**
 * Build a slide WITHOUT IMAGE variation
 * Structure: Header Text | Default Text
 */
function buildSlideWithoutImage(row, index, cells) {
  const slide = document.createElement('div');
  slide.className = 'carousel-dotted-item without-image';
  slide.dataset.index = index;
  moveInstrumentation(row, slide);

  // Create content container
  const content = document.createElement('div');
  content.className = 'carousel-dotted-content';

  // Header text (cell 7)
  const headerText = cells[7]?.textContent.trim();
  if (headerText) {
    const header = document.createElement('div');
    header.className = 'carousel-dotted-header';
    header.textContent = headerText;
    content.append(header);
  }

  // Default text (cell 8)
  if (cells[8]) {
    const defaultText = document.createElement('div');
    defaultText.className = 'carousel-default-text';
    while (cells[8].firstChild) defaultText.append(cells[8].firstChild);
    content.append(defaultText);
  }

  slide.append(content);
  return slide;
}

/**
 * Build a slide HERO BANNER IMAGE CAROUSEL or TEXT ANIMATION VARIANT
 * Structure: Image | Image Alt | Title | Subtitle | Button
 */
function buildSlideHeroVariant(row, index, cells, variant) {
  const slide = document.createElement('div');
  slide.className = `carousel-item ${variant}`;
  slide.dataset.index = index;

  const [heroImageCell, titleCell, subtitleCell, linkCell] = cells.slice(11, 15);
  const picture = heroImageCell?.querySelector('picture');
  if (picture) {
    const media = document.createElement('div');
    media.className = 'carousel-bg';
    media.append(picture);
    slide.append(media);
  }

  const content = document.createElement('div');
  content.className = 'carousel-content content';

  if (titleCell) {
    const title = document.createElement('div');
    title.classList.add('carousel-title', 'animated-text');
    title.innerHTML = titleCell.innerHTML;
    content.append(title);
  }

  if (subtitleCell) {
    const subtitle = document.createElement('div');
    subtitle.classList.add('carousel-subtitle', 'text-animation-variant', 'animated-text');
    subtitle.innerHTML = subtitleCell.innerHTML;
    content.append(subtitle);
  }

  if (linkCell) {
    content.innerHTML += linkCell.innerHTML;
  }

  decorateButtonsV1(content);
  content.querySelector('a')?.classList.add('button-m', 'animated-text');

  slide.append(content);
  return slide;
}

/**
 * Build a slide - determines which variation to use and delegates
 */
function buildSlide(row, index) {
  const cells = [...row.children];

  const heroBannerImageCarousel = cells[9]?.textContent.trim().toLowerCase() === 'true';
  const textAnimationVariant = cells[10]?.textContent.trim().toLowerCase() === 'true';
  const withImageIndicator = cells[1]?.textContent.trim().toLowerCase();
  const picture = cells[3]?.querySelector('picture');

  // Determine slide type priority
  if (heroBannerImageCarousel) {
    return buildSlideHeroVariant(row, index, cells, 'hero-banner-image-carousel');
  }

  if (textAnimationVariant) {
    return buildSlideHeroVariant(row, index, cells, 'text-animation-variant');
  }

  // Determine if this is a with-image slide:
  // Either has "true" in cell 0 OR has a picture in cell 2
  const hasImage = (withImageIndicator === 'true' || !!picture);

  if (hasImage) {
    return buildSlideWithImage(row, index, cells);
  }
  return buildSlideWithoutImage(row, index, cells);
}

/**
 * Initialize drag/swipe functionality for the carousel
 * @param {HTMLElement} block - The carousel block element
 * @param {Array} slideEls - Array of slide elements
 * @param {Function} setActive - Function to set active slide
 * @param {number} dragThreshold - Minimum drag distance to trigger slide change
 * @param {boolean} enableLooping - Whether to enable infinite looping
 */

function initializeDragSwipe(
  block,
  slideEls,
  setActive,
  dragThreshold = 50,
  enableLooping = false,
) {
  let isDragging = false;
  let startX = 0;
  let currentX = 0;
  let hasMoved = false;

  const handleStart = (e) => {
    if (e.target.closest('a, button')) return;
    isDragging = true;
    hasMoved = false;
    startX = e.type === 'touchstart' ? e.touches[0].pageX : (e.pageX || e.clientX);
    currentX = startX;
    block.classList.add('is-dragging');
  };

  const handleMove = (e) => {
    if (!isDragging) return;
    currentX = e.type === 'touchmove' ? e.touches[0].pageX : (e.pageX || e.clientX);
    if (Math.abs(currentX - startX) > 5) hasMoved = true;
  };

  const handleEnd = () => {
    if (!isDragging) return;

    isDragging = false;
    block.classList.remove('is-dragging');

    const deltaX = currentX - startX;

    if (hasMoved && Math.abs(deltaX) > dragThreshold) {
      const currentIndex = slideEls.findIndex((slide) => slide.classList.contains('is-active'));

      if (deltaX < -dragThreshold) {
        let nextIndex;
        if (enableLooping) {
          nextIndex = currentIndex < slideEls.length - 1 ? currentIndex + 1 : 0;
        } else {
          nextIndex = currentIndex < slideEls.length - 1 ? currentIndex + 1 : currentIndex;
        }
        if (nextIndex !== currentIndex) setActive(nextIndex);
      } else if (deltaX > dragThreshold) {
        let prevIndex;
        if (enableLooping) {
          prevIndex = currentIndex > 0 ? currentIndex - 1 : slideEls.length - 1;
        } else {
          prevIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex;
        }
        if (prevIndex !== currentIndex) setActive(prevIndex);
      }
    }

    // Reset drag state
    startX = 0;
    currentX = 0;
    hasMoved = false;
  };

  const handleCancel = () => {
    if (isDragging) {
      isDragging = false;
      block.classList.remove('is-dragging');
      startX = 0;
      currentX = 0;
      hasMoved = false;
    }
  };

  // Add mouse event listeners for desktop
  block.addEventListener('mousedown', handleStart);
  block.addEventListener('mousemove', handleMove);
  block.addEventListener('mouseup', handleEnd);
  block.addEventListener('mouseleave', handleCancel);

  // Add touch event listeners for mobile/tablet
  block.addEventListener('touchstart', handleStart, { passive: true });
  block.addEventListener('touchmove', handleMove, { passive: true });
  block.addEventListener('touchend', handleEnd);
  block.addEventListener('touchcancel', handleCancel);
}

/**
 * Initialize auto-scroll functionality for the carousel
 * @param {HTMLElement} block - The carousel block element
 * @param {Array} slideEls - Array of slide elements
 * @param {Function} setActive - Function to set active slide
 * @param {HTMLElement} prevArrow - Previous arrow button
 * @param {HTMLElement} nextArrow - Next arrow button
 * @param {Array} dotButtons - Array of dot button objects
 * @param {number} delay - Scroll delay in milliseconds
 * @param {number} itemsPerScroll - Number of items to scroll at once
 */
function initializeAutoScroll(
  block,
  slideEls,
  setActive,
  prevArrow,
  nextArrow,
  dotButtons,
  delay,
  itemsPerScroll,
) {
  let autoScrollInterval;

  const startAutoScroll = () => {
    if (autoScrollInterval) return;
    autoScrollInterval = setInterval(() => {
      const currentIndex = slideEls.findIndex((slide) => slide.classList.contains('is-active'));
      let nextIdx = currentIndex + itemsPerScroll;
      if (nextIdx >= slideEls.length) nextIdx = 0;
      setActive(nextIdx);
    }, delay);
  };

  const stopAutoScroll = () => {
    if (autoScrollInterval) {
      clearInterval(autoScrollInterval);
      autoScrollInterval = null;
    }
  };

  // Start auto-scroll immediately
  startAutoScroll();

  // Pause auto-scroll on hover
  block.addEventListener('mouseenter', stopAutoScroll);
  block.addEventListener('mouseleave', startAutoScroll);

  // Pause auto-scroll when user interacts with navigation
  const pauseAutoScrollOnInteraction = () => {
    stopAutoScroll();
    // Resume after a delay (2x the scroll delay)
    setTimeout(startAutoScroll, delay * 2);
  };

  prevArrow.addEventListener('click', pauseAutoScrollOnInteraction);
  nextArrow.addEventListener('click', pauseAutoScrollOnInteraction);
  dotButtons.forEach(({ button }) => {
    button.addEventListener('click', pauseAutoScrollOnInteraction);
  });

  // Clean up interval when block is removed from DOM
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.removedNodes.forEach((node) => {
        if (node === block || node.contains(block)) {
          stopAutoScroll();
          observer.disconnect();
        }
      });
    });
  });

  if (block.parentNode) {
    observer.observe(block.parentNode, { childList: true });
  }
}

export default function decorate(block) {
  const rows = [...block.children];

  // Read configuration values from block rows
  const showDots = readBoolean(rows[0]);
  const dotsAlignment = readDotsAlignment(rows[1]);
  const dotsPosition = readPosition(rows[2]);
  const showArrows = readBoolean(rows[3]);
  const arrowsAlignment = readArrowsAlignment(rows[4]);
  const autoScroll = readBoolean(rows[5]);
  const scrollTimeDelay = rows[6]?.textContent.trim() || '';
  let nextIndex = 7;
  let seeMoreLink = null;

  while (nextIndex < rows.length) {
    const row = rows[nextIndex];
    const link = row?.querySelector('a');
    const hasContent = row?.textContent.trim();

    if (link) {
      seeMoreLink = link;
      nextIndex += 1;
      break;
    } else if (!hasContent) {
      nextIndex += 1;
    } else {
      break;
    }
  }

  const slides = rows.slice(nextIndex);
  block.className = 'carousel-dotted';

  if (showDots) {
    block.classList.add(`dots-${dotsAlignment}-${dotsPosition}`);
  } else {
    block.classList.add('no-dots');
  }

  if (showArrows) {
    block.classList.add('show-arrows');
    block.classList.add(`arrows-${arrowsAlignment}`);
  }

  if (autoScroll) {
    block.classList.add('auto-scroll');
    if (scrollTimeDelay) block.dataset.scrollDelay = scrollTimeDelay;
  }

  block.setAttribute('role', 'region');
  block.setAttribute('aria-roledescription', 'carousel');

  const slideEls = slides.map((row, index) => buildSlide(row, index));

  const slidesWithImage = slideEls.filter((s) => s.classList.contains('with-image')).length;
  const slidesWithoutImage = slideEls.filter((s) => s.classList.contains('without-image')).length;
  const slidesHeroBanner = slideEls.filter((s) => s.classList.contains('hero-banner-image-carousel')).length;
  const slidesTextAnimation = slideEls.filter((s) => s.classList.contains('text-animation-variant')).length;

  if (
    slidesWithImage > 0
  && slidesWithoutImage === 0
  && slidesHeroBanner === 0
  && slidesTextAnimation === 0
  ) {
    block.classList.add('all-with-image');
  } else if (
    slidesWithoutImage > 0
    && slidesWithImage === 0
    && slidesHeroBanner === 0
    && slidesTextAnimation === 0
  ) {
    block.classList.add('all-without-image');
  } else if (
    slidesHeroBanner > 0
    && slidesWithImage === 0
    && slidesWithoutImage === 0
    && slidesTextAnimation === 0
  ) {
    block.classList.add('all-hero-banner-image-carousel');
  } else if (
    slidesTextAnimation > 0
    && slidesWithImage === 0
    && slidesWithoutImage === 0
    && slidesHeroBanner === 0
  ) {
    block.classList.add('all-text-animation-variant');
  } else {
    block.classList.add('mixed-image-slides');
  }
  const dots = document.createElement('ul');
  dots.className = 'slick-dots';
  dots.setAttribute('role', 'tablist');

  // Create arrows
  const prevArrow = document.createElement('button');
  prevArrow.className = 'carousel-arrow carousel-arrow-prev';
  prevArrow.setAttribute('aria-label', 'Previous slide');
  prevArrow.type = 'button';

  const nextArrow = document.createElement('button');
  nextArrow.className = 'carousel-arrow carousel-arrow-next';
  nextArrow.setAttribute('aria-label', 'Next slide');
  nextArrow.type = 'button';

  let dotButtons;

  const zoomTimers = new Map();

  function triggerBgZoom(slideEl) {
    const bg = slideEl.querySelector('.carousel-bg');
    if (!bg) return;

    if (zoomTimers.has(slideEl)) {
      clearTimeout(zoomTimers.get(slideEl));
    }

    bg.classList.remove('bg-zoom-enter');
    // eslint-disable-next-line no-unused-expressions
    bg.offsetWidth;
    bg.classList.add('bg-zoom-enter');

    const timer = setTimeout(() => {
      bg.classList.remove('bg-zoom-enter');
      zoomTimers.delete(slideEl);
    }, 800);
    zoomTimers.set(slideEl, timer);
  }

  let isFirstLoad = true;

  function setActive(index) {
    const prevIndex = slideEls.findIndex((slide) => slide.classList.contains('is-active'));

    const isHeroVariant = block.classList.contains('all-hero-banner-image-carousel')
      || block.classList.contains('all-text-animation-variant');

    const allHeroBanner = (slidesHeroBanner > 0 || slidesTextAnimation > 0)
      && slidesWithImage === 0
      && slidesWithoutImage === 0;

    const allWithoutImageTrack = slidesWithoutImage > 0
      && slidesWithImage === 0
      && slidesHeroBanner === 0
      && slidesTextAnimation === 0;

    const isLoopingForward = index === 0 && prevIndex === slideEls.length - 1;

    slideEls.forEach((slide, i) => {
      const active = i === index;
      const wasActive = slide.classList.contains('is-active');
      if (isHeroVariant && !wasActive && active && !isFirstLoad) {
        if (!isLoopingForward) {
          triggerBgZoom(slide);
          slide.classList.add('is-entering');
          setTimeout(() => slide.classList.remove('is-entering'), 600);
        }
      }

      slide.classList.toggle('is-active', active);
      slide.classList.toggle('is-current', active);
      slide.setAttribute('aria-hidden', active ? 'false' : 'true');
    });
    dotButtons.forEach(({ li, button }, i) => {
      const active = i === index;
      li.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
      button.tabIndex = active ? 0 : -1;
    });

    prevArrow.disabled = index === 0;
    nextArrow.disabled = index === slideEls.length - 1;

    if (allHeroBanner || allWithoutImageTrack) {
      const trackWrapper = block.querySelector('.carousel-track-wrapper');
      if (trackWrapper) {
        const slideWidth = block.offsetWidth;

        if (isLoopingForward) {
          if (isHeroVariant && !isFirstLoad) {
            const cloneSlide = trackWrapper.lastElementChild;
            triggerBgZoom(cloneSlide);
            cloneSlide.classList.add('is-entering');
            setTimeout(() => cloneSlide.classList.remove('is-entering'), 600);
          }

          trackWrapper.style.transform = `translate3d(${-slideEls.length * slideWidth}px, 0px, 0px)`;
          setTimeout(() => {
            trackWrapper.style.transition = 'none';
            trackWrapper.style.transform = 'translate3d(0px, 0px, 0px)';
            trackWrapper.getBoundingClientRect();
            trackWrapper.style.transition = '';
          }, 700);
        } else {
          trackWrapper.style.transform = `translate3d(${-index * slideWidth}px, 0px, 0px)`;
        }
      }
    }
  }

  prevArrow.addEventListener('click', () => {
    const currentIndex = slideEls.findIndex((slide) => slide.classList.contains('is-active'));
    if (currentIndex > 0) setActive(currentIndex - 1);
  });

  nextArrow.addEventListener('click', () => {
    const currentIndex = slideEls.findIndex((slide) => slide.classList.contains('is-active'));
    if (currentIndex < slideEls.length - 1) setActive(currentIndex + 1);
  });
  dotButtons = slideEls.map((slide, index) => {
    const li = document.createElement('li');
    li.setAttribute('role', 'presentation');
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-label', `Slide ${index + 1}`);
    button.addEventListener('click', () => setActive(index));
    li.append(button);
    dots.append(li);
    return { li, button };
  });

  const allWithoutImage = slidesWithoutImage > 0
    && slidesWithImage === 0
    && slidesHeroBanner === 0
    && slidesTextAnimation === 0;

  const allHeroBanner = (slidesHeroBanner > 0 || slidesTextAnimation > 0)
    && slidesWithImage === 0
    && slidesWithoutImage === 0;

  if (allHeroBanner || allWithoutImage) {
    const trackWrapper = document.createElement('div');
    trackWrapper.className = 'carousel-track-wrapper';
    const cloneFirst = slideEls[0].cloneNode(true);
    cloneFirst.setAttribute('aria-hidden', 'true');
    trackWrapper.replaceChildren(...slideEls, cloneFirst);
    block.replaceChildren(trackWrapper);
  } else {
    block.replaceChildren(...slideEls);
  }

  if (showDots) {
    block.append(dots);
  } else if (showArrows) {
    block.append(prevArrow, nextArrow);
  }

  if (seeMoreLink) {
    const moreWrap = document.createElement('div');
    moreWrap.className = 'carousel-dotted-more';
    seeMoreLink.classList.add('icon-arrow-left');
    moreWrap.append(seeMoreLink);
    block.append(moreWrap);
  }

  if (slideEls.length) {
    setActive(0);
  }

  requestAnimationFrame(() => {
    isFirstLoad = false;
  });

  if (autoScroll && scrollTimeDelay) {
    const delay = parseInt(scrollTimeDelay, 10);
    initializeAutoScroll(block, slideEls, setActive, prevArrow, nextArrow, dotButtons, delay, 1);
  }

  // Initialize drag/swipe functionality
  // Enable looping only if slides have images (like Grow Club section)
  // Disable looping for text-only slides (like News and Activities section)
  const enableLooping = slidesWithImage > 0 || slidesHeroBanner > 0 || slidesTextAnimation > 0;
  initializeDragSwipe(block, slideEls, setActive, 50, enableLooping);
}
