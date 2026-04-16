import { moveInstrumentation } from '../../scripts/scripts.js';

const MIN_COMPARE = 2;

export default function decorate(block) {
  const rows = [...block.children];
  rows.forEach((row) => moveInstrumentation(row, block));

  const anchor = rows[0]?.children[0]?.querySelector('a');
  const link = anchor?.href ?? '';
  const linkText = anchor?.textContent?.trim() ?? 'Compare';
  const targetLink = rows[1]?.children[0]?.querySelector('p')?.textContent?.trim() === 'true';

  // ── Build DOM matching live site structure ─────────────────────────────────
  block.innerHTML = '';

  const innerContainer = document.createElement('div');
  innerContainer.className = 'inner-container';

  const compareGroup = document.createElement('div');
  compareGroup.className = 'compare-group';

  const ctaBtn = document.createElement('button');
  ctaBtn.type = 'button';
  ctaBtn.className = 'btn-primary';
  ctaBtn.textContent = linkText;
  ctaBtn.disabled = true;

  innerContainer.appendChild(compareGroup);
  innerContainer.appendChild(ctaBtn);
  block.appendChild(innerContainer);

  // ── Render selected cards ──────────────────────────────────────────────────
  function renderBar(selectedCards) {
    compareGroup.innerHTML = '';

    selectedCards.forEach(({ name, image }) => {
      const item = document.createElement('div');
      item.className = 'product-comparing';

      // Thumb — background-image like live site
      const thumb = document.createElement('div');
      thumb.className = 'thumb';
      if (image) thumb.style.backgroundImage = `url("${image}")`;

      const closeIcon = document.createElement('span');
      closeIcon.className = 'icon-close';
      closeIcon.textContent = 'x';
      thumb.appendChild(closeIcon);

      // Info
      const info = document.createElement('div');
      info.className = 'info';
      const h3 = document.createElement('h3');
      h3.className = 'text-small';
      h3.textContent = name;
      info.appendChild(h3);

      item.appendChild(thumb);
      item.appendChild(info);
      compareGroup.appendChild(item);

      closeIcon.addEventListener('click', () => {
        window.ccsSelectedCards = (window.ccsSelectedCards || []).filter((c) => c.name !== name);
        document.dispatchEvent(new CustomEvent('credit-card-compare-updated', {
          detail: { cards: window.ccsSelectedCards },
        }));
      });
    });
  }

  // ── Update visibility and CTA state ───────────────────────────────────────
  function update(selectedCards) {
    const count = selectedCards.length;
    block.classList.toggle('active', count > 0);
    ctaBtn.disabled = count < MIN_COMPARE;
    renderBar(selectedCards);
  }

  // ── Compare CTA → navigate with selected card names ───────────────────────
  ctaBtn.addEventListener('click', () => {
    if (!link) return;
    const params = (window.ccsSelectedCards || [])
      .map((c) => encodeURIComponent(c.name))
      .join(',');
    const url = params ? `${link}?cards=${params}` : link;
    window.open(url, targetLink ? '_blank' : '_self');
  });

  // ── Listen for selection changes ───────────────────────────────────────────
  document.addEventListener('credit-card-compare-updated', (e) => {
    update(e.detail?.cards ?? []);
  });

  // ── Initialise from existing window state ──────────────────────────────────
  update(window.ccsSelectedCards || []);
}
