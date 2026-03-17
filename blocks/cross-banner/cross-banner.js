export default function decorate(block) {
  const [imgEl, budgeTextEl, titleEl, descriptionEl, buttonEl] = block.children;
  const pictureHTML = imgEl?.querySelector('img')?.outerHTML || '';
  const budgeText = budgeTextEl?.textContent?.trim() || '';
  const titleName = titleEl?.textContent?.trim() || '';
  const description = descriptionEl?.querySelector('p')?.innerHTML?.trim() || '';
  const anchor = buttonEl?.querySelector('a');
  if (anchor) anchor.classList.add('button-m');
  const buttonHTML = buttonEl?.innerHTML?.trim() || '';

  block.innerHTML = `
    <div class="cross-banner content">
      <div class="cross-banner-image">
        ${pictureHTML}
      </div>
      <div class="cross-banner-content">
        ${budgeText ? `<div class="cross-banner-badge">${budgeText}</div>` : ''}
        <div class="cross-banner-title">${titleName}</div>
        <div class="cross-banner-description">${description}</div>
        <div class="cross-banner-button">${buttonHTML}</div>
      </div>
    </div>
  `;
}
