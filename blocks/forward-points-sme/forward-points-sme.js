import { fetchPlaceholders } from '../../scripts/placeholder.js';
import { fetchConfigs } from '../../scripts/config.js';
import {
  buildCalendarGrid,
  buildIntlDayLabels,
  buildIntlMonthLabels,
  formatDateInputValue,
  getMonthKey,
  parseApiDate,
  parseCsvConfigList,
  parseIsoDate,
  parseTypedDate,
} from './helpers/date-helpers.js';
import {
  createApiEndpoints,
  getEnabledDays,
  getFxRates,
  getLatestFwdUpdate,
  getLatestFxRates,
  getUpdatesInDay,
  normalizeFwdRates,
  normalizeFxRates,
  trimValue,
} from './helpers/api-helpers.js';
import parseAuthoring from './helpers/authoring-helpers.js';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isValidSelectedDay(state) {
  const parsed = parseIsoDate(state.selectedDate);
  if (!parsed) return false;
  const selectedMonthKey = getMonthKey(parsed.year, parsed.month);
  const enabledDays = state.enabledDaysByMonth[selectedMonthKey] || [];
  if (!enabledDays.length) return true;
  return enabledDays.includes(parsed.day);
}

function renderDatepicker(
  state,
  sid,
  monthLabels,
  dayLabels,
  buddhistYearOffset,
  prevLabel,
  nextLabel,
) {
  if (!state.calendarOpen) return '';

  const viewMonthKey = getMonthKey(state.viewYear, state.viewMonth);
  const viewEnabledSet = new Set(state.enabledDaysByMonth[viewMonthKey] || []);
  const calendarWeeks = buildCalendarGrid(state.viewYear, state.viewMonth);
  const maxIndex = state.maxSelectableMonth
    ? state.maxSelectableMonth.year * 12 + state.maxSelectableMonth.month
    : null;
  const viewIndex = state.viewYear * 12 + state.viewMonth;
  const nextDisabled = Boolean(maxIndex && viewIndex >= maxIndex);
  const selectedParsed = parseIsoDate(state.selectedDate);
  const now = new Date();

  const weeksMarkup = calendarWeeks.map((week) => {
    const cells = week.map((cell, index) => {
      if (!cell.inMonth) {
        const weekend = index === 0 || index === 6 ? ' is-weekend' : '';
        return `<td class="is-other-month${weekend}">&nbsp;</td>`;
      }

      const dayValue = String(cell.day).padStart(2, '0');
      const isEnabled = viewEnabledSet.has(dayValue);
      const isSelected = selectedParsed
        && Number(selectedParsed.day) === cell.day
        && Number(selectedParsed.month) === state.viewMonth
        && Number(selectedParsed.year) === state.viewYear;
      const isToday = now.getDate() === cell.day
        && now.getMonth() + 1 === state.viewMonth
        && now.getFullYear() === state.viewYear;

      const classes = [
        index === 0 || index === 6 ? 'is-weekend' : '',
        isEnabled ? 'is-enabled' : 'is-disabled',
        isSelected ? 'is-current' : '',
        isToday ? 'is-today' : '',
      ].filter(Boolean).join(' ');

      if (isEnabled) {
        return `<td class="${classes}"><button type="button" class="fpsme-dp-day-btn" data-day="${cell.day}">${cell.day}</button></td>`;
      }
      return `<td class="${classes}"><span class="fpsme-dp-day-text">${cell.day}</span></td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  const daysHeader = dayLabels.map((label, index) => {
    const weekend = index === 0 || index === 6 ? 'is-weekend' : '';
    return `<th class="${weekend}">${escapeHtml(label)}</th>`;
  }).join('');

  return `<div class="fpsme-datepicker fpsme-datepicker-${sid}">
    <div class="fpsme-dp-header">
      <button type="button" class="fpsme-dp-nav fpsme-dp-prev" aria-label="${escapeHtml(prevLabel)}"><i class="icon-arrow-left" aria-hidden="true"></i></button>
      <div class="fpsme-dp-title">
        <span class="fpsme-dp-month">${escapeHtml(monthLabels[state.viewMonth - 1] || '')}</span>
        <span class="fpsme-dp-year">${state.viewYear + buddhistYearOffset}</span>
      </div>
      <button type="button" class="fpsme-dp-nav fpsme-dp-next${nextDisabled ? ' is-disabled' : ''}" aria-label="${escapeHtml(nextLabel)}"${nextDisabled ? ' disabled' : ''}><i class="icon-arrow-left" aria-hidden="true"></i></button>
    </div>
    <table class="fpsme-dp-calendar">
      <thead><tr>${daysHeader}</tr></thead>
      <tbody>${weeksMarkup}</tbody>
    </table>
  </div>`;
}

function renderControlsRow(
  state,
  sid,
  calendarLabel,
  goCtaLabel,
  monthLabels,
  dayLabels,
  buddhistYearOffset,
  prevLabel,
  nextLabel,
) {
  const selectedUpdateObj = state.updates.find(
    (item) => trimValue(item.Update) === state.selectedUpdate,
  );
  const selectedLabel = selectedUpdateObj
    ? `${trimValue(selectedUpdateObj.Update)}: ${trimValue(selectedUpdateObj.Time)}`
    : (state.selectedUpdate || '');

  const timeItems = state.updates.map((item) => {
    const update = trimValue(item.Update);
    const time = trimValue(item.Time);
    const label = `${update}: ${time}`;
    const isActive = update === state.selectedUpdate;
    return `<li class="fpsme-time-item${isActive ? ' is-active' : ''}" role="option" aria-selected="${isActive}" data-value="${escapeHtml(update)}">${escapeHtml(label)}</li>`;
  }).join('');

  const timeDropdownOpen = state.timeDropdownOpen ? ' is-open' : '';
  const timeDisabled = !state.updates.length ? ' is-disabled' : '';
  const goDisabled = (!state.selectedDate || !state.selectedUpdate || state.loading) ? ' disabled' : '';

  return `<div class="fpsme-controls fpsme-controls-${sid}">
    <span class="fpsme-update-label">${escapeHtml(calendarLabel)}</span>
    <div class="fpsme-date-group fpsme-date-group-${sid}">
      <input id="fpsme-date-input-${sid}" class="fpsme-date-input" type="text" inputmode="text" placeholder="DD MMM YYYY" value="${escapeHtml(state.typedDate)}" aria-label="${escapeHtml(calendarLabel)} date">
      <button type="button" class="fpsme-date-trigger fpsme-date-trigger-${sid} icon-calendar" aria-label="Open calendar"></button>
      ${renderDatepicker(
    state,
    sid,
    monthLabels,
    dayLabels,
    buddhistYearOffset,
    prevLabel,
    nextLabel,
  )}
    </div>
    <div class="fpsme-time-wrap">
      <div class="fpsme-time-dropdown fpsme-time-dropdown-${sid}${timeDropdownOpen}${timeDisabled}" role="combobox" aria-expanded="${state.timeDropdownOpen}" aria-haspopup="listbox">
        <button type="button" class="fpsme-time-trigger" aria-label="Select time"${state.updates.length ? '' : ' disabled'}>
          <span class="fpsme-time-label">${escapeHtml(selectedLabel)}</span>
          <i class="icon-dropdown fpsme-time-chevron" aria-hidden="true"></i>
        </button>
        <ul class="fpsme-time-list" role="listbox">${timeItems}</ul>
      </div>
    </div>
    <button type="button" class="fpsme-go-btn fpsme-go-btn-${sid}"${goDisabled}>${escapeHtml(goCtaLabel)}</button>
  </div>`;
}

function renderCurrencyTable(fxRates, authoring) {
  const [col0, col1, col2, col3] = authoring.section1Columns;

  const rows = fxRates.map((rate) => `<tr>
    <td class="fpsme-currency-cell">
      <img src="/icons/${escapeHtml(rate.familyIcon)}.svg" alt="${escapeHtml(rate.family)} flag" loading="lazy" class="fpsme-flag">
      <span>${escapeHtml(rate.family)}</span>
    </td>
    <td class="fpsme-td-right">${escapeHtml(rate.sightBillBuying)}</td>
    <td class="fpsme-td-right">${escapeHtml(rate.ttBuying)}</td>
    <td class="fpsme-td-right">${escapeHtml(rate.ttSelling)}</td>
  </tr>`).join('');

  const unitRow = authoring.section1UnitLabel
    ? `<div class="fpsme-unit fpsme-unit-right">${escapeHtml(authoring.section1UnitLabel)}</div>`
    : '';

  return `<div class="fpsme-table-wrap">
    <table class="fpsme-table fpsme-table-currency">
      <thead>
        <tr>
          <th>${col0}</th>
          <th class="fpsme-th-right">${col1}</th>
          <th class="fpsme-th-right">${col2}</th>
          <th class="fpsme-th-right">${col3}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>${unitRow}`;
}

function renderFwdTable(fwdRates, authoring, tableIndex) {
  const [col0, col1, col2] = authoring.section2Columns;

  const rowHeadings = authoring.section2Rows;

  const rows = rowHeadings.map((heading, i) => {
    const rate = fwdRates[i];
    let buying = '-';
    let selling = '-';
    if (rate) {
      buying = tableIndex === 1 ? rate.t1Buying : rate.t2Buying;
      selling = tableIndex === 1 ? rate.t1Selling : rate.t2Selling;
    }
    return `<tr>
      <td class="fpsme-fwd-period">${escapeHtml(heading)}</td>
      <td class="fpsme-td-right">${escapeHtml(buying)}</td>
      <td class="fpsme-td-right">${escapeHtml(selling)}</td>
    </tr>`;
  }).join('');

  return `<table class="fpsme-table fpsme-fwd-table">
    <thead>
      <tr>
        <th>${col0}</th>
        <th class="fpsme-th-right">${col1}</th>
        <th class="fpsme-th-right">${col2}</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderBlock(
  block,
  s1State,
  s2State,
  authoring,
  monthLabels,
  dayLabels,
  buddhistYearOffset,
  prevLabel,
  nextLabel,
) {
  const s1Controls = renderControlsRow(
    s1State,
    '1',
    authoring.section1CalendarLabel,
    authoring.section1GoCtaLabel,
    monthLabels,
    dayLabels,
    buddhistYearOffset,
    prevLabel,
    nextLabel,
  );
  const s2Controls = renderControlsRow(
    s2State,
    '2',
    authoring.section2CalendarLabel,
    authoring.section2GoCtaLabel,
    monthLabels,
    dayLabels,
    buddhistYearOffset,
    prevLabel,
    nextLabel,
  );

  const allFxRates = normalizeFxRates(s1State.rates);
  const usdWithRates = allFxRates.filter(
    (r) => r.family.toUpperCase() === 'USD' && r.sightBillBuying !== '-',
  );
  const fxRates = usdWithRates.length
    ? usdWithRates.slice(0, 1)
    : allFxRates.filter((r) => r.family.toUpperCase() === 'USD').slice(0, 1);
  const fwdRates = normalizeFwdRates(s2State.rates);

  block.innerHTML = `<div class="fpsme-wrapper">
    ${authoring.printLogoHtml ? `<div class="fpsme-print-logo">${authoring.printLogoHtml}</div>` : ''}
    <div class="fpsme-section1-bar">
      <div class="fpsme-section fpsme-section-currency">
        ${s1Controls}
        ${renderCurrencyTable(fxRates, authoring)}
      </div>
      <button type="button" class="fpsme-print-btn">
        ${escapeHtml(authoring.printCtaLabel)}<i class="icon-print" aria-hidden="true"></i>
      </button>
    </div>

    <div class="fpsme-section fpsme-section-fwd">
      ${s2Controls}
      <div class="fpsme-fwd-body">
        <h3 class="fpsme-fwd-title">${escapeHtml(authoring.section2TableTitle)}</h3>
        <div class="fpsme-fwd-tables">
          <div class="fpsme-fwd-table-col">
            <p class="fpsme-fwd-subtitle">${escapeHtml(authoring.section2SubTitle1)}</p>
            <div class="fpsme-table-wrap">
              ${renderFwdTable(fwdRates, authoring, 1)}
            </div>
            <p class="fpsme-unit fpsme-unit-right">${escapeHtml(authoring.section2UnitLabel)}</p>
          </div>
          <div class="fpsme-fwd-table-col">
            <p class="fpsme-fwd-subtitle">${escapeHtml(authoring.section2SubTitle2)}</p>
            <div class="fpsme-table-wrap">
              ${renderFwdTable(fwdRates, authoring, 2)}
            </div>
            <p class="fpsme-unit fpsme-unit-right">${escapeHtml(authoring.section2UnitLabel)}</p>
          </div>
        </div>
      </div>
      <div class="fpsme-remark">${authoring.remarkHtml}</div>
    </div>
  </div>`;

  block.querySelectorAll('.fpsme-flag').forEach((img) => {
    img.addEventListener('error', (e) => { e.target.style.display = 'none'; });
  });
}

// ─── Section-scoped interaction setup ─────────────────────────────────────────

function setupSection(
  block,
  state,
  sid,
  endpoints,
  isSection2,
  monthLabels,
  dayLabels,
  buddhistYearOffset,
  rerender,
) {
  const dateGroup = block.querySelector(`.fpsme-date-group-${sid}`);
  const dateInput = block.querySelector(`#fpsme-date-input-${sid}`);
  const dateTrigger = block.querySelector(`.fpsme-date-trigger-${sid}`);
  const prevBtn = dateGroup?.querySelector('.fpsme-dp-prev');
  const nextBtn = dateGroup?.querySelector('.fpsme-dp-next');
  const dayButtons = dateGroup?.querySelectorAll('.fpsme-dp-day-btn');
  const timeDropdownEl = block.querySelector(`.fpsme-time-dropdown-${sid}`);
  const timeTrigger = timeDropdownEl?.querySelector('.fpsme-time-trigger');
  const goBtn = block.querySelector(`.fpsme-go-btn-${sid}`);

  const getEndpointUrl = (type, ...args) => {
    if (isSection2) {
      if (type === 'dayInMonth') return endpoints.fwdDayInMonth(...args);
      if (type === 'updateInDay') return endpoints.fwdUpdateInDay(...args);
      if (type === 'rates') return endpoints.fwdRates(...args);
    } else {
      if (type === 'dayInMonth') return endpoints.dayInMonth(...args);
      if (type === 'updateInDay') return endpoints.updateInDay(...args);
      if (type === 'rates') return endpoints.fxRates(...args);
    }
    return '';
  };

  const loadRates = async (dateIso, updateValue) => {
    const parsed = parseIsoDate(dateIso);
    if (!parsed || !updateValue) return;
    state.loading = true;
    rerender();

    try {
      const url = getEndpointUrl('rates', parsed.day, parsed.month, parsed.year, updateValue);
      state.rates = await getFxRates(url);
    } finally {
      state.loading = false;
      rerender();
    }
  };

  const applyDateSelection = async (dateIso) => {
    const parsed = parseIsoDate(dateIso);
    if (!parsed) return false;

    const monthKey = getMonthKey(parsed.year, parsed.month);
    if (!state.enabledDaysByMonth[monthKey]) {
      state.enabledDaysByMonth[monthKey] = await getEnabledDays(
        getEndpointUrl('dayInMonth', parsed.year, parsed.month),
      );
    }

    const monthDays = state.enabledDaysByMonth[monthKey] || [];
    if (monthDays.length && !monthDays.includes(parsed.day)) return false;

    state.selectedDate = dateIso;
    state.typedDate = formatDateInputValue(state.selectedDate, monthLabels, buddhistYearOffset);
    state.viewYear = Number(parsed.year);
    state.viewMonth = Number(parsed.month);
    rerender();

    try {
      const updates = await getUpdatesInDay(
        getEndpointUrl('updateInDay', parsed.day, parsed.month, parsed.year),
      );
      state.updates = updates;
      const stillExists = updates.some((item) => trimValue(item.Update) === state.selectedUpdate);
      if (!stillExists) {
        state.selectedUpdate = trimValue(updates[updates.length - 1]?.Update);
      }
    } catch (e) {
      // silent
    }

    rerender();
    if (state.selectedDate && state.selectedUpdate && isValidSelectedDay(state)) {
      await loadRates(state.selectedDate, state.selectedUpdate);
    }
    return true;
  };

  // Date input events
  if (dateInput) {
    dateInput.addEventListener('input', (e) => { state.typedDate = e.target.value; });

    dateInput.addEventListener('blur', () => {
      const parsed = parseTypedDate(state.typedDate, buddhistYearOffset);
      if (!parsed) {
        state.typedDate = formatDateInputValue(state.selectedDate, monthLabels, buddhistYearOffset);
        rerender();
        return;
      }
      if (parsed.iso !== state.selectedDate) applyDateSelection(parsed.iso);
    });

    dateInput.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const parsed = parseTypedDate(state.typedDate, buddhistYearOffset);
      if (parsed && parsed.iso !== state.selectedDate) applyDateSelection(parsed.iso);
    });
  }

  // Calendar open
  const openCalendar = () => {
    const parsed = parseIsoDate(state.selectedDate);
    if (parsed) {
      state.viewYear = Number(parsed.year);
      state.viewMonth = Number(parsed.month);
    }
    state.calendarOpen = true;
    rerender();

    if (parsed) {
      const monthKey = getMonthKey(parsed.year, parsed.month);
      if (!state.enabledDaysByMonth[monthKey]) {
        getEnabledDays(getEndpointUrl('dayInMonth', parsed.year, parsed.month))
          .then((days) => {
            state.enabledDaysByMonth[monthKey] = days;
            if (state.calendarOpen) rerender();
          });
      }
    }
  };

  if (dateInput) dateInput.addEventListener('focus', openCalendar);
  if (dateTrigger) dateTrigger.addEventListener('click', openCalendar);

  // Calendar navigation
  if (prevBtn) {
    prevBtn.addEventListener('click', async () => {
      const month = state.viewMonth === 1 ? 12 : state.viewMonth - 1;
      const year = state.viewMonth === 1 ? state.viewYear - 1 : state.viewYear;
      state.viewMonth = month;
      state.viewYear = year;
      const monthKey = getMonthKey(year, month);
      if (!state.enabledDaysByMonth[monthKey]) {
        state.enabledDaysByMonth[monthKey] = await getEnabledDays(
          getEndpointUrl('dayInMonth', year, month),
        );
      }
      rerender();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', async () => {
      const month = state.viewMonth === 12 ? 1 : state.viewMonth + 1;
      const year = state.viewMonth === 12 ? state.viewYear + 1 : state.viewYear;
      const nextIndex = year * 12 + month;
      const maxIndex = state.maxSelectableMonth
        ? state.maxSelectableMonth.year * 12 + state.maxSelectableMonth.month
        : null;
      if (maxIndex && nextIndex > maxIndex) return;

      state.viewMonth = month;
      state.viewYear = year;
      const monthKey = getMonthKey(year, month);
      if (!state.enabledDaysByMonth[monthKey]) {
        state.enabledDaysByMonth[monthKey] = await getEnabledDays(
          getEndpointUrl('dayInMonth', year, month),
        );
      }
      rerender();
    });
  }

  if (dayButtons) {
    dayButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const { day } = btn.dataset;
        const dateIso = `${state.viewYear}-${String(state.viewMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        applyDateSelection(dateIso).then((applied) => {
          if (!applied) return;
          state.calendarOpen = false;
          rerender();
        });
      });
    });
  }

  // Time dropdown
  const toggleTime = (open) => {
    state.timeDropdownOpen = open;
    if (timeDropdownEl) timeDropdownEl.classList.toggle('is-open', open);
  };

  if (timeTrigger) {
    timeTrigger.addEventListener('click', () => {
      const next = !state.timeDropdownOpen;
      toggleTime(next);
      if (next) {
        document.addEventListener('mousedown', function closeTime(e) {
          if (!timeDropdownEl || !timeDropdownEl.contains(e.target)) toggleTime(false);
          document.removeEventListener('mousedown', closeTime);
        });
      }
    });
  }

  block.querySelectorAll(`.fpsme-time-dropdown-${sid} .fpsme-time-item`).forEach((item) => {
    item.addEventListener('click', () => {
      const prev = state.selectedUpdate;
      state.selectedUpdate = item.dataset.value;
      toggleTime(false);
      if (prev !== state.selectedUpdate && state.selectedDate && isValidSelectedDay(state)) {
        loadRates(state.selectedDate, state.selectedUpdate);
      }
    });
  });

  // GO button
  if (goBtn) {
    goBtn.addEventListener('click', () => {
      if (!state.selectedDate || !state.selectedUpdate || !isValidSelectedDay(state)) return;
      loadRates(state.selectedDate, state.selectedUpdate);
    });
  }

  // Outside click to close calendar
  if (state.calendarOpen && dateGroup) {
    const outsideClick = (e) => {
      if (!dateGroup.contains(e.target)) {
        state.calendarOpen = false;
        rerender();
        document.removeEventListener('mousedown', outsideClick);
      }
    };
    document.addEventListener('mousedown', outsideClick);
  }
}

// ─── Main decorate ─────────────────────────────────────────────────────────────

export default async function decorate(block) {
  const authoring = parseAuthoring(block);
  const [placeholders, configs] = await Promise.all([fetchPlaceholders(), fetchConfigs()]);

  const prevLabel = placeholders?.forexRatesPrevMonth || 'Previous month';
  const nextLabel = placeholders?.forexRatesNextMonth || 'Next month';
  const language = document.documentElement.lang?.split('-')[0] || 'en';
  const monthLabels = parseCsvConfigList(configs?.monthLabels, buildIntlMonthLabels(language));
  const dayLabels = parseCsvConfigList(configs?.dayLabels, buildIntlDayLabels(language));
  const buddhistYearOffset = Number(configs?.buddhistYearOffset) || 0;
  const endpoints = createApiEndpoints(configs);

  const createSectionState = () => ({
    selectedDate: '',
    selectedUpdate: '',
    updates: [],
    rates: [],
    enabledDaysByMonth: {},
    loading: false,
    typedDate: '',
    calendarOpen: false,
    timeDropdownOpen: false,
    viewMonth: 1,
    viewYear: 1970,
    maxSelectableMonth: null,
  });

  const s1State = createSectionState();
  const s2State = createSectionState();

  const render = () => {
    renderBlock(
      block,
      s1State,
      s2State,
      authoring,
      monthLabels,
      dayLabels,
      buddhistYearOffset,
      prevLabel,
      nextLabel,
    );
    setupSection(
      block,
      s1State,
      '1',
      endpoints,
      false,
      monthLabels,
      dayLabels,
      buddhistYearOffset,
      render,
    );
    setupSection(
      block,
      s2State,
      '2',
      endpoints,
      true,
      monthLabels,
      dayLabels,
      buddhistYearOffset,
      render,
    );

    const printBtn = block.querySelector('.fpsme-print-btn');
    if (printBtn) printBtn.addEventListener('click', () => window.print());
  };

  // ── Init: load latest data for both sections ────────────────────────────────

  s1State.loading = true;
  s2State.loading = true;
  render();

  // Section 1 init
  const initSection1 = async () => {
    try {
      const latest = await getLatestFxRates(endpoints);
      s1State.rates = latest;

      const latestItem = Array.isArray(latest) ? latest[0] : null;
      const latestDate = parseApiDate(latestItem?.Ddate);
      if (!latestDate) return;

      s1State.selectedDate = latestDate.iso;
      s1State.viewYear = Number(latestDate.year);
      s1State.viewMonth = Number(latestDate.month);
      s1State.maxSelectableMonth = {
        year: Number(latestDate.year),
        month: Number(latestDate.month),
      };

      const monthKey = getMonthKey(latestDate.year, latestDate.month);
      s1State.enabledDaysByMonth[monthKey] = await getEnabledDays(
        endpoints.dayInMonth(latestDate.year, latestDate.month),
      );

      const updates = await getUpdatesInDay(
        endpoints.updateInDay(latestDate.day, latestDate.month, latestDate.year),
      );
      s1State.updates = updates;
      const preferredUpdate = trimValue(latestItem?.Update);
      const hasPreferred = updates.some((item) => trimValue(item.Update) === preferredUpdate);
      const fallback = trimValue(updates[updates.length - 1]?.Update);
      s1State.selectedUpdate = hasPreferred ? preferredUpdate : fallback;
      s1State.typedDate = formatDateInputValue(
        s1State.selectedDate,
        monthLabels,
        buddhistYearOffset,
      );
    } finally {
      s1State.loading = false;
    }
  };

  // Section 2 init
  const initSection2 = async () => {
    try {
      const latestFwd = await getLatestFwdUpdate(endpoints);
      if (!latestFwd) return;

      const latestDate = parseApiDate(latestFwd?.Ddate || latestFwd?.Date);
      if (!latestDate) return;

      s2State.selectedDate = latestDate.iso;
      s2State.viewYear = Number(latestDate.year);
      s2State.viewMonth = Number(latestDate.month);
      s2State.maxSelectableMonth = {
        year: Number(latestDate.year),
        month: Number(latestDate.month),
      };

      const monthKey = getMonthKey(latestDate.year, latestDate.month);
      s2State.enabledDaysByMonth[monthKey] = await getEnabledDays(
        endpoints.fwdDayInMonth(latestDate.year, latestDate.month),
      );

      const updates = await getUpdatesInDay(
        endpoints.fwdUpdateInDay(latestDate.day, latestDate.month, latestDate.year),
      );
      s2State.updates = updates;
      const preferredUpdate = trimValue(latestFwd?.Update);
      const hasPreferred = updates.some((item) => trimValue(item.Update) === preferredUpdate);
      const fallback = trimValue(updates[updates.length - 1]?.Update);
      s2State.selectedUpdate = hasPreferred ? preferredUpdate : fallback;
      s2State.typedDate = formatDateInputValue(
        s2State.selectedDate,
        monthLabels,
        buddhistYearOffset,
      );

      if (s2State.selectedDate && s2State.selectedUpdate) {
        const ratesUrl = endpoints.fwdRates(
          latestDate.day,
          latestDate.month,
          latestDate.year,
          s2State.selectedUpdate,
        );
        s2State.rates = await getFxRates(ratesUrl);
      }
    } finally {
      s2State.loading = false;
    }
  };

  await Promise.all([initSection1(), initSection2()]);
  render();
}
