import { moveInstrumentation } from '../../scripts/scripts.js';
import { createModalShell, showModal, hideModal } from '../../scripts/utils/modal.js';
import createSmartImage from '../../scripts/utils/smartcrop-helper.js';

const BANNER_COOKIE = 'bbl-welcome-banner';
const COOKIE_DURATION_MS = 20 * 60 * 1000;

function setBannerDismissed() {
  const ts = Date.now();
  try {
    const expires = new Date(ts + COOKIE_DURATION_MS).toUTCString();
    document.cookie = `${encodeURIComponent(BANNER_COOKIE)}=${ts}; expires=${expires}; path=/; SameSite=Lax`;
  } catch (e) {
    // ignore
  }
  try {
    sessionStorage.setItem(BANNER_COOKIE, ts.toString());
  } catch (e) {
    // ignore
  }
}

function getRemainingMs() {
  let ts = 0;
  try {
    const encodedName = encodeURIComponent(BANNER_COOKIE);
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${encodedName}=([^;]*)`));
    if (match) ts = Number(match[1]);
  } catch (e) {
    // ignore
  }

  if (!ts) {
    try {
      ts = Number(sessionStorage.getItem(BANNER_COOKIE));
    } catch (e) {
      // ignore
    }
  }

  if (!ts) return 0;

  const remaining = COOKIE_DURATION_MS - (Date.now() - ts);
  return remaining > 0 ? remaining : 0;
}

function isDateActive(startStr, endStr) {
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

  const isActiveVal = isActiveRow?.textContent?.trim().toLowerCase();
  if (isActiveVal === 'false') return;

  const publishDate = publishDateRow?.textContent?.trim();
  const unpublishDate = unpublishDateRow?.textContent?.trim();
  if (!isDateActive(publishDate, unpublishDate)) return;

  const pictureDesktop = desktopImgRow?.querySelector('picture');
  const pictureMobile = mobileImgRow?.querySelector('picture');

  const picture = (pictureDesktop || pictureMobile)
    ? createSmartImage(pictureDesktop, pictureMobile, null)
    : null;

  const ctaLinks = buttonRows.map((row) => {
    const a = row?.querySelector('a');
    if (!a) return null;
    return {
      href: a.getAttribute('href') || '#',
      label: a.textContent.trim(),
      target: a.getAttribute('target') || '',
      sourceAnchor: a,
    };
  }).filter(Boolean);
  if (ctaLinks.length === 0) {
    placeholder.closest('.section')?.querySelectorAll('.default-content-wrapper a').forEach((a) => {
      ctaLinks.push({
        href: a.getAttribute('href') || '#',
        label: a.textContent.trim(),
        target: a.getAttribute('target') || '',
        sourceAnchor: a,
      });
    });
  }

  const { overlay, dialog, closeBtn } = createModalShell({
    overlayClass: 'welcome-banner-overlay',
    dialogClass: 'welcome-banner-dialog',
    closeBtnClass: 'welcome-banner-close',
    ariaLabel: 'Welcome banner',
    closeBtnAriaLabel: 'Close welcome banner',
  });

  const dismiss = () => {
    setBannerDismissed();
    hideModal(overlay, 'welcome-banner-overlay-visible', () => {
      doc.body.classList.remove('modal-open');
    });
  };

  closeBtn.addEventListener('click', dismiss);

  const media = doc.createElement('div');
  media.className = 'welcome-banner-media';
  if (picture) media.appendChild(picture);

  const ctas = doc.createElement('div');
  ctas.className = 'welcome-banner-ctas';
  ctaLinks.forEach((ctaData) => {
    const a = doc.createElement('a');
    a.className = 'welcome-banner-cta';
    a.href = ctaData.href;
    a.textContent = ctaData.label;
    if (ctaData.target) a.setAttribute('target', ctaData.target);
    if (ctaData.sourceAnchor) moveInstrumentation(ctaData.sourceAnchor, a);
    a.addEventListener('click', (e) => {
      e.preventDefault();
      setBannerDismissed();
      if (ctaData.href && ctaData.href !== '#') {
        if (ctaData.target === '_blank') {
          window.open(ctaData.href, '_blank', 'noopener,noreferrer');
          dismiss();
        } else {
          window.location.href = ctaData.href;
        }
      } else {
        dismiss();
      }
    });
    ctas.appendChild(a);
  });

  dialog.appendChild(closeBtn);
  dialog.appendChild(media);
  dialog.appendChild(ctas);

  const show = () => {
    doc.body.classList.add('modal-open');
    showModal(overlay, 'welcome-banner-overlay-visible');
    // Set the cookie as soon as the banner is shown to start the 20-minute countdown
    setBannerDismissed();
  };

  const remainingMs = getRemainingMs();

  // If we are within the 20-minute window (cookie exists), do not show the banner at all.
  if (remainingMs > 0) return;

  // Otherwise, show it immediately.
  show();
}
