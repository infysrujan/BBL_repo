import { getMetadata } from '../../scripts/aem.js';

/**
 * Fetches breadcrumb (parent page) data from the AEM pageinfo endpoint.
 * Returns a map of { [pagePath]: pageTitle } for all ancestor pages.
 * @returns {Promise<Object>} Map of path to page title
 */
async function fetchBreadcrumbData() {
  const AEM_BASE_URL = 'https://publish-p185039-e1939903.adobeaemcloud.com';

  try {
    const { pathname } = window.location;
    const apiUrl = `${AEM_BASE_URL}/content/bangkokbank${pathname}.pageinfo.json`;
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`);
    }
    const data = await response.json();

    // Build a path-to-title map from the returned parent pages
    const titleMap = {};

    // Add current page to titleMap first
    if (data.currentPage) {
      const { pagePath, pageTitle, jcrTitle } = data.currentPage;
      if (pagePath && (pageTitle || jcrTitle)) {
        titleMap[pagePath] = pageTitle || jcrTitle;
      }
    }

    // Helper function to traverse nested parent structure and collect pages
    const collectPages = (page, pages = []) => {
      if (page) {
        pages.push(page);
        if (page.parent) {
          collectPages(page.parent, pages);
        }
      }
      return pages;
    };

    // Collect all pages from nested structure
    let allPages = [];
    if (data.currentPage) {
      // Handle nested structure with currentPage and parent
      allPages = collectPages(data.currentPage);
      if (data.parent) {
        allPages = allPages.concat(collectPages(data.parent));
      }
    } else if (Array.isArray(data)) {
      // Handle array response
      allPages = data;
    } else if (data && typeof data === 'object') {
      // Handle other object shapes
      const pages = data.pages || data.items || data.children || [];
      allPages = pages;
    }

    // Filter pages: only include pages with pageDepth > 3 (after "en" level)
    // and build the titleMap
    allPages.forEach((page) => {
      const pagePath = page.pagePath || page.path;
      const pageTitle = page.pageTitle || page.jcrTitle || page.title;
      const { pageDepth } = page;

      // Only include pages after the "en" level (pageDepth > 3)
      if (pagePath && pageTitle && pageDepth && pageDepth > 3) {
        titleMap[pagePath] = pageTitle;
      }
    });
    // console.warn('value of titleMap is : ', titleMap);
    return titleMap;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Breadcrumb data fetch error:', error);
    return {};
  }
}

/**
 * Builds breadcrumb navigation from the current URL path
 * @param {Element} block The breadcrumb block element
 */
export default async function decorate(block) {
  const shortTitle = getMetadata('short-title');
  const { title: pageTitle } = document;

  // Fetch parent page titles from AEM to use as breadcrumb labels
  const breadcrumbTitleMap = await fetchBreadcrumbData();

  const ol = document.createElement('ol');
  block.appendChild(ol);

  const pathSegments = window.location.pathname
    .split('/')
    .filter(Boolean);

  const langPattern = /^([a-z]{2}(-[A-Z]{2})?)$/;
  const startIndex = pathSegments.length && langPattern.test(pathSegments[0]) ? 1 : 0;

  // Homepage only
  if (pathSegments.length === startIndex) {
    block.classList.add('is-homepage');

    const li = document.createElement('li');
    li.textContent = 'Homepage - Bangkok Bank';
    li.setAttribute('aria-current', 'page');
    ol.appendChild(li);

    return;
  }

  let currentPath = '';

  for (let i = startIndex; i < pathSegments.length; i += 1) {
    const segment = pathSegments[i];
    currentPath += `/${segment}`;

    const li = document.createElement('li');

    const isLast = i === pathSegments.length - 1;

    if (isLast) {
      // Use shortTitle if available, then document.title, otherwise use pageTitle
      li.textContent = (shortTitle || pageTitle)
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase());
      li.setAttribute('aria-current', 'page');
    } else {
      // Prefer the title fetched from AEM; fall back to humanising the URL segment
      const fetchedTitle = breadcrumbTitleMap[currentPath];
      const label = fetchedTitle
        || segment
          .replace(/-/g, ' ')
          .replace(/\b\w/g, (char) => char.toUpperCase());
      const link = document.createElement('a');
      link.href = currentPath;
      link.textContent = label;
      li.appendChild(link);
    }

    ol.appendChild(li);
  }

  // Find and move existing social-icons block inside breadcrumb
  const socialIconsBlock = document.querySelector('.social-icons.block');
  if (socialIconsBlock) {
    // Get the wrapper and section of the social-icons block
    const socialWrapper = socialIconsBlock.parentElement;
    const socialSection = socialWrapper?.parentElement;

    // Move social-icons wrapper inside breadcrumb block
    if (socialWrapper) {
      block.appendChild(socialWrapper);

      // Clean up empty section if it exists
      if (socialSection && socialSection.children.length === 0) {
        socialSection.remove();
      }
    }
  }
}
