import { createElementFromHTML } from '../../scripts/scripts.js';

function buildPopupElement(config, doc) {
  const wrapper = createElementFromHTML('<div class="external-redirect-popup"></div>', doc);
  const inner = createElementFromHTML('<div class="external-redirect-popup-inner"></div>', doc);

  inner.appendChild(
    createElementFromHTML(
      '<button class="external-redirect-popup-close" aria-label="Close popup"></button>',
      doc,
    ),
  );

  const cardBody = createElementFromHTML(
    '<div class="external-redirect-popup-body"></div>',
    doc,
  );

  if (config.image) {
    cardBody.appendChild(config.image);
  }

  const content = createElementFromHTML(
    '<div class="external-redirect-popup-content"></div>',
    doc,
  );

  if (config.title) {
    content.appendChild(
      createElementFromHTML(
        `<div class="external-redirect-popup-title">${config.title}</div>`,
        doc,
      ),
    );
  }

  if (config.description) {
    content.appendChild(
      createElementFromHTML(
        `<div class="external-redirect-popup-description">${config.description}</div>`,
        doc,
      ),
    );
  }

  cardBody.appendChild(content);
  inner.appendChild(cardBody);

  // Add first link
  if (config.linkElement1) {
    config.linkElement1.classList.add('button-m');
    inner.appendChild(config.linkElement1);
  }

  // Add second link
  if (config.linkElement2) {
    config.linkElement2.classList.add('button-m');
    inner.appendChild(config.linkElement2);
  }

  wrapper.appendChild(inner);
  return wrapper;
}

export default function decorate(block) {
  const doc = block.ownerDocument;
  const [
    imageDiv,
    titleDiv,
    descriptionDiv,
    primaryButtonDiv,
    secondaryButtonDiv,
  ] = [...block.children];

  const linkElement1 = primaryButtonDiv?.querySelector('a') || null;
  const linkElement2 = secondaryButtonDiv?.querySelector('a') || null;

  const config = {
    image: imageDiv?.querySelector('img'),
    title: titleDiv?.querySelector('div')?.innerHTML || '',
    description: descriptionDiv?.querySelector('div')?.innerHTML || '',
    linkElement1,
    linkElement2,
  };

  if (!config.title && !config.linkElement1 && !config.linkElement2) return;

  const popupEl = buildPopupElement(config, doc);
  block.replaceChildren(popupEl);

  const show = () => {
    requestAnimationFrame(() => popupEl.classList.add('external-redirect-popup-visible'));

    const closePopup = () => {
      popupEl.classList.remove('external-redirect-popup-visible');
    };

    popupEl.querySelector('.external-redirect-popup-close')?.addEventListener('click', closePopup);

    popupEl.addEventListener('click', (e) => {
      if (!e.target.closest('.external-redirect-popup-inner')) {
        closePopup();
      }
    });
  };

  show();
}
