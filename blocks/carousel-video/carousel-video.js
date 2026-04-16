const VISIBLE = 4;
const THUMB_GAP = 12;

function getYouTubeId(url) {
  const regex = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/;
  const match = url?.match(regex);
  return match ? match[1] : null;
}

export default function decorate(block) {
  const rows = [...block.children];

  // Each row is a carousel-video-item; extract its YouTube URL
  const videoIds = rows.map((row) => {
    const link = row.querySelector('a');
    const text = row.querySelector('div')?.textContent?.trim();
    const url = link?.getAttribute('href') || text || '';
    return getYouTubeId(url);
  }).filter(Boolean);

  block.textContent = '';

  if (videoIds.length === 0) return;

  let scrollIndex = 0;

  // ── Main player ──────────────────────────────────────────────────────────
  const mainPlayer = document.createElement('div');
  mainPlayer.className = 'cv-main-player';

  const iframe = document.createElement('iframe');
  iframe.src = `https://www.youtube.com/embed/${videoIds[0]}`;
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

  const thumbEls = videoIds.map((id, i) => {
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

  const dotEls = videoIds.map((_, i) => {
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
    iframe.src = `https://www.youtube.com/embed/${videoIds[index]}${autoplay ? '?autoplay=1' : ''}`;
    thumbEls.forEach((t, i) => t.classList.toggle('active', i === index));
    dotEls.forEach((d, i) => d.classList.toggle('active', i === index));
  }

  function scrollTrack(newIndex) {
    scrollIndex = Math.max(0, Math.min(newIndex, Math.max(0, videoIds.length - VISIBLE)));
    const thumbWidth = thumbEls[0]?.offsetWidth || 0;
    track.style.transform = `translateX(-${scrollIndex * (thumbWidth + THUMB_GAP)}px)`;
    prevBtn.disabled = scrollIndex <= 0;
    nextBtn.disabled = videoIds.length <= VISIBLE || scrollIndex >= videoIds.length - VISIBLE;
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
    if (scrollIndex > 0) scrollTrack(scrollIndex - 1);
  });

  nextBtn.addEventListener('click', () => {
    if (scrollIndex < videoIds.length - VISIBLE) scrollTrack(scrollIndex + 1);
  });

  dotEls.forEach((dot, i) => {
    dot.addEventListener('click', () => {
      setActive(i, true);
      ensureVisible(i);
    });
  });

  // ── Initial state ─────────────────────────────────────────────────────────
  prevBtn.disabled = true;
  nextBtn.disabled = videoIds.length <= VISIBLE;

  // Recalculate scroll offset on resize
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => scrollTrack(scrollIndex), 200);
  });
}
