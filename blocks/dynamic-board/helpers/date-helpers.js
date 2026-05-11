export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function pad2(n) {
  return String(n).padStart(2, '0');
}

export function formatDisplayDate(date) {
  return `${pad2(date.getDate())} ${MONTH_SHORT[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatMaturityDate(isoStr) {
  const d = new Date(isoStr);
  return `${pad2(d.getDate())} ${MONTH_SHORT[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
}

export function formatRemainTerm(remainTerm) {
  const parts = remainTerm.split('.');
  const years = parseInt(parts[0], 10);
  const months = parseInt(parts[1], 10);
  if (years === 0) return `${months}M`;
  if (months === 0) return `${years}Y`;
  return `${years}Y ${months}M`;
}

export function remainTermToMonths(remainTerm) {
  const parts = remainTerm.split('.');
  return parseInt(parts[0], 10) * 12 + parseInt(parts[1], 10);
}

export function formatMonthYear(month, year) {
  return `${month}-${year}`;
}

export function formatMonthYearDisplay(month, year) {
  return `${pad2(month)}/${year}`;
}

export function buildCalendarGrid(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const cells = [];

  for (let i = firstDay - 1; i >= 0; i -= 1) {
    cells.push({ day: daysInPrev - i, otherMonth: true });
  }
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push({ day: d, otherMonth: false });
  }
  while (cells.length < 42) {
    cells.push({ day: cells.length - firstDay - daysInMonth + 1, otherMonth: true });
  }
  return cells;
}
