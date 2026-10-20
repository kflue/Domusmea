import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/** A migration step: SQL, or a function for steps that also report on the data they change. */
type Migration = string | ((db: DatabaseSync) => void);

/**
 * Schema migrations; index + 1 is the resulting `PRAGMA user_version`. Append only, never edit an
 * applied migration (ADR 0002).
 */
const MIGRATIONS: readonly Migration[] = [
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
  // Journal of repairs and investments; roles that may see or edit items get the same on the journal.
  `CREATE TABLE journal_entries (
     id INTEGER PRIMARY KEY,
     date TEXT NOT NULL,
     kind TEXT NOT NULL CHECK (kind IN ('repair', 'investment')),
     title TEXT NOT NULL,
     cost_rappen INTEGER CHECK (cost_rappen >= 0),
     contractor TEXT,
     notes TEXT,
     item_id INTEGER REFERENCES items (id) ON DELETE SET NULL,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
   );
   CREATE INDEX journal_entries_date ON journal_entries (date);
   CREATE INDEX journal_entries_item ON journal_entries (item_id);
   INSERT INTO role_permissions (role_id, permission)
     SELECT role_id, 'journal:read' FROM role_permissions WHERE permission = 'items:read';
   INSERT INTO role_permissions (role_id, permission)
     SELECT role_id, 'journal:write' FROM role_permissions WHERE permission = 'items:write';`,
  // Subscriptions with their price history (ADR 0009) and the cancellation deadline last reminded of
  // (ADR 0010); roles with the journal permissions get the same on finance.
  `CREATE TABLE subscriptions (
     id INTEGER PRIMARY KEY,
     name TEXT NOT NULL,
     interval TEXT NOT NULL CHECK (interval IN ('monthly', 'annual')),
     cost_rappen INTEGER NOT NULL CHECK (cost_rappen BETWEEN 0 AND 100000000),
     start_date TEXT NOT NULL,
     end_date TEXT CHECK (end_date >= start_date),
     notice_months INTEGER CHECK (notice_months BETWEEN 0 AND 24),
     cancel_reminded_for TEXT,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
   );
   CREATE TABLE subscription_price_changes (
     subscription_id INTEGER NOT NULL REFERENCES subscriptions (id) ON DELETE CASCADE,
     valid_from TEXT NOT NULL,
     cost_rappen INTEGER NOT NULL CHECK (cost_rappen BETWEEN 0 AND 100000000),
     PRIMARY KEY (subscription_id, valid_from)
   );
   INSERT INTO role_permissions (role_id, permission)
     SELECT role_id, 'finance:read' FROM role_permissions WHERE permission = 'journal:read';
   INSERT INTO role_permissions (role_id, permission)
     SELECT role_id, 'finance:write' FROM role_permissions WHERE permission = 'journal:write';`,
  // Utility bills (ADR 0011, 0012): a bill holds the invoice number and notes, its entries one
  // commodity and billing period each; guarded by the finance permissions. The commodity is a string
  // key without CHECK so new ones need no migration.
  `CREATE TABLE utility_bills (
     id INTEGER PRIMARY KEY,
     invoice_number TEXT,
     notes TEXT,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
   );
   CREATE TABLE utility_entries (
     id INTEGER PRIMARY KEY,
     bill_id INTEGER NOT NULL REFERENCES utility_bills (id) ON DELETE CASCADE,
     commodity TEXT NOT NULL,
     period_from TEXT NOT NULL,
     period_to TEXT NOT NULL CHECK (period_to >= period_from),
     amount_milli INTEGER CHECK (amount_milli BETWEEN 0 AND 1000000000),
     cost_rappen INTEGER NOT NULL CHECK (cost_rappen BETWEEN -100000000 AND 100000000),
     fixed_fee_rappen INTEGER NOT NULL CHECK (fixed_fee_rappen BETWEEN -100000000 AND 100000000),
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
   );
   CREATE INDEX utility_entries_commodity ON utility_entries (commodity, period_to);
   CREATE INDEX utility_entries_bill ON utility_entries (bill_id);`,
  // The journal holds only repairs and items need a purchase date (ADR 0017). Investment entries are
  // deleted; items without a purchase date get the day they were entered, or their warranty expiry
  // if earlier, so they stay valid for the API. SQLite cannot drop a column with a CHECK or add
  // NOT NULL, so both tables are rebuilt.
  (db) => {
    const undated = db
      .prepare('SELECT id FROM items WHERE purchase_date IS NULL ORDER BY id')
      .all() as { id: number }[];
    if (undated.length) {
      // Ids only: item names are free text and do not belong in the server log.
      console.warn(
        `Purchase date filled in for ${undated.length} item(s); please check them on /items: ids ` +
          undated.map((item) => item.id).join(', '),
      );
    }
    db.exec(`
      DELETE FROM journal_entries WHERE kind = 'investment';
      CREATE TABLE journal_entries_new (
        id INTEGER PRIMARY KEY,
        date TEXT NOT NULL,
        title TEXT NOT NULL,
        cost_rappen INTEGER CHECK (cost_rappen >= 0),
        contractor TEXT,
        notes TEXT,
        item_id INTEGER REFERENCES items (id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      INSERT INTO journal_entries_new
        SELECT id, date, title, cost_rappen, contractor, notes, item_id, created_at, updated_at
        FROM journal_entries;
      DROP TABLE journal_entries;
      ALTER TABLE journal_entries_new RENAME TO journal_entries;
      CREATE INDEX journal_entries_date ON journal_entries (date);
      CREATE INDEX journal_entries_item ON journal_entries (item_id);

      CREATE TABLE items_new (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT CHECK (category IN ('appliance', 'building-part')),
        purchase_date TEXT NOT NULL,
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
      INSERT INTO items_new
        SELECT id, name, category,
          coalesce(purchase_date, CASE
            WHEN warranty_expires < substr(created_at, 1, 10) THEN warranty_expires
            ELSE substr(created_at, 1, 10)
          END),
          cost_rappen,
          warranty_expires, manufacturer, model, serial_number, seller, warranty_notified_at,
          created_at, updated_at
        FROM items;
      DROP TABLE items;
      ALTER TABLE items_new RENAME TO items;
      CREATE INDEX items_warranty_pending ON items (warranty_expires)
        WHERE warranty_notified_at IS NULL;`);
  },
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

/**
 * Applies the migrations up to `target` (default: all). Foreign keys are off during a step so a
 * table can be rebuilt without `DROP TABLE` firing `ON DELETE` actions; they are checked before
 * the step commits (SQLite's procedure for schema changes).
 */
export function migrate(db: DatabaseSync, target = MIGRATIONS.length): void {
  const { user_version: version } = db.prepare('PRAGMA user_version').get() as {
    user_version: number;
  };
  for (let next = version; next < target; next++) {
    const migration = MIGRATIONS[next];
    // Has no effect inside a transaction, so it is switched outside BEGIN … COMMIT.
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec('BEGIN');
    try {
      if (typeof migration === 'string') {
        db.exec(migration);
      } else {
        migration(db);
      }
      if (db.prepare('PRAGMA foreign_key_check').all().length) {
        throw new Error(`Migration ${next + 1} leaves rows with broken foreign keys.`);
      }
      db.exec(`PRAGMA user_version = ${next + 1}`);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    } finally {
      db.exec('PRAGMA foreign_keys = ON');
    }
  }
}
