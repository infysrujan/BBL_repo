import { moveInstrumentation, createElementFromHTML } from '../../scripts/scripts.js';

function createTeaserCard(cardRow, doc) {
  const cols = [...cardRow.children];
  const [cardImgDiv, cardTitleDiv, cardDescDiv] = [cols[0], ...cols.slice(2)];
  const cardImg = cardImgDiv?.querySelector('img');

  if (!cardImg && !cardTitleDiv && !cardDescDiv) return null;

  const card = createElementFromHTML(
    '<div class="teaser-bg-image-card"></div>',
    doc,
  );

  if (cardImg) {
    const imgWrapper = createElementFromHTML(
      '<div class="teaser-bg-image-card-image"></div>',
      doc,
    );
    imgWrapper.appendChild(cardImg.cloneNode(true));
    card.appendChild(imgWrapper);
  }

  const body = createElementFromHTML(
    '<div class="teaser-bg-image-card-body"></div>',
    doc,
  );

  if (cardTitleDiv) {
    cardTitleDiv.classList.add('teaser-bg-image-card-title');
    body.appendChild(cardTitleDiv);
  }

  if (cardDescDiv) {
    cardDescDiv.classList.add('teaser-bg-image-card-description');
    body.appendChild(cardDescDiv);
  }

  card.appendChild(body);
  return card;
}

export default function decorate(block) {
  const doc = block.ownerDocument;

  const [
    teaserBgImgRow,
    teaserTitleRow,
    teaserDescRow,
    teaserButtonRow,
    ...teaserRows
  ] = [...block.children];

  const teaserBgPicture = teaserBgImgRow?.querySelector('img');
  const teaserButton = teaserButtonRow?.querySelector('a');

  const wrapper = createElementFromHTML(
    '<div class="teaser-bg-image-wrapper"></div>',
    doc,
  );

  if (teaserBgPicture) {
    const bgLayer = createElementFromHTML(
      '<div class="teaser-bg-image-bg" aria-hidden="true"></div>',
      doc,
    );
    bgLayer.appendChild(teaserBgPicture.cloneNode(true));
    wrapper.appendChild(bgLayer);
  }

  const overlay = createElementFromHTML(
    '<div class="teaser-bg-image-overlay content"></div>',
    doc,
  );

  if (teaserTitleRow) {
    teaserTitleRow.classList.add('teaser-bg-image-title');
    overlay.appendChild(teaserTitleRow);
  }

  if (teaserDescRow) {
    teaserDescRow.classList.add('teaser-bg-image-description', 'pad-bot-30');
    overlay.appendChild(teaserDescRow);
  }

  wrapper.appendChild(overlay);

  if (teaserRows.length) {
    const cardsContainer = createElementFromHTML(
      '<div class="teaser-bg-image-cards content"></div>',
      doc,
    );

    teaserRows.forEach((row) => {
      const card = createTeaserCard(row, doc);
      if (!card) return;

      moveInstrumentation(row, card);
      cardsContainer.appendChild(card);
    });

    wrapper.appendChild(cardsContainer);
  }

  if (teaserButton) {
    teaserButton.classList.add('button-m');
    wrapper.appendChild(
      createElementFromHTML(
        `<div class="teaser-bg-image-cta content">${teaserButton.outerHTML}</div>`,
        doc,
      ),
    );
  }

  block.textContent = '';
  block.appendChild(wrapper);
}
