import { describe, expect, it } from 'vitest';
import { lastMonths, monthRange, mrcSummary, OpexCategory, opexChart } from './finance-totals';

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
