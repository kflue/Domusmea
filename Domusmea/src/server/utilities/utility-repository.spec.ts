import { beforeEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { UtilityBillInput } from '../../shared/utility';
import { openDatabase } from '../db';
import { testClock } from '../items/test-clock';
import { UtilityRepository } from './utility-repository';

const q2: UtilityBillInput = {
  periodFrom: '2026-04-01',
  periodTo: '2026-06-30',
  invoiceNumber: '2026-0815',
  notes: null,
  lines: [
    { commodity: 'electricity', amountMilli: 812_500, costRappen: 23_319, fixedFeeRappen: 1_500 },
    { commodity: 'garbage', amountMilli: null, costRappen: 0, fixedFeeRappen: 4_500 },
  ],
};

describe('UtilityRepository', () => {
  let db: DatabaseSync;
  let repository: UtilityRepository;

  beforeEach(() => {
    db = openDatabase(':memory:');
    repository = new UtilityRepository(db, testClock('2026-10-15').now);
  });

  it('stores each line of a bill as an entry and reads it back', () => {
    const created = repository.createBill(q2);
    expect(created).toEqual([
      {
        id: 1,
        billId: 1,
        commodity: 'electricity',
        periodFrom: '2026-04-01',
        periodTo: '2026-06-30',
        amountMilli: 812_500,
        costRappen: 23_319,
        fixedFeeRappen: 1_500,
        invoiceNumber: '2026-0815',
        notes: null,
        createdAt: '2026-10-15T08:00:00.000Z',
        updatedAt: '2026-10-15T08:00:00.000Z',
      },
      expect.objectContaining({ id: 2, commodity: 'garbage', amountMilli: null }),
    ]);
    expect(repository.get(2)).toEqual(created[1]);
  });

  it('lists entries with the newest period first', () => {
    repository.createBill(q2);
    repository.createBill({ ...q2, periodFrom: '2026-07-01', periodTo: '2026-09-30' });
    repository.createBill({ ...q2, periodFrom: '2026-01-01', periodTo: '2026-03-31' });
    expect(repository.list().map((entry) => `${entry.periodTo} ${entry.id}`)).toEqual([
      '2026-09-30 4',
      '2026-09-30 3',
      '2026-06-30 2',
      '2026-06-30 1',
      '2026-03-31 6',
      '2026-03-31 5',
    ]);
  });

  it('updates and deletes single entries', () => {
    const [electricity] = repository.createBill(q2);
    const updated = repository.update(electricity.id, {
      commodity: 'electricity',
      periodFrom: '2026-04-01',
      periodTo: '2026-06-30',
      amountMilli: 800_000,
      costRappen: -1_000,
      fixedFeeRappen: 0,
      invoiceNumber: '2026-0815b',
      notes: 'Corrected meter reading',
    });
    expect(updated).toMatchObject({ amountMilli: 800_000, costRappen: -1_000, fixedFeeRappen: 0 });
    // Invoice number and notes belong to the bill, so the garbage entry shows them too.
    expect(repository.get(2)).toMatchObject({
      invoiceNumber: '2026-0815b',
      notes: 'Corrected meter reading',
    });

    expect(repository.delete(electricity.id)).toBe(true);
    expect(repository.get(electricity.id)).toBeUndefined();
    expect(
      repository.update(electricity.id, { ...q2.lines[0], ...q2, invoiceNumber: null }),
    ).toBeUndefined();
    expect(repository.delete(electricity.id)).toBe(false);
    expect(repository.list()).toHaveLength(1);
    expect(db.prepare('SELECT COUNT(*) AS n FROM utility_bills').get()).toEqual({ n: 1 });
    expect(repository.delete(2)).toBe(true);
    expect(db.prepare('SELECT COUNT(*) AS n FROM utility_bills').get()).toEqual({ n: 0 });
  });

  it('keeps the invoice number and notes when an update leaves them out', () => {
    const [electricity] = repository.createBill({ ...q2, notes: 'Filed in the energy folder' });
    const { invoiceNumber: _, notes: __, ...figures } = { ...electricity, ...q2.lines[0] };
    const updated = repository.update(electricity.id, {
      ...figures,
      periodFrom: electricity.periodFrom,
      periodTo: electricity.periodTo,
      notes: undefined,
    });
    expect(updated).toMatchObject({
      invoiceNumber: '2026-0815',
      notes: 'Filed in the energy folder',
    });
    expect(repository.update(electricity.id, { ...figures, notes: null })).toMatchObject({
      invoiceNumber: '2026-0815',
      notes: null,
    });
  });

  it('never changes the commodity of an entry', () => {
    const [electricity] = repository.createBill(q2);
    const water = { ...q2, ...q2.lines[0], commodity: 'water' as const };
    expect(repository.update(electricity.id, water)).toBeUndefined();
    expect(repository.get(electricity.id)?.commodity).toBe('electricity');
  });

  it('groups the entries of one bill', () => {
    repository.createBill(q2);
    repository.createBill({ ...q2, periodFrom: '2026-07-01', periodTo: '2026-09-30' });
    expect(repository.list().map((entry) => entry.billId)).toEqual([2, 2, 1, 1]);
  });

  it('stores nothing of a bill when one line is rejected by the database', () => {
    expect(() =>
      repository.createBill({
        ...q2,
        lines: [q2.lines[0], { ...q2.lines[1], fixedFeeRappen: 100_000_001 }],
      }),
    ).toThrow();
    expect(repository.list()).toEqual([]);
    expect(db.prepare('SELECT COUNT(*) AS n FROM utility_bills').get()).toEqual({ n: 0 });
  });

  it('rejects a period that ends before it starts', () => {
    expect(() =>
      repository.createBill({ ...q2, periodFrom: '2026-07-01', periodTo: '2026-06-30' }),
    ).toThrow();
    expect(db.prepare('SELECT COUNT(*) AS n FROM utility_entries').get()).toEqual({ n: 0 });
  });
});
