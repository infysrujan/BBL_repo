import { moveInstrumentation } from '../../scripts/scripts.js';
import createCard from '../content-insert-cards/create-cards-helper.js';

/**
 * Build a slide for contentInsertCarouselCards variant.
 * Delegates card rendering to the shared createCard helper.
 *
 * Cell layout (carousel-dotted-slide, slideType = contentInsertCarouselCards):
 *   0: variant (hidden), 1: slideType (select),
 *   2: promoTag (category), 3: cardImage, 4: cardTitle,
 *   5: cardDescription, 6: button (merged — cardLink+cardLinkText+cardLinkTitle+cardLinkType)
 *
 * @param {HTMLElement} row - Original row element from the block
 * @param {number} index - Slide index
 * @param {HTMLElement[]} cells - Array of cell elements from the row
 * @returns {HTMLElement} Slide element
 */
export default function buildContentCardsSlide(row, index, cells) {
  const slide = document.createElement('div');
  slide.className = 'carousel-dotted-item content-cards';
  slide.dataset.index = index;
  moveInstrumentation(row, slide);

  // Build a cardItem matching the structure createCard expects:
  // children[0]=categoryRow, [1]=imageRow, [2]=titleRow, [3]=descRow, [4]=buttonRow
  const cardItem = document.createElement('div');
  [cells[2], cells[3], cells[4], cells[5], cells[6]].forEach((cell) => {
    if (cell) cardItem.append(cell);
  });

  const card = createCard(cardItem);
  if (card) slide.append(card);

  return slide;
}
