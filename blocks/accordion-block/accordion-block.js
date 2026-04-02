import { loadBlock } from '../../scripts/aem.js';

export default async function decorate(block) {
  const rows = [...block.children];

  // Clear the original table layout
  block.innerHTML = '';
  block.classList.add('accordion-block');

  rows.forEach((row, rowIndex) => {
    const cells = [...row.children];
    if (cells.length < 2) return;

    const [titleCell, contentCell] = cells;

    const item = document.createElement('div');
    item.className = 'accordion-item';

    const headerBtn = document.createElement('button');
    headerBtn.type = 'button';
    headerBtn.className = 'accordion-header';
    headerBtn.id = `accordion-header-${rowIndex}`;
    headerBtn.setAttribute('aria-expanded', rowIndex === 0 ? 'true' : 'false');
    headerBtn.setAttribute('aria-controls', `accordion-panel-${rowIndex}`);
    headerBtn.innerHTML = titleCell.innerHTML;

    const panel = document.createElement('div');
    panel.className = 'accordion-panel';
    panel.id = `accordion-panel-${rowIndex}`;
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-labelledby', headerBtn.id);
    if (rowIndex !== 0) {
      panel.hidden = true;
    }

    // Move all content nodes from the cell into the panel (keeps nested blocks)
    while (contentCell.firstChild) {
      panel.append(contentCell.firstChild);
    }

    item.append(headerBtn, panel);
    block.append(item);

    headerBtn.addEventListener('click', async () => {
      const currentlyExpanded = headerBtn.getAttribute('aria-expanded') === 'true';
      const newExpanded = !currentlyExpanded;

      // Optional: close other items (accordion behavior)
      block.querySelectorAll('.accordion-header').forEach((btn) => {
        const isThis = btn === headerBtn;
        const expanded = isThis ? newExpanded : false;
        btn.setAttribute('aria-expanded', expanded);
        const targetPanel = document.getElementById(btn.getAttribute('aria-controls'));
        if (targetPanel) {
          targetPanel.hidden = !expanded;
        }
      });

      // When opening, load any nested blocks in this panel
      if (newExpanded) {
        const nestedBlocks = panel.querySelectorAll('.block');
        await Promise.all(
          [...nestedBlocks].map((nestedBlock) => loadBlock(nestedBlock)),
        );
      }
    });
  });
}