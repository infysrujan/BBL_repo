import { moveInstrumentation, createElementFromHTML } from '../../scripts/scripts.js';
import { getLang } from '../../scripts/bbl-decorators.js';
import createGlobalDropdown from '../../scripts/utils/dropdown-helpers.js';
import createDownloadLink from '../../scripts/utils/download-helpers.js';
import { openModal } from '../../scripts/utils/modal.js';

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

function createMenuCardItem(cardElement, doc) {
  const cells = [...cardElement.children];

  // 1. Semantic Extraction
  const imgCell = cells.find((c) => c.querySelector('img'));
  const img = imgCell?.querySelector('img');

  const titleCell = cells.find((c) => c.querySelector('h1, h2, h3, h4, h5, h6'));
  const title = titleCell?.innerHTML?.trim();

  // 2. Find the Action Type
  const validActionTypes = ['default', 'download', 'multiple-download', 'select-dropdown'];
  const actionTypeIndex = cells.findIndex((c) => {
    const text = c.textContent.trim().toLowerCase();
    return validActionTypes.includes(text);
  });
  const actionTypeText = actionTypeIndex !== -1 ? cells[actionTypeIndex].textContent.trim().toLowerCase() : '';

  // 3. Description (Cell before action type, if it exists)
  const descDiv = actionTypeIndex > 0 ? cells[actionTypeIndex - 1] : null;
  const description = (descDiv && descDiv !== titleCell && descDiv !== imgCell) ? descDiv.innerHTML : '';

  // 4. Remaining Cells (Everything after the Action Type)
  let remainingCells = actionTypeIndex !== -1 ? cells.slice(actionTypeIndex + 1) : cells.slice(3);

  // 5. Extract Date (Last cell that parses as a valid Date)
  let dateTextRaw = '';
  if (remainingCells.length > 0) {
    const lastCell = remainingCells[remainingCells.length - 1];
    const text = lastCell.textContent?.trim() || '';
    if (text.length >= 8 && !Number.isNaN(Date.parse(text)) && !lastCell.querySelector('a')) {
      dateTextRaw = text;
      remainingCells.pop(); // Remove it so it doesn't interfere
    }
  }
  const dateText = dateTextRaw ? formatMenuCardDate(dateTextRaw) : '';

  // 7. Extract Modal Overlay Link
  let enableOverlayModal = false;
  let overlayHref = '';

  const modalCell = remainingCells.find((c) => {
    const a = c.querySelector('a');
    return a && a.getAttribute('href')?.includes('/fragments/');
  });

  if (modalCell) {
    const indexInOriginal = cells.indexOf(modalCell);
    const prevCell = cells[indexInOriginal - 1];
    const prevText = prevCell?.textContent?.trim().toLowerCase() || '';

    if (prevText === 'false' || prevCell?.innerHTML?.trim() === '') {
      // The author unchecked 'enableOverlayModal' but Universal Editor left garbage data.
      enableOverlayModal = false;
      remainingCells = remainingCells.filter((c) => c !== modalCell && c !== prevCell);
    } else {
      const a = modalCell.querySelector('a');
      overlayHref = a.getAttribute('href');
      enableOverlayModal = true;
      remainingCells = remainingCells.filter((c) => c !== modalCell);
    }
  }

  // 9. Extract Card Link
  let isCardClickable = false;
  let cardLinkHref = '';
  let cardLinkTarget = '';
  let cardLinkTitle = '';

  // Card link usually contains slashes in its text because it's a raw URL without a label
  const cardLinkCell = remainingCells.find((c) => {
    const a = c.querySelector('a');
    if (!a || c.querySelector('ul')) return false;
    const text = a.textContent?.trim() || '';
    const href = a.getAttribute('href')?.trim() || '';
    return text.includes('/') || href.endsWith(text) || text === href;
  });

  if (cardLinkCell) {
    const indexInOriginal = cells.indexOf(cardLinkCell);
    const prevCell = cells[indexInOriginal - 1];
    const prevText = prevCell?.textContent?.trim().toLowerCase() || '';

    if (prevText === 'false' || prevCell?.innerHTML?.trim() === '') {
      // The author unchecked 'isCardClickable' but Universal Editor left garbage data.
      isCardClickable = false;
      remainingCells = remainingCells.filter((c) => c !== cardLinkCell && c !== prevCell);
    } else {
      const a = cardLinkCell.querySelector('a');
      isCardClickable = true;
      cardLinkHref = a.getAttribute('href') || '';
      cardLinkTitle = a.title?.trim() || '';
      cardLinkTarget = a.target || '';
      remainingCells = remainingCells.filter((c) => c !== cardLinkCell);
    }
  }

  // 10. Filter remaining anchor cells for Action Buttons
  const allAnchorCells = remainingCells.filter((c) => {
    const a = c.querySelector('a');
    return a && !c.querySelector('h1, h2, h3, h4, h5, h6') && !c.querySelector('picture, img');
  });

  // 9. Map the Active Action Button
  let defaultButton = null;
  let downloadButton = null;
  let dropdownLabel = '';
  let dropdownLinks = '';
  let multipleDownloadLinks = '';

  if (actionTypeText === 'default' && allAnchorCells.length > 0) {
    defaultButton = allAnchorCells[0].querySelector('a');
  } else if (actionTypeText === 'download' && allAnchorCells.length > 0) {
    downloadButton = allAnchorCells.find((c) => !c.querySelector('ul'))?.querySelector('a') || allAnchorCells[0].querySelector('a');
  } else if (actionTypeText === 'select-dropdown') {
    const dropdownCell = allAnchorCells.find((c) => c.querySelector('ul') || c.querySelectorAll('a').length > 1);
    if (dropdownCell) {
      dropdownLinks = dropdownCell.innerHTML;
      const labelCellIndex = remainingCells.indexOf(dropdownCell) - 1;
      if (labelCellIndex >= 0 && !remainingCells[labelCellIndex].querySelector('a')) {
        dropdownLabel = remainingCells[labelCellIndex].textContent.trim();
      }
    }
  } else if (actionTypeText === 'multiple-download') {
    // multiple-download is the last action button in the array
    const multipleCell = allAnchorCells[allAnchorCells.length - 1];
    if (multipleCell) {
      multipleDownloadLinks = multipleCell.innerHTML;
    }
  }

  // 10. DOM Construction
  const card = createElementFromHTML('<div class="menu-card-action-item"></div>', doc);
  const inner = createElementFromHTML('<div class="menu-card-action-inner"></div>', doc);

  if (img) inner.appendChild(img.cloneNode(true));

  if (title) {
    inner.appendChild(createElementFromHTML(`<div class="menu-card-action-title">${title}</div>`, doc));
  }

  if (description) {
    inner.appendChild(createElementFromHTML(`<div class="menu-card-action-description">${description}</div>`, doc));
    inner.querySelector('.menu-card-action-title')?.classList.add('has-description');
  }

  if (actionTypeText === 'default' && defaultButton) {
    const defaultButtonClone = defaultButton.cloneNode(true);

    // Find linkType (primary, secondary, tertiary) in remaining cells or default to tertiary
    const linkTypeCell = remainingCells.find((c) => {
      const t = c.textContent.trim().toLowerCase();
      return ['primary', 'secondary', 'tertiary'].includes(t);
    });
    const linkType = linkTypeCell ? linkTypeCell.textContent.trim().toLowerCase() : 'tertiary';
    defaultButtonClone.classList.add('button', `button-${linkType}`);

    // Button always acts as an independent link irrespective of card wrapper
    defaultButtonClone.removeAttribute('data-modal');

    inner.appendChild(defaultButtonClone);
  }

  if (actionTypeText === 'download' && downloadButton) {
    const dlLink = createDownloadLink(downloadButton, doc);
    dlLink?.querySelector('.download-files')?.addEventListener('click', (e) => e.stopPropagation());
    inner.appendChild(dlLink);
  }

  if (actionTypeText === 'multiple-download' && multipleDownloadLinks) {
    const temp = createElementFromHTML(`<div>${multipleDownloadLinks}</div>`, doc);
    temp.querySelectorAll('a').forEach((anchor) => {
      const dlLink = createDownloadLink(anchor, doc);
      dlLink?.querySelector('.download-files')?.addEventListener('click', (e) => e.stopPropagation());
      inner.appendChild(dlLink);
    });
  }

  if (actionTypeText === 'select-dropdown') {
    const dropdown = createGlobalDropdown(dropdownLabel || 'Select', dropdownLinks, doc);
    inner.appendChild(dropdown);
  }

  if (dateText) {
    const dateTextWrapper = doc.createElement('div');
    dateTextWrapper.className = 'menu-card-action-date pad-top-30';
    dateTextWrapper.textContent = dateText;
    inner.appendChild(dateTextWrapper);
  }

  // 11. Interactive Wrappers
  if (isCardClickable || enableOverlayModal) {
    const wrapper = createElementFromHTML('<div class="menu-card-action-item-link"></div>', doc);
    wrapper.setAttribute('role', 'button');
    wrapper.setAttribute('tabindex', '0');

    if (cardLinkTitle) wrapper.setAttribute('title', cardLinkTitle);

    if (enableOverlayModal) {
      wrapper.setAttribute('data-modal', overlayHref || '');
    } else {
      wrapper.setAttribute('data-href', cardLinkHref || '#');
      if (cardLinkTarget) wrapper.setAttribute('data-target', cardLinkTarget);
    }

    wrapper.addEventListener('click', (e) => {
      // If the user clicks an inner link (like a download button), do NOT trigger the card
      if (e.target.closest('a') || e.target.closest('[role="link"]')) return;

      if (!enableOverlayModal) {
        e.preventDefault();
        const href = wrapper.getAttribute('data-href');
        const target = wrapper.getAttribute('data-target');
        if (target === '_blank') {
          window.open(href, '_blank', 'noopener,noreferrer');
        } else {
          window.location.href = href;
        }
      }
      // If it's a modal, the block-level listener handles it based on data-modal
    });

    wrapper.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        wrapper.click();
      }
    });

    wrapper.appendChild(inner);
    card.appendChild(wrapper);
  } else {
    card.appendChild(inner);
  }

  return card;
}

export default function decorate(block) {
  const doc = block.ownerDocument;
  const [mobileRow, ...cardRows] = [...block.children];
  const mobileExperience = mobileRow?.textContent?.trim();
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
    const card = createMenuCardItem(row, doc);
    moveInstrumentation(row, card);
    container.appendChild(card);
  });

  block.textContent = '';
  block.appendChild(container);

  block.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-modal]');
    if (!trigger || !block.contains(trigger)) return;

    // Do not trigger modal if clicking an inner link or converted span button
    if (event.target.closest('a') || event.target.closest('[role="link"]')) return;

    event.preventDefault();
    const fragmentPath = trigger.getAttribute('data-modal');
    if (fragmentPath) openModal(doc, { fragmentPath });
  });
}
