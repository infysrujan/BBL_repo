/**
 * Accordion Group block
 *
 * Pattern:
 * - One `accordion-group` block = header (title + actions) + container for items.
 * - Each item is a SECTION that has section metadata fields:
 *     accordionGroupId  (string, required)
 *     accordionTitle    (string, required)
 *     accordionOpen     (boolean, optional)
 *   Inside those sections, authors can put ANY blocks (download PDF, tables, text+image, etc.).
 *
 * Authoring contract:
 * - The block's model provides:
 *     title           (string)  → main heading text
 *     groupId         (string)  → must match section.accordionGroupId
 *     showExpandAll   (boolean) → whether to show the "Expand All" toggle
 *     showPrint       (boolean) → whether to show the "Print" button
 */

function normalizeKey(key) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Read section-metadata into a plain object.
 * Works with both DA and Crosswalk-generated metadata.
 */
function readSectionMetadata(section) {
  const meta = section.querySelector(':scope > .section-metadata');
  const data = {};
  if (!meta) return data;

  [...meta.children].forEach((row) => {
    const cells = row.children;
    if (cells.length < 2) return;
    const name = normalizeKey(cells[0].textContent.trim());
    const value = cells[1].textContent.trim();
    if (name) data[name] = value;
  });

  return data;
}

/**
 * Find all accordion item sections that belong to this group.
 * The contract is:
 *   - They live after the block's own section.
 *   - They have section metadata accordionGroupId matching the block's groupId.
 *   - Once we hit a section that either has a different groupId or no groupId,
 *     we stop (only consecutive sections belong to a group).
 */
function findItemSections(block, groupId) {
  const main = block.closest('main') || document;
  const allSections = [...main.querySelectorAll(':scope > div.section, :scope > main > div.section')];

  const hostSection = block.closest('.section');
  const startIndex = allSections.indexOf(hostSection);
  if (startIndex === -1) return [];

  const wantedKey = normalizeKey('accordionGroupId');
  const items = [];

  for (let i = startIndex + 1; i < allSections.length; i += 1) {
    const section = allSections[i];
    const meta = readSectionMetadata(section);
    const rawGroup = meta[wantedKey];

    if (!rawGroup) {
      // if we already started collecting, stop on the first "unmarked" section
      if (items.length) break;
      // otherwise just skip and keep looking
      // eslint-disable-next-line no-continue
      continue;
    }

    if (rawGroup !== groupId) {
      // stop once another group's sections start
      if (items.length) break;
      // skip non-matching group before we started
      // eslint-disable-next-line no-continue
      continue;
    }

    items.push({ section, meta });
  }

  return items;
}

function buildHeader(block, cfg) {
  const header = document.createElement('div');
  header.className = 'accordion-group-header';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'accordion-group-title-wrapper';

  const h2 = document.createElement('h2');
  h2.className = 'accordion-group-title';
  h2.textContent = cfg.title || 'Accordion';

  const underline = document.createElement('div');
  underline.className = 'accordion-group-underline';

  titleWrap.append(h2, underline);

  const actions = document.createElement('div');
  actions.className = 'accordion-group-actions';

  if (cfg.showExpandAll) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'accordion-group-btn accordion-group-btn-expand';
    btn.textContent = 'Expand All';
    actions.append(btn);
    cfg.expandAllButton = btn;
  }

  if (cfg.showPrint) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'accordion-group-btn accordion-group-btn-print';
    btn.textContent = 'Print';
    actions.append(btn);
    cfg.printButton = btn;
  }

  header.append(titleWrap, actions);
  block.append(header);
}

/**
 * Build one accordion item from a section.
 * Returns the accordion item element.
 */
function buildItem(groupCfg, index, section, meta) {
  const idSuffix = `${groupCfg.groupId || 'accordion'}-${index + 1}`;
  const itemId = `accordion-item-${idSuffix}`;
  const headerId = `accordion-header-${idSuffix}`;

  const titleKey = normalizeKey('accordionTitle');
  const openKey = normalizeKey('accordionOpen');

  const title = meta[titleKey] || `Item ${index + 1}`;
  const isOpen = (meta[openKey] || '').toLowerCase() === 'true';

  // Move the section's children (except section-metadata) into the item body.
  const bodyContent = document.createElement('div');
  bodyContent.className = 'accordion-item-body-inner';

  [...section.children].forEach((child) => {
    if (child.classList.contains('section-metadata')) return;
    bodyContent.append(child);
  });

  const item = document.createElement('div');
  item.className = 'accordion-item';
  if (isOpen) item.classList.add('is-open');

  const headerBtn = document.createElement('button');
  headerBtn.type = 'button';
  headerBtn.className = 'accordion-item-header';
  headerBtn.id = headerId;
  headerBtn.setAttribute('aria-controls', itemId);
  headerBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  headerBtn.innerHTML = `
      <span class="accordion-item-label">${title}</span>
      <span class="accordion-item-icon" aria-hidden="true"></span>
    `;

  const body = document.createElement('div');
  body.className = 'accordion-item-body';
  body.id = itemId;
  body.setAttribute('role', 'region');
  body.setAttribute('aria-labelledby', headerId);
  if (!isOpen) body.hidden = true;
  body.append(bodyContent);

  headerBtn.addEventListener('click', () => {
    const nowOpen = !item.classList.contains('is-open');
    item.classList.toggle('is-open', nowOpen);
    headerBtn.setAttribute('aria-expanded', nowOpen ? 'true' : 'false');
    body.hidden = !nowOpen;
  });

  item.append(headerBtn, body);

  // Remove the original empty shell section from DOM entirely.
  section.remove();

  return item;
}

function wireExpandAll(groupCfg, container) {
  if (!groupCfg.expandAllButton) return;

  const btn = groupCfg.expandAllButton;
  btn.addEventListener('click', () => {
    const items = [...container.querySelectorAll('.accordion-item')];
    if (!items.length) return;

    const anyClosed = items.some((it) => !it.classList.contains('is-open'));
    const targetState = anyClosed; // true = open all, false = collapse all

    items.forEach((item) => {
      const headerBtn = item.querySelector('.accordion-item-header');
      const body = item.querySelector('.accordion-item-body');
      item.classList.toggle('is-open', targetState);
      if (headerBtn) headerBtn.setAttribute('aria-expanded', targetState ? 'true' : 'false');
      if (body) body.hidden = !targetState;
    });

    btn.textContent = targetState ? 'Collapse All' : 'Expand All';
  });
}

function wirePrint(groupCfg, container) {
  if (!groupCfg.printButton) return;

  const btn = groupCfg.printButton;
  btn.addEventListener('click', () => {
    // Ensure everything is open for printing
    const items = [...container.querySelectorAll('.accordion-item')];
    items.forEach((item) => {
      const headerBtn = item.querySelector('.accordion-item-header');
      const body = item.querySelector('.accordion-item-body');
      item.classList.add('is-open');
      if (headerBtn) headerBtn.setAttribute('aria-expanded', 'true');
      if (body) body.hidden = false;
    });

    // Let layout settle, then trigger print
    window.setTimeout(() => {
      window.print();
    }, 50);
  });
}

export default function decorate(block) {
  // Expect a single row with four cells: title, groupId, showExpandAll, showPrint
  const row = block.querySelector(':scope > div');
  const cells = row ? [...row.children] : [];
  const [titleCell, groupIdCell, expandAllCell, printCell] = cells;

  const cfg = {
    title: titleCell ? titleCell.textContent.trim() : '',
    groupId: groupIdCell ? groupIdCell.textContent.trim() : '',
    showExpandAll: !!expandAllCell && expandAllCell.textContent.trim().toLowerCase() === 'true',
    showPrint: !!printCell && printCell.textContent.trim().toLowerCase() === 'true',
  };

  // Clean the autogenerated table content.
  block.textContent = '';

  // Build header
  buildHeader(block, cfg);

  // Find item sections
  if (!cfg.groupId) {
    // Nothing to group, bail out gracefully.
    return;
  }

  const itemsMeta = findItemSections(block, cfg.groupId);
  if (!itemsMeta.length) return;

  const itemsContainer = document.createElement('div');
  itemsContainer.className = 'accordion-group-items';

  itemsMeta.forEach(({ section, meta }, idx) => {
    const itemEl = buildItem(cfg, idx, section, meta);
    itemsContainer.append(itemEl);
  });

  block.append(itemsContainer);

  // Wire header actions
  wireExpandAll(cfg, itemsContainer);
  wirePrint(cfg, itemsContainer);
}
