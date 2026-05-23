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
  const lang = document.documentElement.lang || 'en';
  const logoLink = el('a', { className: 'srr-preview-logo', attrs: { href: `/${lang}`, 'aria-label': 'Bangkok Bank Home' } });
  const logoImg = el('img', {
    attrs: {
      src: '/icons/bbl-logo-white.svg', alt: 'Bangkok Bank', width: '120', height: '40', onerror: "this.style.display='none'",
    },
  });
  logoLink.append(logoImg);

  const closeBtn = el('button', { className: 'srr-preview-close', attrs: { type: 'button', 'aria-label': 'Close preview' } });
  closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  header.append(logoLink, closeBtn);

  const body = el('div', { className: 'srr-preview-body' });
  const embedWrapper = el('div', { className: 'srr-preview-embed-wrapper' });
  const embed = el('embed', {
    attrs: {
      src: path, type: 'application/pdf', width: '100%', height: '100%',
    },
  });
  embedWrapper.append(embed);

  const btnGroup = el('div', { className: 'srr-preview-btn-group' });
  const downloadBtn = el('a', {
    className: 'srr-preview-download-btn',
    text: 'Download',
    attrs: { href: path, download: name || '', target: '_blank' },
  });
  btnGroup.append(downloadBtn);
  body.append(embedWrapper, btnGroup);
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
}

function buildCard(asset, isAuthor) {
  const fullPath = isAuthor ? asset.path : `${API_BASE}${asset.path}`;

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
    previewBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>';
    previewBtn.addEventListener('click', () => openPdfPreview(fullPath, asset.name));
    icons.append(previewBtn);
  }

  const downloadLink = el('a', {
    className: 'srr-icon-btn srr-download-btn',
    attrs: { href: fullPath, download: asset.name, 'aria-label': `Download ${asset.name}` },
  });
  downloadLink.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
  icons.append(downloadLink);

  fileRow.append(fileLabel, icons);
  card.append(topRow, fileRow);
  return card;
}

export default async function decorate(block) {
  const isAuthor = window.self !== window.top;
  const params = new URLSearchParams(window.location.search);
  const type = params.get('type') || '';
  const year = params.get('year') || '';
  const lang = document.documentElement.lang || 'en';

  block.innerHTML = '<div class="srr-loading">Loading...</div>';

  try {
    if (isAuthor) {
      block.innerHTML = '';
      block.append(el('p', { className: 'srr-empty', text: 'Search results will appear here on the published page.' }));
      return;
    }

    const res = await fetch(`${API_BASE}/content/bangkokbank/${lang}.reports.${type}.${year}.json`);
    const data = await res.json();

    block.innerHTML = '';
    const wrapper = el('div', { className: 'srr-results-wrapper' });

    // Back button
    const backHeader = el('div', { className: 'srr-back-header' });
    const backBtn = el('a', { className: 'srr-back-btn', attrs: { href: '#', 'aria-label': 'Go back' }, text: '‹' });
    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof window.__previewGoBack === 'function') window.__previewGoBack();
      else window.history.back();
    });
    backHeader.append(backBtn);
    wrapper.append(backHeader);

    const pageTitle = el('h1', { className: 'srr-page-title', text: 'Search Results' });
    const titleDivider = el('div', { className: 'srr-title-divider' });
    wrapper.append(pageTitle, titleDivider);

    if (!data.totalCount || !data.assets?.length) {
      wrapper.append(el('p', { className: 'srr-empty', text: 'No reports found for the selected filters.' }));
      block.append(wrapper);
      return;
    }

    const sorted = sortAssets(data.assets, type);
    const list = el('div', { className: 'srr-list' });
    sorted.forEach((asset) => list.append(buildCard(asset, isAuthor)));
    wrapper.append(list);
    block.append(wrapper);
  } catch {
    block.innerHTML = '';
    block.append(el('p', { className: 'srr-error', text: 'Unable to load reports. Please try again.' }));
  }
}
