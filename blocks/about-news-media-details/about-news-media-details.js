import { getLang } from '../../scripts/scripts.js';
import { fetchConfigs } from '../../scripts/config.js';

const LOCALE_MAP = { th: 'th-TH', en: 'en-US' };

function formatDate(dateStr, locale = 'en-US') {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}

async function fetchNewsCard(url, newsId) {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const { cards } = await resp.json();
    return cards?.find((c) => c.aboutUsId === newsId) || null;
  } catch {
    return null;
  }
}

async function renderNewsDetail(block) {
  const lang = getLang();
  const locale = LOCALE_MAP[lang] || 'en-US';

  const params = new URLSearchParams(window.location.search);
  const newsId = params.get('ID') || '';

  const configs = await fetchConfigs();
  const configUrl = configs?.aboutNewsMediaDetails;
  const dataUrl = configUrl
    ? configUrl.replace(/\.json$/, lang !== 'en' ? `.${lang}.json` : '.json')
    : '/blocks/about-news-media-details/dummy-news-data.json';

  const card = await fetchNewsCard(dataUrl, newsId);

  if (!card) {
    block.innerHTML = '';
    return;
  }

  const title = card.Title
    ? `<div class="anm-detail-title pad-bot-30">${card.Title}</div>`
    : '';
  const date = card.publishDate
    ? `<p class="anm-detail-date pad-bot-30">${formatDate(card.publishDate, locale)}</p>`
    : '';
  const imageHtml = card.detailImageUrl
    ? `<div class="anm-detail-image"><img src="${card.detailImageUrl}" alt="${card.Title || ''}" loading="lazy"></div>`
    : '';
  const description = card.detailDescription
    ? `<div class="anm-detail-description">${card.detailDescription}</div>`
    : '';

  block.innerHTML = `
    <div class="anm-detail-inner">
      <div class="anm-detail-content">
        ${title}
        ${date}
        ${imageHtml}
        ${description}
      </div>
    </div>`;
}

export default function decorate(block) {
  renderNewsDetail(block);
}
