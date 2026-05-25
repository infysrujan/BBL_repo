const STYLE_TAG_REGEX = /<style[^>]*>[\s\S]*?<\/style>/gi;
const STYLE_CONTENT_REGEX = /<style[^>]*>([\s\S]*?)<\/style>/gi;
const STYLES_ID = 'bbm-glow-card-styles';

/**
 * Joins paragraph text from the block (encoded HTML from authoring).
 * @param {Element} block
 * @returns {string}
 */
function collectParagraphText(block) {
  return [...block.querySelectorAll('p')]
    .map((p) => p.textContent)
    .join('\n');
}

/**
 * Decodes HTML entities in a string (e.g. &lt; → <).
 * @param {string} encoded
 * @returns {string}
 */
function decodeHtmlEntities(encoded) {
  const decoder = document.createElement('textarea');
  decoder.innerHTML = encoded;
  return decoder.value;
}

/**
 * Pulls inline styles out of HTML and returns stitched CSS plus body markup.
 * @param {string} html
 * @returns {{ css: string, bodyHtml: string }}
 */
function extractStyles(html) {
  const css = [...html.matchAll(STYLE_CONTENT_REGEX)]
    .map((match) => match[1])
    .join('\n');

  const bodyHtml = html.replace(STYLE_TAG_REGEX, '');

  return { css, bodyHtml };
}

/**
 * Renders decoded markup inside the block element.
 * @param {Element} block
 * @param {string} bodyHtml
 */
function renderBlockContent(block, bodyHtml) {
  block.innerHTML = bodyHtml;
}

/**
 * Inserts or updates a single style element immediately after the page footer.
 * @param {string} css
 */
function injectStylesAfterFooter(css) {
  if (!css.trim()) return;

  const footer = document.querySelector('footer');
  if (!footer) return;

  let styleEl = document.getElementById(STYLES_ID);
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = STYLES_ID;
    footer.insertAdjacentElement('afterend', styleEl);
  }

  styleEl.textContent = styleEl.textContent
    ? `${styleEl.textContent}\n${css}`
    : css;
}

/**
 * Decorates the Bbm Glow Card block.
 * Collects encoded HTML from block paragraphs, stitches embedded styles into
 * a document-level style tag after the footer, and renders body markup in the block.
 * @param {Element} block - The bbm-glow-card block element
 */
export default function decorate(block) {
  const rawContent = collectParagraphText(block);
  const decodedHtml = decodeHtmlEntities(rawContent);
  const { css, bodyHtml } = extractStyles(decodedHtml);

  renderBlockContent(block, bodyHtml);
  injectStylesAfterFooter(css);
}
