import createDownloadLink from '../../scripts/utils/download-helpers.js';

export default function decorate(block) {
  const [buttonRow, row1, row2, row3] = [...block.children];
  if (!buttonRow) return;

  const button = createDownloadLink(buttonRow);

  let isBoxed = false;
  let titleRow = null;
  let dateRow = null;

  if (row1) {
    const row1Text = row1.textContent.trim().toLowerCase();
    if (row1Text === 'true') {
      isBoxed = true;
      titleRow = row2 || null;
      dateRow = row3 || null;
    } else if (row1Text === 'false') {
      isBoxed = false;
      titleRow = null;
      dateRow = null;
    } else {
      const possibleTitle = row1.querySelector(':is(h1, h2, h3, h4, h5, h6)');
      if (possibleTitle) {
        titleRow = row1;
        dateRow = row2 || null;
        isBoxed = true;
      }
    }
  }

  block.textContent = '';

  if (isBoxed) {
    block.classList.add('boxed-card');

    const titleEl = titleRow?.querySelector(':is(h1, h2, h3, h4, h5, h6), p');
    if (titleEl && titleEl.textContent.trim()) {
      titleEl.classList.add('download-file-title');
      block.appendChild(titleEl);
    }
  } else {
    block.classList.remove('boxed-card');
  }

  if (button) {
    block.appendChild(button);
  }

  if (isBoxed && dateRow) {
    const dateElements = [...dateRow.querySelectorAll(':scope > div > *')];
    if (dateElements.length > 0) {
      dateElements.forEach((el) => {
        if (el.textContent.trim()) {
          el.classList.add('download-file-date');
          block.appendChild(el);
        }
      });
    } else if (dateRow.textContent.trim()) {
      const p = document.createElement('p');
      p.className = 'download-file-date';
      p.textContent = dateRow.textContent.trim();
      block.appendChild(p);
    }
  }
}
