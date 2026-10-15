import { addMonths } from './calendar';

/**
 * Figures of the finance dashboard (ADR 0013). Each cost category is a source that returns these
 * plain figures; the dashboard only combines them. Months are `YYYY-MM`, money integer Rappen.
 */

/** Figures of an opex source: a running cost such as subscriptions or utilities. */
export interface OpexFigures {
  /** Cost per month as of today, unrounded, so the total over all sources is rounded once (R2). */
  currentMonthlyRappen: number;
  /** Cost per calendar month; a month without a key is not covered by the source (a gap, R3). */
  monthly: Readonly<Record<string, number>>;
}

/** An opex source's figures with the name shown in the legend, the KPI and the table. */
export interface OpexCategory {
  id: string;
  label: string;
  figures: OpexFigures;
}

/** The `count` calendar months up to and including the month of `today`, oldest first. */
export function lastMonths(today: string, count: number): string[] {
  const current = `${today.slice(0, 7)}-01`;
  return Array.from({ length: count }, (_, i) => addMonths(current, i - count + 1).slice(0, 7));
}

/** Calendar months `YYYY-MM` from `first` to `last` (both `YYYY-MM`), inclusive. */
export function monthRange(first: string, last: string): string[] {
  const months: string[] = [];
  for (let month = `${first}-01`; month.slice(0, 7) <= last; month = addMonths(month, 1)) {
    months.push(month.slice(0, 7));
  }
  return months;
}

/** The monthly recurring cost (MRC) tile: the total and each category with its share. */
export interface MrcSummary {
  totalRappen: number;
  categories: {
    id: string;
    label: string;
    rappen: number;
    /** 0–1 of the total. */
    share: number;
  }[];
}

/** Current monthly cost per category; the total is the sum of the exact amounts, rounded once. */
export function mrcSummary(categories: readonly OpexCategory[]): MrcSummary {
  const exact = categories.reduce((sum, c) => sum + c.figures.currentMonthlyRappen, 0);
  return {
    totalRappen: Math.round(exact),
    categories: categories.map((category) => ({
      id: category.id,
      label: category.label,
      rappen: Math.round(category.figures.currentMonthlyRappen),
      share: exact === 0 ? 0 : category.figures.currentMonthlyRappen / exact,
    })),
  };
}

/** One line of a chart: a value per period, `null` where there is no point (a gap). */
export interface Series {
  id: string;
  label: string;
  values: (number | null)[];
}

/** The MRC chart (R3): a line per category that has a value in `months`, and the total. */
export interface OpexChart {
  months: string[];
  categories: Series[];
  /** Only for months every drawn category covers, so a missing bill never looks like a drop. */
  total: (number | null)[];
}

export function opexChart(
  categories: readonly OpexCategory[],
  months: readonly string[],
): OpexChart {
  const drawn = categories
    .map((category): Series => ({
      id: category.id,
      label: category.label,
      values: months.map((month) => category.figures.monthly[month] ?? null),
    }))
    .filter((series) => series.values.some((value) => value !== null));
  const total = months.map((_, i) => {
    const values = drawn.map((series) => series.values[i]);
    return values.length > 0 && values.every((value) => value !== null)
      ? values.reduce((sum, value) => sum + (value ?? 0), 0)
      : null;
  });
  return { months: [...months], categories: drawn, total };
}

/** Investments of one capex category in one calendar year, split by today's date (R4). */
export interface CapexYear {
  /** `YYYY`. */
  year: string;
  /** Category key, unique within its source, e.g. `appliance`. */
  category: string;
  categoryLabel: string;
  /** Dated up to today. */
  spentRappen: number;
  /** Dated after today. */
  plannedRappen: number;
}

/** Figures of a capex source: investments per year and category (R4–R6). */
export interface CapexFigures {
  /** One row per category and year that has investments; categories in legend order. */
  years: CapexYear[];
  /** Remarks shown under the tile, e.g. `3 investments without cost`. */
  notes: string[];
}

/** The investments tile (R4). */
export interface CapexSummary {
  /** The current year, `YYYY`. */
  year: string;
  spentRappen: number;
  plannedRappen: number;
  /** Planned in the five years after the current one. */
  nextYears: { from: string; to: string; plannedRappen: number };
}

/** Number of years after the current one that the tile sums up. */
export const PLANNED_YEARS = 5;

export function capexSummary(rows: readonly CapexYear[], today: string): CapexSummary {
  const year = Number(today.slice(0, 4));
  const sum = (filter: (row: CapexYear) => boolean, amount: (row: CapexYear) => number) =>
    rows.filter(filter).reduce((total, row) => total + amount(row), 0);
  const isCurrent = (row: CapexYear) => Number(row.year) === year;
  const isNext = (row: CapexYear) =>
    Number(row.year) > year && Number(row.year) <= year + PLANNED_YEARS;
  return {
    year: String(year),
    spentRappen: sum(isCurrent, (row) => row.spentRappen),
    plannedRappen: sum(isCurrent, (row) => row.plannedRappen),
    nextYears: {
      from: String(year + 1),
      to: String(year + PLANNED_YEARS),
      plannedRappen: sum(isNext, (row) => row.spentRappen + row.plannedRappen),
    },
  };
}

/** A capex line: spent plus planned per year, with the two parts for the tooltip. */
export interface CapexSeries extends Series {
  values: number[];
  spent: number[];
  planned: number[];
}

/** The investments chart (R5). */
export interface CapexChart {
  years: string[];
  categories: CapexSeries[];
  total: CapexSeries;
  /** Index of the first future year; from there on the lines are drawn as planned. */
  plannedFrom: number;
  /** Index of the current year, which holds both spent and planned amounts. */
  currentIndex: number;
}

/** Years shown before the current one at most (R5). */
export const MAX_PAST_YEARS = 10;

/**
 * Investments per year and category from the first year with an investment (at most
 * {@link MAX_PAST_YEARS} back) to the last planned year, at least up to the current year. A year
 * without investments in a category is a real 0, not a gap.
 */
export function capexChart(rows: readonly CapexYear[], today: string): CapexChart {
  const current = Number(today.slice(0, 4));
  const numbers = rows.map((row) => Number(row.year));
  const first = Math.max(Math.min(current, ...numbers), current - MAX_PAST_YEARS);
  const last = Math.max(current, ...numbers);
  const years = Array.from({ length: last - first + 1 }, (_, i) => String(first + i));
  const series = (id: string, label: string, match: (row: CapexYear) => boolean): CapexSeries => {
    const part = (amount: (row: CapexYear) => number) =>
      years.map((year) =>
        rows
          .filter((row) => row.year === year && match(row))
          .reduce((sum, row) => sum + amount(row), 0),
      );
    const spent = part((row) => row.spentRappen);
    const planned = part((row) => row.plannedRappen);
    return { id, label, spent, planned, values: spent.map((value, i) => value + planned[i]) };
  };
  const categories = [...new Map(rows.map((row) => [row.category, row.categoryLabel]))].map(
    ([category, label]) => series(category, label, (row) => row.category === category),
  );
  return {
    years,
    categories,
    total: series('total', 'Total', () => true),
    plannedFrom: current + 1 - first,
    currentIndex: current - first,
  };
}
