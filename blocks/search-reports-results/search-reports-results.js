import { getLang } from '../../scripts/scripts.js';
import {
  createModalShell,
  showModal,
  hideModal,
  setupModalHandlers,
} from '../../scripts/utils/modal.js';
import createDownloadLink from '../../scripts/utils/download-helpers.js';

const API_BASE = 'https://publish-p185039-e1939903.adobeaemcloud.com';

function el(tag, { className, text, attrs = {} } = {}) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  return node;
}

function getDownloadLabel(mimeType) {
  if (mimeType === 'application/pdf') return 'Download PDF';
  if (mimeType.includes('spreadsheetml') || mimeType.includes('excel')) return 'Download Excel';
  if (mimeType.includes('wordprocessingml') || mimeType.includes('msword')) return 'Download Word';
  return 'Download File';
}

function sortAssets(assets, type) {
  return [...assets].sort((a, b) => {
    if (type === 'summary-statement') {
      return parseInt(a.reportMonth, 10) - parseInt(b.reportMonth, 10);
    }
    return parseInt(a.reportQuarter, 10) - parseInt(b.reportQuarter, 10);
  });
}

function openPdfPreview(path, name) {
  const lang = getLang();

  const { overlay, dialog, closeBtn } = createModalShell({
    overlayClass: 'srr-preview-overlay',
    dialogClass: 'srr-preview-dialog',
    closeBtnClass: 'srr-preview-close',
    ariaLabel: 'PDF Preview',
    closeBtnAriaLabel: 'Close preview',
    closeBtnHTML: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  });

  // Header: logo + close button
  const header = el('div', { className: 'srr-preview-header' });
  const innerContainer = el('div', { className: 'srr-preview-inner-container' });
  const logoLink = el('a', {
    className: 'srr-preview-logo',
    attrs: { href: `/${lang}`, 'aria-label': 'Bangkok Bank Home' },
  });
  const logoImg = el('img', {
    attrs: {
      src: '/icons/logo.svg',
      alt: 'Bangkok Bank',
      width: '120',
      height: '40',
      onerror: "this.style.display='none'",
    },
  });
  logoLink.append(logoImg);
  innerContainer.append(logoLink, closeBtn);
  header.append(innerContainer);

  // Body: embed + download button
  const body = el('div', { className: 'srr-preview-body' });
  const centerContent = el('div', { className: 'srr-preview-center-content' });
  const pdfEmbed = el('div', { className: 'srr-custom-pdf' });
  const viewerSrc = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(path)}`;
  const embedEl = el('iframe', {
    attrs: {
      src: viewerSrc, width: '100%', height: '100%', frameborder: '0', title: name || 'PDF Preview',
    },
  });
  pdfEmbed.append(embedEl);

  const buttonGroup = el('div', { className: 'srr-button-group' });
  const downloadLink = el('a', {
    className: 'srr-btn-primary',
    text: 'Download',
    attrs: {
      href: path, title: 'Download', target: '_blank', download: name || '',
    },
  });
  buttonGroup.append(downloadLink);

  centerContent.append(pdfEmbed, buttonGroup);
  body.append(centerContent);
  dialog.append(header, body);

  function close() {
    document.body.classList.remove('srr-preview-open');
    hideModal(overlay, 'srr-preview-visible');
  }

  closeBtn.addEventListener('click', close);
  setupModalHandlers(overlay, dialog, close);

  document.body.classList.add('srr-preview-open');
  showModal(overlay, 'srr-preview-visible');
  closeBtn.focus();
}

function buildCard(asset) {
  const fetchPath = asset.path.startsWith('http') ? asset.path : `${API_BASE}${asset.path}`;

  // Outer white card — reuses .download-section from download-file.css
  const card = el('div', { className: 'download-section' });

  // Title area — reuses .default-content-wrapper pattern from accordion-block
  const titleWrapper = el('div', { className: 'default-content-wrapper' });
  const title = el('h3', { className: 'srr-card-title', text: asset.reportTitle || asset.title });
  const divider = el('div', { className: 'srr-card-divider' });
  titleWrapper.append(title, divider);

  const fileRow = el('div', { className: 'srr-card-file-row' });

  // Download button — reuses createDownloadLink from download-helpers.js
  const anchor = el('a', {
    text: getDownloadLabel(asset.mimeType),
    attrs: { href: fetchPath, download: asset.name, 'aria-label': `Download ${asset.name}` },
  });
  const downloadWrapper = createDownloadLink(anchor);

  if (downloadWrapper) {
    const downloadAnchor = downloadWrapper.querySelector('.download-files');
    if (downloadAnchor) downloadAnchor.classList.remove('icon-download');

    if (asset.mimeType === 'application/pdf') {
      const iconGroup = el('div', { className: 'srr-icon-group' });

      const previewBtn = el('button', {
        className: 'srr-icon-btn srr-preview-btn',
        attrs: { type: 'button', 'aria-label': `Preview ${asset.name}` },
      });
      previewBtn.append(el('span', { className: 'icon icon-preview', attrs: { 'aria-hidden': 'true' } }));
      previewBtn.addEventListener('click', (e) => { e.stopPropagation(); openPdfPreview(fetchPath, asset.name); });

      const downloadIcon = el('span', { className: 'icon icon-download', attrs: { 'aria-hidden': 'true' } });

      iconGroup.append(previewBtn, downloadIcon);
      downloadWrapper.append(iconGroup);
    }

    fileRow.append(downloadWrapper);
  }
  card.append(titleWrapper, fileRow);
  return card;
}

async function fetchAndRender(block, type, year) {
  const lang = getLang();

  block.innerHTML = '';
  const wrapper = el('div', { className: 'srr-results-wrapper' });
  const resultsHeader = el('div', { className: 'srr-header' });
  const backBtn = el('button', {
    className: 'srr-back-btn',
    attrs: { type: 'button', 'aria-label': 'Go back' },
    text: '‹',
  });
  backBtn.addEventListener('click', () => {
    if (typeof window.__previewGoBack === 'function') {
      window.__previewGoBack();
    } else {
      window.history.pushState({}, '', window.location.pathname);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  });
  resultsHeader.append(backBtn);
  wrapper.append(resultsHeader);
  wrapper.append(el('h1', { className: 'srr-page-title', text: 'Search Results' }));
  wrapper.append(el('div', { className: 'srr-title-divider' }));
  const loading = el('div', { className: 'srr-loading', text: 'Loading...' });
  wrapper.append(loading);
  block.append(wrapper);

  try {
    const { hostname } = window.location;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    let res;
    if (isLocal) {
      res = await fetch('/blocks/search-reports-results/results.mock.json');
    } else {
      res = await fetch(`${API_BASE}/content/bangkokbank/${lang}.reports.${type}.${year}.json`);
      if (res.status === 204 && lang !== 'en') {
        res = await fetch(`${API_BASE}/content/bangkokbank/en.reports.${type}.${year}.json`);
      }
    }
    if (res.status === 204) throw new Error('no content');
    const data = await res.json();

    loading.remove();

    if (!data.totalCount || !data.assets?.length) {
      wrapper.append(el('p', { className: 'srr-empty', text: 'No reports found for the selected filters.' }));
      return;
    }

    const sorted = sortAssets(data.assets, type);
    const list = el('div', { className: 'srr-list' });
    sorted.forEach((asset) => list.append(buildCard(asset)));
    wrapper.append(list);
  } catch {
    loading.remove();
    wrapper.append(el('p', { className: 'srr-error', text: 'Unable to load reports. Please try again.' }));
  }
}

export default function decorate(block) {
  const params = new URLSearchParams(window.location.search);
  const type = params.get('type') || '';
  const year = params.get('year') || '';

  if (type && year) {
    fetchAndRender(block, type, year);
  }

  window.addEventListener('popstate', () => {
    const p = new URLSearchParams(window.location.search);
    if (!p.get('type') && !p.get('year')) block.innerHTML = '';
  });

  window.addEventListener('search-reports:submit', (e) => {
    fetchAndRender(block, e.detail.type, e.detail.year);
  });
}
