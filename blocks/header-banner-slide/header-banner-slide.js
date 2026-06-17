import { moveInstrumentation } from '../../scripts/scripts.js';

export default function decorate(block) {
  const [titleEl,
    isAutoPlayEl,
    scrollTimeDelayEl,
    infiniteLoopEl,
    ...creditCardcells
  ] = block.children;

  const title = titleEl?.textContent?.trim();
  const isAutoPlay = isAutoPlayEl?.textContent?.trim();
  const scrollTimeDelay = scrollTimeDelayEl?.textContent?.trim();
  const infiniteLoop = infiniteLoopEl?.textContent?.trim();
  let creditCardcellsHTML = '';

  creditCardcells.forEach((item) => {
    const [creditCardImagesEl] = item.children || [];
    if (creditCardImagesEl) {
      const picture = creditCardImagesEl.querySelector('picture');
      const img = creditCardImagesEl.querySelector('img');

      if (!img) return;

      const cardHTML = (picture || img).outerHTML;
      item.innerHTML = `
        <div class="header-banner-slide-item">
          ${cardHTML}
        </div>`;
      moveInstrumentation(item, item.firstElementChild);
      creditCardcellsHTML += item.innerHTML;
    }
  });

  block.innerHTML = `
    <div class="header-banner-slide-wrapper">
      <div class="header-banner-slide-title">${title}</div>
      <div class="header-banner-slide-carousel"
           data-autoplay="${isAutoPlay ?? 'true'}"
           data-autoplay-speed="${scrollTimeDelay ?? '3000'}"
           data-infinite="${infiniteLoop ?? 'true'}">
        <div class="header-banner-slide-track">
          ${creditCardcellsHTML}
        </div>
      </div>
    </div>
  `;
}
