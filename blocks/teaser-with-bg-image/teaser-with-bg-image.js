import { moveInstrumentation, createElementFromHTML } from '../../scripts/scripts.js';

function createTeaserCard(cardRow, doc) {
  const cols = [...cardRow.children];
  const [teaserBgImgDiv, teaserTitleDiv, teaserDescDiv, teaserButtonDiv] = cols;
  const teaserBgImg = teaserBgImgDiv?.querySelector('picture') || teaserBgImgDiv?.querySelector('img');
  const teaserTitle = teaserTitleDiv?.innerHTML?.trim();
  const teaserDescription = teaserDescDiv?.innerHTML?.trim();
  const teaserButton = teaserButtonDiv?.querySelector('a');

  const card = createElementFromHTML(
    '<div class="teaser-bg-image-card"></div>',
    doc,
  );

  if (teaserBgImg) {
    const imgWrapper = createElementFromHTML(
      '<div class="teaser-bg-image-card-image"></div>',
      doc,
    );
    imgWrapper.appendChild(teaserBgImg.cloneNode(true));
    card.appendChild(imgWrapper);
  }

  const body = createElementFromHTML(
    '<div class="teaser-bg-image-card-body"></div>',
    doc,
  );

  if (teaserTitle) {
    body.appendChild(
      createElementFromHTML(
        `<div class="teaser-bg-image-card-title">${teaserTitle}</div>`,
        doc,
      ),
    );
  }

  if (teaserDescription) {
    body.appendChild(
      createElementFromHTML(
        `<div class="teaser-bg-image-card-description">${teaserDescription}</div>`,
        doc,
      ),
    );
  }

  if (teaserButton) {
    const cta = teaserButton.cloneNode(true);
    cta.classList.add('teaser-bg-image-card-cta');
    body.appendChild(cta);
  }

  card.appendChild(body);
  return card;
}

export default function decorate(block) {
  const doc = block.ownerDocument;
  const [cardBgImgRow, cardTitleRow, cardDescRow, ...cardRows] = [...block.children];
  const cardBgPicture = cardBgImgRow?.querySelector('picture') || cardBgImgRow?.querySelector('img');
  const cardTitle = cardTitleRow?.innerHTML?.trim();
  const cardDescription = cardDescRow?.innerHTML?.trim();

  const wrapper = createElementFromHTML(
    '<div class="teaser-bg-image-wrapper"></div>',
    doc,
  );

  if (cardBgPicture) {
    const bgLayer = createElementFromHTML(
      '<div class="teaser-bg-image-bg" aria-hidden="true"></div>',
      doc,
    );
    bgLayer.appendChild(cardBgPicture.cloneNode(true));
    wrapper.appendChild(bgLayer);
  }

  const overlay = createElementFromHTML(
    '<div class="teaser-bg-image-overlay"></div>',
    doc,
  );

  if (cardTitle) {
    overlay.appendChild(
      createElementFromHTML(
        `<div class="teaser-bg-image-title">${cardTitle}</div>`,
        doc,
      ),
    );
  }

  if (cardDescription) {
    overlay.appendChild(
      createElementFromHTML(
        `<div class="teaser-bg-image-description">${cardDescription}</div>`,
        doc,
      ),
    );
  }

  wrapper.appendChild(overlay);

  if (cardRows.length) {
    const cardsContainer = createElementFromHTML(
      '<div class="teaser-bg-image-cards"></div>',
      doc,
    );

    cardRows.forEach((row) => {
      const card = createTeaserCard(row, doc);
      moveInstrumentation(row, card);
      cardsContainer.appendChild(card);
    });

    wrapper.appendChild(cardsContainer);
  }

  block.textContent = '';
  block.appendChild(wrapper);
}
