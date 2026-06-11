import { getLang } from '../../scripts/bbl-decorators.js';
import { fetchConfigs } from '../../scripts/config.js';
import { fetchGet } from '../../scripts/utils/fetchApi.js';

const LOCALE_MAP = { th: 'th-TH', en: 'en-US' };

function formatDate(dateStr, locale = 'en-US') {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}

async function fetchNewsCard(url, newsId) {
  try {
    const json = await fetchGet(url, { throwOnError: false });
    const { news } = json || {};
    return news?.find((c) => c.aboutUsId === newsId) || null;
  } catch {
    return null;
  }
}

// Fetch block data directly from AEM JCR API for authoring preview
async function fetchAuthoringData() {
  try {
    const pagePath = window.location.pathname.replace('.html', '');
    const resp = await fetch(`${pagePath}/_jcr_content.infinity.json`);
    if (!resp.ok) return null;
    const data = await resp.json();
    // Find the news-media-detail node under root.section
    const section = data?.root?.section || {};
    return Object.values(section).find((node) => node?.model === 'news-media-detail') || null;
  } catch (e) {
    return null;
  }
}

async function renderNewsDetail(block) {
  const isAuthoring = window.location.hostname.includes('adobeaemcloud.com');
  const lang = getLang();
  const locale = LOCALE_MAP[lang] || 'en-US';

  let card = null;

  if (isAuthoring) {
    card = await fetchAuthoringData();
  } else {
    const params = new URLSearchParams(window.location.search);
    const newsId = params.get('ID') || '';
    const configs = await fetchConfigs();
    const baseUrl = configs?.newsMediaBaseUrl || '';
    const dataUrl = baseUrl.replace(/\.json$/, lang !== 'en' ? `.${lang}.json` : '.json');
    card = await fetchNewsCard(dataUrl, newsId);
  }

  if (!card) {
    block.innerHTML = '';
    return;
  }

  const title = card.title
    ? `<div class="news-media-detail-title pad-bot-30">${card.title}</div>`
    : '';
  const date = card.publishDate
    ? `<p class="news-media-detail-date pad-bot-30">${formatDate(card.publishDate, locale)}</p>`
    : '';
  const imageHtml = card.detailImageUrl
    ? `<div class="news-media-detail-image"><img src="${card.detailImageUrl}" alt="${card.title || ''}" loading="lazy"></div>`
    : '';
  const description = card.detailDescription
    ? `<div class="news-media-detail-description">${card.detailDescription}</div>`
    : '';

  // Preserve original block children for Content Tree in authoring
  const originalChildren = isAuthoring ? [...block.children] : [];

  block.innerHTML = `
    <div class="news-media-detail-inner">
      <div class="news-media-detail-content">
        ${title}
        ${date}
        ${imageHtml}
        ${description}
      </div>
    </div>`;

  // Re-append original children hidden so Content Tree still works
  if (isAuthoring) {
    const hidden = document.createElement('div');
    hidden.style.display = 'none';
    originalChildren.forEach((child) => hidden.appendChild(child));
    block.appendChild(hidden);
  }
}

export default function decorate(block) {
  renderNewsDetail(block);
}
