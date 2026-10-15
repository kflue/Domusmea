import { addDays, addMonths } from './calendar';
import { Commodity, UtilityEntry } from './utility';

/** Usage cost plus fixed fee of an entry. */
export function totalRappen(entry: UtilityEntry): number {
  return entry.costRappen + entry.fixedFeeRappen;
}

/**
 * Usage cost per unit in Rappen (fixed fee excluded), e.g. `28.7` for CHF 0.287/kWh; `undefined`
 * without an amount or for an amount of 0.
 */
export function rappenPerUnit(costRappen: number, amountMilli: number | null): number | undefined {
  return amountMilli ? (costRappen * 1000) / amountMilli : undefined;
}

/** Calendar year an entry counts towards: the year of its end date (ADR 0011). */
export function yearOf(entry: Pick<UtilityEntry, 'periodTo'>): string {
  return entry.periodTo.slice(0, 4);
}

/** `Q1 2026` if the period is exactly a calendar quarter, `undefined` otherwise. */
export function calendarQuarter(from: string, to: string): string | undefined {
  const [year, month, day] = from.split('-').map(Number);
  const isQuarterStart = day === 1 && (month - 1) % 3 === 0;
  if (!isQuarterStart || to !== addDays(addMonths(from, 3), -1)) {
    return undefined;
  }
  return `Q${(month - 1) / 3 + 1} ${year}`;
}

/** Totals of the entries of one commodity in one calendar year. */
export interface YearTotal {
  year: string;
  /** Entries of the year, newest period first. */
  entries: UtilityEntry[];
  /** `null` when no entry has an amount. */
  amountMilli: number | null;
  costRappen: number;
  fixedFeeRappen: number;
  totalRappen: number;
}

/** Entries of `commodity` with newest periods first. */
export function entriesOf(entries: readonly UtilityEntry[], commodity: Commodity): UtilityEntry[] {
  return entries
    .filter((entry) => entry.commodity === commodity)
    .sort(
      (a, b) =>
        b.periodTo.localeCompare(a.periodTo) ||
        b.periodFrom.localeCompare(a.periodFrom) ||
        b.id - a.id,
    );
}

/** The entries of one commodity grouped by calendar year (see {@link yearOf}), newest year first. */
export function yearTotals(entries: readonly UtilityEntry[], commodity: Commodity): YearTotal[] {
  const years = new Map<string, YearTotal>();
  for (const entry of entriesOf(entries, commodity)) {
    const year = yearOf(entry);
    const total = years.get(year) ?? {
      year,
      entries: [],
      amountMilli: null,
      costRappen: 0,
      fixedFeeRappen: 0,
      totalRappen: 0,
    };
    total.entries.push(entry);
    if (entry.amountMilli !== null) {
      total.amountMilli = (total.amountMilli ?? 0) + entry.amountMilli;
    }
    total.costRappen += entry.costRappen;
    total.fixedFeeRappen += entry.fixedFeeRappen;
    total.totalRappen += totalRappen(entry);
    years.set(year, total);
  }
  return [...years.values()];
}

/** Entries of `commodity` whose period shares at least one day with `from`–`to`. */
export function overlappingEntries(
  entries: readonly UtilityEntry[],
  commodity: Commodity,
  from: string,
  to: string,
  /** The entry being edited, which does not overlap itself. */
  excludeId?: number,
): UtilityEntry[] {
  return entries.filter(
    (entry) =>
      entry.commodity === commodity &&
      entry.id !== excludeId &&
      entry.periodFrom <= to &&
      entry.periodTo >= from,
  );
}

/**
 * Period proposed for the next bill: the three months after the latest entry (1 Jul–30 Sep after
 * 1 Apr–30 Jun), or the last full calendar quarter before `today` when there are none.
 */
export function nextBillingPeriod(
  entries: readonly UtilityEntry[],
  today: string,
): { from: string; to: string } {
  const latest = entries.reduce<string | undefined>(
    (max, entry) => (max === undefined || entry.periodTo > max ? entry.periodTo : max),
    undefined,
  );
  let from: string;
  if (latest === undefined) {
    const [year, month] = today.split('-').map(Number);
    const quarterStart = `${year}-${String(month - ((month - 1) % 3)).padStart(2, '0')}-01`;
    from = addMonths(quarterStart, -3);
  } else {
    from = addDays(latest, 1);
  }
  return { from, to: addDays(addMonths(from, 3), -1) };
}

/** Calendar months `YYYY-MM` from the month of `from` to the month of `to`, inclusive. */
export function monthsOf(from: string, to: string): string[] {
  const months: string[] = [];
  for (let month = `${from.slice(0, 7)}-01`; month <= to; month = addMonths(month, 1)) {
    months.push(month.slice(0, 7));
  }
  return months;
}

/**
 * Utility cost of the whole months from the month of `from` to the month of `to` (R10, ADR 0012):
 * each entry's total is spread evenly over the calendar months its period touches. Sums the exact
 * shares and rounds once, so the months of a bill add up to its total. Filter `entries` for a
 * single commodity.
 */
export function paidRappen(entries: readonly UtilityEntry[], from: string, to: string): number {
  const first = from.slice(0, 7);
  const last = to.slice(0, 7);
  let sum = 0;
  for (const entry of entries) {
    const months = monthsOf(entry.periodFrom, entry.periodTo);
    const inRange = months.filter((month) => month >= first && month <= last).length;
    sum += (totalRappen(entry) * inRange) / months.length;
  }
  return Math.round(sum);
}

/**
 * The twelve months up to the last month that has been billed, e.g. 1 October 2025 to
 * 30 September 2026 after a Q3 2026 bill; `undefined` without entries. Months not billed yet are
 * left out, so the total is not too low while a bill is outstanding.
 */
export function lastTwelveBilledMonths(
  entries: readonly UtilityEntry[],
): { from: string; to: string } | undefined {
  const latest = entries.reduce<string | undefined>(
    (max, entry) => (max === undefined || entry.periodTo > max ? entry.periodTo : max),
    undefined,
  );
  if (latest === undefined) {
    return undefined;
  }
  const nextMonth = addMonths(`${latest.slice(0, 7)}-01`, 1);
  return { from: addMonths(nextMonth, -12), to: addDays(nextMonth, -1) };
}

/** Change from `previous` to `current` in percent; `undefined` when `previous` is 0. */
export function percentChange(current: number, previous: number): number | undefined {
  return previous === 0 ? undefined : ((current - previous) / Math.abs(previous)) * 100;
}

/** Quarter (1–4) an entry counts towards: the quarter of its end date. */
export function quarterOf(entry: Pick<UtilityEntry, 'periodTo'>): number {
  return Math.floor((Number(entry.periodTo.slice(5, 7)) - 1) / 3) + 1;
}

/** Amount and total cost of some entries; amount `null` when none has one. */
export interface UsageTotal {
  amountMilli: number | null;
  totalRappen: number;
}

function sumUsage(entries: readonly UtilityEntry[]): UsageTotal {
  return entries.reduce<UsageTotal>(
    (total, entry) => ({
      amountMilli:
        entry.amountMilli === null
          ? total.amountMilli
          : (total.amountMilli ?? 0) + entry.amountMilli,
      totalRappen: total.totalRappen + totalRappen(entry),
    }),
    { amountMilli: null, totalRappen: 0 },
  );
}

/** A year of one commodity compared with the same quarters of the year before (R8, ADR 0012). */
export interface YearComparison extends UsageTotal {
  year: string;
  /** Quarters with entries in this year, ascending, e.g. `[1, 2, 3]`. */
  quarters: number[];
  /** The same quarters a year earlier; `undefined` if one of them has no entry. */
  previous: UsageTotal | undefined;
  /** Change in percent against `previous`; `undefined` without a comparison. */
  amountChange: number | undefined;
  costChange: number | undefined;
}

/**
 * Totals per calendar year, newest first, each compared like for like: a year with Q1–Q3 so far is
 * compared with Q1–Q3 of the year before, not with the whole year.
 */
export function yearOverYear(
  entries: readonly UtilityEntry[],
  commodity: Commodity,
): YearComparison[] {
  const byYear = new Map<string, UtilityEntry[]>();
  for (const entry of entriesOf(entries, commodity)) {
    byYear.set(yearOf(entry), [...(byYear.get(yearOf(entry)) ?? []), entry]);
  }
  return [...byYear].map(([year, yearEntries]) => {
    const quarters = [...new Set(yearEntries.map(quarterOf))].sort((a, b) => a - b);
    const earlier = (byYear.get(String(Number(year) - 1)) ?? []).filter((entry) =>
      quarters.includes(quarterOf(entry)),
    );
    const complete = quarters.every((quarter) => earlier.some((e) => quarterOf(e) === quarter));
    const current = sumUsage(yearEntries);
    const previous = complete ? sumUsage(earlier) : undefined;
    return {
      year,
      quarters,
      ...current,
      previous,
      amountChange:
        previous?.amountMilli != null && current.amountMilli !== null
          ? percentChange(current.amountMilli, previous.amountMilli)
          : undefined,
      costChange: previous ? percentChange(current.totalRappen, previous.totalRappen) : undefined,
    };
  });
}

/**
 * The same calendar quarter a year before `entry`, for the chart overlay; `undefined` for an
 * irregular period or when that quarter has no entry.
 */
export function sameQuarterYearBefore(
  entries: readonly UtilityEntry[],
  entry: UtilityEntry,
): UsageTotal | undefined {
  if (!calendarQuarter(entry.periodFrom, entry.periodTo)) {
    return undefined;
  }
  const from = addMonths(entry.periodFrom, -12);
  const to = addDays(addMonths(from, 3), -1);
  const matches = entries.filter(
    (other) =>
      other.commodity === entry.commodity && other.periodFrom === from && other.periodTo === to,
  );
  return matches.length ? sumUsage(matches) : undefined;
}
