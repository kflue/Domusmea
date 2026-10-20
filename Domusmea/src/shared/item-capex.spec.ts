import { describe, expect, it } from 'vitest';
import { Item } from './item';
import { itemCapex } from './item-capex';

let nextId = 1;
function item(overrides: Partial<Item>): Item {
  return {
    id: nextId++,
    name: 'Heat pump',
    category: 'building-part',
    purchaseDate: '2026-03-10',
    costRappen: 1_200_000,
    warrantyExpires: null,
    manufacturer: null,
    model: null,
    serialNumber: null,
    seller: null,
    createdAt: '2026-03-10T08:00:00.000Z',
    updatedAt: '2026-03-10T08:00:00.000Z',
    ...overrides,
  };
}

describe('itemCapex', () => {
  it('counts an item as spent in its purchase year (R3)', () => {
    expect(itemCapex([item({})], '2026-10-15').years).toEqual([
      {
        year: '2026',
        category: 'building-part',
        categoryLabel: 'Building part',
        spentRappen: 1_200_000,
        plannedRappen: 0,
      },
    ]);
  });

  it('counts an item bought after today as planned, and as spent once the date has passed', () => {
    const dishwasher = [item({ category: 'appliance', purchaseDate: '2027-04-01' })];
    expect(itemCapex(dishwasher, '2026-10-15').years[0]).toMatchObject({
      year: '2027',
      spentRappen: 0,
      plannedRappen: 1_200_000,
    });
    expect(itemCapex(dishwasher, '2027-04-01').years[0].spentRappen).toBe(1_200_000);
  });

  it('groups by category, uncategorized items as Other, in category order', () => {
    const figures = itemCapex(
      [
        item({ category: null, purchaseDate: '2024-05-01', costRappen: 1 }),
        item({ costRappen: 500 }),
        item({ category: 'appliance', costRappen: 100 }),
        item({ category: 'appliance', costRappen: 50 }),
      ],
      '2026-10-15',
    );
    expect(figures.years.map((row) => [row.categoryLabel, row.year, row.spentRappen])).toEqual([
      ['Appliance', '2026', 150],
      ['Building part', '2026', 500],
      ['Other', '2024', 1],
    ]);
  });

  it('leaves out items without cost and notes them', () => {
    expect(
      itemCapex([item({ costRappen: null }), item({ costRappen: null })], '2026-10-15'),
    ).toEqual({ years: [], notes: ['2 items without cost'] });
    expect(itemCapex([item({ costRappen: null })], '2026-10-15').notes).toEqual([
      '1 item without cost',
    ]);
  });
});
