export function plaintext(field) {
  if (!field) return '';
  if (typeof field === 'string') return field;
  return field.plaintext || field.html || '';
}

// A URL field may come back as a plain string or a publish/author/path URL object.
export function resolveApplyUrl(urlField) {
  if (!urlField) return '';
  if (typeof urlField === 'string') return urlField;
  // eslint-disable-next-line no-underscore-dangle
  return urlField._publishUrl || urlField._authorUrl || urlField._path || '';
}

// Resolve the learn-more URL from cardPageUrl (object with _publishUrl/_authorUrl)
export function resolveCardPageUrl(card) {
  const raw = card.cardPageUrl;
  if (raw && typeof raw === 'object') {
    // eslint-disable-next-line no-underscore-dangle
    return raw._publishUrl || raw._authorUrl || raw._path || '';
  }
  return '';
}

export function resolveImageUrl(card, ...keys) {
  const raw = keys.map((key) => card[key]).find(Boolean) || '';
  if (!raw) return '';
  if (typeof raw === 'string') return raw;
  // eslint-disable-next-line no-underscore-dangle
  return raw._publishUrl || raw._authorUrl || '';
}
