import createDownloadLink from '../../scripts/utils/download-helpers.js';
import { fetchConfigs } from '../../scripts/config.js';
import { getLang } from '../../scripts/scripts.js';
import { loadFragment } from '../fragment/fragment.js';

async function handleDownloadWithPopup(e, link) {
  const targetUrl = link?.href;
  if (!targetUrl) return;

  if (e && typeof e.preventDefault === 'function') {
    e.preventDefault();
  }

  try {
    if (typeof window.showPrivacyModal === 'function') {
      window.showPrivacyModal(targetUrl);
      return;
    }

    const configs = await fetchConfigs();
    const lang = getLang() || 'en';
    const popupPath = configs?.downloadFilePopup
      || configs?.download_file_popup
      || configs?.downloadfilepopup
      || `/${lang}/fragments/modals/download-file-popup`;

    await loadFragment(popupPath);

    if (typeof window.showPrivacyModal === 'function') {
      window.showPrivacyModal(targetUrl);
    } else {
      window.open(targetUrl, link.target || '_blank');
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[Download File] Failed to load terms & conditions popup:', err);
    window.open(targetUrl, link.target || '_blank');
  }
}

export default function decorate(block) {
  const rows = [...block.children];
  const [buttonRow, ...otherRows] = rows;
  if (!buttonRow) return;

  const button = createDownloadLink(buttonRow);
  const link = button?.querySelector('a');

  let datePrefix = '';
  let isTermsPopupEnabled = false;
  let isBoxed = block.classList.contains('boxed-card');
  let titleEl = null;
  const dateElements = [];
  const booleanRows = [];

  // Direct query check for Universal Editor instrumentation
  const uePrefixProp = block.querySelector('[data-aue-prop="datePrefix"]');
  if (uePrefixProp && uePrefixProp.textContent.trim()) {
    datePrefix = uePrefixProp.textContent.trim();
  }

  const uePopupProp = block.querySelector('[data-aue-prop="enableTermsConditionPopup"]');
  if (uePopupProp) {
    const txt = uePopupProp.textContent.trim().toLowerCase();
    if (txt === 'true' || txt === 'on' || txt === '1') isTermsPopupEnabled = true;
    else if (txt === 'false' || txt === 'off' || txt === '0') isTermsPopupEnabled = false;
  }

  const ueBoxedProp = block.querySelector('[data-aue-prop="boxedCard"]');
  if (ueBoxedProp) {
    const txt = ueBoxedProp.textContent.trim().toLowerCase();
    if (txt === 'true' || txt === 'on' || txt === '1') isBoxed = true;
    else if (txt === 'false' || txt === 'off' || txt === '0') isBoxed = false;
  }

  otherRows.forEach((row) => {
    const rawText = row.textContent.replace(/\s+/g, ' ').trim().toLowerCase();
    const isTrueVal = rawText === 'true' || rawText === 'on' || rawText === 'yes' || rawText === '1';
    const isFalseVal = rawText === 'false' || rawText === 'off' || rawText === 'no' || rawText === '0';

    const prop = row.querySelector('[data-aue-prop]')?.getAttribute('data-aue-prop')
      || row.dataset.aueProp
      || row.querySelector('input[name]')?.getAttribute('name');

    if (prop === 'datePrefix') {
      if (row.textContent.trim()) datePrefix = row.textContent.trim();
      return;
    }

    if (prop === 'targetLink') {
      if (isTrueVal && link) link.target = '_blank';
      else if (isFalseVal && link) link.target = '_self';
      return;
    }

    if (prop === 'enableTermsConditionPopup') {
      if (isTrueVal || (rawText.includes('true') && !isFalseVal)) {
        isTermsPopupEnabled = true;
      }
      return;
    }

    if (prop === 'boxedCard') {
      if (isTrueVal || (rawText.includes('true') && !isFalseVal)) {
        isBoxed = true;
      } else if (isFalseVal) {
        isBoxed = false;
      }
      return;
    }

    // Find title heading
    const heading = row.querySelector(':is(h1, h2, h3, h4, h5, h6), [data-aue-prop="title"]');
    if (heading && !titleEl && heading.textContent.trim()) {
      titleEl = heading;
      return;
    }

    // Find authorable date
    const dateMatches = [...row.querySelectorAll('[data-aue-prop="authorableDate"], [data-richtext-prop="authorableDate"]')];
    if (dateMatches.length > 0 && !isTrueVal && !isFalseVal) {
      dateMatches.forEach((el) => {
        if (el !== titleEl && el.textContent.trim()) {
          dateElements.push(el);
        }
      });
      return;
    }

    if (isTrueVal || isFalseVal) {
      booleanRows.push({ row, isTrue: isTrueVal });
      return;
    }

    if (row.textContent.trim()) {
      const p = document.createElement('p');
      p.textContent = row.textContent.trim();
      dateElements.push(p);
    }
  });

  // If boolean rows were found without explicit data-aue-prop
  if (booleanRows.length >= 3) {
    if (booleanRows[0].isTrue && link) link.target = '_blank';
    else if (!booleanRows[0].isTrue && link) link.target = '_self';
    isBoxed = booleanRows[1].isTrue;
    isTermsPopupEnabled = booleanRows[2].isTrue;
  } else if (booleanRows.length === 2) {
    isBoxed = booleanRows[0].isTrue;
    isTermsPopupEnabled = booleanRows[1].isTrue;
  } else if (booleanRows.length === 1) {
    isBoxed = booleanRows[0].isTrue;
  }

  // Prepend datePrefix if present
  if (button && datePrefix) {
    const dateSpan = document.createElement('span');
    dateSpan.className = 'download-date-prefix';
    dateSpan.textContent = datePrefix;
    link?.prepend(dateSpan);
  }

  block.textContent = '';

  if (isBoxed) {
    block.classList.add('boxed-card');

    if (titleEl && titleEl.textContent.trim()) {
      titleEl.classList.add('download-file-title');
      block.appendChild(titleEl);
    }
  } else {
    block.classList.remove('boxed-card');
  }

  if (button) {
    if (link && isTermsPopupEnabled) {
      link.addEventListener('click', (e) => handleDownloadWithPopup(e, link));
    }
    block.appendChild(button);
  }

  if (isBoxed && dateElements.length > 0) {
    dateElements.forEach((el) => {
      el.classList.add('download-file-date');
      block.appendChild(el);
    });
  }
}
