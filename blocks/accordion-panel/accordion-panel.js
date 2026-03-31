/**
 * Section-based accordion behavior for AEM+UE Crosswalk.
 *
 * Assumes:
 *  - Each accordion item is its own <section> element.
 *  - The section is created with the "Accordion Panel" template/model.
 *  - The section element carries data attributes:
 *      data-accordion-id="accordion-1"
 *      data-accordion-title="Panel title"
 *      data-accordion-expanded-by-default="true" | "false"
 *
 * Usage:
 *  - Import and call initAccordionPanels() from scripts.js after the page is decorated.
 *  - Or just inline this file's contents into scripts.js and call initAccordionPanels().
 */

// set to false if you want multiple panels open within one accordionId
const SINGLE_OPEN_PER_GROUP = true;

/**
 * Extracts accordion metadata from a section element.
 * Adjust this method if your attributes differ.
 *
 * @param {HTMLElement} section
 * @returns {{accordionId:string, title:string, expandedByDefault:boolean} | null}
 */
function getSectionMeta(section) {
  if (!section || !(section instanceof HTMLElement)) return null;

  const accordionId = section.dataset.accordionId || '';
  const title = section.dataset.accordionTitle || '';
  const expandedRaw = section.dataset.accordionExpandedByDefault || 'false';
  const expandedByDefault = String(expandedRaw).toLowerCase() === 'true';

  if (!accordionId || !title) {
    return null;
  }

  return { accordionId, title, expandedByDefault };
}

/**
 * Toggles a single section, optionally closing siblings in the same group.
 *
 * @param {HTMLElement} section
 * @param {string} accordionId
 */
function toggleAccordionPanel(section, accordionId) {
  const isCollapsed = section.classList.contains('accordion-panel--collapsed');
  const newExpanded = isCollapsed;

  if (SINGLE_OPEN_PER_GROUP && newExpanded) {
    // Close other sections in the same accordion group
    const allInGroup = document.querySelectorAll(
      `.accordion-panel[data-accordion-id="${CSS.escape(accordionId)}"]`,
    );
    allInGroup.forEach((s) => {
      if (s !== section) {
        s.classList.add('accordion-panel--collapsed');
        const header = s.querySelector('.accordion-header');
        if (header) header.setAttribute('aria-expanded', 'false');
      }
    });
  }

  section.classList.toggle('accordion-panel--collapsed', !newExpanded);
  const header = section.querySelector('.accordion-header');
  if (header) {
    header.setAttribute('aria-expanded', newExpanded ? 'true' : 'false');
  }
}

/**
 * Builds the header + body structure inside a section to turn it into
 * an accordion item, and wires up the toggle behavior.
 *
 * @param {HTMLElement} section
 * @param {{accordionId:string, title:string, expandedByDefault:boolean}} meta
 */
function decorateAccordionPanel(section, meta) {
  section.classList.add('accordion-panel');
  section.setAttribute('data-accordion-id', meta.accordionId);

  // Create header button
  const headerBtn = document.createElement('button');
  headerBtn.type = 'button';
  headerBtn.classList.add('accordion-header');
  headerBtn.setAttribute('data-accordion-header', '');
  headerBtn.setAttribute('aria-expanded', meta.expandedByDefault ? 'true' : 'false');

  // Generate unique IDs for ARIA
  const uid = `${meta.accordionId}-${Math.random().toString(36).slice(2, 10)}`;
  const headerId = `accordion-header-${uid}`;
  const bodyId = `accordion-body-${uid}`;

  headerBtn.id = headerId;
  headerBtn.setAttribute('aria-controls', bodyId);

  const titleSpan = document.createElement('span');
  titleSpan.classList.add('accordion-title');
  titleSpan.textContent = meta.title;
  headerBtn.appendChild(titleSpan);

  // Insert header at the top of the section
  section.insertBefore(headerBtn, section.firstChild);

  // Create body wrapper and move all siblings after header into it
  const bodyWrapper = document.createElement('div');
  bodyWrapper.classList.add('accordion-body');
  bodyWrapper.id = bodyId;
  bodyWrapper.setAttribute('role', 'region');
  bodyWrapper.setAttribute('aria-labelledby', headerId);

  let sib = headerBtn.nextSibling;
  while (sib) {
    const next = sib.nextSibling;
    bodyWrapper.appendChild(sib);
    sib = next;
  }
  section.appendChild(bodyWrapper);

  // Initial state: collapsed or expanded
  if (!meta.expandedByDefault) {
    section.classList.add('accordion-panel--collapsed');
  }

  headerBtn.addEventListener('click', () => {
    toggleAccordionPanel(section, meta.accordionId);
  });
}

/**
 * Initializes all accordion panels on the page.
 * Call this once after the page/blocks are decorated.
 *
 * @param {HTMLElement|Document} [root=document]
 */
export function initAccordionPanels(root = document) {
  const sections = root.querySelectorAll('main .section');

  sections.forEach((section) => {
    const meta = getSectionMeta(section);
    if (!meta) return; // not an accordion panel

    // Avoid double-decorating (e.g. in case of re-init)
    if (section.classList.contains('accordion-panel')) return;

    decorateAccordionPanel(section, meta);
  });
}

/**
 * Optional: Universal Editor integration
 * - Ensure that selecting content inside a collapsed accordion item
 *   automatically expands that section in the editor.
 */
function initUniversalEditorIntegration() {
  if (typeof window === 'undefined') return;

  document.addEventListener('aue:ui-select', (event) => {
    const { target } = event.detail || {};
    if (!target) return;

    const section = target.closest('.accordion-panel');
    if (!section) return;

    section.classList.remove('accordion-panel--collapsed');
    const header = section.querySelector('.accordion-header');
    if (header) {
      header.setAttribute('aria-expanded', 'true');
    }
  });
}

// Auto-init on DOMContentLoaded (browser only)
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    initAccordionPanels(document);
    initUniversalEditorIntegration();
  });
}

// Backward-compatible named export during rename transition.
export const initAccordionSections = initAccordionPanels;
export default initAccordionPanels;
