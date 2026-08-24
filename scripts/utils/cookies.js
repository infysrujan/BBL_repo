/**
 * Reads a cookie value by name from `document.cookie`.
 * @param {string} name - Cookie name (exact match).
 * @returns {string} Decoded value, or `''` if missing or `name` is empty.
 */
export function getCookie(name) {
  if (!name) return '';
  const encoded = encodeURIComponent(name);
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${encoded}=`));
  return match ? decodeURIComponent(match.split('=')[1]) : '';
}

/**
 * Sets a cookie with a given name, value, and expiry (in days).
 * @param {string} name
 * @param {string} value
 * @param {number} days
 */
export function setCookie(name, value, days) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; `
    + `expires=${expires}; path=/; SameSite=Lax`;
}

export function deleteCookie(name) {
  document.cookie = `${name}=; Max-Age=0; path=/`;
}

/**
 * Deletes a cookie by name across the domain variants third-party scripts (GA/GTM/Adobe)
 * commonly use, since a delete only succeeds if `Domain` matches how the cookie was
 * originally set. Unlike `deleteCookie`, this also clears cookies scoped to a parent
 * domain (e.g. set with `Domain=.example.com`).
 * @param {string} name
 */
export function deleteCookieAllDomains(name) {
  const encoded = encodeURIComponent(name);
  const { hostname } = window.location;
  const domains = [null, hostname, `.${hostname}`];
  const labels = hostname.split('.');
  if (labels.length > 2) {
    domains.push(`.${labels.slice(-2).join('.')}`);
  }
  domains.forEach((domain) => {
    document.cookie = `${encoded}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ''}`;
  });
}

/**
 * Deletes every browser cookie whose current value exactly matches `value`.
 * @param {string} value
 */
export function deleteCookiesByValue(value) {
  document.cookie.split('; ').forEach((entry) => {
    const separatorIndex = entry.indexOf('=');
    if (separatorIndex === -1) return;
    const name = decodeURIComponent(entry.slice(0, separatorIndex));
    const cookieValue = decodeURIComponent(entry.slice(separatorIndex + 1));
    if (cookieValue === value) {
      deleteCookieAllDomains(name);
    }
  });
}
