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
  const embedEl = el('embed', { attrs: { src: path, width: '100%', height: '100%' } });
  pdfEmbed.append(embedEl);

  const anchor = el('a', {
    text: 'Download',
    attrs: {
      href: path, title: 'Download', target: '_blank', download: name || '',
    },
  });
  const downloadSection = el('div', { className: 'download-section' });
  const downloadWrapper = createDownloadLink(anchor);
  if (downloadWrapper) downloadSection.append(downloadWrapper);

  centerContent.append(pdfEmbed, downloadSection);
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
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const fetchPath = (isLocal && asset.path.startsWith('/content/dam/')) ? `${API_BASE}${asset.path}` : asset.path;

  const card = el('div', { className: 'srr-card' });
  const topRow = el('div', { className: 'srr-card-top' });
  const titleRow = el('div', { className: 'srr-card-title-row' });
  const title = el('h3', { className: 'srr-card-title', text: asset.reportTitle || asset.title });
  titleRow.append(title);
  const divider = el('div', { className: 'srr-card-divider' });
  topRow.append(titleRow, divider);

  const fileRow = el('div', { className: 'srr-card-file-row' });
  const fileLabel = el('span', { className: 'srr-file-label', text: getDownloadLabel(asset.mimeType) });
  const icons = el('div', { className: 'srr-card-icons' });

  if (asset.mimeType === 'application/pdf') {
    const previewBtn = el('button', {
      className: 'srr-icon-btn srr-preview-btn',
      attrs: { type: 'button', 'aria-label': `Preview ${asset.name}` },
    });
    const previewIcon = el('span', { className: 'icon icon-preview', attrs: { 'aria-hidden': 'true' } });
    previewBtn.append(previewIcon);
    previewBtn.addEventListener('click', (e) => { e.stopPropagation(); openPdfPreview(fetchPath, asset.name); });
    icons.append(previewBtn);
  }

  const downloadBtn = el('button', {
    className: 'srr-icon-btn srr-download-btn',
    attrs: { type: 'button', 'aria-label': `Download ${asset.name}` },
  });
  const downloadIcon = el('span', { className: 'icon icon-download', attrs: { 'aria-hidden': 'true' } });
  downloadBtn.append(downloadIcon);
  downloadBtn.addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = fetchPath;
    a.download = asset.name;
    a.click();
  });
  icons.append(downloadBtn);

  fileRow.append(fileLabel, icons);
  card.append(topRow, fileRow);
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
