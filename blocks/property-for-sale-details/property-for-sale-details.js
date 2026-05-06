import { fetchPlaceholders } from '../../scripts/placeholder.js';

const API_BASE = 'https://publish-p185039-e1938068.adobeaemcloud.com/api/PropertyForSaleService/GetPropertyDetail';

function getFileId() {
  return new URLSearchParams(window.location.search).get('FILE_ID') || '';
}

function getImageMimeType(base64) {
  if (base64.startsWith('R0lGOD')) return 'image/gif';
  if (base64.startsWith('/9j/')) return 'image/jpeg';
  if (base64.startsWith('iVBORw0K')) return 'image/png';
  return 'image/jpeg';
}

function getPhotos(data) {
  const photos = [];
  for (let i = 1; i <= 20; i += 1) {
    const photo = data[`PHOTO_FILE_${i}`];
    if (!photo) break;
    photos.push(photo);
  }
  return photos;
}

function buildCarousel(photos) {
  if (!photos.length) return '';
  const slides = photos.map((photo, i) => {
    const mime = getImageMimeType(photo);
    return `<div class="prop-for-sale-slide${i === 0 ? ' is-active' : ''}">
      <img src="data:${mime};base64,${photo}" alt="" class="prop-for-sale-slide-img" loading="lazy">
    </div>`;
  }).join('');

  const dots = photos.length > 1
    ? photos.map((_, i) => `<li class="prop-for-sale-dot${i === 0 ? ' is-active' : ''}"><button data-index="${i}" aria-label="Slide ${i + 1}"></button></li>`).join('')
    : '';

  const nav = photos.length > 1 ? `
    <button class="prop-for-sale-nav prop-for-sale-nav-prev" aria-label="Previous"><i class="icon-arrow-left" aria-hidden="true"></i></button>
    <button class="prop-for-sale-nav prop-for-sale-nav-next" aria-label="Next"><i class="icon-arrow-left" aria-hidden="true"></i></button>` : '';

  return `<div class="prop-for-sale-carousel">
    <div class="prop-for-sale-slides">${slides}</div>
    ${nav}
    ${dots ? `<ul class="prop-for-sale-dots">${dots}</ul>` : ''}
  </div>`;
}

function formatPrice(price) {
  if (!price) return '';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

function formatArea(data) {
  return `${data.AREA_RAI ?? 0}-${data.AREA_QUARTER ?? 0}-${data.AREA_SQUARE_WAH ?? 0}-${data.AREA_SQUARE_METER ?? 0}`;
}

function buildLocation(data) {
  const parts = [
    data.HOUSE_NO ? `บ้านเลขที่ ${data.HOUSE_NO}` : '',
    data.VILLAGE_NO ? `หมู่ที่ ${data.VILLAGE_NO}` : '',
    data.LOCATION_ROAD && data.LOCATION_ROAD !== '-' ? `ถนน ${data.LOCATION_ROAD}` : '',
    data.LOCATION_TAMBON ? `ตำบล ${data.LOCATION_TAMBON}` : '',
    data.LOCATION_AMPHUR ? `อำเภอ ${data.LOCATION_AMPHUR}` : '',
    data.LOCATION_PROVINCE ? `จังหวัด ${data.LOCATION_PROVINCE}` : '',
  ].filter(Boolean);
  return parts.join(' ') || '-';
}

function buildMapLink(data, label) {
  const lat = data.GPS_LATITUDE;
  const lng = data.GPS_LONGTITUDE;
  if (!lat || !lng) return '-';
  return `<a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" class="prop-for-sale-map-link">${label}<img src="/icons/google-map-open.ico" alt="" class="prop-for-sale-map-icon"></a>`;
}

function buildDetailHtml(data, placeholders) {
  const p = placeholders;
  const currency = p.pfsCurrency || 'บาท';
  const startingPrice = data.PR_PRICE
    ? `${formatPrice(data.PR_PRICE)} ${currency}` : '-';
  const specialPrice = data.SPECIAL_PRICE
    ? `${formatPrice(data.SPECIAL_PRICE)} ${currency}` : '-';

  const rows = [
    { label: p.pfsFileId || 'รหัสแฟ้ม', value: data.FILE_ID ? `${data.FILE_ID}${data.OLD_FILE_ID ? ` หรือ ${data.OLD_FILE_ID}` : ''}` : '-' },
    { label: p.pfsPropertyType || 'ประเภททรัพย์', value: data.MAIN_ASSET || '-' },
    { label: p.pfsArea || 'ไร่-งาน-ตร.วา-ตร.ม.', value: formatArea(data) },
    { label: p.pfsTotalAssets || 'จำนวนแปลง', value: data.ASSET_COUNT || '-' },
    { label: p.pfsCertificate || 'เลขที่เอกสารสิทธิ์', value: data.CERTIFICATE_NO || '-' },
    { label: p.pfsLocation || 'ที่ตั้งทรัพย์', value: buildLocation(data) },
    { label: p.pfsStartingPrice || 'ราคาเริ่มต้น', value: startingPrice, starting: true },
    { label: p.pfsSpecialPrice || 'ราคาพิเศษ', value: specialPrice, special: true },
    { label: p.pfsMapLocation || 'ตำแหน่งที่ตั้ง', value: buildMapLink(data, p.pfsOpenMap || 'เปิด google map') },
    { label: p.pfsSaleCondition || 'เงื่อนไข', value: data.SALE_CONDITION_DESC || '-' },
    { label: p.pfsRemark || 'หมายเหตุ', value: data.WEBSITE_REMARK || '-' },
  ];

  const rowsHtml = rows.map(({
    label, value, special, starting,
  }) => {
    const cls = `prop-for-sale-value${special ? ' prop-for-sale-special-price' : ''}${starting ? ' prop-for-sale-starting-price' : ''}`;
    return `
    <div class="prop-for-sale-row">
      <div class="prop-for-sale-label">${label}</div>
      <div class="${cls}">${value}</div>
    </div>`;
  }).join('');

  const contactParts = [
    data.PORT_TEAM_NAME,
    data.SAM_TEAM_NAME,
  ].filter(Boolean).join(' , ');

  const contactBody = [
    contactParts ? `<p class="prop-for-sale-contact-name">${contactParts}</p>` : '',
    data.WEB_TELEPHONE ? `<p class="prop-for-sale-contact-tel">${p.pfsPhone || 'โทรศัพท์'}: ${data.WEB_TELEPHONE.trim()}</p>` : '',
    data.WEB_EMAIL ? `<p class="prop-for-sale-contact-email">${p.pfsEmail || 'อีเมล'}: ${data.WEB_EMAIL.trim()}</p>` : '',
  ].filter(Boolean).join('');

  const contactHtml = contactBody ? `
    <div class="prop-for-sale-contact-title-wrapper">
      <h3 class="prop-for-sale-contact-title">${p.pfsContactTitle || 'การติดต่อ'}</h3>
    </div>
    <div class="prop-for-sale-contact-body">${contactBody}</div>` : '';

  return `<div class="prop-for-sale-grid">${rowsHtml}</div>${contactHtml}`;
}

function initCarousel(block) {
  const slides = [...block.querySelectorAll('.prop-for-sale-slide')];
  const dots = [...block.querySelectorAll('.prop-for-sale-dot')];
  if (slides.length <= 1) return;

  let current = 0;
  let autoTimer;

  function goTo(idx, direction = 1) {
    slides[current].classList.remove('is-active', 'from-left');
    dots[current]?.classList.remove('is-active');
    current = (idx + slides.length) % slides.length;
    slides[current].classList.toggle('from-left', direction < 0);
    slides[current].classList.add('is-active');
    dots[current]?.classList.add('is-active');
  }

  function startAuto() {
    clearInterval(autoTimer);
    autoTimer = setInterval(() => goTo(current + 1, 1), 10000);
  }

  block.querySelector('.prop-for-sale-nav-prev')?.addEventListener('click', () => { goTo(current - 1, -1); startAuto(); });
  block.querySelector('.prop-for-sale-nav-next')?.addEventListener('click', () => { goTo(current + 1, 1); startAuto(); });
  dots.forEach((dot, i) => dot.querySelector('button')?.addEventListener('click', () => { goTo(i, 1); startAuto(); }));

  const slidesEl = block.querySelector('.prop-for-sale-slides');
  let dragStartX = 0;
  let isDragging = false;

  function onDragStart(x) { dragStartX = x; isDragging = true; }
  function onDragEnd(x) {
    if (!isDragging) return;
    isDragging = false;
    const diff = dragStartX - x;
    if (Math.abs(diff) > 50) {
      const dir = diff > 0 ? 1 : -1;
      goTo(current + dir, dir);
      startAuto();
    }
  }

  slidesEl.addEventListener('touchstart', (e) => onDragStart(e.touches[0].clientX), { passive: true });
  slidesEl.addEventListener('touchend', (e) => onDragEnd(e.changedTouches[0].clientX));
  slidesEl.addEventListener('mousedown', (e) => onDragStart(e.clientX));
  slidesEl.addEventListener('mouseup', (e) => onDragEnd(e.clientX));

  startAuto();
}

export default async function decorate(block) {
  const fileId = getFileId();
  if (!fileId) {
    block.innerHTML = '';
    return;
  }

  const [resp, placeholders] = await Promise.all([
    fetch(`${API_BASE}/${fileId}`, { headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
    fetchPlaceholders(),
  ]);

  const data = Array.isArray(resp) ? resp[0] : resp;

  if (!data) {
    block.innerHTML = `<p class="prop-for-sale-error">${placeholders.pfsNotFound || 'ไม่พบข้อมูลทรัพย์สิน'}</p>`;
    return;
  }

  const photos = getPhotos(data);

  block.innerHTML = `
    ${buildCarousel(photos)}
    <div class="prop-for-sale-detail">${buildDetailHtml(data, placeholders)}</div>`;

  initCarousel(block);
}
