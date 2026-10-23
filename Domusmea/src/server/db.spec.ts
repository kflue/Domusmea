import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { migrate } from './db';

describe('migration 8: repairs only, purchase date required (ADR 0017)', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    migrate(db, 7);
    db.exec(`
      INSERT INTO items (id, name, category, purchase_date, cost_rappen, created_at, updated_at)
      VALUES (1, 'Heat pump', 'building-part', '2026-03-10', 1200000, '2026-03-11T08:00:00Z', 'x'),
             (2, 'Old fridge', NULL, NULL, NULL, '2024-05-02T09:30:00Z', 'x');
      INSERT INTO items (id, name, warranty_expires, created_at, updated_at)
      VALUES (3, 'Old oven', '2019-01-31', '2024-05-02T09:30:00Z', 'x');
      INSERT INTO journal_entries (id, date, kind, title, cost_rappen, item_id, created_at, updated_at)
      VALUES (1, '2026-04-01', 'repair', 'Pump serviced', 30000, 1, 'x', 'x'),
             (2, '2026-03-10', 'investment', 'Heat pump installed', 1200000, 1, 'x', 'x');`);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it('deletes investments, drops the kind column and keeps the item links', () => {
    migrate(db);

    const columns = db.prepare('PRAGMA table_info(journal_entries)').all() as { name: string }[];
    expect(columns.map((column) => column.name)).not.toContain('kind');
    expect(db.prepare('SELECT id, item_id FROM journal_entries').all()).toEqual([
      { id: 1, item_id: 1 },
    ]);
  });

  it('fills a missing purchase date with the entry date, at most the warranty expiry', () => {
    migrate(db);

    expect(db.prepare('SELECT id, purchase_date FROM items WHERE id > 1').all()).toEqual([
      { id: 2, purchase_date: '2024-05-02' },
      { id: 3, purchase_date: '2019-01-31' },
    ]);
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/2 item\(s\).*ids 2, 3$/));
    expect(console.warn).not.toHaveBeenCalledWith(expect.stringContaining('Old'));
    expect(() =>
      db.exec(`INSERT INTO items (name, created_at, updated_at) VALUES ('No date', 'x', 'x')`),
    ).toThrow(/NOT NULL/);
  });

  it('keeps foreign keys enforced afterwards', () => {
    migrate(db);

    db.exec('DELETE FROM items WHERE id = 1');
    expect(db.prepare('SELECT item_id FROM journal_entries WHERE id = 1').get()).toEqual({
      item_id: null,
    });
  });
});
