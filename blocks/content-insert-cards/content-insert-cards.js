import { moveInstrumentation } from '../../scripts/scripts.js';

function createCard(cardItem) {
  // Get all rows from the card item
  const rows = [...cardItem.children];

  if (rows.length === 0) {
    return null;
  }

  // Destructure rows - [0] = categoryRow, [1] = imageRow,
  // [2] = titleRow, [3] = descRow, [4] = buttonRow
  const [categoryRow, imageRow, titleRow, descRow, buttonRow] = rows;

  // Check if we have at least the image row to proceed
  if (!imageRow) {
    return null;
  }

  const picture = imageRow.querySelector('picture');

  // Only proceed if we have a picture
  if (!picture) {
    return null;
  }

  // Create the main card container
  const card = document.createElement('div');
  card.className = 'content-insert-card';

  // Move instrumentation from original cardItem to the new card
  moveInstrumentation(cardItem, card);

  const figure = document.createElement('figure');
  figure.className = 'thumb-large smaller';

  const imageContainer = document.createElement('div');
  imageContainer.className = 'thumb';
  imageContainer.appendChild(picture);

  figure.appendChild(imageContainer);

  // Process category (first row) - add it to figure (on top of image)
  if (categoryRow) {
    const categoryDiv = categoryRow.querySelector('p');
    const categoryText = categoryDiv?.textContent?.trim();

    if (categoryText) {
      const category = document.createElement('p');
      category.className = 'category';
      category.textContent = categoryText;
      figure.appendChild(category);
    }
  }

  // Create figcaption for content
  const figcaption = document.createElement('figcaption');
  figcaption.className = 'intro-info';

  // Process title (third row) - only if it exists
  if (titleRow) {
    const titleDiv = titleRow.querySelector('p');
    const titleText = titleDiv?.textContent?.trim();

    if (titleText) {
      const title = document.createElement('h3');
      title.className = 'title-2 line';
      title.textContent = titleText;
      figcaption.appendChild(title);
    }
  }

  // Process description (fourth row) - only if it exists
  if (descRow) {
    const descDiv = descRow.querySelector('p');
    const descText = descDiv?.textContent?.trim();

    if (descText) {
      const desc = document.createElement('div');
      desc.className = 'desc';
      const paragraph = document.createElement('p');
      paragraph.className = 'text-default';
      paragraph.textContent = descText;
      desc.appendChild(paragraph);
      figcaption.appendChild(desc);
    }
  }

  // Process button (fifth row) - only if it exists
  if (buttonRow) {
    const buttonContainer = buttonRow.querySelector('.button-container');
    const link = buttonContainer?.querySelector('a') || buttonRow.querySelector('a');

    if (link) {
      const buttonGroup = document.createElement('div');
      buttonGroup.className = 'button-group';

      // Create new button with proper classes
      const button = document.createElement('a');
      button.className = 'btn-primary';
      button.href = link.href;
      button.textContent = link.textContent || 'Read More';
      button.title = link.title || 'read-more';

      buttonGroup.appendChild(button);
      figcaption.appendChild(buttonGroup);
    }
  }

  figure.appendChild(figcaption);
  card.appendChild(figure);

  return card;
}

export default function decorate(block) {
  // Get all card items (direct children divs)
  const cardItems = [...block.children];

  // Create a container for all cards
  const cardsContainer = document.createElement('div');
  cardsContainer.className = 'content-insert-cards-wrapper';

  // Process each card item
  cardItems.forEach((cardItem) => {
    const card = createCard(cardItem);
    if (card) {
      // Add the decorated card
      cardsContainer.appendChild(card);
    } else {
      // Keep the original item for Universal Editor tracking
      // Move instrumentation to maintain editability
      const placeholder = document.createElement('div');
      placeholder.className = 'content-insert-card-placeholder';
      moveInstrumentation(cardItem, placeholder);
      // Keep original children for Universal Editor
      while (cardItem.firstElementChild) {
        placeholder.appendChild(cardItem.firstElementChild);
      }
      cardsContainer.appendChild(placeholder);
    }
  });

  // Replace block content
  block.replaceChildren(cardsContainer);
}
