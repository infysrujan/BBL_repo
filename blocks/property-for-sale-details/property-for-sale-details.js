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
    return `<div class="pfs-slide${i === 0 ? ' is-active' : ''}">
      <img src="data:${mime};base64,${photo}" alt="" class="pfs-slide-img" loading="lazy">
    </div>`;
  }).join('');

  const dots = photos.length > 1
    ? photos.map((_, i) => `<button class="pfs-dot${i === 0 ? ' is-active' : ''}" data-index="${i}" aria-label="Slide ${i + 1}"></button>`).join('')
    : '';

  const nav = photos.length > 1 ? `
    <button class="pfs-nav pfs-nav-prev" aria-label="Previous"><i class="icon-arrow-left" aria-hidden="true"></i></button>
    <button class="pfs-nav pfs-nav-next" aria-label="Next"><i class="icon-arrow-left" aria-hidden="true"></i></button>` : '';

  return `<div class="pfs-carousel">
    <div class="pfs-slides">${slides}</div>
    ${nav}
    ${dots ? `<div class="pfs-dots">${dots}</div>` : ''}
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
  return `<a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" class="pfs-map-link">${label}</a>`;
}

function buildDetailHtml(data, placeholders) {
  const p = placeholders;
  const currency = p.pfsCurrency || 'บาท';
  const startingPrice = data.COST_PRICE
    ? `${formatPrice(data.COST_PRICE)} ${currency}` : '-';
  const specialPrice = data.SALE_PRICE
    ? `${formatPrice(data.SALE_PRICE)} ${currency}` : '-';

  const rows = [
    { label: p.pfsFileId || 'รหัสแฟ้ม', value: data.FILE_ID || '-' },
    { label: p.pfsPropertyType || 'ประเภททรัพย์', value: data.MAIN_ASSET || '-' },
    { label: p.pfsArea || 'ไร่-งาน-ตร.วา-ตร.ม.', value: formatArea(data) },
    { label: p.pfsTotalAssets || 'จำนวนแปลง', value: data.ASSET_COUNT || '-' },
    { label: p.pfsCertificate || 'เลขที่เอกสารสิทธิ์', value: data.CERTIFICATE_NO || '-' },
    { label: p.pfsLocation || 'ที่ตั้งทรัพย์', value: buildLocation(data) },
    { label: p.pfsStartingPrice || 'ราคาเริ่มต้น', value: startingPrice },
    { label: p.pfsSpecialPrice || 'ราคาพิเศษ', value: specialPrice, special: true },
    { label: p.pfsMapLocation || 'ตำแหน่งที่ตั้ง', value: buildMapLink(data, p.pfsOpenMap || 'เปิด google map') },
    { label: p.pfsSaleCondition || 'เงื่อนไข', value: data.SALE_CONDITION || '-' },
    { label: p.pfsRemark || 'หมายเหตุ', value: data.WEBSITE_REMARK || '-' },
  ];

  const rowsHtml = rows.map(({ label, value, special }) => `
    <div class="pfs-row">
      <div class="pfs-label">${label}</div>
      <div class="pfs-value${special ? ' pfs-special-price' : ''}">${value}</div>
    </div>`).join('');

  const phone = data.WEB_TELEPHONE
    ? `<p class="pfs-contact">${data.WEB_TELEPHONE}</p>` : '';

  return `<div class="pfs-grid">${rowsHtml}</div>${phone}`;
}

function initCarousel(block) {
  const slides = [...block.querySelectorAll('.pfs-slide')];
  const dots = [...block.querySelectorAll('.pfs-dot')];
  if (slides.length <= 1) return;

  let current = 0;

  function goTo(idx) {
    slides[current].classList.remove('is-active');
    dots[current]?.classList.remove('is-active');
    current = (idx + slides.length) % slides.length;
    slides[current].classList.add('is-active');
    dots[current]?.classList.add('is-active');
  }

  block.querySelector('.pfs-nav-prev')?.addEventListener('click', () => goTo(current - 1));
  block.querySelector('.pfs-nav-next')?.addEventListener('click', () => goTo(current + 1));
  dots.forEach((dot, i) => dot.addEventListener('click', () => goTo(i)));
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
    block.innerHTML = `<p class="pfs-error">${placeholders.pfsNotFound || 'ไม่พบข้อมูลทรัพย์สิน'}</p>`;
    return;
  }

  const photos = getPhotos(data);

  block.innerHTML = `
    ${buildCarousel(photos)}
    <div class="pfs-detail">${buildDetailHtml(data, placeholders)}</div>`;

  initCarousel(block);
}
