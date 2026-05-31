import { moveInstrumentation, createElementFromHTML } from '../../scripts/scripts.js';
import { getLang } from '../../scripts/bbl-decorators.js';
import createGlobalDropdown from '../../scripts/utils/dropdown-helpers.js';
import createDownloadLink from '../../scripts/utils/download-helpers.js';
import { openModal } from '../../scripts/utils/modal.js';

const ACTION_TYPES = ['default', 'download', 'multiple-download', 'select-dropdown'];
const LINK_TYPES = ['primary', 'secondary', 'tertiary'];

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (getLang() === 'th') {
    return `${date.getDate()} ${date.toLocaleString('th-TH', { month: 'long' })} ${date.getFullYear() + 543}`;
  }
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/**
 * Reads a boolean toggle cell pair authored as:
 *   [checkbox cell (true/false/empty)] [value cell]
 * Returns the value cell anchor element, or null if the toggle is disabled.
 */
function extractToggledLink(cells, valueCellSelector) {
  const valueCell = cells.find(valueCellSelector);
  if (!valueCell) return { enabled: false, cell: null };

  const indexInAll = cells.indexOf(valueCell);
  const prevCell = cells[indexInAll - 1];
  const prevText = prevCell?.textContent?.trim().toLowerCase() || '';
  const isDisabled = prevText === 'false' || prevCell?.innerHTML?.trim() === '';

  return { enabled: !isDisabled, cell: valueCell };
}

function buildCardWrapper(
  cardLinkHref,
  cardLinkTarget,
  cardLinkTitle,
  overlayHref,
  enableOverlayModal,
) {
  const wrapper = createElementFromHTML('<div class="menu-card-action-item-link"></div>', document);
  wrapper.setAttribute('role', 'button');
  wrapper.setAttribute('tabindex', '0');
  if (cardLinkTitle) wrapper.setAttribute('title', cardLinkTitle);

  if (enableOverlayModal) {
    wrapper.setAttribute('data-modal', overlayHref);
  } else {
    wrapper.setAttribute('data-href', cardLinkHref);
  }

  wrapper.addEventListener('click', (e) => {
    if (e.target.closest('a') || e.target.closest('[role="link"]')) return;
    if (!enableOverlayModal) {
      e.preventDefault();
      window.location.href = wrapper.getAttribute('data-href');
    }
  });

  wrapper.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      wrapper.click();
    }
  });

  return wrapper;
}

function createCardItem(cardRow, doc) {
  const cells = [...cardRow.children];

  // Skip empty or config-only rows (no image, heading, or meaningful text content)
  const hasImage = !!cells.find((c) => c.querySelector('img'));
  const hasHeading = !!cells.find((c) => c.querySelector('h1, h2, h3, h4, h5, h6'));
  const hasText = cells.some((c) => c.textContent.trim().length > 0);
  if (!hasImage && !hasHeading && !hasText) return null;

  // --- Data Extraction ---

  const imgEl = cells.find((c) => c.querySelector('img'))?.querySelector('img');
  const titleCell = cells.find((c) => c.querySelector('h1, h2, h3, h4, h5, h6'));
  const title = titleCell?.innerHTML?.trim();

  const actionTypeIdx = cells.findIndex(
    (c) => ACTION_TYPES.includes(c.textContent.trim().toLowerCase()),
  );
  const actionType = actionTypeIdx !== -1
    ? cells[actionTypeIdx].textContent.trim().toLowerCase()
    : '';

  const descCell = actionTypeIdx > 0 ? cells[actionTypeIdx - 1] : null;
  const description = (descCell && descCell !== titleCell && descCell !== cells.find((c) => c.querySelector('img')))
    ? descCell.innerHTML
    : '';

  let remaining = actionTypeIdx !== -1 ? cells.slice(actionTypeIdx + 1) : cells.slice(3);

  // Date: last remaining cell that is a valid date string without links
  let dateText = '';
  const lastCell = remaining[remaining.length - 1];
  const lastCellText = lastCell?.textContent?.trim() || '';
  if (lastCellText.length >= 8 && !Number.isNaN(Date.parse(lastCellText)) && !lastCell.querySelector('a')) {
    dateText = formatDate(lastCellText);
    remaining = remaining.slice(0, -1);
  }

  // Overlay modal toggle
  const { enabled: enableOverlayModal, cell: modalCell } = extractToggledLink(
    remaining,
    (c) => c.querySelector('a')?.getAttribute('href')?.includes('/fragments/'),
  );
  const overlayHref = enableOverlayModal ? modalCell.querySelector('a').getAttribute('href') : '';
  remaining = remaining.filter((c) => c !== modalCell);

  // Card link toggle (URL-like link text or href === text)
  const { enabled: isCardClickable, cell: cardLinkCell } = extractToggledLink(
    remaining,
    (c) => {
      const a = c.querySelector('a');
      if (!a || c.querySelector('ul')) return false;
      const text = a.textContent?.trim() || '';
      const href = a.getAttribute('href')?.trim() || '';
      return text.includes('/') || href.endsWith(text) || text === href;
    },
  );
  const cardLinkAnchor = isCardClickable ? cardLinkCell.querySelector('a') : null;
  const cardLinkHref = cardLinkAnchor?.getAttribute('href') || '';
  const cardLinkTarget = cardLinkAnchor?.target || '';
  const cardLinkTitle = cardLinkAnchor?.title?.trim() || '';
  remaining = remaining.filter((c) => c !== cardLinkCell);

  // Action button cells (cells with links that aren't headings or images)
  const actionCells = remaining.filter((c) => {
    const a = c.querySelector('a');
    return a && !c.querySelector('h1, h2, h3, h4, h5, h6') && !c.querySelector('picture, img');
  });

  // --- DOM Construction ---

  const card = createElementFromHTML('<div class="menu-card-action-item"></div>', doc);
  const inner = createElementFromHTML('<div class="menu-card-action-inner"></div>', doc);

  if (imgEl) inner.appendChild(imgEl.cloneNode(true));

  if (title) {
    inner.appendChild(createElementFromHTML(`<div class="menu-card-action-title">${title}</div>`, doc));
  }

  if (description) {
    inner.appendChild(createElementFromHTML(`<div class="menu-card-action-description">${description}</div>`, doc));
    inner.querySelector('.menu-card-action-title')?.classList.add('has-description');
  }

  // Action button rendering
  if (actionType === 'default' && actionCells.length > 0) {
    const btn = actionCells[0].querySelector('a').cloneNode(true);
    const linkTypeCell = remaining.find(
      (c) => LINK_TYPES.includes(c.textContent.trim().toLowerCase()),
    );
    const linkType = linkTypeCell ? linkTypeCell.textContent.trim().toLowerCase() : 'tertiary';
    btn.classList.add('button', `button-${linkType}`);
    btn.removeAttribute('data-modal');
    inner.appendChild(btn);
  } else if (actionType === 'download' && actionCells.length > 0) {
    const dlAnchor = actionCells.find((c) => !c.querySelector('ul'))?.querySelector('a') || actionCells[0].querySelector('a');
    const dlLink = createDownloadLink(dlAnchor, doc);
    dlLink?.querySelector('.download-files')?.addEventListener('click', (e) => e.stopPropagation());
    inner.appendChild(dlLink);
  } else if (actionType === 'multiple-download' && actionCells.length > 0) {
    const multipleCell = actionCells[actionCells.length - 1];
    const temp = createElementFromHTML(`<div>${multipleCell.innerHTML}</div>`, doc);
    temp.querySelectorAll('a').forEach((anchor) => {
      const dlLink = createDownloadLink(anchor, doc);
      dlLink?.querySelector('.download-files')?.addEventListener('click', (e) => e.stopPropagation());
      inner.appendChild(dlLink);
    });
  } else if (actionType === 'select-dropdown') {
    const dropdownCell = actionCells.find((c) => c.querySelector('ul') || c.querySelectorAll('a').length > 1);
    if (dropdownCell) {
      const labelCellIdx = remaining.indexOf(dropdownCell) - 1;
      const label = (labelCellIdx >= 0 && !remaining[labelCellIdx].querySelector('a'))
        ? remaining[labelCellIdx].textContent.trim()
        : 'Select';
      inner.appendChild(createGlobalDropdown(label, dropdownCell.innerHTML, doc));
    }
  }

  if (dateText) {
    const dateEl = doc.createElement('div');
    dateEl.className = 'menu-card-action-date pad-top-30';
    dateEl.textContent = dateText;
    inner.appendChild(dateEl);
  }

  // Wrap with interactive layer if card is clickable or opens a modal
  if (isCardClickable || enableOverlayModal) {
    const wrapper = buildCardWrapper(
      cardLinkHref,
      cardLinkTarget,
      cardLinkTitle,
      overlayHref,
      enableOverlayModal,
    );
    wrapper.appendChild(inner);
    card.appendChild(wrapper);
  } else {
    card.appendChild(inner);
  }

  return card;
}

const VALID_LAYOUTS = ['stacked', 'scrollable'];

export default function decorate(block) {
  const doc = block.ownerDocument;
  const allRows = [...block.children];

  // Consume the first row only if it is a known layout keyword; otherwise default to 'stacked'
  const firstRowText = allRows[0]?.textContent?.trim().toLowerCase();
  const layout = VALID_LAYOUTS.includes(firstRowText) ? firstRowText : 'stacked';
  const cardRows = VALID_LAYOUTS.includes(firstRowText) ? allRows.slice(1) : allRows;

  // Tag section header text/image wrappers for styling
  const section = block.closest('.menu-card-actions-container');
  ['text', 'image'].forEach((type, i) => {
    section?.querySelector(`.default-content-wrapper > p:nth-of-type(${i + 1})`)
      ?.classList.add(`default-content-wrapper-${type}`);
  });

  const container = createElementFromHTML(`<div class="menu-card-action ${layout}"></div>`, doc);

  cardRows.forEach((row) => {
    const card = createCardItem(row, doc);
    if (!card) return; // Skip empty/config rows
    moveInstrumentation(row, card);
    container.appendChild(card);
  });

  block.textContent = '';
  block.appendChild(container);

  // Block-level modal trigger (delegated)
  block.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-modal]');
    if (!trigger || !block.contains(trigger)) return;
    if (event.target.closest('a') || event.target.closest('[role="link"]')) return;
    event.preventDefault();
    const fragmentPath = trigger.getAttribute('data-modal');
    if (fragmentPath) openModal(doc, { fragmentPath });
  });
}
