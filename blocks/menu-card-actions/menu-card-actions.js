import { moveInstrumentation, createElementFromHTML } from '../../scripts/scripts.js';
import { getLang } from '../../scripts/bbl-decorators.js';
import createGlobalDropdown from '../../scripts/utils/dropdown-helpers.js';
import createDownloadLink from '../../scripts/utils/download-helpers.js';
import { openModal } from '../../scripts/utils/modal.js';

function getTextValue(value) {
  return value?.toString().trim() || '';
}

function formatMenuCardDate(dateStr) {
  if (!dateStr) return '';
  const lang = getLang();
  const date = new Date(dateStr);
  if (lang === 'th') {
    const buddhistYear = date.getFullYear() + 543;
    const month = date.toLocaleString('th-TH', { month: 'long' });
    const day = date.getDate();
    return `${day} ${month} ${buddhistYear}`;
  }
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function parseBooleanFlag(value, defaultValue = false) {
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

function getOverlayHref(linkDiv) {
  const linkedHref = linkDiv?.querySelector('a')?.getAttribute('href')?.trim();
  if (linkedHref && !isBooleanLikeValue(linkedHref)) return linkedHref;
  const textValue = getTextValue(linkDiv?.textContent);
  if (textValue && !isBooleanLikeValue(textValue)) return textValue;
  return '';
}

function createCardItem(cardRow, doc) {
  const cells = [...cardRow.children];
  const isEmptyRow = !cells.some((c) => c.textContent.trim().length > 0);

  // Skip entirely empty rows on live site (allow in UE for authoring new items)
  if (isEmptyRow && !window.hlx?.aue?.status) return null;

  const [
    imageDiv,
    titleDiv,
    descDiv,
    actionTypeTextDiv,
    defaultButtonDiv,
    downloadButtonDivA,
    downloadButtonDivB,
    dropdownLabletDiv,
    dropdownLinksDiv,
    multipleDownloadLinksDiv,
    isCardClickableDiv,
    cardLinkDiv,
    enableOverlayModalDiv,
    overlayHrefDiv,
  ] = cells;

  const downloadButtonDiv = downloadButtonDivA?.querySelector('a')
    ? downloadButtonDivA
    : downloadButtonDivB;

  const img = imageDiv?.querySelector('img');

  // For title, preserve HTML but default to wrapping plain text in h3
  // to align with old logic & styling
  let title = titleDiv?.innerHTML?.trim();
  const headingEl = titleDiv?.querySelector('h1, h2, h3, h4, h5, h6');
  if (title && !headingEl) {
    title = `<h3>${title}</h3>`;
  }

  const description = descDiv?.innerHTML;
  const actionTypeText = actionTypeTextDiv?.textContent?.trim().toLowerCase();
  const defaultButton = defaultButtonDiv?.querySelector('a');
  const downloadButton = downloadButtonDiv?.querySelector('a');
  const dropdownLable = dropdownLabletDiv?.textContent?.trim();
  const dropdownLinks = dropdownLinksDiv?.innerHTML;
  const multipleDownloadLinks = multipleDownloadLinksDiv?.innerHTML;

  const cardLinkAnchor = cardLinkDiv?.querySelector('a');
  const cardLinkHref = cardLinkAnchor?.href || getOverlayHref(cardLinkDiv) || '';
  const cardLinkTarget = cardLinkAnchor?.target || '';
  const cardLinkTitle = cardLinkAnchor?.title?.trim() || '';

  const enableOverlayModal = isBooleanLikeValue(enableOverlayModalDiv?.textContent)
    ? parseBooleanFlag(enableOverlayModalDiv?.textContent, false)
    : !!getOverlayHref(enableOverlayModalDiv);

  const overlayHref = isBooleanLikeValue(enableOverlayModalDiv?.textContent)
    ? getOverlayHref(overlayHrefDiv)
    : getOverlayHref(enableOverlayModalDiv);

  const isCardClickable = isBooleanLikeValue(isCardClickableDiv?.textContent)
    ? parseBooleanFlag(isCardClickableDiv?.textContent, false)
    : !!cardLinkHref || enableOverlayModal;

  const dateTextRaw = cells.at(-1)?.textContent?.trim() || '';
  let dateText = '';
  if (dateTextRaw) {
    const parsedDate = new Date(dateTextRaw);
    if (!Number.isNaN(parsedDate.getTime())) {
      dateText = formatMenuCardDate(dateTextRaw);
    } else {
      dateText = dateTextRaw;
    }
  }

  // --- DOM Construction ---
  const card = createElementFromHTML('<div class="menu-card-action-item"></div>', doc);
  const inner = createElementFromHTML('<div class="menu-card-action-inner"></div>', doc);

  const appendWithInst = (parent, newEl, sourceCell) => {
    if (sourceCell) moveInstrumentation(sourceCell, newEl);
    parent.appendChild(newEl);
  };

  /* ---------------- IMAGE ---------------- */
  if (img || (isEmptyRow && imageDiv)) {
    const wrapper = doc.createElement('div');
    if (img) wrapper.appendChild(img.cloneNode(true));
    appendWithInst(inner, wrapper, imageDiv);
  }

  /* ---------------- TITLE ---------------- */
  if (title || (isEmptyRow && titleDiv)) {
    const titleWrapper = createElementFromHTML(`<div class="menu-card-action-title">${title || ''}</div>`, doc);
    appendWithInst(inner, titleWrapper, titleDiv);
  }

  /* ---------------- DESCRIPTION ---------------- */
  if (description || (isEmptyRow && descDiv)) {
    const descWrapper = createElementFromHTML(`<div class="menu-card-action-description">${description || ''}</div>`, doc);
    inner.querySelector('.menu-card-action-title')?.classList.add('has-description');
    appendWithInst(inner, descWrapper, descDiv);
  }

  /* ---------------- ACTION DEFAULT ---------------- */
  if (actionTypeText === 'default' && defaultButton) {
    const defaultButtonClone = defaultButton.cloneNode(true);
    defaultButtonClone.removeAttribute('data-modal');
    if (enableOverlayModal && overlayHref) {
      defaultButtonClone.removeAttribute('href');
      defaultButtonClone.setAttribute('data-modal', overlayHref);
    }

    // Wrap button to accept instrumentation without polluting the 'a' tag
    const btnWrapper = doc.createElement('div');
    btnWrapper.appendChild(defaultButtonClone);
    appendWithInst(inner, btnWrapper, defaultButtonDiv);
  } else if (isEmptyRow && defaultButtonDiv) {
    const btnPlaceholder = doc.createElement('div');
    appendWithInst(inner, btnPlaceholder, defaultButtonDiv);
  }

  /* ---------------- ACTION : DOWNLOAD ---------------- */
  if (actionTypeText === 'download' && downloadButton) {
    const dlLink = createDownloadLink(downloadButton, doc);
    dlLink?.querySelector('.download-files')?.addEventListener('click', (e) => e.stopPropagation());
    appendWithInst(inner, dlLink, downloadButtonDiv);
  }

  /* ---------------- ACTION : MULTIPLE DOWNLOAD ---------------- */
  if (actionTypeText === 'multiple-download' && multipleDownloadLinks) {
    const temp = createElementFromHTML(`<div>${multipleDownloadLinks}</div>`, doc);
    const multiWrapper = createElementFromHTML('<div class="multiple-download-wrapper"></div>', doc);
    temp.querySelectorAll('a').forEach((anchor) => {
      const downloadLink = createDownloadLink(anchor, doc);
      if (downloadLink) {
        downloadLink.querySelector('.download-files')?.addEventListener('click', (e) => e.stopPropagation());
        multiWrapper.appendChild(downloadLink);
      }
    });
    appendWithInst(inner, multiWrapper, multipleDownloadLinksDiv);
  }

  /* ---------------- ACTION : DROPDOWN ---------------- */
  if (actionTypeText === 'select-dropdown') {
    const dropdown = createGlobalDropdown(dropdownLable || 'Select', dropdownLinks, doc);
    appendWithInst(inner, dropdown, dropdownLinksDiv);
  }

  /* ---------------- DATE TEXT ---------------- */
  if (dateText || (isEmptyRow && cells.at(-1))) {
    const dateTextWrapper = doc.createElement('div');
    dateTextWrapper.className = 'menu-card-action-date pad-top-30';
    dateTextWrapper.textContent = dateText;
    appendWithInst(inner, dateTextWrapper, cells.at(-1));
  }

  if (isCardClickable) {
    const wrapper = createElementFromHTML('<a class="menu-card-action-item-link"></a>', doc);
    if (cardLinkTitle) wrapper.setAttribute('title', cardLinkTitle);
    if (cardLinkTarget) wrapper.setAttribute('target', cardLinkTarget);
    if (cardLinkTarget === '_blank') wrapper.setAttribute('rel', 'noopener noreferrer');

    // Support UE click blocking
    wrapper.addEventListener('click', (e) => {
      if (window.hlx?.aue?.status) e.preventDefault();
    });

    if (enableOverlayModal) {
      if (overlayHref) wrapper.setAttribute('data-modal', overlayHref);
    } else if (cardLinkHref) {
      wrapper.setAttribute('href', cardLinkHref);
    }
    wrapper.appendChild(inner);
    card.appendChild(wrapper);
  } else {
    card.appendChild(inner);
  }

  return card;
}

export default function decorate(block) {
  const doc = block.ownerDocument;
  const allRows = [...block.children];

  // The provided logic assumes the first row is always the layout config row
  const [mobileRow, ...cardRows] = allRows;
  const mobileExperience = mobileRow?.textContent?.trim() || 'stacked';

  const section = block.closest('.menu-card-actions-container');
  ['text', 'image'].forEach((type, i) => {
    section?.querySelector(`.default-content-wrapper > p:nth-of-type(${i + 1})`)
      ?.classList.add(`default-content-wrapper-${type}`);
  });

  const container = createElementFromHTML(
    `<div class="menu-card-action ${mobileExperience}"></div>`,
    doc,
  );

  cardRows.forEach((row) => {
    const card = createCardItem(row, doc);
    if (!card) return;
    moveInstrumentation(row, card);
    container.appendChild(card);
  });

  block.textContent = '';
  block.appendChild(container);

  // Block-level modal trigger (delegated)
  block.addEventListener('click', (event) => {
    if (window.hlx?.aue?.status) return; // Let UE handle clicks in edit mode
    const trigger = event.target.closest('[data-modal]');
    if (!trigger || !block.contains(trigger)) return;
    if (event.target.closest('a') || event.target.closest('[role="link"]')) return;
    event.preventDefault();
    const fragmentPath = trigger.getAttribute('data-modal');
    if (fragmentPath) openModal(doc, { fragmentPath });
  });
}
