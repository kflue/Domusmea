/**
 * Arithmetic on `YYYY-MM-DD` calendar dates (ADR 0004). Day arithmetic goes through UTC midnight,
 * which has no daylight saving shifts, so dates never move across time zones.
 */

/**
 * `date` plus `months` (negative to go back), clamped to the end of shorter months:
 * 31 January + 1 month = 28 February (29 in leap years).
 */
export function addMonths(date: string, months: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const total = year * 12 + month - 1 + months;
  const targetYear = Math.floor(total / 12);
  const targetMonth = (total % 12) + 1;
  return format(targetYear, targetMonth, Math.min(day, daysInMonth(targetYear, targetMonth)));
}

/** `date` plus `days` (negative to go back). */
export function addDays(date: string, days: number): string {
  return new Date(toUtc(date) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Number of days from `from` to `to`; negative if `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

const DAY_MS = 24 * 60 * 60 * 1000;

function toUtc(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function format(year: number, month: number, day: number): string {
  const pad = (value: number, length = 2) => String(value).padStart(length, '0');
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}
