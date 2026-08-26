import createDownloadLink from '../../scripts/utils/download-helpers.js';

export default function decorate(block) {
  const rows = [...block.children];
  const [row] = rows;
  if (!row) return;
  const datePrefix = rows[1]?.textContent.trim();
  const button = createDownloadLink(row);
  if (button && datePrefix) {
    const link = button.querySelector('a');
    const dateSpan = document.createElement('span');
    dateSpan.className = 'download-date-prefix';
    dateSpan.textContent = datePrefix;
    link?.prepend(dateSpan);
  }
  block.textContent = '';

  if (isBoxed) {
    block.classList.add('boxed-card');

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

  if (isBoxed && dateElements.length > 0) {
    dateElements.forEach((el) => {
      el.classList.add('download-file-date');
      block.appendChild(el);
    });
  }
}
