import { readBlockConfig } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

/**
 * @param {string|string[]|undefined} raw
 * @returns {string}
 */
function firstHref(raw) {
  if (Array.isArray(raw)) return raw[0] || '';
  return typeof raw === 'string' ? raw : '';
}

/**
 * Path suitable for loadFragment (.plain.html fetch).
 * @param {string} path
 * @returns {string}
 */
function normalizeFragmentPath(path) {
  const t = path.trim();
  if (!t) return '';
  if (t.startsWith('http')) {
    try {
      return new URL(t).pathname;
    } catch {
      return '';
    }
  }
  return t.startsWith('/') ? t : `/${t}`;
}

/**
 * @param {unknown} raw
 * @returns {boolean}
 */
function parseBooleanField(raw) {
  if (raw === true) return true;
  if (raw === false) return false;
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'false' || s === 'no' || s === '0') return false;
  if (s === 'true' || s === 'yes' || s === '1') return true;
  return true;
}

/**
 * @param {HTMLElement} el
 * @param {string} value
 */
function setRichTextContent(el, value) {
  const str = String(value ?? '').trim();
  if (!str) return;
  if (/<[a-z][\s\S]*>/i.test(str)) {
    el.innerHTML = str;
  } else {
    el.textContent = str;
  }
}

/**
 * EDS / Crosswalk: one cell per row in model field order (see _accordion-block.json).
 * Classic Franklin: two columns label | value.
 * @param {Element} block
 */
function getAccordionBlockConfig(block) {
  const firstRow = block.querySelector(':scope > div');
  const isKeyValueRows = firstRow && firstRow.children.length >= 2;

  if (isKeyValueRows) {
    const c = readBlockConfig(block);
    const title = (c.title || '').trim();
    const descRaw = c.description || c['description-text'] || '';
    const descriptionHtml = Array.isArray(descRaw) ? descRaw.join('') : String(descRaw || '').trim();
    return {
      title,
      descriptionHtml,
      showExpandAll: parseBooleanField(c['show-expand-all'] ?? c.showexpandall ?? true),
      showPrint: parseBooleanField(c['show-print'] ?? c.showprint ?? true),
      fragmentPath: normalizeFragmentPath(firstHref(c['fragment-path'] || c.fragmentpath)),
    };
  }

  const rows = [...block.querySelectorAll(':scope > div')];

  if (rows.length >= 5) {
    const title = rows[0]?.children[0]?.textContent.trim() || '';
    const showExpandAll = parseBooleanField(rows[1]?.children[0]?.textContent);
    const showPrint = parseBooleanField(rows[2]?.children[0]?.textContent);
    const descCell = rows[3]?.children[0];
    const descriptionHtml = descCell?.innerHTML?.trim() || '';
    const fragmentRow = rows[4];
    let rawPath = '';
    if (fragmentRow) {
      const link = fragmentRow.querySelector('a');
      rawPath = link?.getAttribute('href') || link?.href || fragmentRow.textContent.trim();
    }
    return {
      title,
      descriptionHtml,
      showExpandAll,
      showPrint,
      fragmentPath: normalizeFragmentPath(rawPath),
    };
  }

  const titleCell = rows[0]?.children[0];
  const title = titleCell ? titleCell.textContent.trim() : '';
  const fragmentRow = rows[1];
  let rawPath = '';
  if (fragmentRow) {
    const link = fragmentRow.querySelector('a');
    rawPath = link?.getAttribute('href') || link?.href || fragmentRow.textContent.trim();
  }
  return {
    title,
    descriptionHtml: '',
    showExpandAll: true,
    showPrint: true,
    fragmentPath: normalizeFragmentPath(rawPath),
  };
}

/**
 * Block-level title (h2) and description (richtext) from the accordion-block model.
 * @param {Element} block
 * @param {{ title: string, descriptionHtml: string }} config
 * @param {string} baseId
 */
function renderAccordionIntro(block, { title, descriptionHtml }, baseId) {
  const hasTitle = Boolean(title?.trim());
  const hasDesc = Boolean(descriptionHtml?.trim());
  if (!hasTitle && !hasDesc) return;

  const intro = document.createElement('div');
  intro.className = 'accordion-block-intro';

  if (hasTitle) {
    const h2 = document.createElement('h2');
    h2.className = 'accordion-block-title';
    h2.id = `${baseId}-main-title`;
    h2.textContent = title.trim();
    intro.appendChild(h2);
    block.setAttribute('aria-labelledby', h2.id);
  }

  if (hasDesc) {
    const desc = document.createElement('div');
    desc.className = 'accordion-block-description';
    desc.id = `${baseId}-main-desc`;
    setRichTextContent(desc, descriptionHtml);
    intro.appendChild(desc);
    if (hasTitle) {
      block.setAttribute('aria-describedby', desc.id);
    }
  }

  block.appendChild(intro);
}

/**
 * First title under the section: Title block (Franklin `div.title.block`) or first heading.
 * @param {Element} section
 * @returns {Element|null}
 */
function findFirstTitleRoot(section) {
  const titleBlock = section.querySelector('.block.title, .title.block');
  if (titleBlock) return titleBlock;
  return section.querySelector('h1, h2, h3, h4, h5, h6');
}

/**
 * Moves all section children into a fragment, removes the title subtree,
 * returns { titleText, contentFrag }.
 * @param {Element} section
 */
function extractTitleAndBody(section) {
  const titleRoot = findFirstTitleRoot(section);
  const titleText = titleRoot?.textContent?.trim() || '';

  const contentFrag = document.createDocumentFragment();
  while (section.firstChild) {
    contentFrag.appendChild(section.firstChild);
  }
  if (titleRoot) {
    titleRoot.remove();
  }

  return { titleText, contentFrag };
}

function wireAccordionHeader(header, panel) {
  header.addEventListener('click', () => {
    const expanded = header.getAttribute('aria-expanded') === 'true';
    header.setAttribute('aria-expanded', expanded ? 'false' : 'true');
    panel.hidden = expanded;
  });
}

/**
 * WAI-ARIA APG accordion: Arrow/Home/End move focus between header buttons.
 * @param {Element} block
 */
function wireAccordionGroupNavigation(block) {
  const headers = [...block.querySelectorAll(':scope > .accordion-item > .accordion-heading .accordion-header')];
  if (headers.length < 2) return;

  headers.forEach((header, i) => {
    header.addEventListener('keydown', (e) => {
      let next = i;
      if (e.key === 'ArrowDown') {
        next = (i + 1) % headers.length;
      } else if (e.key === 'ArrowUp') {
        next = (i - 1 + headers.length) % headers.length;
      } else if (e.key === 'Home') {
        next = 0;
      } else if (e.key === 'End') {
        next = headers.length - 1;
      } else {
        return;
      }
      e.preventDefault();
      headers[next].focus();
    });
  });
}

/**
 * @param {Element} block
 * @param {string} baseId
 * @param {string} itemTitle
 * @param {DocumentFragment} contentFrag
 * @param {number} index
 */
function appendAccordionItem(block, baseId, itemTitle, contentFrag, index) {
  const panelId = `${baseId}-panel-${index}`;

  const item = document.createElement('div');
  item.classList.add('accordion-item');

  const heading = document.createElement('h3');
  heading.classList.add('accordion-heading');

  const header = document.createElement('button');
  header.type = 'button';
  header.classList.add('accordion-header');
  header.id = `${panelId}-toggle`;
  header.setAttribute('aria-expanded', 'false');
  header.setAttribute('aria-controls', panelId);

  const label = document.createElement('span');
  label.classList.add('accordion-header-title');
  label.textContent = itemTitle || `Item ${index + 1}`;
  header.appendChild(label);

  heading.appendChild(header);

  const panel = document.createElement('div');
  panel.id = panelId;
  panel.classList.add('accordion-panel');
  panel.hidden = true;
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-labelledby', header.id);

  panel.appendChild(contentFrag);

  item.appendChild(heading);
  item.appendChild(panel);
  block.appendChild(item);

  wireAccordionHeader(header, panel);
}

/**
 * @returns {{
 *   item: HTMLDivElement,
 *   header: HTMLButtonElement,
 *   panel: HTMLDivElement,
 *   label: HTMLSpanElement,
 * }}
 */
function createAccordionItemElements(baseId, itemIndex, itemLabel) {
  const panelId = `${baseId}-panel-${itemIndex}`;

  const item = document.createElement('div');
  item.classList.add('accordion-item');

  const heading = document.createElement('h3');
  heading.classList.add('accordion-heading');

  const header = document.createElement('button');
  header.type = 'button';
  header.classList.add('accordion-header');
  header.id = `${panelId}-toggle`;
  header.setAttribute('aria-expanded', 'false');
  header.setAttribute('aria-controls', panelId);

  const label = document.createElement('span');
  label.classList.add('accordion-header-title');
  label.textContent = itemLabel || 'Accordion';
  header.appendChild(label);

  heading.appendChild(header);

  const panel = document.createElement('div');
  panel.id = panelId;
  panel.classList.add('accordion-panel');
  panel.hidden = true;
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-labelledby', header.id);

  item.appendChild(heading);
  item.appendChild(panel);

  return {
    item,
    header,
    panel,
    label,
  };
}

/**
 * Label for the single placeholder row when the main block title is already shown as h2.
 * @param {string} blockTitle
 */
function singleItemButtonLabel(blockTitle) {
  return blockTitle?.trim() ? 'Details' : 'Accordion';
}

/**
 * Accordion block: optional fragmentPath loads a page whose top-level sections
 * each become one item.
 * Block model title + description render above items.
 * @param {Element} block
 */
export default async function decorate(block) {
  const config = getAccordionBlockConfig(block);
  const {
    title,
    descriptionHtml,
    fragmentPath,
  } = config;

  block.textContent = '';
  block.classList.add('accordion');

  const baseId = block.id || `accordion-${crypto.randomUUID().slice(0, 8)}`;

  renderAccordionIntro(block, { title, descriptionHtml }, baseId);

  if (!fragmentPath) {
    const { item, header, panel } = createAccordionItemElements(
      baseId,
      0,
      singleItemButtonLabel(title),
    );
    block.appendChild(item);
    wireAccordionHeader(header, panel);
    wireAccordionGroupNavigation(block);
    return;
  }

  block.setAttribute('aria-busy', 'true');
  block.classList.add('accordion-panel-loading');
  let fragment;
  try {
    fragment = await loadFragment(fragmentPath);
  } finally {
    block.removeAttribute('aria-busy');
    block.classList.remove('accordion-panel-loading');
  }

  if (!fragment) {
    const status = document.createElement('p');
    status.className = 'accordion-load-error';
    status.setAttribute('role', 'status');
    status.textContent = 'Content could not be loaded.';
    block.appendChild(status);
    return;
  }

  const sections = [...fragment.querySelectorAll(':scope > .section')];

  if (sections.length > 0) {
    sections.forEach((section, index) => {
      const { titleText, contentFrag } = extractTitleAndBody(section);
      appendAccordionItem(block, baseId, titleText, contentFrag, index);
    });
    block.classList.add('accordion-panel-loaded');
    wireAccordionGroupNavigation(block);
    return;
  }

  const {
    item,
    header,
    panel,
    label,
  } = createAccordionItemElements(
    baseId,
    0,
    singleItemButtonLabel(title),
  );
  block.appendChild(item);
  wireAccordionHeader(header, panel);

  const fragmentSection = fragment.querySelector(':scope .section');
  if (fragmentSection) {
    panel.append(...fragmentSection.childNodes);
  } else {
    const { titleText, contentFrag } = extractTitleAndBody(fragment);
    if (titleText) {
      label.textContent = titleText;
    }
    panel.appendChild(contentFrag);
  }
  block.classList.add('accordion-panel-loaded');
  wireAccordionGroupNavigation(block);
}
