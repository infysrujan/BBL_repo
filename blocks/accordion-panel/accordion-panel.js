/**
 * Section-based accordion controller for Crosswalk.
 *
 * Assumes:
 * - You have "Accordion Section" templates that render as <section> elements
 *   with these data attributes:
 *   - data-accordion-id
 *   - data-accordion-title
 *   - data-accordion-expanded-by-default="true|false"
 *
 * - This script is wired as a standard EDS block:
 *   blocks/accordion/accordion.js
 *   and is invoked as `decorate(block)` when the "accordion" block is on the page.
 *
 * The block itself is just a controller; the visible UI is built inside the sections.
 */

function getSectionMeta(section) {
  const { accordionId, accordionTitle, accordionExpandedByDefault } = section.dataset;

  return {
    id: accordionId || null,
    title: accordionTitle || '',
    expandedByDefault: accordionExpandedByDefault === 'true',
  };
}

/**
 * Returns all sections that:
 * - have a data-accordion-id
 * - appear after the accordion block in the DOM
 */
function getAccordionSections(block) {
  const main = block.closest('main') || document;
  const allSections = [...main.querySelectorAll('.section[data-accordion-id]')];

  return allSections.filter((section) => {
    // Only handle sections that appear after the block
    const position = block.compareDocumentPosition(section);
    /* eslint-disable no-bitwise -- Node.compareDocumentPosition returns a bitmask (MDN) */
    const hasFollowing = (position & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    const hasContainedBy = (position & Node.DOCUMENT_POSITION_CONTAINED_BY) !== 0;
    /* eslint-enable no-bitwise */
    const isAfter = hasFollowing && !hasContainedBy;

    return isAfter;
  });
}

function createHeaderElement(section, meta) {
  const header = document.createElement('button');
  header.type = 'button';
  header.classList.add('accordion-header');
  header.setAttribute('aria-expanded', meta.expandedByDefault ? 'true' : 'false');

  // You can tweak heading level & structure here if needed
  const label = document.createElement('span');
  label.classList.add('accordion-header-title');
  label.textContent = meta.title || 'Accordion item';
  header.appendChild(label);

  return header;
}

function wrapSectionContentAsAccordionItem(section, meta) {
  if (section.dataset.accordionEnhanced === 'true') {
    return; // avoid double enhancement
  }

  section.dataset.accordionEnhanced = 'true';
  section.classList.add('accordion-section-item');

  // Create item wrapper, header, and body
  const item = document.createElement('div');
  item.classList.add('accordion-item');
  item.dataset.accordionId = meta.id || '';

  const header = createHeaderElement(section, meta);
  const body = document.createElement('div');
  body.classList.add('accordion-body');

  // Move all existing children of the section into the body
  // NOTE: This keeps inner blocks intact; we only reparent them.
  while (section.firstChild) {
    const child = section.firstChild;
    body.appendChild(child);
  }

  item.appendChild(header);
  item.appendChild(body);

  // Insert the item back into the section
  section.appendChild(item);

  // Set initial collapsed/expanded state
  if (!meta.expandedByDefault) {
    section.classList.add('accordion-collapsed');
    body.hidden = true;
  } else {
    section.classList.remove('accordion-collapsed');
    body.hidden = false;
  }
}

function setupInteractions(sectionsByGroup) {
  sectionsByGroup.forEach((sections) => {
    // Single-open behavior per group
    sections.forEach((section) => {
      const header = section.querySelector('.accordion-header');
      const body = section.querySelector('.accordion-body');
      if (!header || !body) return;

      header.addEventListener('click', () => {
        const isExpanded = header.getAttribute('aria-expanded') === 'true';

        if (isExpanded) {
          // Collapse this one
          header.setAttribute('aria-expanded', 'false');
          section.classList.add('accordion-collapsed');
          body.hidden = true;
        } else {
          // Collapse others in the same group
          sections.forEach((sibling) => {
            if (sibling === section) return;
            const siblingHeader = sibling.querySelector('.accordion-header');
            const siblingBody = sibling.querySelector('.accordion-body');
            if (!siblingHeader || !siblingBody) return;

            siblingHeader.setAttribute('aria-expanded', 'false');
            sibling.classList.add('accordion-collapsed');
            siblingBody.hidden = true;
          });

          // Expand this one
          header.setAttribute('aria-expanded', 'true');
          section.classList.remove('accordion-collapsed');
          body.hidden = false;
        }
      });
    });
  });
}

/**
 * EDS block entry point.
 * `block` is the "accordion" controller block.
 */
export default function decorate(block) {
  // Find all accordion sections after this block
  const sections = getAccordionSections(block);
  if (!sections.length) {
    // Nothing to do; controller is on a page with no accordion sections
    return;
  }

  // Decorate each section as an accordion item
  const groups = new Map(); // id -> [sections]

  sections.forEach((section) => {
    const meta = getSectionMeta(section);
    if (!meta.id) {
      // If there's no ID, treat it as its own group using a unique key per section
      meta.id = `__accordion-${Math.random().toString(36).slice(2)}`;
    }

    wrapSectionContentAsAccordionItem(section, meta);

    if (!groups.has(meta.id)) {
      groups.set(meta.id, []);
    }
    groups.get(meta.id).push(section);
  });

  // Setup interactions per group
  setupInteractions([...groups.values()]);

  // Optionally, hide the controller block itself (it has done its job)
  block.classList.add('accordion-controller');
  block.style.display = 'none';
}
