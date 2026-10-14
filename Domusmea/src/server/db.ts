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
  // Single row; recipients as a JSON array, smtp_password encrypted (ADR 0006).
  `CREATE TABLE email_settings (
     id INTEGER PRIMARY KEY CHECK (id = 1),
     smtp_host TEXT,
     smtp_port INTEGER NOT NULL CHECK (smtp_port BETWEEN 1 AND 65535),
     smtp_security TEXT NOT NULL CHECK (smtp_security IN ('starttls', 'tls', 'none')),
     smtp_username TEXT,
     smtp_password TEXT,
     from_address TEXT,
     recipients TEXT NOT NULL,
     updated_at TEXT NOT NULL
   );`,
  // Login with roles as sets of permissions (ADR 0007). Sessions are stored by token hash; the
  // default account is created by AuthRepository so its password hash is not part of the schema.
  `CREATE TABLE roles (
     id INTEGER PRIMARY KEY,
     name TEXT NOT NULL UNIQUE
   );
   CREATE TABLE role_permissions (
     role_id INTEGER NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
     permission TEXT NOT NULL,
     PRIMARY KEY (role_id, permission)
   );
   CREATE TABLE users (
     id INTEGER PRIMARY KEY,
     username TEXT NOT NULL UNIQUE COLLATE NOCASE,
     password_hash TEXT NOT NULL,
     role_id INTEGER NOT NULL REFERENCES roles (id),
     must_change_credentials INTEGER NOT NULL CHECK (must_change_credentials IN (0, 1)),
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
   );
   CREATE TABLE sessions (
     token_hash TEXT PRIMARY KEY,
     user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
     created_at TEXT NOT NULL,
     last_seen_at TEXT NOT NULL
   );
   CREATE INDEX sessions_user ON sessions (user_id);
   INSERT INTO roles (id, name) VALUES (1, 'Owner');
   INSERT INTO role_permissions (role_id, permission) VALUES
     (1, 'items:read'), (1, 'items:write'), (1, 'settings:read'), (1, 'settings:write'),
     (1, 'account:manage');`,
  // Recent successful sign-ins per account, shown in Settings (ADR 0007).
  `CREATE TABLE sign_ins (
     id INTEGER PRIMARY KEY,
     user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
     signed_in_at TEXT NOT NULL,
     address TEXT NOT NULL,
     forwarded_for TEXT
   );
   CREATE INDEX sign_ins_user ON sign_ins (user_id, id);`,
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
