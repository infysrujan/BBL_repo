let sharedPopup = null;
let popupAttachedInput = null;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getOrCreatePopup(doc) {
  if (sharedPopup && doc.body.contains(sharedPopup)) return sharedPopup;
  sharedPopup = doc.createElement('div');
  sharedPopup.className = 'bbl-cal-popup';
  sharedPopup.innerHTML = `
    <header>
      <button class="cal-prev">&#8249;</button>
      <span class="cal-label"></span>
      <button class="cal-next">&#8250;</button>
    </header>
    <div class="cal-grid"></div>`;
  doc.body.appendChild(sharedPopup);
  return sharedPopup;
}

function positionPopup(popup, input) {
  const rect = input.getBoundingClientRect();
  popup.style.top = `${rect.bottom + window.scrollY + 4}px`;
  popup.style.left = `${rect.left + window.scrollX}px`;
}

function formatDisplay(d) {
  const day = String(d.getDate()).padStart(2, '0');
  const mon = MONTH_NAMES[d.getMonth()].slice(0, 3);
  return `${day} ${mon} ${d.getFullYear()}`;
}

/**
 * @param {{
 *   input: HTMLInputElement,
 *   value?: Date,
 *   fetchEnabledDays?: (ctx: {year: number, month: number}) => Promise<number[]>,
 *   onChange?: (date: Date) => void,
 *   allDaysEnabled?: boolean,
 * }} options
 */
export default function attachCalendarPicker({
  input, value, fetchEnabledDays, onChange, allDaysEnabled = false,
}) {
  const doc = input.ownerDocument;
  const popup = getOrCreatePopup(doc);
  const grid = popup.querySelector('.cal-grid');
  const label = popup.querySelector('.cal-label');
  const prevBtn = popup.querySelector('.cal-prev');
  const nextBtn = popup.querySelector('.cal-next');

  let current = value ? new Date(value) : new Date();
  let selected = value ? new Date(value) : new Date();
  let enabledDays = [];
  let activePrevHandler = null;
  let activeNextHandler = null;

  function makeDayClickHandler(y, m, dayNum) {
    return () => {
      selected = new Date(y, m, dayNum);
      input.value = formatDisplay(selected);
      popup.classList.remove('open');
      onChange?.(selected);
    };
  }

  function renderGrid(y, m) {
    label.textContent = `${MONTH_NAMES[m]} ${y}`;
    grid.innerHTML = '';

    ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].forEach((n) => {
      const s = doc.createElement('span');
      s.className = 'cal-day-name';
      s.textContent = n;
      grid.appendChild(s);
    });

    const firstDay = new Date(y, m, 1).getDay();
    for (let i = 0; i < firstDay; i += 1) grid.appendChild(doc.createElement('span'));

    const daysInMonth = new Date(y, m + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d += 1) {
      const s = doc.createElement('span');
      s.textContent = d;
      const isEnabled = allDaysEnabled || enabledDays.includes(d);
      if (isEnabled) {
        s.classList.add('cal-enabled');
        const isSelected = selected
          && selected.getFullYear() === y
          && selected.getMonth() === m
          && selected.getDate() === d;
        if (isSelected) s.classList.add('cal-selected');
        s.addEventListener('click', makeDayClickHandler(y, m, d));
      } else {
        s.classList.add('cal-disabled');
      }
      grid.appendChild(s);
    }
  }

  async function loadGrid(y, m) {
    if (!allDaysEnabled && fetchEnabledDays) {
      enabledDays = await fetchEnabledDays({ year: y, month: m }).catch(() => []);
    }
    renderGrid(y, m);
  }

  function openPopup() {
    positionPopup(popup, input);
    popup.classList.add('open');
    popupAttachedInput = input;

    if (activePrevHandler) prevBtn.removeEventListener('click', activePrevHandler);
    if (activeNextHandler) nextBtn.removeEventListener('click', activeNextHandler);

    activePrevHandler = () => {
      current = new Date(current.getFullYear(), current.getMonth() - 1, 1);
      loadGrid(current.getFullYear(), current.getMonth());
    };
    activeNextHandler = () => {
      current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
      loadGrid(current.getFullYear(), current.getMonth());
    };

    prevBtn.addEventListener('click', activePrevHandler);
    nextBtn.addEventListener('click', activeNextHandler);
    loadGrid(current.getFullYear(), current.getMonth());
  }

  input.value = formatDisplay(selected);
  input.readOnly = true;

  const wrapper = input.closest('.calendar-input') ?? input;

  wrapper.addEventListener('click', (e) => {
    e.stopPropagation();
    if (popup.classList.contains('open') && popupAttachedInput === input) {
      popup.classList.remove('open');
    } else {
      openPopup();
    }
  });

  doc.addEventListener('click', (e) => {
    if (!popup.contains(e.target)) popup.classList.remove('open');
  });
}
