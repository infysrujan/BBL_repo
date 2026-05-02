/* eslint-env browser */

/**
 * Calendar popover for any page: attach to a text-like input, localize via `<html lang>`.
 *
 * Usage:
 *   import { attachCalendarPicker } from './utils/calendar-picker.js';
 *   attachCalendarPicker({
 *     input: document.querySelector('#as-of-date'),
 *     value: new Date(),
 *     isDateDisabled: (d) => d.getDay() === 0 || d.getDay() === 6,
 *     onChange: (d) => console.log(d),
 *   });
 *
 * The field is set to `readOnly` so values come from the calendar only (override with
 * `{ readOnly: false }`). Use `type="text"`. For a separate visible label, pass `labelElement`.
 */

const STYLE_ID = 'bbl-calendar-picker-styles';

const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTHS_SHORT_EN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const MONTHS_TH = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

const MONTHS_SHORT_TH = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_TH = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

const BE_OFFSET = 543;

/**
 * @param {Document} doc
 * @returns {'en' | 'th'}
 */
export function getCalendarLang(doc = document) {
  const raw = (doc.documentElement.lang || 'en').toLowerCase().trim();
  if (raw === 'th' || raw.startsWith('th-')) return 'th';
  return 'en';
}

/**
 * @param {Date} date - local date (time ignored)
 * @param {'en' | 'th'} lang
 * @returns {string} e.g. `24 Apr 2026` or `30 เม.ย. 2569`
 */
export function formatCalendarDate(date, lang) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const d = date.getDate();
  if (lang === 'th') {
    const m = MONTHS_SHORT_TH[date.getMonth()];
    const y = date.getFullYear() + BE_OFFSET;
    return `${d} ${m} ${y}`;
  }
  const m = MONTHS_SHORT_EN[date.getMonth()];
  const y = date.getFullYear();
  return `${d} ${m} ${y}`;
}

function padMonthHeader(year, monthIndex, lang) {
  if (lang === 'th') {
    return `${MONTHS_TH[monthIndex]} ${year + BE_OFFSET}`;
  }
  return `${MONTHS_EN[monthIndex]} ${year}`;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function injectStyles(doc) {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.bbl-calendar-picker-popover {
  position: fixed;
  z-index: 10050;
  min-width: 280px;
  padding: 16px;
  background: var(--bbl-color-white, #fff);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06);
  font-family: inherit;
  box-sizing: border-box;
}
.bbl-calendar-picker-popover *,
.bbl-calendar-picker-popover *::before,
.bbl-calendar-picker-popover *::after { box-sizing: border-box; }

.bbl-calendar-picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}

.bbl-calendar-picker-nav {
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
  border: 1px solid var(--bbl-color-grey-30, #DBDBDB);
  border-radius: 50%;
  background: var(--bbl-color-white, #fff);
  color: var(--bbl-color-grey-100, #323238);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  line-height: 1;
}
.bbl-calendar-picker-nav:hover {
  border-color: var(--bbl-color-grey-50, #A9A9AA);
}
.bbl-calendar-picker-nav:focus-visible {
  outline: 2px solid var(--bbl-color-active-blue, #0064FF);
  outline-offset: 2px;
}

.bbl-calendar-picker-title {
  flex: 1 1 auto;
  margin: 0;
  text-align: center;
  font-size: 1rem;
  font-weight: 700;
  color: var(--bbl-color-blue-105, #003399);
}

.bbl-calendar-picker-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  margin-bottom: 8px;
}

.bbl-calendar-picker-weekdays span {
  text-align: center;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--bbl-color-black, #000);
}

.bbl-calendar-picker-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.bbl-calendar-picker-day {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  max-height: 40px;
  border: none;
  background: transparent;
  border-radius: 50%;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--bbl-color-grey-100, #323238);
  cursor: pointer;
  padding: 0;
  margin: 0;
}
.bbl-calendar-picker-day--muted {
  visibility: hidden;
  pointer-events: none;
}
.bbl-calendar-picker-day:disabled {
  color: var(--bbl-color-grey-45, #BBBBBB);
  cursor: not-allowed;
}
.bbl-calendar-picker-day:not(:disabled):hover {
  background: var(--bbl-color-grey-10, #F5F5F5);
}
.bbl-calendar-picker-day--selected {
  background: var(--bbl-color-active-blue, #0064FF) !important;
  color: var(--bbl-color-white, #fff) !important;
}
.bbl-calendar-picker-day--selected:hover {
  background: var(--bbl-color-blue-70, #357EF8) !important;
}
`;
  doc.head.append(style);
}

function positionPopover(trigger, popover, doc) {
  const rect = trigger.getBoundingClientRect();
  const { bottom, left: rectLeft, top } = rect;
  const margin = 8;
  popover.style.top = `${bottom + margin}px`;
  let left = rectLeft;
  const vw = doc.defaultView.innerWidth;
  popover.style.visibility = 'hidden';
  popover.style.left = `${left}px`;
  // measure after in DOM
  requestAnimationFrame(() => {
    const pw = popover.offsetWidth;
    if (left + pw > vw - margin) {
      left = Math.max(margin, vw - margin - pw);
      popover.style.left = `${left}px`;
    }
    const vh = doc.defaultView.innerHeight;
    const ph = popover.offsetHeight;
    let popTop = bottom + margin;
    if (popTop + ph > vh - margin && top - margin - ph > margin) {
      popTop = top - margin - ph;
      popover.style.top = `${popTop}px`;
    }
    popover.style.visibility = '';
  });
}

/**
 * @typedef {Object} CalendarPickerOptions
 * @property {HTMLInputElement} [input] - Field that opens the calendar (preferred)
 * @property {HTMLInputElement} [trigger] - Alias for `input` (deprecated name)
 * @property {Document} [doc]
 * @property {Date} [value] - Initially selected date (local calendar day)
 * @property {(date: Date) => boolean} [isDateDisabled] - Return true to grey out / block selection
 * @property {(date: Date) => void} [onChange] - Fires when a date is chosen
 * @property {HTMLElement} [labelElement] - If set, formatted date is written here instead of
 *   `input.value`
 * @property {boolean} [readOnly=true] - When true, sets `input.readOnly` so typing is disabled
 */

/**
 * @param {CalendarPickerOptions} options
 * @returns {{ open: () => void, close: () => void, destroy: () => void,
 *   getValue: () => Date | null, setValue: (d: Date | null) => void }}
 */
export function attachCalendarPicker(options) {
  const {
    input: inputOption,
    trigger: triggerAlias,
    doc = document,
    value: initialValue,
    isDateDisabled = () => false,
    onChange,
    labelElement: labelElementOpt,
    readOnly: readOnlyOption = true,
  } = options;

  const input = inputOption ?? triggerAlias;
  if (!input || !(input instanceof HTMLInputElement)) {
    throw new Error('attachCalendarPicker: `input` must be an HTMLInputElement');
  }

  if (readOnlyOption) {
    input.readOnly = true;
  }

  injectStyles(doc);

  let selected = initialValue ? startOfDay(initialValue) : null;
  let viewYear = (selected || new Date()).getFullYear();
  let viewMonth = (selected || new Date()).getMonth();
  let isOpen = false;

  const getLang = () => getCalendarLang(doc);

  const popover = doc.createElement('div');
  popover.className = 'bbl-calendar-picker-popover';
  popover.setAttribute('role', 'dialog');
  popover.setAttribute('aria-label', 'Calendar');
  popover.hidden = true;

  const header = doc.createElement('div');
  header.className = 'bbl-calendar-picker-header';

  const btnPrev = doc.createElement('button');
  btnPrev.type = 'button';
  btnPrev.className = 'bbl-calendar-picker-nav';
  btnPrev.setAttribute('aria-label', 'Previous month');
  btnPrev.innerHTML = '<span aria-hidden="true">‹</span>';

  const title = doc.createElement('h2');
  title.className = 'bbl-calendar-picker-title';

  const btnNext = doc.createElement('button');
  btnNext.type = 'button';
  btnNext.className = 'bbl-calendar-picker-nav';
  btnNext.setAttribute('aria-label', 'Next month');
  btnNext.innerHTML = '<span aria-hidden="true">›</span>';

  header.append(btnPrev, title, btnNext);

  const weekdaysRow = doc.createElement('div');
  weekdaysRow.className = 'bbl-calendar-picker-weekdays';

  const grid = doc.createElement('div');
  grid.className = 'bbl-calendar-picker-grid';
  grid.setAttribute('role', 'grid');

  popover.append(header, weekdaysRow, grid);
  doc.body.append(popover);

  function syncLabel() {
    const lang = getLang();
    const text = selected ? formatCalendarDate(selected, lang) : '';
    if (labelElementOpt) {
      labelElementOpt.textContent = text;
    } else {
      input.value = text;
    }
  }

  function notifyInputCommitted() {
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function renderWeekdayLabels() {
    weekdaysRow.replaceChildren();
    const lang = getLang();
    const labels = lang === 'th' ? WEEKDAYS_TH : WEEKDAYS_EN;
    labels.forEach((text) => {
      const span = doc.createElement('span');
      span.textContent = text;
      weekdaysRow.append(span);
    });
  }

  function closePopover() {
    isOpen = false;
    input.setAttribute('aria-expanded', 'false');
    popover.hidden = true;
  }

  function renderGrid() {
    grid.replaceChildren();
    const lang = getLang();
    title.textContent = padMonthHeader(viewYear, viewMonth, lang);

    const first = new Date(viewYear, viewMonth, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    for (let i = 0; i < startPad; i += 1) {
      const placeholder = doc.createElement('div');
      placeholder.className = 'bbl-calendar-picker-day bbl-calendar-picker-day--muted';
      placeholder.setAttribute('aria-hidden', 'true');
      grid.append(placeholder);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const cellDate = startOfDay(new Date(viewYear, viewMonth, day));
      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'bbl-calendar-picker-day';
      btn.textContent = String(day);
      btn.setAttribute('role', 'gridcell');
      btn.dataset.day = String(day);

      const disabled = isDateDisabled(cellDate);
      btn.disabled = disabled;

      if (selected && sameDay(cellDate, selected)) {
        btn.classList.add('bbl-calendar-picker-day--selected');
      }

      grid.append(btn);
    }
  }

  function openPopover() {
    isOpen = true;
    input.setAttribute('aria-expanded', 'true');
    popover.hidden = false;
    if (selected) {
      viewYear = selected.getFullYear();
      viewMonth = selected.getMonth();
    }
    renderWeekdayLabels();
    renderGrid();
    positionPopover(input, popover, doc);
  }

  function onGridClick(e) {
    const btn = e.target.closest('button.bbl-calendar-picker-day');
    if (!btn || btn.disabled || !grid.contains(btn)) return;
    const day = Number.parseInt(btn.dataset.day, 10);
    if (Number.isNaN(day)) return;
    const cellDate = startOfDay(new Date(viewYear, viewMonth, day));
    selected = cellDate;
    syncLabel();
    notifyInputCommitted();
    onChange?.(cellDate);
    closePopover();
  }

  grid.addEventListener('click', onGridClick);

  function shiftMonth(delta) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    viewYear = d.getFullYear();
    viewMonth = d.getMonth();
    renderGrid();
  }

  btnPrev.addEventListener('click', (e) => {
    e.stopPropagation();
    shiftMonth(-1);
  });
  btnNext.addEventListener('click', (e) => {
    e.stopPropagation();
    shiftMonth(1);
  });

  function onDocClick(e) {
    if (!isOpen) return;
    const t = e.target;
    if (popover.contains(t) || input.contains(t)) return;
    closePopover();
  }

  function onKeydown(e) {
    if (e.key === 'Escape' && isOpen) {
      e.stopPropagation();
      closePopover();
    }
  }

  function onReposition() {
    if (isOpen) positionPopover(input, popover, doc);
  }

  doc.addEventListener('click', onDocClick);
  doc.addEventListener('keydown', onKeydown);
  doc.defaultView.addEventListener('resize', onReposition);
  doc.defaultView.addEventListener('scroll', onReposition, true);

  input.setAttribute('aria-haspopup', 'dialog');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('autocomplete', 'off');

  /** Opens when tabbing in; first pointer focus does not double-close with click. */
  function onInputFocusIn() {
    if (!isOpen) openPopover();
  }

  function onInputClick(e) {
    e.stopPropagation();
    if (!isOpen) openPopover();
  }

  input.addEventListener('focusin', onInputFocusIn);
  input.addEventListener('click', onInputClick);

  syncLabel();
  if (selected) renderGrid();

  return {
    open: openPopover,
    close: closePopover,
    destroy() {
      grid.removeEventListener('click', onGridClick);
      input.removeEventListener('focusin', onInputFocusIn);
      input.removeEventListener('click', onInputClick);
      doc.removeEventListener('click', onDocClick);
      doc.removeEventListener('keydown', onKeydown);
      doc.defaultView.removeEventListener('resize', onReposition);
      doc.defaultView.removeEventListener('scroll', onReposition, true);
      popover.remove();
    },
    getValue() {
      return selected ? new Date(selected.getTime()) : null;
    },
    setValue(d) {
      selected = d ? startOfDay(d) : null;
      if (selected) {
        viewYear = selected.getFullYear();
        viewMonth = selected.getMonth();
      }
      syncLabel();
      notifyInputCommitted();
      if (isOpen) renderGrid();
    },
  };
}

export default attachCalendarPicker;
