import { beforeEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { JournalEntryInput } from '../../shared/journal';
import { openDatabase } from '../db';
import { ItemRepository } from '../items/item-repository';
import { testClock } from '../items/test-clock';
import { JournalRepository } from './journal-repository';

const emptyInput: JournalEntryInput = {
  date: '2026-09-01',
  title: 'Fixed leaking tap',
  costRappen: null,
  contractor: null,
  notes: null,
  itemId: null,
};

describe('JournalRepository', () => {
  let db: DatabaseSync;
  let repository: JournalRepository;

  beforeEach(() => {
    db = openDatabase(':memory:');
    repository = new JournalRepository(db, testClock('2026-10-14').now);
  });

  it('creates, reads, updates and deletes entries', () => {
    const created = repository.create({
      ...emptyInput,
      costRappen: 25000,
      contractor: 'Sanitär Meier',
      notes: 'Kitchen tap.\nReplaced the cartridge.',
    });
    expect(created).toEqual({
      ...emptyInput,
      id: 1,
      costRappen: 25000,
      contractor: 'Sanitär Meier',
      notes: 'Kitchen tap.\nReplaced the cartridge.',
      itemName: null,
      createdAt: '2026-10-14T08:00:00.000Z',
      updatedAt: '2026-10-14T08:00:00.000Z',
    });

    const updated = repository.update(created.id, { ...emptyInput, title: 'Tap replaced' });
    expect(updated).toMatchObject({ id: 1, title: 'Tap replaced', contractor: null, notes: null });

    expect(repository.delete(created.id)).toBe(true);
    expect(repository.get(created.id)).toBeUndefined();
    expect(repository.update(created.id, emptyInput)).toBeUndefined();
    expect(repository.delete(created.id)).toBe(false);
  });

  it('lists entries newest first', () => {
    repository.create({ ...emptyInput, title: 'Old', date: '2024-05-01' });
    repository.create({ ...emptyInput, title: 'New', date: '2026-05-01' });
    repository.create({ ...emptyInput, title: 'Newer same day', date: '2026-05-01' });

    expect(repository.list().map((entry) => entry.title)).toEqual(['Newer same day', 'New', 'Old']);
  });

  it('links entries to items and unlinks them when the item is deleted', () => {
    const items = new ItemRepository(db, testClock('2026-10-14'));
    const boiler = items.create({
      name: 'Boiler',
      category: 'appliance',
      purchaseDate: '2026-01-15',
      costRappen: null,
      warrantyExpires: null,
      manufacturer: null,
      model: null,
      serialNumber: null,
      seller: null,
    });
    expect(repository.itemExists(boiler.id)).toBe(true);
    expect(repository.itemExists(99)).toBe(false);

    const entry = repository.create({ ...emptyInput, itemId: boiler.id });
    expect(entry).toMatchObject({ itemId: boiler.id, itemName: 'Boiler' });

    items.delete(boiler.id);
    expect(repository.get(entry.id)).toMatchObject({ itemId: null, itemName: null });
  });

  it('gives the journal permissions to roles that have the item permissions', () => {
    const permissions = db
      .prepare("SELECT permission FROM role_permissions WHERE permission LIKE 'journal:%'")
      .all()
      .map((row) => row['permission']);
    expect(permissions.sort()).toEqual(['journal:read', 'journal:write']);
  });
});
