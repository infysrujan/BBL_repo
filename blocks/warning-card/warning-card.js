/**
 * Converts a date to Bangkok timezone
 * @param {Date} date - The date to convert
 * @returns {Date} - Date in Bangkok timezone
 */
function toBangkokTime(date) {
  // Create a date string in Bangkok timezone
  const bangkokString = date.toLocaleString('en-US', {
    timeZone: 'Asia/Bangkok',
  });
  return new Date(bangkokString);
}

/**
 * Checks if current Bangkok time is within the date range
 * @param {string} startDate - ISO date string for start
 * @param {string} endDate - ISO date string for end
 * @returns {boolean} - True if current time is within range
 */
function isWithinDateRange(startDate, endDate) {
  if (!startDate || !endDate) {
    return false;
  }

  try {
    const now = new Date();
    const bangkokNow = toBangkokTime(now);

    const start = new Date(startDate);
    const end = new Date(endDate);

    const bangkokStart = toBangkokTime(start);
    const bangkokEnd = toBangkokTime(end);

    const isWithin = bangkokNow >= bangkokStart && bangkokNow <= bangkokEnd;

    return isWithin;
  } catch (error) {
    return false;
  }
}

/**
 * Decorates the warning-card block
 * @param {HTMLElement} block - The block element
 */
export default function decorate(block) {
  // Get all rows from the block
  const rows = [...block.children];

  // Parse each row to get the content
  // Row 0: Icon
  const iconRow = rows[0];
  const iconCell = iconRow?.querySelector('div');
  const iconImg = iconCell?.querySelector('img');
  const icon = iconImg?.src || '';
  const iconAlt = 'warning icon';

  const title = rows[1]?.textContent.trim() || '';
  const description = rows[2]?.innerHTML.trim() || '';
  const startDate = rows[3]?.textContent.trim() || '';
  const endDate = rows[4]?.textContent.trim() || '';

  // Check if current time is within the date range (Bangkok timezone)
  if (!isWithinDateRange(startDate, endDate)) {
    block.style.display = 'none';
    return;
  }

  // Clear the block
  block.innerHTML = '';

  // Create inner container wrapper for layout consistency
  const innerContainer = document.createElement('div');
  innerContainer.className = 'warning-card-inner-container';

  // Add icon if present
  if (icon) {
    const iconWrapper = document.createElement('div');
    iconWrapper.className = 'warning-card-icon';

    const iconElement = document.createElement('img');
    iconElement.src = icon;
    iconElement.alt = iconAlt;
    iconElement.loading = 'lazy';
    iconWrapper.appendChild(iconElement);

    innerContainer.appendChild(iconWrapper);
  }

  // Create content container
  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'warning-card-content';

  // Add title
  if (title) {
    const titleElement = document.createElement('h2');
    titleElement.className = 'warning-card-title';
    titleElement.textContent = title;
    contentWrapper.appendChild(titleElement);
  }

  // Add description
  if (description) {
    const descriptionElement = document.createElement('div');
    descriptionElement.className = 'warning-card-description';
    descriptionElement.innerHTML = description;
    contentWrapper.appendChild(descriptionElement);
  }

  innerContainer.appendChild(contentWrapper);
  block.appendChild(innerContainer);
}
