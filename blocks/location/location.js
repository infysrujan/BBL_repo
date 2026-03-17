/**
 * Decorates the Location block.
 * Creates a location finder link with an icon for the header navigation.
 * @param {Element} block The location block element
 */
export default function decorate(block) {
  const rows = [...block.children];
  if (rows.length === 0) return;

  // Extract the location link from the first row
  const anchor = block.querySelector('a');
  const locationUrl = anchor?.href || '#';

  // Extract aria label from the second row or use default
  let ariaLabel = 'Find locations';
  if (rows.length > 1) {
    const ariaLabelCell = rows[1]?.querySelector('p');
    ariaLabel = ariaLabelCell?.textContent?.trim() || ariaLabel;
  }

  // Clear the block content
  block.textContent = '';

  // Create the location wrapper
  const locationWrapper = document.createElement('div');
  locationWrapper.className = 'location-wrapper';

  // Create the location link
  const locationLink = document.createElement('a');
  locationLink.href = locationUrl;
  locationLink.className = 'location-link';
  locationLink.setAttribute('aria-label', ariaLabel);
  locationLink.setAttribute('title', ariaLabel);

  // Create the location icon (map pin)
  const locationIcon = document.createElement('span');
  locationIcon.className = 'location-icon';
  locationIcon.setAttribute('aria-hidden', 'true');

  locationLink.appendChild(locationIcon);
  locationWrapper.appendChild(locationLink);
  block.appendChild(locationWrapper);
}
