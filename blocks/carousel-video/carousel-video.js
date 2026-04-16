import { moveInstrumentation } from '../../scripts/scripts.js';

const VISIBLE = 4;
const THUMB_GAP = 12;

function getYouTubeId(url) {
  const regex = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/;
  const match = url?.match(regex);
  return match ? match[1] : null;
}

export default function decorate(block) {
  // Tell UE this block is a container that accepts carousel-video-item children.
  // Without these attributes the "+" add-child button in the editor shows nothing.
  if (document.documentElement.classList.contains('adobe-ue-edit')) {
    block.setAttribute('data-aue-type', 'container');
    block.setAttribute('data-aue-filter', 'carousel-video');
  }

  const rows = [...block.children];

  // Each row is a carousel-video-item; pair it with its YouTube ID
  const allItems = rows.map((row) => {
    const link = row.querySelector('a');
    const text = row.querySelector('div')?.textContent?.trim();
    const url = link?.getAttribute('href') || text || '';
    return { row, id: getYouTubeId(url) };
  });

  const items = allItems.filter((item) => item.id);

  // Always clear and rebuild so UE instrumentation is applied correctly
  block.innerHTML = '';

  // For rows with no valid YouTube ID, preserve their UE instrumentation via
  // hidden placeholders so UE can still track and manage those child items.
  const orphanRows = allItems.filter((item) => !item.id);
  orphanRows.forEach(({ row }) => {
    const placeholder = document.createElement('div');
    placeholder.hidden = true;
    moveInstrumentation(row, placeholder);
    block.appendChild(placeholder);
  });

  // Render nothing visible if no valid URLs yet (block element keeps data-aue-* for UE)
  if (items.length === 0) return;

  let scrollIndex = 0;
  let activeIndex = 0;

  // ── Main player ──────────────────────────────────────────────────────────
  const mainPlayer = document.createElement('div');
  mainPlayer.className = 'cv-main-player';

  const iframe = document.createElement('iframe');
  iframe.src = `https://www.youtube.com/embed/${items[0].id}`;
  iframe.title = 'YouTube Video Player';
  iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
  iframe.setAttribute('allowfullscreen', '');
  iframe.setAttribute('loading', 'lazy');
  mainPlayer.appendChild(iframe);
  block.appendChild(mainPlayer);

  // ── Thumbnail carousel ────────────────────────────────────────────────────
  const carouselSection = document.createElement('div');
  carouselSection.className = 'cv-carousel-section';

  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'cv-nav cv-prev';
  prevBtn.setAttribute('aria-label', 'Previous');

  const trackWrap = document.createElement('div');
  trackWrap.className = 'cv-track-wrap';

  const track = document.createElement('div');
  track.className = 'cv-track';

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'cv-nav cv-next';
  nextBtn.setAttribute('aria-label', 'Next');

  // Build one thumbnail per item; move UE instrumentation from original row
  const thumbEls = items.map(({ row, id }, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cv-thumb';
    if (i === 0) btn.classList.add('active');
    btn.setAttribute('aria-label', `Play video ${i + 1}`);

    const img = document.createElement('img');
    img.src = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
    img.alt = `Video ${i + 1} thumbnail`;
    img.loading = 'lazy';

    btn.appendChild(img);

    // Preserve data-aue-* attributes so UE can track and manage each item
    moveInstrumentation(row, btn);

    track.appendChild(btn);
    return btn;
  });

  trackWrap.appendChild(track);
  carouselSection.appendChild(prevBtn);
  carouselSection.appendChild(trackWrap);
  carouselSection.appendChild(nextBtn);
  block.appendChild(carouselSection);

  // ── Dots ──────────────────────────────────────────────────────────────────
  const dotsEl = document.createElement('div');
  dotsEl.className = 'cv-dots';

  const dotEls = items.map((_, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'cv-dot';
    if (i === 0) dot.classList.add('active');
    dot.setAttribute('aria-label', `Video ${i + 1}`);
    dotsEl.appendChild(dot);
    return dot;
  });

  block.appendChild(dotsEl);

  // ── State helpers ─────────────────────────────────────────────────────────
  function setActive(index, autoplay = false) {
    activeIndex = index;
    iframe.src = `https://www.youtube.com/embed/${items[index].id}${autoplay ? '?autoplay=1' : ''}`;
    thumbEls.forEach((t, i) => t.classList.toggle('active', i === index));
    dotEls.forEach((d, i) => d.classList.toggle('active', i === index));
    prevBtn.disabled = index <= 0;
    nextBtn.disabled = index >= items.length - 1;
  }

  function scrollTrack(newIndex) {
    scrollIndex = Math.max(0, Math.min(newIndex, Math.max(0, items.length - VISIBLE)));
    const thumbWidth = thumbEls[0]?.offsetWidth || 0;
    track.style.transform = `translateX(-${scrollIndex * (thumbWidth + THUMB_GAP)}px)`;
  }

  function ensureVisible(index) {
    if (index < scrollIndex) {
      scrollTrack(index);
    } else if (index >= scrollIndex + VISIBLE) {
      scrollTrack(index - VISIBLE + 1);
    }
  }

  // ── Event listeners ───────────────────────────────────────────────────────
  thumbEls.forEach((btn, i) => {
    btn.addEventListener('click', () => {
      setActive(i, true);
      ensureVisible(i);
    });
  });

  prevBtn.addEventListener('click', () => {
    if (activeIndex > 0) {
      setActive(activeIndex - 1, true);
      ensureVisible(activeIndex);
    }
  });

  nextBtn.addEventListener('click', () => {
    if (activeIndex < items.length - 1) {
      setActive(activeIndex + 1, true);
      ensureVisible(activeIndex);
    }
  });

  dotEls.forEach((dot, i) => {
    dot.addEventListener('click', () => {
      setActive(i, true);
      ensureVisible(i);
    });
  });

  // ── Initial state ─────────────────────────────────────────────────────────
  prevBtn.disabled = true;
  nextBtn.disabled = items.length <= 1;

  // Recalculate scroll offset on resize
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => scrollTrack(scrollIndex), 200);
  });
}
