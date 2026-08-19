import createDownloadLink from '../../scripts/utils/download-helpers.js';

export default function decorate(block) {
  const [row] = [...block.children];
  if (!row) return;
  const button = createDownloadLink(row);
  block.textContent = '';
  if (button) block.appendChild(button);
}
