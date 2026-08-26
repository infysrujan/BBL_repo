import createDownloadLink from '../../scripts/utils/download-helpers.js';

export default function decorate(block) {
  const rows = [...block.children];
  if (!rows.length) return;

  const [buttonRow, titleRow, dateRow] = rows;
  const button = buttonRow ? createDownloadLink(buttonRow) : null;

  const titleEl = titleRow?.querySelector(':is(h1, h2, h3, h4, h5, h6), p');
  const dateElements = dateRow ? [...dateRow.querySelectorAll(':scope > div > *')] : [];
  const hasBoxedCard = Boolean(
    (titleEl && titleEl.textContent.trim())
    || dateElements.length > 0
    || (dateRow && dateRow.textContent.trim()),
  );

  block.textContent = '';

  if (hasBoxedCard) {
    block.classList.add('boxed-card');
  }

  if (titleEl && titleEl.textContent.trim()) {
    titleEl.classList.add('download-file-title');
    block.appendChild(titleEl);
  }

  if (button) {
    block.appendChild(button);
  }

  if (dateElements.length > 0) {
    dateElements.forEach((el) => {
      if (el.textContent.trim()) {
        el.classList.add('download-file-date');
        block.appendChild(el);
      }
    });
  } else if (dateRow?.textContent.trim()) {
    const p = document.createElement('p');
    p.className = 'download-file-date';
    p.textContent = dateRow.textContent.trim();
    block.appendChild(p);
  }
}
