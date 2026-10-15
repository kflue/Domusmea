import { describe, expect, it } from 'vitest';
import {
  capexChart,
  capexSummary,
  CapexYear,
  lastMonths,
  monthRange,
  mrcSummary,
  OpexCategory,
  opexChart,
} from './finance-totals';

const category = (
  id: string,
  currentMonthlyRappen: number,
  monthly: Record<string, number> = {},
): OpexCategory => ({ id, label: id, figures: { currentMonthlyRappen, monthly } });

describe('lastMonths and monthRange', () => {
  it('lists the months up to the current one, oldest first', () => {
    expect(lastMonths('2026-02-15', 3)).toEqual(['2025-12', '2026-01', '2026-02']);
    expect(lastMonths('2026-10-15', 24)).toHaveLength(24);
    expect(lastMonths('2026-10-15', 24)[0]).toBe('2024-11');
  });

  it('lists the months between two months, inclusive', () => {
    expect(monthRange('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
    expect(monthRange('2026-03', '2026-03')).toEqual(['2026-03']);
    expect(monthRange('2026-04', '2026-03')).toEqual([]);
  });
});

describe('mrcSummary', () => {
  it('sums the exact category amounts and rounds once (R2)', () => {
    const summary = mrcSummary([
      category('subscriptions', 8_500),
      category('utilities', 240_000 / 12),
    ]);
    expect(summary.totalRappen).toBe(28_500);
    expect(summary.categories).toEqual([
      { id: 'subscriptions', label: 'subscriptions', rappen: 8_500, share: 8_500 / 28_500 },
      { id: 'utilities', label: 'utilities', rappen: 20_000, share: 20_000 / 28_500 },
    ]);
    // 0.4 + 0.4 + 0.4 rounds to 1, not to 0 + 0 + 0.
    expect(
      mrcSummary([category('a', 0.4), category('b', 0.4), category('c', 0.4)]).totalRappen,
    ).toBe(1);
  });

  it('has no shares without costs', () => {
    expect(mrcSummary([category('a', 0)]).categories[0].share).toBe(0);
    expect(mrcSummary([]).totalRappen).toBe(0);
  });
});

describe('opexChart', () => {
  const months = ['2026-08', '2026-09', '2026-10'];

  it('leaves gaps for months a source does not cover and draws the total only where all do (R3)', () => {
    const chart = opexChart(
      [
        category('subscriptions', 0, { '2026-08': 8_500, '2026-09': 8_500, '2026-10': 9_000 }),
        category('utilities', 0, { '2026-08': 20_000, '2026-09': 21_000 }),
      ],
      months,
    );
    expect(chart.categories.map((series) => series.values)).toEqual([
      [8_500, 8_500, 9_000],
      [20_000, 21_000, null],
    ]);
    expect(chart.total).toEqual([28_500, 29_500, null]);
  });

  it('leaves out sources without any value in the range', () => {
    const chart = opexChart(
      [
        category('subscriptions', 0, { '2026-10': 1_000 }),
        category('utilities', 0, { '2023-01': 5 }),
      ],
      months,
    );
    expect(chart.categories.map((series) => series.id)).toEqual(['subscriptions']);
    expect(chart.total).toEqual([null, null, 1_000]);
    expect(opexChart([], months).total).toEqual([null, null, null]);
  });
});

const capex = (
  year: string,
  category: string,
  spentRappen: number,
  plannedRappen = 0,
): CapexYear => ({ year, category, categoryLabel: category, spentRappen, plannedRappen });

describe('capexSummary', () => {
  it('splits the current year into spent and planned and sums the next five years (R4)', () => {
    const summary = capexSummary(
      [
        capex('2025', 'a', 500_000),
        capex('2026', 'a', 1_800_000, 1_200_000),
        capex('2027', 'b', 0, 300_000),
        capex('2031', 'a', 0, 100_000),
        capex('2032', 'a', 0, 999_999),
      ],
      '2026-10-15',
    );
    expect(summary).toEqual({
      year: '2026',
      spentRappen: 1_800_000,
      plannedRappen: 1_200_000,
      nextYears: { from: '2027', to: '2031', plannedRappen: 400_000 },
    });
  });
});

describe('capexChart', () => {
  it('runs from the first investment to the last planned year, missing years as 0 (R5)', () => {
    const chart = capexChart(
      [capex('2024', 'a', 100), capex('2026', 'b', 200, 300), capex('2028', 'a', 0, 400)],
      '2026-10-15',
    );
    expect(chart.years).toEqual(['2024', '2025', '2026', '2027', '2028']);
    expect(chart.categories.map((s) => [s.id, s.values])).toEqual([
      ['a', [100, 0, 0, 0, 400]],
      ['b', [0, 0, 500, 0, 0]],
    ]);
    expect(chart.total.values).toEqual([100, 0, 500, 0, 400]);
    expect(chart.total.spent[2]).toBe(200);
    expect(chart.total.planned[2]).toBe(300);
    expect(chart.currentIndex).toBe(2);
    expect(chart.plannedFrom).toBe(3);
  });

  it('shows at most ten past years and always the current year', () => {
    const chart = capexChart([capex('2001', 'a', 100), capex('2020', 'a', 100)], '2026-10-15');
    expect(chart.years[0]).toBe('2016');
    expect(chart.years.at(-1)).toBe('2026');
    expect(chart.plannedFrom).toBe(chart.years.length);
    expect(capexChart([], '2026-10-15').years).toEqual(['2026']);
  });
});
