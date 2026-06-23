import { openModal } from '../../scripts/utils/modal.js';
import { applyLinkTarget } from '../../scripts/bbl-decorators.js';
import { loadFragment } from '../fragment/fragment.js';

const parseBool = (el) => el?.textContent.trim().toLowerCase() === 'true';

export default function decorate(block) {
  const doc = block.ownerDocument;

  [...block.children].forEach((row) => {
    const anchor = row.querySelector('a');
    if (!anchor) return;

    const allCells = [...row.children];
    const boolCells = allCells.filter((cell) => {
      const t = cell.textContent.trim().toLowerCase();
      return t === 'true' || t === 'false';
    });

    // UE writes empty string for false booleans; Word/SharePoint writes explicit "false".
    // When no explicit "false" is found, use positional reading (UE format):
    //   cell[1]=targetLink, cell[2]=enableModal, cell[3]=enableCookieModal
    // Otherwise fall back to the boolCells filter approach (Word format).
    const hasExplicitFalse = boolCells.some((c) => c.textContent.trim().toLowerCase() === 'false');
    let targetLink;
    let enableModal;
    let enableCookieModal;
    if (hasExplicitFalse) {
      targetLink = boolCells.length >= 2 ? parseBool(boolCells[0]) : anchor.target === '_blank';
      enableModal = boolCells.length >= 2 ? parseBool(boolCells[1]) : parseBool(boolCells[0]);
      enableCookieModal = boolCells.length >= 3 ? parseBool(boolCells[2]) : false;
    } else {
      targetLink = parseBool(allCells[1]);
      enableModal = parseBool(allCells[2]);
      enableCookieModal = parseBool(allCells[3]);
    }

    const cellsToHide = hasExplicitFalse ? boolCells : allCells.slice(1);
    cellsToHide.forEach((cell) => { cell.hidden = true; });

    if (enableCookieModal) {
      const href = anchor.getAttribute('href');
      if (href) {
        anchor.removeAttribute('href');
        anchor.addEventListener('click', async (e) => {
          e.preventDefault();
          if (typeof window.showCookieModal !== 'function') {
            await loadFragment(href);
          }
          window.showCookieModal?.(anchor);
        });
      }
    } else if (enableModal) {
      const href = anchor.getAttribute('href');
      if (href) {
        anchor.removeAttribute('href');
        anchor.addEventListener('click', (e) => {
          e.preventDefault();
          openModal(doc, { fragmentPath: href });
        });
      }
    } else {
      applyLinkTarget(row, 'a', targetLink);
    }
  });
}
