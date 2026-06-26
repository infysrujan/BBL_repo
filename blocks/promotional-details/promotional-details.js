import { fetchPlaceholders } from '../../scripts/placeholder.js';
import { getLang } from '../../scripts/scripts.js';
import { fetchConfigs } from '../../scripts/config.js';
import { readBlockConfig } from '../../scripts/aem.js';
import { isAuthoringInstance } from '../../scripts/bbl-decorators.js';
import {
  createModalShell,
  showModal,
  hideModal,
  setupModalHandlers,
} from '../../scripts/utils/modal.js';
import { handleMobileAppView } from '../../scripts/utils/card-helpers.js';

const LOCALE_MAP = { th: 'th-TH', en: 'en-GB' };

function isRegisterEnabled(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return normalized === 'Y' || normalized === 'D';
}

function getRegisterCtaLabel(isRegister, data) {
  if (!isRegisterEnabled(isRegister)) return '';
  return data?.registerCtaLabel || '';
}

function formatPromoDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}/${dd}/${d.getFullYear()}`;
}

function getRegisterCtaUrl(isRegister, registerCtaUrl, data) {
  if (!isRegisterEnabled(isRegister) || !registerCtaUrl) return '';

  const tokenMap = {
    'PROMO-ID': data?.id || '',
    'PROMO-TITLE': (data?.title || '').replace(/<[^>]*>/g, '').trim(),
    'PROMO-START-DATE': formatPromoDate(data?.promotionStartDate),
    'PROMO-END-DATE': formatPromoDate(data?.promotionEndDate),
    'PROMO-FLAG': isRegister,
  };

  return registerCtaUrl.replace(
    /\{\{\s*([\w-]+)\s*\}\}/g,
    (_, key) => encodeURIComponent(tokenMap[key.trim()] ?? ''),
  );
}

function readBlockData(block) {
  const firstRow = block.querySelector(':scope > div');
  if (!firstRow || firstRow.children.length < 2) return null;
  const config = readBlockConfig(block);
  return {
    title: config.title || '',
    detailImageUrl: config['detail-image-url'] || '',
    detailDescription: config['detail-description'] || '',
    promotionStartDate: config['promotion-start-date'] || '',
    promotionEndDate: config['promotion-end-date'] || '',
    responsibleLendingDisclaimerEnabled: config['responsible-lending-disclaimer-enabled'],
    responsibleLendingDisclaimerText: config['responsible-lending-disclaimer-text'] || '',
    isRegister: config['is-register'] || '',
    registerCtaLabel: config['register-cta-label'] || '',
    ctaLabel: config['cta-label'] || '',
  };
}

function formatDate(dateStr, locale = 'en-GB') {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}

function buildDateHtml(start, end, label, locale) {
  if (!start && !end) return '';
  const parts = [start && formatDate(start, locale), end && formatDate(end, locale)]
    .filter(Boolean);
  return `<p class="promo-detail-date">${label} ${parts.join(' – ')}</p>`;
}

function buildDisclaimerHtml(enabled, text) {
  if (!enabled || !text) return '';
  return `<div class="promo-detail-disclaimer pad-top-30">${text}</div>`;
}

function buildRegisterCtaHtml(label, url) {
  if (!label || !url) return '';
  return `
    <div class="promo-detail-cta button-container">
        <a href="${url}" class="button primary promo-detail-register-btn">${label}</a>
    </div>`;
}

function bindImageModal(container, imageUrl, altText) {
  const imageLink = container.querySelector('.promo-detail-image-link');
  imageLink?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    const doc = container.ownerDocument;

    // Guard against rapid double-clicks opening multiple modals
    if (doc.body.classList.contains('modal-open')) return;

    const wrapper = doc.createElement('div');
    wrapper.className = 'custom-modal';
    wrapper.setAttribute('aria-hidden', 'true');

    const backdrop = doc.createElement('div');
    backdrop.className = 'modal-overlay';

    const { overlay: content, dialog: body, closeBtn } = createModalShell({
      overlayClass: 'modal-content',
      dialogClass: 'modal-body promo-detail-image-modal',
      closeBtnClass: 'modal-close',
      closeBtnAriaLabel: 'Close modal',
    });
    content.insertBefore(closeBtn, body);

    let closeModal;

    const handleEscape = (evt) => {
      if (evt.key === 'Escape' && closeModal) closeModal();
    };

    closeModal = () => {
      doc.removeEventListener('keydown', handleEscape);
      wrapper.setAttribute('aria-hidden', 'true');
      hideModal(wrapper, 'active', () => doc.body.classList.remove('modal-open'));
    };

    closeBtn.addEventListener('click', closeModal);
    // Explicitly disable escapeKey in setupModalHandlers to prevent listener leaks on the document
    setupModalHandlers(wrapper, content, closeModal, { escapeKey: false, clickOutside: true });
    doc.addEventListener('keydown', handleEscape);
    wrapper.append(backdrop, content);

    const modalContent = doc.createElement('div');
    modalContent.className = 'promo-detail-image-modal-content';

    const modalImage = doc.createElement('img');
    modalImage.src = imageUrl;
    modalImage.alt = altText;
    modalContent.appendChild(modalImage);

    body.replaceChildren(modalContent);
    doc.body.appendChild(wrapper);

    wrapper.setAttribute('aria-hidden', 'false');
    doc.body.classList.add('modal-open');
    showModal(wrapper, 'active');
  });
}

function renderDetails(container, data, periodLabel, locale, viewFull, registerCtaUrl) {
  const title = data?.title
    ? `<h2 class="promo-detail-title">${data.title}</h2>`
    : '';
  const imageUrl = data?.detailImageUrl || '';

  const cleanTitle = data?.title ? data.title.replace(/<[^>]*>/g, '').trim() : '';
  const imageHtml = imageUrl
    ? `<img src="${imageUrl}" alt="${cleanTitle}" loading="lazy">`
    : '';
  const description = data?.detailDescription || '';
  const startDate = data?.promotionStartDate || '';
  const endDate = data?.promotionEndDate || '';
  const disclaimerEnabled = data?.responsibleLendingDisclaimerEnabled;
  const disclaimerText = data?.responsibleLendingDisclaimerText || '';
  const isRegister = data?.isRegister || '';
  const ctaLabel = getRegisterCtaLabel(isRegister, data);
  const ctaUrl = getRegisterCtaUrl(isRegister, registerCtaUrl, data);

  const rowClass = imageHtml ? 'promo-detail-row' : 'promo-detail-row promo-detail-row-no-image';
  const imageColHtml = imageHtml ? `
          <div class="promo-detail-image">
            <a class="promo-detail-image-link" href="#" title="${viewFull}">
              ${imageHtml}
            </a>
          </div>` : '';

  container.innerHTML = `
    <div class="promo-detail-inner">
      <div class="promo-detail-center">
        <div class="promo-detail-title-wrap">
          ${title}
        </div>
        <div class="${rowClass}">
          ${imageColHtml}
          <div class="promo-detail-content">
            <div class="promo-detail-description">${description}</div>
            ${buildDateHtml(startDate, endDate, periodLabel, locale)}
            ${buildRegisterCtaHtml(ctaLabel, ctaUrl)}
            ${buildDisclaimerHtml(disclaimerEnabled, disclaimerText)}
          </div>
        </div>
      </div>
    </div>`;

  if (imageUrl) bindImageModal(container, imageUrl, cleanTitle);
}

export default async function decorate(block) {
  const searchParams = new URLSearchParams(window.location.search);
  handleMobileAppView(searchParams);

  const lang = getLang();
  const locale = LOCALE_MAP[lang] || 'en-GB';

  const [placeholders, configs] = await Promise.all([
    fetchPlaceholders(),
    fetchConfigs(),
  ]);

  const periodLabel = placeholders.promotionPeriodText || 'Promotion Period:';
  const clickToViewFull = placeholders.promoClickToViewFull || '';
  const registerCtaUrl = (configs || {}).bbmIsRegister || '';
  const data = readBlockData(block);

  if (isAuthoringInstance(block)) {
    if (!data || !Object.values(data).some(Boolean)) return;

    const originalChildren = [...block.children];
    block.classList.add('has-preview');
    let previewContainer = block.querySelector('.promo-detail-preview');
    if (!previewContainer) {
      previewContainer = document.createElement('div');
      previewContainer.className = 'promo-detail-preview';
      block.appendChild(previewContainer);
    }

    renderDetails(previewContainer, data, periodLabel, locale, clickToViewFull, registerCtaUrl);

    const hidden = document.createElement('div');
    hidden.style.display = 'none';
    originalChildren.forEach((child) => hidden.appendChild(child));
    block.appendChild(hidden);
    return;
  }

  if (!data || !Object.values(data).some(Boolean)) {
    const errorMsg = placeholders.promoNoResults || 'No promotion details found.';
    block.innerHTML = `<p class="promo-detail-error">${errorMsg}</p>`;
    return;
  }

  renderDetails(block, data, periodLabel, locale, clickToViewFull, registerCtaUrl);
}
