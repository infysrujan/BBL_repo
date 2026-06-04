/**
 * Forms Menu Card Component
 *
 * Renders a single display card containing an icon, bold heading,
 * a short divider, and a description. Placed inside a
 * Forms Menu Card Actions container.
 *
 * Authored properties (stored under fd.properties):
 *   iconPath  – DAM path to the icon image (SVG / PNG)
 *   iconAlt   – Accessible alt text for the icon
 *
 * Standard AEM Forms fields used for card content:
 *   jcr:title   → heading
 *   description → body text (supports rich text)
 */

function getProp(fd, key) {
  return fd.properties?.[`properties.${key}`]
    ?? fd.properties?.[key]
    ?? fd[key]
    ?? '';
}

export default function decorate(fieldDiv, fd) {
  const iconPath = getProp(fd, 'iconPath');
  const iconAlt = getProp(fd, 'iconAlt');
  const heading = fd['jcr:title'] || fd.label?.value || '';
  const { description } = fd;

  // Clear everything form.js rendered (plain-text <p> and label)
  fieldDiv.innerHTML = '';

  const card = document.createElement('article');
  card.className = 'fmc-card';

  // Icon
  if (iconPath) {
    const iconWrapper = document.createElement('div');
    iconWrapper.className = 'fmc-icon';
    const img = document.createElement('img');
    img.src = iconPath;
    img.alt = iconAlt || '';
    img.width = 64;
    img.height = 64;
    img.loading = 'lazy';
    img.decoding = 'async';
    if (!iconAlt) img.setAttribute('aria-hidden', 'true');
    iconWrapper.appendChild(img);
    card.appendChild(iconWrapper);
  }

  // Heading
  if (heading) {
    const h = document.createElement('p');
    h.className = 'fmc-heading';
    h.textContent = heading;
    card.appendChild(h);
  }

  // Short decorative divider
  const hr = document.createElement('hr');
  hr.setAttribute('aria-hidden', 'true');
  card.appendChild(hr);

  // Description (rich text)
  if (description) {
    const desc = document.createElement('div');
    desc.className = 'fmc-description';
    desc.innerHTML = description;
    card.appendChild(desc);
  }

  fieldDiv.appendChild(card);
  return fieldDiv;
}
