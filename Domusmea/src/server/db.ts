import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * Schema migrations; index + 1 is the resulting `PRAGMA user_version`. Append only, never edit an
 * applied migration (ADR 0002).
 */
const MIGRATIONS: readonly string[] = [
  `CREATE TABLE items (
     id INTEGER PRIMARY KEY,
     name TEXT NOT NULL,
     category TEXT CHECK (category IN ('appliance', 'building-part')),
     purchase_date TEXT,
     cost_rappen INTEGER CHECK (cost_rappen >= 0),
     warranty_expires TEXT,
     manufacturer TEXT,
     model TEXT,
     serial_number TEXT,
     seller TEXT,
     warranty_notified_at TEXT,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
   );
   CREATE INDEX items_warranty_pending ON items (warranty_expires) WHERE warranty_notified_at IS NULL;`,
];

export const DEFAULT_DB_PATH = 'data/domusmea.db';

/** Opens (and creates if needed) the database at `path`, or an in-memory one for `:memory:`. */
export function openDatabase(path: string): DatabaseSync {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA journal_mode = WAL');
  migrate(db);
  return db;
}

function migrate(db: DatabaseSync): void {
  const { user_version: version } = db.prepare('PRAGMA user_version').get() as {
    user_version: number;
  };
  for (let next = version; next < MIGRATIONS.length; next++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[next]);
      db.exec(`PRAGMA user_version = ${next + 1}`);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}
