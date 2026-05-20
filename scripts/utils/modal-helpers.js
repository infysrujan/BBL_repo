import { createElementFromHTML } from '../scripts.js';
import { loadFragment } from '../../blocks/fragment/fragment.js';

function getTextValue(value) {
  return value?.toString().trim() || '';
}

export function parseBooleanFlag(value, defaultValue = false) {
  const normalizedValue = getTextValue(value).toLowerCase();
  if (!normalizedValue) return defaultValue;
  if (normalizedValue === 'true') return true;
  if (normalizedValue === 'false') return false;
  return defaultValue;
}

function isBooleanLikeValue(value) {
  const normalizedValue = getTextValue(value).toLowerCase();
  return normalizedValue === 'true' || normalizedValue === 'false';
}

export function getOverlayHref(linkDiv) {
  const linkedHref = linkDiv?.querySelector('a')?.getAttribute('href')?.trim();
  if (linkedHref && !isBooleanLikeValue(linkedHref)) return linkedHref;

  const textValue = getTextValue(linkDiv?.textContent);
  if (textValue && !isBooleanLikeValue(textValue)) return textValue;

  return '';
}

export function closeModal(doc) {
  const modal = doc.querySelector('.custom-modal');
  if (!modal) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
  doc.body.classList.remove('modal-open');
}

export function createModal(doc) {
  if (doc.querySelector('.custom-modal')) return doc.querySelector('.custom-modal');

  const modal = createElementFromHTML(`
    <div class="custom-modal" aria-hidden="true">
      <div class="modal-overlay"></div>
      <div class="modal-content" role="dialog" aria-modal="true">
        <button class="modal-close" type="button" aria-label="Close modal">&times;</button>
        <div class="modal-body card-list-modal-body"></div>
      </div>
    </div>`, doc);

  const hide = () => {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    doc.body.classList.remove('modal-open');
  };

  modal.querySelector('.modal-close')?.addEventListener('click', hide);
  modal.querySelector('.modal-overlay')?.addEventListener('click', hide);
  doc.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) hide();
  });

  return doc.body.appendChild(modal);
}

export async function openModal(doc, fragmentPath, onLoad) {
  const modal = createModal(doc);
  const modalBody = modal.querySelector('.modal-body');
  if (!modalBody) return;

  try {
    const fragment = await loadFragment(fragmentPath);
    if (!fragment) throw new Error(`Unable to load fragment: ${fragmentPath}`);

    modalBody.replaceChildren(...fragment.children);
    if (onLoad) onLoad(modalBody);
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    doc.body.classList.add('modal-open');
  } catch { /* silent fail */ }
}
