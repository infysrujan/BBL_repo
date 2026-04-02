import { readBlockConfig } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

/**
 * @param {string|string[]|undefined} raw
 * @returns {string}
 */
function firstHref(raw) {
  if (Array.isArray(raw)) return raw[0] || '';
  return typeof raw === 'string' ? raw : '';
}

/**
 * Path suitable for loadFragment (.plain.html fetch).
 * @param {string} path
 * @returns {string}
 */
function normalizeFragmentPath(path) {
  const t = path.trim();
  if (!t) return '';
  if (t.startsWith('http')) {
    try {
      return new URL(t).pathname;
    } catch {
      return '';
    }
  }
  return t.startsWith('/') ? t : `/${t}`;
}

/**
 * Reads accordion-block model fields: title, fragmentPath (see _accordion-block.json).
 * @param {Element} block
 */
function getAccordionBlockConfig(block) {
  const c = readBlockConfig(block);
  const title = (c.title || '').trim();
  const rawPath = firstHref(c['fragment-path'] || c.fragmentpath);
  return {
    title,
    fragmentPath: normalizeFragmentPath(rawPath),
  };
}

function wireAccordionHeader(header, panel) {
  header.addEventListener('click', () => {
    const expanded = header.getAttribute('aria-expanded') === 'true';
    header.setAttribute('aria-expanded', expanded ? 'false' : 'true');
    panel.hidden = expanded;
  });
}

/**
 * Accordion block: required title, optional fragment path (Content Fragment / plain HTML).
 * @param {Element} block
 */
export default async function decorate(block) {
  const { title, fragmentPath } = getAccordionBlockConfig(block);

  block.textContent = '';
  block.classList.add('accordion');

  const panelId = block.id
    ? `${block.id}-panel`
    : `accordion-panel-${crypto.randomUUID().slice(0, 8)}`;

  const item = document.createElement('div');
  item.classList.add('accordion-item');

  const header = document.createElement('button');
  header.type = 'button';
  header.classList.add('accordion-header');
  header.id = `${panelId}-toggle`;
  header.setAttribute('aria-expanded', 'false');
  header.setAttribute('aria-controls', panelId);
  const label = document.createElement('span');
  label.textContent = title || 'Accordion';
  header.appendChild(label);

  const panel = document.createElement('div');
  panel.id = panelId;
  panel.classList.add('accordion-panel');
  panel.hidden = true;
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-labelledby', header.id);

  item.appendChild(header);
  item.appendChild(panel);
  block.appendChild(item);

  wireAccordionHeader(header, panel);

  if (!fragmentPath) {
    return;
  }

  panel.classList.add('accordion-panel-loading');
  const fragment = await loadFragment(fragmentPath);
  panel.classList.remove('accordion-panel-loading');

  if (!fragment) {
    return;
  }

  const fragmentSection = fragment.querySelector(':scope .section');
  if (fragmentSection) {
    panel.append(...fragmentSection.childNodes);
  } else {
    panel.append(...fragment.childNodes);
  }
  panel.classList.add('accordion-panel-loaded');
}
