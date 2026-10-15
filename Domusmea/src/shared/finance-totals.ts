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
    /** 0–1 of the total. */ share: number;
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
