import { beforeEach, describe, expect, it } from 'vitest';
import { ItemInput } from '../../shared/item';
import { openDatabase } from '../db';
import { ItemRepository } from './item-repository';
import { testClock } from './test-clock';

const emptyInput: ItemInput = {
  name: 'Dishwasher',
  category: null,
  purchaseDate: null,
  costRappen: null,
  warrantyExpires: null,
  manufacturer: null,
  model: null,
  serialNumber: null,
  seller: null,
};

describe('ItemRepository', () => {
  let clock: ReturnType<typeof testClock>;
  let repository: ItemRepository;

  beforeEach(() => {
    clock = testClock('2026-10-10');
    repository = new ItemRepository(openDatabase(':memory:'), clock);
  });

  it('creates, reads, updates and deletes items', () => {
    const created = repository.create({
      ...emptyInput,
      category: 'appliance',
      costRappen: 129900,
      seller: 'Fust',
    });
    expect(created).toMatchObject({
      id: 1,
      name: 'Dishwasher',
      costRappen: 129900,
      seller: 'Fust',
    });
    expect(created.createdAt).toBe('2026-10-10T08:00:00.000Z');

    const updated = repository.update(created.id, { ...emptyInput, name: 'Heat pump' });
    expect(updated).toMatchObject({ id: 1, name: 'Heat pump', category: null, seller: null });

    expect(repository.delete(created.id)).toBe(true);
    expect(repository.get(created.id)).toBeUndefined();
    expect(repository.update(created.id, emptyInput)).toBeUndefined();
    expect(repository.delete(created.id)).toBe(false);
  });

  it('lists items by warranty expiry, items without warranty last', () => {
    repository.create({ ...emptyInput, name: 'Roof' });
    repository.create({ ...emptyInput, name: 'Oven', warrantyExpires: '2027-05-01' });
    repository.create({ ...emptyInput, name: 'Boiler', warrantyExpires: '2026-12-01' });

    expect(repository.list().map((item) => item.name)).toEqual(['Boiler', 'Oven', 'Roof']);
  });

  describe('warranty notification state', () => {
    it('reports an item once its warranty expires, until marked', () => {
      const item = repository.create({ ...emptyInput, warrantyExpires: '2026-10-12' });
      expect(repository.findWarrantyExpiredUnnotified('2026-10-11')).toEqual([]);

      expect(repository.findWarrantyExpiredUnnotified('2026-10-12')).toEqual([item]);
      repository.markWarrantyNotified([item.id], '2026-10-12');
      expect(repository.findWarrantyExpiredUnnotified('2026-10-13')).toEqual([]);
    });

    it('never reports items saved with an already expired warranty', () => {
      repository.create({ ...emptyInput, warrantyExpires: '2026-10-10' });
      const later = repository.create({ ...emptyInput, warrantyExpires: '2026-11-01' });
      repository.update(later.id, { ...emptyInput, warrantyExpires: '2025-01-01' });

      expect(repository.findWarrantyExpiredUnnotified('2027-01-01')).toEqual([]);
    });

    it('reports an item again when its expiry date is moved into the future', () => {
      const item = repository.create({ ...emptyInput, warrantyExpires: '2026-10-11' });
      clock.set('2026-10-11');
      repository.markWarrantyNotified([item.id], '2026-10-11');

      repository.update(item.id, { ...emptyInput, warrantyExpires: '2028-10-11' });

      expect(repository.findWarrantyExpiredUnnotified('2028-10-11')).toHaveLength(1);
    });

    it('keeps the state when the expiry date is unchanged', () => {
      const item = repository.create({ ...emptyInput, warrantyExpires: '2026-10-11' });
      repository.markWarrantyNotified([item.id], '2026-10-11');

      repository.update(item.id, { ...emptyInput, name: 'Renamed', warrantyExpires: '2026-10-11' });

      expect(repository.findWarrantyExpiredUnnotified('2026-12-31')).toEqual([]);
    });

    it('does not mark items whose expiry date moved past the check date', () => {
      const item = repository.create({ ...emptyInput, warrantyExpires: '2026-10-11' });
      repository.update(item.id, { ...emptyInput, warrantyExpires: '2026-12-01' });

      repository.markWarrantyNotified([item.id], '2026-10-11');

      expect(repository.findWarrantyExpiredUnnotified('2026-12-01')).toHaveLength(1);
    });
  });
});
