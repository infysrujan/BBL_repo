import { createElementFromHTML } from '../../scripts/scripts.js';

function buildPopupInner(config, doc) {
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

  return inner;
}

export default function decorate(block) {
  const doc = block.ownerDocument;
  const rows = [...block.children];

  // Row layout:
  // 0: image, 1: title, 2: description
  // 3: accept link URL, 4: accept label, 5: accept id, 6: accept variant
  // 7: cancel link URL, 8: cancel label, 9: cancel id, 10: cancel variant
  const [
    imageDiv,
    titleDiv,
    descriptionDiv,
    acceptLinkDiv,
    acceptLabelDiv, , , // skip accept id and accept variant
    cancelLinkDiv,
    cancelLabelDiv,
  ] = rows;

  // Build Accept button from the link element + label text
  const acceptAnchor = acceptLinkDiv?.querySelector('a') || null;
  const acceptLabel = acceptLabelDiv?.querySelector('div')?.textContent?.trim() || 'Accept';
  if (acceptAnchor && acceptLabel) {
    acceptAnchor.textContent = acceptLabel;
  }

  // Build Cancel button — uses the link href if present, falls back to closing the popup
  const cancelHref = cancelLinkDiv?.querySelector('a')?.href || null;
  const cancelLabel = cancelLabelDiv?.querySelector('div')?.textContent?.trim() || 'Cancel';
  const cancelAnchor = doc.createElement('a');
  cancelAnchor.textContent = cancelLabel;
  if (cancelHref) {
    cancelAnchor.href = cancelHref;
  } else {
    cancelAnchor.href = '#';
  }

  const config = {
    image: imageDiv?.querySelector('img'),
    title: titleDiv?.querySelector('div')?.innerHTML || '',
    description: descriptionDiv?.querySelector('div')?.innerHTML || '',
    linkElement1: acceptAnchor,
    linkElement2: cancelAnchor,
  };

  if (!config.title && !config.linkElement1 && !config.linkElement2) return;

  const inner = buildPopupInner(config, doc);
  block.replaceChildren(inner);

  const show = () => {
    requestAnimationFrame(() => block.classList.add('external-redirect-popup-visible'));

    const closePopup = () => {
      block.classList.remove('external-redirect-popup-visible');
    };

    block.querySelector('.external-redirect-popup-close')?.addEventListener('click', closePopup);

    // Cancel button (second <a>) closes the popup
    const cancelBtn = block.querySelectorAll('.external-redirect-popup-inner > a.button')[1];
    if (cancelBtn) {
      cancelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        closePopup();
      });
    }

    block.addEventListener('click', (e) => {
      if (!e.target.closest('.external-redirect-popup-inner')) {
        closePopup();
      }
    });
  };

  show();
}
