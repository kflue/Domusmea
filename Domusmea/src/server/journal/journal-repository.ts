import { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { JournalEntry, JournalEntryInput, JournalKind } from '../../shared/journal';

interface JournalRow {
  id: number;
  date: string;
  kind: JournalKind;
  title: string;
  cost_rappen: number | null;
  contractor: string | null;
  notes: string | null;
  item_id: number | null;
  item_name: string | null;
  created_at: string;
  updated_at: string;
}

const SELECT = `SELECT j.id, j.date, j.kind, j.title, j.cost_rappen, j.contractor, j.notes, j.item_id,
    i.name AS item_name, j.created_at, j.updated_at
  FROM journal_entries j LEFT JOIN items i ON i.id = j.item_id`;

/** Persistence of the journal of repairs and investments. */
export class JournalRepository {
  constructor(
    private readonly db: DatabaseSync,
    private readonly now: () => string,
  ) {}

  /** All entries, newest work first. */
  list(): JournalEntry[] {
    const rows = this.db
      .prepare(`${SELECT} ORDER BY j.date DESC, j.id DESC`)
      .all() as unknown as JournalRow[];
    return rows.map(toEntry);
  }

  get(id: number): JournalEntry | undefined {
    const row = this.db.prepare(`${SELECT} WHERE j.id = ?`).get(id) as JournalRow | undefined;
    return row && toEntry(row);
  }

  /** Whether the item an entry refers to exists. */
  itemExists(itemId: number): boolean {
    return this.db.prepare('SELECT 1 FROM items WHERE id = ?').get(itemId) !== undefined;
  }

  create(input: JournalEntryInput): JournalEntry {
    const now = this.now();
    const { lastInsertRowid } = this.db
      .prepare(
        `INSERT INTO journal_entries (date, kind, title, cost_rappen, contractor, notes, item_id,
           created_at, updated_at)
         VALUES (:date, :kind, :title, :costRappen, :contractor, :notes, :itemId, :now, :now)`,
      )
      .run({ ...toParams(input), now });
    return this.get(Number(lastInsertRowid)) as JournalEntry;
  }

  update(id: number, input: JournalEntryInput): JournalEntry | undefined {
    const { changes } = this.db
      .prepare(
        `UPDATE journal_entries SET
           date = :date, kind = :kind, title = :title, cost_rappen = :costRappen,
           contractor = :contractor, notes = :notes, item_id = :itemId, updated_at = :now
         WHERE id = :id`,
      )
      .run({ ...toParams(input), id, now: this.now() });
    return changes ? this.get(id) : undefined;
  }

  delete(id: number): boolean {
    return this.db.prepare('DELETE FROM journal_entries WHERE id = ?').run(id).changes > 0;
  }
}

function toParams(input: JournalEntryInput): Record<string, SQLInputValue> {
  return {
    date: input.date,
    kind: input.kind,
    title: input.title,
    costRappen: input.costRappen,
    contractor: input.contractor,
    notes: input.notes,
    itemId: input.itemId,
  };
}

function toEntry(row: JournalRow): JournalEntry {
  return {
    id: row.id,
    date: row.date,
    kind: row.kind,
    title: row.title,
    costRappen: row.cost_rappen,
    contractor: row.contractor,
    notes: row.notes,
    itemId: row.item_id,
    itemName: row.item_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
