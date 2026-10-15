import { describe, expect, it } from 'vitest';
import { JournalEntry } from './journal';
import { journalCapex } from './investment-totals';

let nextId = 1;
function entry(overrides: Partial<JournalEntry>): JournalEntry {
  return {
    id: nextId++,
    date: '2026-03-10',
    kind: 'investment',
    title: 'Heat pump',
    costRappen: 1_800_000,
    contractor: null,
    notes: null,
    itemId: null,
    itemName: null,
    createdAt: '2026-03-10T08:00:00.000Z',
    updatedAt: '2026-03-10T08:00:00.000Z',
    ...overrides,
  };
}

const categories = new Map([
  [1, 'appliance' as const],
  [2, 'building-part' as const],
  [3, null],
]);

describe('journalCapex', () => {
  it('splits a year into spent and planned by today (R4)', () => {
    const figures = journalCapex(
      [entry({}), entry({ date: '2026-12-01', costRappen: 1_200_000 })],
      categories,
      '2026-10-15',
    );
    expect(figures.years).toEqual([
      {
        year: '2026',
        category: 'other',
        categoryLabel: 'Other',
        spentRappen: 1_800_000,
        plannedRappen: 1_200_000,
      },
    ]);
  });

  it('counts a planned entry as spent once its date has passed', () => {
    const planned = [entry({ date: '2028-02-15' })];
    expect(journalCapex(planned, categories, '2026-10-15').years[0].plannedRappen).toBe(1_800_000);
    expect(journalCapex(planned, categories, '2028-02-15').years[0].spentRappen).toBe(1_800_000);
  });

  it("groups by the linked item's category, unlinked and uncategorized as Other (R6)", () => {
    const figures = journalCapex(
      [
        entry({ itemId: 3 }),
        entry({ itemId: 2, costRappen: 500 }),
        entry({ itemId: 1, costRappen: 100 }),
        entry({ itemId: 99, costRappen: 1 }),
      ],
      categories,
      '2026-10-15',
    );
    expect(figures.years.map((row) => [row.categoryLabel, row.spentRappen])).toEqual([
      ['Appliance', 100],
      ['Building part', 500],
      ['Other', 1_800_001],
    ]);
  });

  it('ignores repairs and notes investments without cost', () => {
    const figures = journalCapex(
      [entry({ kind: 'repair' }), entry({ costRappen: null }), entry({ costRappen: null })],
      categories,
      '2026-10-15',
    );
    expect(figures).toEqual({ years: [], notes: ['2 investments without cost'] });
    expect(journalCapex([entry({ costRappen: null })], categories, '2026-10-15').notes).toEqual([
      '1 investment without cost',
    ]);
  });

  it('lists the rows by category, then year, so the legend follows the category order', () => {
    const figures = journalCapex(
      [entry({ date: '2024-05-01' }), entry({ itemId: 1, date: '2026-05-01' })],
      categories,
      '2026-10-15',
    );
    expect(figures.years.map((row) => [row.category, row.year])).toEqual([
      ['appliance', '2026'],
      ['other', '2024'],
    ]);
  });
});
