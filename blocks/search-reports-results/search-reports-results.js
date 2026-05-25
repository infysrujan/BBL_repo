import { getLang } from '../../scripts/scripts.js';

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
  const overlay = el('div', {
    className: 'srr-preview-overlay',
    attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'PDF Preview' },
  });

  const header = el('div', { className: 'srr-preview-header' });
  const lang = getLang();
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
  const closeBtn = el('button', {
    className: 'srr-preview-close',
    attrs: { type: 'button', 'aria-label': 'Close preview' },
  });
  closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  header.append(logoLink, closeBtn);

  const body = el('div', { className: 'srr-preview-body' });
  const frame = el('iframe', { className: 'srr-preview-frame', attrs: { title: name || 'PDF Preview' } });
  body.append(frame);

  const btnGroup = el('div', { className: 'srr-preview-btn-group' });
  const downloadBtn = el('button', {
    className: 'srr-preview-download-btn',
    text: 'Download',
    attrs: { type: 'button' },
  });
  downloadBtn.addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = path;
    a.download = name || '';
    a.click();
  });
  btnGroup.append(downloadBtn);
  body.append(btnGroup);
  overlay.append(header, body);
  document.body.appendChild(overlay);
  document.body.classList.add('srr-preview-open');
  requestAnimationFrame(() => overlay.classList.add('srr-preview-visible'));

  function close() {
    overlay.classList.remove('srr-preview-visible');
    document.body.classList.remove('srr-preview-open');
    overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
    setTimeout(() => overlay.remove(), 300);
  }

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  closeBtn.focus();

  fetch(path, { method: 'HEAD' }).then((res) => {
    if (res.ok) {
      frame.src = path;
    } else {
      frame.remove();
      const msg = el('p', {
        className: 'srr-preview-unavailable',
        text: 'File not available for preview.',
      });
      body.insertBefore(msg, btnGroup);
    }
  }).catch(() => {
    frame.remove();
    const msg = el('p', {
      className: 'srr-preview-unavailable',
      text: 'File not available for preview.',
    });
    body.insertBefore(msg, btnGroup);
  });
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
    previewBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><circle cx="10" cy="14" r="2.5"/><line x1="12" y1="16" x2="14.5" y2="18.5"/></svg>';
    previewBtn.addEventListener('click', (e) => { e.stopPropagation(); openPdfPreview(fetchPath, asset.name); });
    icons.append(previewBtn);
  }

  const downloadBtn = el('button', {
    className: 'srr-icon-btn srr-download-btn',
    attrs: { type: 'button', 'aria-label': `Download ${asset.name}` },
  });
  downloadBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M13 3a1 1 0 1 0-2 0v10.586l-2.293-2.293a1 1 0 0 0-1.414 1.414l4 4a1 1 0 0 0 1.414 0l4-4a1 1 0 0 0-1.414-1.414L13 13.586V3zM4 17a1 1 0 0 1 2 0v2h12v-2a1 1 0 1 1 2 0v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2z"/></svg>';
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
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
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
