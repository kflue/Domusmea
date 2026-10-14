const chfFormat = new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' });

/** Formats integer Rappen as Swiss francs, e.g. `123450` → `CHF 1’234.50`. */
export function formatChf(rappen: number): string {
  return chfFormat.format(rappen / 100);
}

/** Formats a `YYYY-MM-DD` date as `DD.MM.YYYY` without going through `Date` (no time zone shifts). */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}.${month}.${year}`;
}

/** Time zone that defines "today" for warranty expiry unless `APP_TIMEZONE` overrides it on the server. */
export const DEFAULT_TIME_ZONE = 'Europe/Zurich';

/** Calendar date of `now` in `timeZone` as `YYYY-MM-DD`. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Formats an ISO timestamp as `DD.MM.YYYY, HH:MM` in `timeZone` (Swiss notation). */
export function formatDateTime(isoTimestamp: string, timeZone: string = DEFAULT_TIME_ZONE): string {
  return new Intl.DateTimeFormat('de-CH', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoTimestamp));
}
