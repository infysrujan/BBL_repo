/**
 * Decorates the Brand Logo block.
 * Creates a clickable logo that links to the homepage.
 * @param {Element} block The brand-logo block element
 */
export default function decorate(block) {
  const rows = [...block.children];

  // Extract the picture element (logo image) from first row
  const picture = rows[0]?.querySelector('picture');

  // Extract the link (typically the home page URL)
  const anchor = block.querySelector('a');

  // Extract alt text from the block data or image
  const img = block.querySelector('img');
  const altText = img?.alt || 'Brand Logo';

  // Extract print logo picture from row 3 (optional field)
  const printLogoPicture = rows[3]?.querySelector('picture');

  // Clear the block content
  block.textContent = '';

  // Create the logo container
  const logoContainer = document.createElement('div');
  logoContainer.className = 'brand-logo-container';

  if (anchor && picture) {
    // Create a link wrapper for the logo
    const link = document.createElement('a');
    link.href = anchor.href;
    link.className = 'brand-logo-link';
    link.setAttribute('aria-label', altText);

    // Ensure the image has proper alt text
    const clonedPicture = picture.cloneNode(true);
    const clonedImg = clonedPicture.querySelector('img');
    if (clonedImg) {
      clonedImg.alt = altText;
      clonedImg.className = 'brand-logo-image';
    }

    link.appendChild(clonedPicture);
    logoContainer.appendChild(link);
  } else if (picture) {
    // No link provided, just display the logo
    const clonedPicture = picture.cloneNode(true);
    const clonedImg = clonedPicture.querySelector('img');
    if (clonedImg) {
      clonedImg.alt = altText;
      clonedImg.className = 'brand-logo-image';
    }
    logoContainer.appendChild(clonedPicture);
  }

  block.appendChild(logoContainer);

  // Render print logo in a hidden container (visible only during print)
  if (printLogoPicture) {
    const printContainer = document.createElement('div');
    printContainer.className = 'brand-logo-print-logo';
    printContainer.appendChild(printLogoPicture.cloneNode(true));
    block.appendChild(printContainer);
  }
}
