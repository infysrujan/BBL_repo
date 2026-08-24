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

/**
 * Deletes a cookie by name, retrying across the domain variants third-party scripts
 * (GA/GTM/Adobe) commonly use, since a delete only succeeds if `Domain` matches
 * how the cookie was originally set.
 * @param {string} name
 */
export function deleteCookie(name) {
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
 * Deletes all browser cookies whose name matches any of the given patterns.
 * @param {RegExp[]} patterns
 */
export function deleteCookiesMatching(patterns) {
  document.cookie.split('; ').forEach((entry) => {
    const separatorIndex = entry.indexOf('=');
    if (separatorIndex === -1) return;
    const name = decodeURIComponent(entry.slice(0, separatorIndex));
    if (patterns.some((pattern) => pattern.test(name))) {
      deleteCookie(name);
    }
  });
}
