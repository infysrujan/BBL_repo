import { moveInstrumentation, createElementFromHTML } from '../../scripts/scripts.js';
import { getLang } from '../../scripts/bbl-decorators.js';
import createGlobalDropdown from '../../scripts/utils/dropdown-helpers.js';
import createDownloadLink from '../../scripts/utils/download-helpers.js';
import { openModal } from '../../scripts/utils/modal.js';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (getLang() === 'th') {
    return `${date.getDate()} ${date.toLocaleString('th-TH', { month: 'long' })} ${date.getFullYear() + 543}`;
  }
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function isKeywordCell(cell) {
  if (!cell.textContent.trim()) return false;
  return ![...cell.querySelectorAll('*')].some(
    (el) => el instanceof HTMLAnchorElement
      || el instanceof HTMLImageElement
      || el instanceof HTMLPictureElement
      || el instanceof HTMLHeadingElement,
  );
}

// A toggle checkbox cell authored as true / false / or intentionally left empty
function isToggleCell(cell) {
  const text = cell.textContent.trim().toLowerCase();
  return text === 'true' || text === 'false' || cell.innerHTML.trim() === '';
}

function extractToggledLink(cells, valueCellSelector) {
  const valueCell = cells.find(valueCellSelector);
  if (!valueCell) return { enabled: false, cell: null };

  const indexInAll = cells.indexOf(valueCell);
  const prevCell = cells[indexInAll - 1];
  const isDisabled = isToggleCell(prevCell) && prevCell?.textContent?.trim().toLowerCase() === 'false';

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

  // Skip empty or config-only rows
  if (!cells.some((c) => c.textContent.trim().length > 0)) return null;

  // --- Data Extraction ---

  // Finds the first element of a given DOM type across all cells, returning both cell and element
  const findInCells = (ctor) => cells.reduce((found, cell) => {
    if (found.el) return found;
    const el = [...cell.querySelectorAll('*')].find((e) => e instanceof ctor);
    return el ? { cell, el } : found;
  }, { cell: null, el: null });

  const { cell: imgCell, el: imgEl } = findInCells(HTMLImageElement);
  const { cell: titleCell, el: headingEl } = findInCells(HTMLHeadingElement);
  // Preserve author's heading level (outerHTML); default to h3 if plain text with no heading
  const titleText = titleCell?.textContent?.trim();
  const title = headingEl?.outerHTML?.trim() ?? (titleText ? `<h3>${titleText}</h3>` : '');

  // Action type: keyword cell immediately before the first cell with links or a list
  const hasActionContent = (c) => [...c.querySelectorAll('*')]
    .some((el) => el instanceof HTMLAnchorElement || el instanceof HTMLUListElement);
  const firstActionCellIdx = cells.findIndex(hasActionContent);
  let actionTypeIdx = -1;
  if (firstActionCellIdx > 0) {
    const candidate = cells[firstActionCellIdx - 1];
    if (candidate !== imgCell && candidate !== titleCell && isKeywordCell(candidate)) {
      actionTypeIdx = firstActionCellIdx - 1;
    }
  }
  const actionType = actionTypeIdx !== -1 ? cells[actionTypeIdx].textContent.trim().toLowerCase() : '';

  // Description: the cell immediately before the action type keyword cell
  const descCell = actionTypeIdx > 1 ? cells[actionTypeIdx - 1] : null;
  const description = (descCell && descCell !== titleCell && descCell !== imgCell)
    ? descCell.innerHTML
    : '';

  let remaining = actionTypeIdx !== -1 ? cells.slice(actionTypeIdx + 1) : cells.slice(3);

  // Date: last remaining cell that parses as a valid date with no links
  let dateText = '';
  const lastCell = remaining[remaining.length - 1];
  const lastCellText = lastCell?.textContent?.trim() || '';
  const lastCellEls = lastCell ? [...lastCell.querySelectorAll('*')] : [];
  if (lastCellText.length >= 8 && !Number.isNaN(Date.parse(lastCellText))
    && !lastCellEls.some((el) => el instanceof HTMLAnchorElement)) {
    dateText = formatDate(lastCellText);
    remaining = remaining.slice(0, -1);
  }

  // Overlay modal toggle
  const { enabled: enableOverlayModal, cell: modalCell } = extractToggledLink(
    remaining,
    (c) => [...c.querySelectorAll('*')]
      .find((el) => el instanceof HTMLAnchorElement
        && el.getAttribute('href')?.includes('/fragments/')),
  );
  const overlayHref = enableOverlayModal
    ? [...modalCell.querySelectorAll('*')].find((el) => el instanceof HTMLAnchorElement).getAttribute('href')
    : '';
  remaining = remaining.filter((c) => c !== modalCell);

  // Card link toggle (URL-like: link text contains '/' or equals href)
  const { enabled: isCardClickable, cell: cardLinkCell } = extractToggledLink(
    remaining,
    (c) => {
      const els = [...c.querySelectorAll('*')];
      const a = els.find((el) => el instanceof HTMLAnchorElement);
      if (!a || els.some((el) => el instanceof HTMLUListElement)) return false;
      const text = a.textContent?.trim() || '';
      const href = a.getAttribute('href')?.trim() || '';
      return text.includes('/') || href.endsWith(text) || text === href;
    },
  );
  const cardLinkAnchor = isCardClickable
    ? [...cardLinkCell.querySelectorAll('*')].find((el) => el instanceof HTMLAnchorElement)
    : null;
  const cardLinkHref = cardLinkAnchor?.getAttribute('href') || '';
  const cardLinkTarget = cardLinkAnchor?.target || '';
  const cardLinkTitle = cardLinkAnchor?.title?.trim() || '';
  remaining = remaining.filter((c) => c !== cardLinkCell);

  // Action button cells: have a link, but aren't image or heading containers
  const actionCells = remaining.filter((c) => {
    const els = [...c.querySelectorAll('*')];
    return els.some((el) => el instanceof HTMLAnchorElement)
      && !els.some((el) => el instanceof HTMLHeadingElement
        || el instanceof HTMLImageElement
        || el instanceof HTMLPictureElement);
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

  // Render action based on the authored action type (read dynamically — no whitelist)
  if (actionType === 'default' && actionCells.length > 0) {
    const btn = actionCells[0].querySelector('a').cloneNode(true);
    // Link style: read from the first non-toggle keyword cell in remaining
    const isLinkTypeCell = (c) => isKeywordCell(c) && !isToggleCell(c) && !actionCells.includes(c);
    const linkTypeCell = remaining.find(isLinkTypeCell);
    const linkType = linkTypeCell?.textContent.trim().toLowerCase() ?? 'tertiary';
    btn.classList.add('button', `button-${linkType}`);
    btn.removeAttribute('data-modal');
    inner.appendChild(btn);
  } else if (actionType === 'download' && actionCells.length > 0) {
    const dlAnchor = actionCells.find((c) => !c.querySelector('ul'))?.querySelector('a')
      || actionCells[0].querySelector('a');
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
        : remaining[labelCellIdx]?.textContent.trim() || 'Select';
      inner.appendChild(createGlobalDropdown(label, dropdownCell.innerHTML, doc));
    }
  }

  if (dateText) {
    const dateEl = doc.createElement('div');
    dateEl.className = 'menu-card-action-date pad-top-30';
    dateEl.textContent = dateText;
    inner.appendChild(dateEl);
  }

  // Wrap with interactive layer if the card is clickable or triggers a modal
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

export default function decorate(block) {
  const doc = block.ownerDocument;
  const allRows = [...block.children];

  // Layout: first-row keyword if it is plain text with a single word, otherwise 'stacked'
  const firstRowText = allRows[0]?.textContent?.trim().toLowerCase() || '';
  const firstRowEls = allRows[0] ? [...allRows[0].querySelectorAll('*')] : [];
  const isFirstRowLayout = /^[a-z-]+$/.test(firstRowText)
    && !firstRowEls.some((el) => el instanceof HTMLAnchorElement
      || el instanceof HTMLImageElement
      || el instanceof HTMLHeadingElement);
  const layout = isFirstRowLayout ? firstRowText : 'stacked';
  const cardRows = isFirstRowLayout ? allRows.slice(1) : allRows;

  // Tag section header wrappers for styling
  const section = block.closest('.menu-card-actions-container');
  ['text', 'image'].forEach((type, i) => {
    section?.querySelector(`.default-content-wrapper > p:nth-of-type(${i + 1})`)
      ?.classList.add(`default-content-wrapper-${type}`);
  });

  const container = createElementFromHTML(`<div class="menu-card-action ${layout}"></div>`, doc);

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
    const trigger = event.target.closest('[data-modal]');
    if (!trigger || !block.contains(trigger)) return;
    if (event.target.closest('a') || event.target.closest('[role="link"]')) return;
    event.preventDefault();
    const fragmentPath = trigger.getAttribute('data-modal');
    if (fragmentPath) openModal(doc, { fragmentPath });
  });
}
