import { describe, expect, it } from 'vitest';
import { JournalEntry } from './journal';
import { itemRepairs, repairOpex } from './repair-costs';

let nextId = 1;
function repair(overrides: Partial<JournalEntry>): JournalEntry {
  return {
    id: nextId++,
    date: '2026-03-10',
    title: 'Boiler serviced',
    costRappen: 60_000,
    contractor: null,
    notes: null,
    itemId: null,
    itemName: null,
    createdAt: '2026-03-10T08:00:00.000Z',
    updatedAt: '2026-03-10T08:00:00.000Z',
    ...overrides,
  };
}

describe('repairOpex', () => {
  it('counts each repair in its month, CHF 0 in months without one, up to today (R5)', () => {
    const figures = repairOpex(
      [repair({}), repair({ date: '2026-05-20', costRappen: 180_000 })],
      '2026-06-15',
    );
    expect(figures.monthly).toEqual({
      '2026-03': 60_000,
      '2026-04': 0,
      '2026-05': 180_000,
      '2026-06': 0,
    });
    expect(figures.currentMonthlyRappen).toBe(0);
  });

  it("sums the current month's repairs as the cost this month", () => {
    const figures = repairOpex(
      [repair({ date: '2026-06-01' }), repair({ date: '2026-06-15', costRappen: 500 })],
      '2026-06-15',
    );
    expect(figures.currentMonthlyRappen).toBe(60_500);
  });

  it('leaves out repairs dated after today', () => {
    const figures = repairOpex([repair({ date: '2026-07-01' })], '2026-06-15');
    expect(figures).toEqual({ currentMonthlyRappen: 0, monthly: {}, notes: [] });
  });

  it('has no months without any repair cost, and notes repairs without cost', () => {
    expect(repairOpex([repair({ costRappen: null })], '2026-06-15')).toEqual({
      currentMonthlyRappen: 0,
      monthly: {},
      notes: ['1 repair without cost'],
    });
    expect(
      repairOpex(
        [repair({}), repair({ costRappen: null }), repair({ costRappen: null })],
        '2026-03-31',
      ).notes,
    ).toEqual(['2 repairs without cost']);
  });
});

describe('itemRepairs', () => {
  it("counts the item's repairs and sums their costs, without cost as 0", () => {
    const entries = [
      repair({ itemId: 4, costRappen: 30_000 }),
      repair({ itemId: 4, costRappen: null }),
      repair({ itemId: 9 }),
      repair({}),
    ];
    expect(itemRepairs(entries, 4)).toEqual({ count: 2, totalRappen: 30_000 });
    expect(itemRepairs(entries, 5)).toEqual({ count: 0, totalRappen: 0 });
  });
});
