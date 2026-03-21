export default function decorate(block) {
  const doc = block.ownerDocument;
  const rows = [...block.children];

  // Row layout (from HTML authoring table):
  // 0: image
  // 1: title
  // 2: description prefix ("and entering")
  // 3: accept link placeholder  (unused — actual URL comes from the clicked link)
  // 4: accept label             ("Accept")
  // 5: accept id                (unused)
  // 6: accept variant           (unused)
  // 7: cancel link              (unused — cancel just closes the popup)
  // 8: cancel label             ("Cancel")
  // 9: cancel id                (unused)
  // 10: cancel variant          (unused)
  const [imageDiv, titleDiv, descriptionDiv, , acceptLabelDiv, , , , cancelLabelDiv] = rows;

  const acceptLabel = acceptLabelDiv?.querySelector('div')?.textContent?.trim() || 'Accept';
  const cancelLabel = cancelLabelDiv?.querySelector('div')?.textContent?.trim() || 'Cancel';
  const descPrefix = descriptionDiv?.querySelector('div')?.textContent?.trim() || 'and entering';
  const img = imageDiv?.querySelector('img') ?? null;
  const titleEl = titleDiv?.querySelector(':is(h1,h2,h3,h4,h5,h6)');
  const titleHTML = titleEl ? titleEl.outerHTML : (titleDiv?.querySelector('div')?.innerHTML || '');

  // ── Build DOM ──────────────────────────────────────────────────────────────
  block.innerHTML = '';

  // White card container
  const inner = doc.createElement('div');
  inner.className = 'external-redirect-popup-inner';
  block.appendChild(inner);

  // Close (×) button — top-right corner of card
  const closeBtn = doc.createElement('button');
  closeBtn.className = 'external-redirect-popup-close';
  closeBtn.setAttribute('aria-label', 'Close popup');
  inner.appendChild(closeBtn);

  // Card body: image + text
  const body = doc.createElement('div');
  body.className = 'external-redirect-popup-body';

  if (img) {
    img.removeAttribute('loading'); // show immediately when popup opens
    body.appendChild(img);
  }

  const content = doc.createElement('div');
  content.className = 'external-redirect-popup-content';

  if (titleHTML) {
    const titleWrapper = doc.createElement('div');
    titleWrapper.className = 'external-redirect-popup-title';
    titleWrapper.innerHTML = titleHTML;
    content.appendChild(titleWrapper);
  }

  // Description: "and entering <strong>"URL"</strong>"
  const descEl = doc.createElement('div');
  descEl.className = 'external-redirect-popup-description';
  const descP = doc.createElement('p');
  descP.textContent = `${descPrefix} `;
  const urlSpan = doc.createElement('strong');
  urlSpan.className = 'external-redirect-popup-url';
  descP.appendChild(urlSpan);
  descEl.appendChild(descP);
  content.appendChild(descEl);

  body.appendChild(content);
  inner.appendChild(body);

  // Button row
  const btnRow = doc.createElement('div');
  btnRow.className = 'external-redirect-popup-btn-row';

  const acceptBtn = doc.createElement('button');
  acceptBtn.type = 'button';
  acceptBtn.className = 'external-redirect-popup-btn external-redirect-popup-btn-accept';
  acceptBtn.textContent = acceptLabel;

  const cancelBtn = doc.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'external-redirect-popup-btn external-redirect-popup-btn-cancel';
  cancelBtn.textContent = cancelLabel;

  btnRow.appendChild(acceptBtn);
  btnRow.appendChild(cancelBtn);
  inner.appendChild(btnRow);

  // ── State & helpers ────────────────────────────────────────────────────────
  let targetUrl = '';

  const closePopup = () => {
    block.classList.remove('external-redirect-popup-visible');
    targetUrl = '';
  };

  const openPopup = (url) => {
    targetUrl = url;
    urlSpan.textContent = `"${url}"`;
    requestAnimationFrame(() => block.classList.add('external-redirect-popup-visible'));
  };

  // ── Event listeners ────────────────────────────────────────────────────────
  closeBtn.addEventListener('click', closePopup);

  cancelBtn.addEventListener('click', closePopup);

  acceptBtn.addEventListener('click', () => {
    const url = targetUrl;
    closePopup();
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  });

  // Click on the dark overlay (outside the card) also closes
  block.addEventListener('click', (e) => {
    if (!e.target.closest('.external-redirect-popup-inner')) closePopup();
  });

  // Expose openPopup globally so scripts.js can call it after loading this fragment
  window.showExternalRedirectPopup = openPopup;
}
