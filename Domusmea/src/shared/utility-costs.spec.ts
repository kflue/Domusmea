import { describe, expect, it } from 'vitest';
import { UtilityEntry } from './utility';
import {
  calendarQuarter,
  entriesOf,
  lastTwelveBilledMonths,
  monthsOf,
  nextBillingPeriod,
  overlappingEntries,
  paidRappen,
  percentChange,
  quarterOf,
  rappenPerUnit,
  sameQuarterYearBefore,
  totalRappen,
  utilityOpex,
  yearOverYear,
  yearTotals,
} from './utility-costs';

let nextId = 1;
function entry(overrides: Partial<UtilityEntry>): UtilityEntry {
  return {
    id: nextId++,
    billId: 1,
    commodity: 'electricity',
    periodFrom: '2026-04-01',
    periodTo: '2026-06-30',
    amountMilli: 1_000_000,
    costRappen: 28_700,
    fixedFeeRappen: 1_500,
    invoiceNumber: null,
    notes: null,
    createdAt: '2026-07-10T08:00:00.000Z',
    updatedAt: '2026-07-10T08:00:00.000Z',
    ...overrides,
  };
}

describe('totalRappen and rappenPerUnit', () => {
  it('adds the fixed fee to the total but leaves it out of the price per unit', () => {
    const e = entry({});
    expect(totalRappen(e)).toBe(30_200);
    expect(rappenPerUnit(e.costRappen, e.amountMilli)).toBeCloseTo(28.7);
  });

  it('has no price per unit without an amount', () => {
    expect(rappenPerUnit(1_000, 0)).toBeUndefined();
    expect(rappenPerUnit(1_000, null)).toBeUndefined();
  });
});

describe('calendarQuarter', () => {
  it('names exact calendar quarters only', () => {
    expect(calendarQuarter('2026-01-01', '2026-03-31')).toBe('Q1 2026');
    expect(calendarQuarter('2026-10-01', '2026-12-31')).toBe('Q4 2026');
    expect(calendarQuarter('2026-02-01', '2026-04-30')).toBeUndefined();
    expect(calendarQuarter('2026-04-01', '2026-06-29')).toBeUndefined();
    expect(calendarQuarter('2026-04-15', '2026-06-30')).toBeUndefined();
  });
});

describe('yearTotals', () => {
  it('groups by the year of the end date, newest first, and sums each year', () => {
    const entries = [
      entry({ periodFrom: '2025-12-01', periodTo: '2026-02-28', amountMilli: 500, costRappen: 10 }),
      entry({ periodFrom: '2025-07-01', periodTo: '2025-09-30', amountMilli: 250, costRappen: -5 }),
      entry({
        periodFrom: '2026-04-01',
        periodTo: '2026-06-30',
        amountMilli: 1_500,
        costRappen: 20,
      }),
      entry({ commodity: 'water', periodTo: '2024-06-30' }),
    ];
    const totals = yearTotals(entries, 'electricity');
    expect(totals.map((total) => total.year)).toEqual(['2026', '2025']);
    expect(totals[0]).toMatchObject({
      amountMilli: 2_000,
      costRappen: 30,
      fixedFeeRappen: 3_000,
      totalRappen: 3_030,
    });
    expect(totals[0].entries.map((e) => e.periodTo)).toEqual(['2026-06-30', '2026-02-28']);
    expect(totals[1]).toMatchObject({ amountMilli: 250, totalRappen: 1_495 });
  });

  it('has no amount total for garbage', () => {
    const garbage = entry({ commodity: 'garbage', amountMilli: null, costRappen: 0 });
    expect(yearTotals([garbage], 'garbage')[0]).toMatchObject({
      amountMilli: null,
      totalRappen: 1_500,
    });
  });
});

describe('entriesOf', () => {
  it('returns the commodity newest first', () => {
    const old = entry({ periodFrom: '2026-01-01', periodTo: '2026-03-31' });
    const recent = entry({});
    expect(entriesOf([old, entry({ commodity: 'water' }), recent], 'electricity')).toEqual([
      recent,
      old,
    ]);
  });
});

describe('overlappingEntries', () => {
  const q2 = entry({ id: 100 });

  it('finds entries of the same commodity sharing a day', () => {
    expect(overlappingEntries([q2], 'electricity', '2026-06-30', '2026-09-30')).toEqual([q2]);
    expect(overlappingEntries([q2], 'electricity', '2026-03-01', '2026-04-01')).toEqual([q2]);
    expect(overlappingEntries([q2], 'electricity', '2026-07-01', '2026-09-30')).toEqual([]);
    expect(overlappingEntries([q2], 'water', '2026-04-01', '2026-06-30')).toEqual([]);
  });

  it('ignores the entry being edited', () => {
    expect(overlappingEntries([q2], 'electricity', '2026-04-01', '2026-06-30', 100)).toEqual([]);
  });
});

describe('nextBillingPeriod', () => {
  it('proposes the three months after the latest entry', () => {
    const entries = [entry({}), entry({ periodFrom: '2026-01-01', periodTo: '2026-03-31' })];
    expect(nextBillingPeriod(entries, '2026-10-15')).toEqual({
      from: '2026-07-01',
      to: '2026-09-30',
    });
    expect(nextBillingPeriod([entry({ periodTo: '2026-12-31' })], '2027-02-01')).toEqual({
      from: '2027-01-01',
      to: '2027-03-31',
    });
  });

  it('proposes the last full quarter before today without entries', () => {
    expect(nextBillingPeriod([], '2026-10-15')).toEqual({ from: '2026-07-01', to: '2026-09-30' });
    expect(nextBillingPeriod([], '2026-01-01')).toEqual({ from: '2025-10-01', to: '2025-12-31' });
  });
});

describe('monthsOf and paidRappen', () => {
  it('lists the calendar months a period touches', () => {
    expect(monthsOf('2026-04-01', '2026-06-30')).toEqual(['2026-04', '2026-05', '2026-06']);
    expect(monthsOf('2025-12-15', '2026-01-10')).toEqual(['2025-12', '2026-01']);
    expect(monthsOf('2026-02-01', '2026-02-28')).toEqual(['2026-02']);
  });

  it('spreads each bill evenly over its months and rounds once', () => {
    // CHF 302.00 and CHF 100.00 per quarter, i.e. 100.666… and 33.333… per month.
    const entries = [
      entry({ periodFrom: '2026-04-01', periodTo: '2026-06-30' }),
      entry({ commodity: 'garbage', amountMilli: null, costRappen: 0, fixedFeeRappen: 10_000 }),
    ];
    expect(paidRappen(entries, '2026-05-01', '2026-05-31')).toBe(13_400);
    expect(paidRappen(entries, '2026-04-01', '2026-06-30')).toBe(40_200);
    // Whole months: any day of a month selects it.
    expect(paidRappen(entries, '2026-06-30', '2026-12-01')).toBe(13_400);
    expect(paidRappen(entries, '2026-07-01', '2026-12-31')).toBe(0);
  });

  it('subtracts credits', () => {
    const credit = entry({ costRappen: -3_000, fixedFeeRappen: 0, periodTo: '2026-04-30' });
    expect(paidRappen([credit], '2026-01-01', '2026-12-31')).toBe(-3_000);
  });
});

describe('lastTwelveBilledMonths', () => {
  it('ends with the last billed month', () => {
    expect(lastTwelveBilledMonths([entry({ periodTo: '2026-09-30' }), entry({})])).toEqual({
      from: '2025-10-01',
      to: '2026-09-30',
    });
    expect(lastTwelveBilledMonths([entry({ periodTo: '2026-02-14' })])).toEqual({
      from: '2025-03-01',
      to: '2026-02-28',
    });
    expect(lastTwelveBilledMonths([])).toBeUndefined();
  });
});

describe('percentChange and quarterOf', () => {
  it('computes the change against a positive or negative base', () => {
    expect(percentChange(110, 100)).toBeCloseTo(10);
    expect(percentChange(-50, -100)).toBeCloseTo(50);
    expect(percentChange(5, 0)).toBeUndefined();
  });

  it('assigns the quarter of the end date', () => {
    expect(quarterOf({ periodTo: '2026-03-31' })).toBe(1);
    expect(quarterOf({ periodTo: '2026-12-31' })).toBe(4);
  });
});

describe('yearOverYear', () => {
  const quarter = (year: number, q: number, amountMilli: number, costRappen: number) => {
    const from = `${year}-${String(q * 3 - 2).padStart(2, '0')}-01`;
    const to = { 1: '03-31', 2: '06-30', 3: '09-30', 4: '12-31' }[q];
    return entry({
      periodFrom: from,
      periodTo: `${year}-${to}`,
      amountMilli,
      costRappen,
      fixedFeeRappen: 0,
    });
  };

  it('compares a year with the same quarters of the year before', () => {
    const entries = [
      quarter(2025, 1, 1_000_000, 30_000),
      quarter(2025, 2, 800_000, 24_000),
      quarter(2025, 4, 1_200_000, 36_000),
      quarter(2026, 1, 1_100_000, 33_000),
      quarter(2026, 2, 900_000, 30_000),
    ];
    const [y2026, y2025] = yearOverYear(entries, 'electricity');
    expect(y2026).toMatchObject({
      year: '2026',
      quarters: [1, 2],
      amountMilli: 2_000_000,
      totalRappen: 63_000,
      previous: { amountMilli: 1_800_000, totalRappen: 54_000 },
    });
    expect(y2026.amountChange).toBeCloseTo(11.111);
    expect(y2026.costChange).toBeCloseTo(16.667);
    expect(y2025).toMatchObject({ year: '2025', quarters: [1, 2, 4], previous: undefined });
    expect(y2025.costChange).toBeUndefined();
  });

  it('has no comparison when a quarter is missing a year earlier', () => {
    const entries = [
      quarter(2025, 1, 1_000, 100),
      quarter(2026, 1, 1_000, 100),
      quarter(2026, 2, 1_000, 100),
    ];
    expect(yearOverYear(entries, 'electricity')[0]).toMatchObject({
      previous: undefined,
      amountChange: undefined,
    });
  });

  it('compares garbage by cost only', () => {
    const garbage = (to: string, fee: number) =>
      entry({
        commodity: 'garbage',
        periodFrom: `${to.slice(0, 4)}-01-01`,
        periodTo: to,
        amountMilli: null,
        costRappen: 0,
        fixedFeeRappen: fee,
      });
    const [y2026] = yearOverYear(
      [garbage('2025-03-31', 4_000), garbage('2026-03-31', 4_500)],
      'garbage',
    );
    expect(y2026.amountChange).toBeUndefined();
    expect(y2026.costChange).toBeCloseTo(12.5);
  });
});

describe('sameQuarterYearBefore', () => {
  it('finds the same calendar quarter a year earlier', () => {
    const q2 = entry({});
    const earlier = entry({
      periodFrom: '2025-04-01',
      periodTo: '2025-06-30',
      amountMilli: 900_000,
    });
    expect(
      sameQuarterYearBefore(
        [
          q2,
          earlier,
          entry({ commodity: 'water', periodFrom: '2025-04-01', periodTo: '2025-06-30' }),
        ],
        q2,
      ),
    ).toEqual({
      amountMilli: 900_000,
      totalRappen: 30_200,
    });
    expect(sameQuarterYearBefore([q2], q2)).toBeUndefined();
  });

  it('has none for an irregular period', () => {
    const irregular = entry({ periodFrom: '2026-04-15', periodTo: '2026-06-30' });
    expect(
      sameQuarterYearBefore(
        [irregular, entry({ periodFrom: '2025-04-15', periodTo: '2025-06-30' })],
        irregular,
      ),
    ).toBeUndefined();
  });
});

describe('utilityOpex', () => {
  it('returns the last twelve billed months ÷ 12 and a value per billed month (R2, R3)', () => {
    const entries = [
      entry({
        periodFrom: '2025-10-01',
        periodTo: '2025-12-31',
        costRappen: 58_500,
        fixedFeeRappen: 1_500,
      }),
      entry({
        periodFrom: '2026-01-01',
        periodTo: '2026-03-31',
        costRappen: 58_500,
        fixedFeeRappen: 1_500,
      }),
      entry({
        periodFrom: '2026-04-01',
        periodTo: '2026-06-30',
        costRappen: 58_500,
        fixedFeeRappen: 1_500,
      }),
      entry({
        periodFrom: '2026-07-01',
        periodTo: '2026-09-30',
        costRappen: 58_500,
        fixedFeeRappen: 1_500,
      }),
    ];
    const opex = utilityOpex(entries);
    expect(opex.currentMonthlyRappen).toBe(20_000);
    expect(Object.keys(opex.monthly)).toHaveLength(12);
    expect(opex.monthly['2025-10']).toBe(20_000);
    expect(opex.monthly['2026-09']).toBe(20_000);
    // Not billed yet: no value rather than 0.
    expect(opex.monthly['2026-10']).toBeUndefined();
  });

  it('is empty without bills', () => {
    expect(utilityOpex([])).toEqual({ currentMonthlyRappen: 0, monthly: {} });
  });
});
