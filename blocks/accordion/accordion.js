import { loadFragment } from '../fragment/fragment.js';

function createAccordionItem(block, titleText, fragmentPath, index) {
  const item = document.createElement('div');
  item.classList.add('accordion-item');

  const headerId = `accordion-header-${index}`;
  const panelId = `accordion-panel-${index}`;

  const header = document.createElement('button');
  header.type = 'button';
  header.classList.add('accordion-header');
  header.id = headerId;
  header.textContent = titleText || `Item ${index + 1}`;
  header.setAttribute('aria-expanded', 'false');
  header.setAttribute('aria-controls', panelId);

  const panel = document.createElement('div');
  panel.classList.add('accordion-panel');
  panel.id = panelId;
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-labelledby', headerId);
  panel.hidden = true;

  header.addEventListener('click', async () => {
    const isExpanded = header.getAttribute('aria-expanded') === 'true';

    // Close if already open
    if (isExpanded) {
      header.setAttribute('aria-expanded', 'false');
      panel.hidden = true;
      return;
    }

    // Close other open items in this accordion
    [...block.querySelectorAll('.accordion-header[aria-expanded="true"]')]
      .forEach((openHeader) => openHeader.setAttribute('aria-expanded', 'false'));

    [...block.querySelectorAll('.accordion-panel:not([hidden])')]
      .forEach((openPanel) => { openPanel.hidden = true; });

    // Open this one
    header.setAttribute('aria-expanded', 'true');
    panel.hidden = false;

    // Lazy‑load fragment once
    if (!panel.dataset.loaded && fragmentPath) {
      panel.classList.add('accordion-panel-loading');
      try {
        const fragment = await loadFragment(fragmentPath);
        panel.innerHTML = '';
        if (fragment) {
          // loadFragment returns a <div> containing the fragment content,
          // including any nested blocks (cards, download, etc.) already decorated.
          panel.append(...fragment.childNodes);
        } else {
          panel.innerHTML = '<p>Content could not be loaded.</p>';
        }
        panel.dataset.loaded = 'true';
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to load fragment for accordion', fragmentPath, e);
        panel.innerHTML = '<p>Content could not be loaded.</p>';
      } finally {
        panel.classList.remove('accordion-panel-loading');
        panel.classList.add('accordion-panel-loaded');
      }
    }
  });

  item.append(header, panel);
  return item;
}

export default function decorate(block) {
  const rows = [...block.children];
  block.textContent = '';

  rows.forEach((row, index) => {
    const cells = [...row.children];
    const titleText = cells[0]?.textContent.trim();
    const fragmentPath = cells[1]?.textContent.trim();

    if (!titleText && !fragmentPath) {
      return;
    }

    const item = createAccordionItem(block, titleText, fragmentPath, index);
    block.append(item);
  });
}
