/**
 * Reads a cookie value by name from `document.cookie`.
 * @param {string} name - Cookie name (exact match).
 * @returns {string} Decoded value, or `''` if missing or `name` is empty.
 */
export function getCookie(name) {
  if (!name) return '';
  const parts = document.cookie.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key !== name) continue;
    const raw = part.slice(idx + 1).trim();
    try {
      return decodeURIComponent(raw.replace(/\+/g, ' '));
    } catch {
      return raw;
    }
  }
  return '';
}
