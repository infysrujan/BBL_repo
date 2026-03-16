import { getMetadata } from '../../scripts/aem.js';
import createGlobalDropdown from '../../scripts/utils/dropdown-helpers.js';

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Collect all sections on the page that have a sub-nav label.
 * Adjust the selector if your sections live somewhere else.
 */
function collectSections() {
  // For your decorateSections, sections are direct children of main: main > div.section
  const sections = [...document.querySelectorAll('main > .section')];

  return sections
    .map((section) => {
      // Label to show in dropdown:
      // 1) use section's Sub Nav Title (subnavLabel) from section model
      // 2) fallback to first heading text
      const label = section.dataset.subnavLabel || section.querySelector('h1, h2, h3, h4, h5, h6')?.textContent?.trim();
      if (!label) return null;

      return { label, element: section };
    })
    .filter(Boolean);
}

/**
 * Main decorate function for the sub-nav block.
 * Will turn the block into a dropdown that navigates between sections.
 */
export default function decorate(block) {
  const isSubNav = getMetadata('issubnav') === 'true';

  if (!isSubNav) {
    block.remove();
    return;
  }

  // Read block config: classes from block model (subnav-dropdown | subnav-without-dropdown)
  const blockClasses = [...block.classList];
  const hasDropdownClass = blockClasses.includes('subnav-dropdown');

  // Build UI: wrapper + back button (always)
  const wrapper = document.createElement('div');
  wrapper.className = 'wrapper content';

  const backButton = document.createElement('button');
  backButton.type = 'button';
  backButton.className = 'sub-nav-back';
  backButton.setAttribute('aria-label', 'Go back to previous page');
  backButton.innerHTML = '<span class="sub-nav-back-circle icon-arrow-left"></span>';
  backButton.addEventListener('click', () => {
    window.history.back();
  });

  if (hasDropdownClass) {
    const sections = collectSections();
    if (sections.length) {
      const linksHTML = `<ul>${sections.map(({ label: optLabel }, index) => `<li><a href="#" data-section-index="${index}" class="global-dropdown-link">${escapeHtml(optLabel)}</a></li>`).join('')}</ul>`;
      const initialLabel = sections[0]?.label ?? 'Select';
      const subNavSelect = createGlobalDropdown(initialLabel, linksHTML, document);
      subNavSelect.classList.add('sub-nav-select');

      subNavSelect.querySelectorAll('.global-dropdown-link').forEach((link) => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const sectionIndex = parseInt(link.dataset.sectionIndex, 10);
          if (
            Number.isNaN(sectionIndex)
            || sectionIndex < 0
            || sectionIndex >= sections.length
          ) {
            return;
          }

          const targetSection = sections[sectionIndex].element;
          if (targetSection) {
            targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }

          subNavSelect.querySelector('.global-dropdown-trigger').textContent = link.textContent;
          subNavSelect.classList.remove('is-open');
          subNavSelect.querySelector('.global-dropdown-trigger').setAttribute('aria-expanded', 'false');
        });
      });

      wrapper.append(backButton, subNavSelect);
    } else {
      wrapper.append(backButton);
    }
  } else {
    // only back button on the left, no dropdown on the right
    wrapper.append(backButton);
  }

  block.textContent = '';
  block.appendChild(wrapper);
}
