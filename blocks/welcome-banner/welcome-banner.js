import { getMetadata } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

const COOKIE_NAME = 'bbl-welcome-banner';
const COOKIE_MINUTES = 20;

function setCookie(name, value, minutes) {
  const expires = new Date(Date.now() + minutes * 60e3).toUTCString();
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function getCookie(name) {
  const encoded = encodeURIComponent(name);
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${encoded}=`));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}

function isBannerActive(startStr, endStr) {
  const now = new Date();
  if (startStr) {
    const start = new Date(startStr);
    if (!Number.isNaN(start.getTime()) && now < start) return false;
  }
  if (endStr) {
    const end = new Date(endStr);
    if (!Number.isNaN(end.getTime())) {
      end.setHours(23, 59, 59, 999);
      if (now > end) return false;
    }
  }
  return true;
}

export default function decorate(block) {
  const isWelcomeBanner = getMetadata('iswelcomebanner');
  if (isWelcomeBanner !== 'true') {
    block.closest('.section')?.remove();
    return;
  }

  const doc = block.ownerDocument;

  const rows = [...block.children];
  const [desktopImgRow, mobileImgRow,, publishDateRow, unpublishDateRow, ...buttonRows] = rows;

  const publishDate = publishDateRow?.textContent?.trim() || '';
  const unpublishDate = unpublishDateRow?.textContent?.trim() || '';

  const desktopPic = desktopImgRow?.querySelector('picture')?.cloneNode(true) ?? null;
  const mobilePic = mobileImgRow?.querySelector('picture')?.cloneNode(true) ?? null;

  const ctaLinks = buttonRows
    .map((row) => {
      const a = row?.querySelector('a');
      if (!a) return null;
      return {
        href: a.getAttribute('href') || '#',
        label: a.textContent.trim(),
        target: a.getAttribute('target') || '',
      };
    })
    .filter(Boolean);

  if (ctaLinks.length === 0) {
    const siblingWrapper = block.parentElement?.nextElementSibling;
    if (siblingWrapper) {
      siblingWrapper.querySelectorAll('a').forEach((a) => {
        ctaLinks.push({
          href: a.getAttribute('href') || '#',
          label: a.textContent.trim(),
          target: a.getAttribute('target') || '',
        });
      });
      siblingWrapper.remove();
    }
  }

  const placeholder = doc.createElement('div');
  placeholder.className = 'welcome-banner-placeholder';
  moveInstrumentation(block, placeholder);
  block.replaceWith(placeholder);

  if (!isBannerActive(publishDate, unpublishDate)) return;

  if (getCookie(COOKIE_NAME) === 'seen') return;

  const overlay = doc.createElement('div');
  overlay.className = 'welcome-banner-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Welcome banner');

  const dialog = doc.createElement('div');
  dialog.className = 'welcome-banner-dialog';

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

  dialog.appendChild(media);
  dialog.appendChild(ctas);
  overlay.appendChild(dialog);

  overlay.addEventListener('click', (e) => {
    const cta = e.target.closest('.welcome-banner-cta');
    if (!cta) return;

    e.preventDefault();

    const href = cta.getAttribute('href');
    if (href && href !== '#') {
      window.location.href = href;
    } else {
      overlay.classList.remove('welcome-banner-overlay-visible');
      overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
    }
  });

  setCookie(COOKIE_NAME, 'seen', COOKIE_MINUTES);

  doc.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('welcome-banner-overlay-visible'));
}
