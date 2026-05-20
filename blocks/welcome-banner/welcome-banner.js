import { moveInstrumentation } from '../../scripts/scripts.js';

function isBannerActive(startStr, endStr) {
  const now = new Date();
  if (startStr) {
    const start = new Date(startStr);
    if (!Number.isNaN(start.getTime()) && now < start) return false;
  }
  if (endStr) {
    const end = new Date(endStr);
    if (!Number.isNaN(end.getTime()) && now > end) return false;
  }
  return true;
}

export default function decorate(block) {
  const rows = [...block.children];
  const [
    desktopImgRow, mobileImgRow, isActiveRow, publishDateRow, unpublishDateRow, ...buttonRows
  ] = rows;

  const doc = block.ownerDocument;

  const placeholder = doc.createElement('div');
  placeholder.className = 'welcome-banner-placeholder';
  moveInstrumentation(block, placeholder);
  block.replaceWith(placeholder);

  const isActive = isActiveRow?.textContent?.trim().toLowerCase() === 'true';
  if (!isActive) return;

  const publishDate = publishDateRow?.textContent?.trim() || '';
  const unpublishDate = unpublishDateRow?.textContent?.trim() || '';
  if (!isBannerActive(publishDate, unpublishDate)) return;

  const desktopPic = desktopImgRow?.querySelector('picture')?.cloneNode(true) ?? null;
  const mobilePic = mobileImgRow?.querySelector('picture')?.cloneNode(true) ?? null;

  const ctaLinks = buttonRows.map((row) => {
    const a = row?.querySelector('a');
    if (!a) return null;
    return {
      href: a.getAttribute('href') || '#',
      label: a.textContent.trim(),
      target: a.getAttribute('target') || '',
    };
  }).filter(Boolean);

  const overlay = doc.createElement('div');
  overlay.className = 'welcome-banner-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Welcome banner');

  const dialog = doc.createElement('div');
  dialog.className = 'welcome-banner-dialog';

  const closeBtn = doc.createElement('button');
  closeBtn.className = 'welcome-banner-close';
  closeBtn.setAttribute('aria-label', 'Close welcome banner');
  closeBtn.innerHTML = '&times;';
  closeBtn.addEventListener('click', () => {
    overlay.classList.remove('welcome-banner-overlay-visible');
    overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
  });

  const media = doc.createElement('div');
  media.className = 'welcome-banner-media';

  if (desktopPic) {
    desktopPic.classList.add('welcome-banner-desktop-img');
    media.appendChild(desktopPic);
  }
  if (mobilePic) {
    mobilePic.classList.add('welcome-banner-mobile-img');
    media.appendChild(mobilePic);
  }

  const ctas = doc.createElement('div');
  ctas.className = 'welcome-banner-ctas';

  ctaLinks.forEach((ctaData) => {
    const a = doc.createElement('a');
    a.className = 'welcome-banner-cta';
    a.href = ctaData.href;
    a.textContent = ctaData.label;
    if (ctaData.target) a.setAttribute('target', ctaData.target);
    ctas.appendChild(a);
  });

  dialog.appendChild(closeBtn);
  dialog.appendChild(media);
  dialog.appendChild(ctas);
  overlay.appendChild(dialog);

  doc.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('welcome-banner-overlay-visible'));
}
