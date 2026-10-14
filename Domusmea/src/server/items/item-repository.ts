import { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { Item, ItemCategory, ItemInput } from '../../shared/item';

interface ItemRow {
  id: number;
  name: string;
  category: ItemCategory | null;
  purchase_date: string | null;
  cost_rappen: number | null;
  warranty_expires: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  seller: string | null;
  created_at: string;
  updated_at: string;
}

const COLUMNS = `id, name, category, purchase_date, cost_rappen, warranty_expires, manufacturer, model,
  serial_number, seller, created_at, updated_at`;

/** Clock used for timestamps and for deciding whether a warranty has already expired. */
export interface Clock {
  /** Current instant as ISO 8601 UTC. */
  now(): string;
  /** Today's calendar date in the app time zone as `YYYY-MM-DD`. */
  today(): string;
}

/**
 * Persistence of items. Also owns `warranty_notified_at` (ADR 0003): items whose warranty has
 * already expired when saved are marked as notified so they never trigger an email.
 */
export class ItemRepository {
  constructor(
    private readonly db: DatabaseSync,
    private readonly clock: Clock,
  ) {}

  list(): Item[] {
    const rows = this.db
      .prepare(
        `SELECT ${COLUMNS} FROM items
         ORDER BY warranty_expires IS NULL, warranty_expires, name COLLATE NOCASE, id`,
      )
      .all() as unknown as ItemRow[];
    return rows.map(toItem);
  }

  get(id: number): Item | undefined {
    const row = this.db.prepare(`SELECT ${COLUMNS} FROM items WHERE id = ?`).get(id) as
      ItemRow | undefined;
    return row && toItem(row);
  }

  create(input: ItemInput): Item {
    const now = this.clock.now();
    const { lastInsertRowid } = this.db
      .prepare(
        `INSERT INTO items (name, category, purchase_date, cost_rappen, warranty_expires, manufacturer,
           model, serial_number, seller, warranty_notified_at, created_at, updated_at)
         VALUES (:name, :category, :purchaseDate, :costRappen, :warrantyExpires, :manufacturer,
           :model, :serialNumber, :seller,
           CASE WHEN :warrantyExpires <= :today THEN :now END, :now, :now)`,
      )
      .run({ ...toParams(input), today: this.clock.today(), now });
    return this.get(Number(lastInsertRowid)) as Item;
  }

  update(id: number, input: ItemInput): Item | undefined {
    // SET expressions see the old row, so `warranty_expires IS :warrantyExpires` detects a changed
    // expiry date: unchanged keeps the notification state, a past date counts as notified, a future
    // (or no) date resets it.
    const { changes } = this.db
      .prepare(
        `UPDATE items SET
           name = :name, category = :category, purchase_date = :purchaseDate,
           cost_rappen = :costRappen, warranty_expires = :warrantyExpires,
           manufacturer = :manufacturer, model = :model, serial_number = :serialNumber,
           seller = :seller, updated_at = :now,
           warranty_notified_at = CASE
             WHEN warranty_expires IS :warrantyExpires THEN warranty_notified_at
             WHEN :warrantyExpires <= :today THEN :now
           END
         WHERE id = :id`,
      )
      .run({ ...toParams(input), id, today: this.clock.today(), now: this.clock.now() });
    return changes ? this.get(id) : undefined;
  }

  delete(id: number): boolean {
    return this.db.prepare('DELETE FROM items WHERE id = ?').run(id).changes > 0;
  }

  /** Items whose warranty expired on or before `today` and that were not announced yet. */
  findWarrantyExpiredUnnotified(today: string): Item[] {
    const rows = this.db
      .prepare(
        `SELECT ${COLUMNS} FROM items
         WHERE warranty_notified_at IS NULL AND warranty_expires <= ?
         ORDER BY warranty_expires, name COLLATE NOCASE, id`,
      )
      .all(today) as unknown as ItemRow[];
    return rows.map(toItem);
  }

  /**
   * Marks the given items as announced. Items whose expiry date was moved past `today` in the
   * meantime are left alone, so they are announced again when the new date is reached.
   */
  markWarrantyNotified(ids: readonly number[], today: string): void {
    const mark = this.db.prepare(
      `UPDATE items SET warranty_notified_at = :now
       WHERE id = :id AND warranty_notified_at IS NULL AND warranty_expires <= :today`,
    );
    const now = this.clock.now();
    this.db.exec('BEGIN');
    try {
      for (const id of ids) {
        mark.run({ id, now, today });
      }
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
}

function toParams(input: ItemInput): Record<string, SQLInputValue> {
  return {
    name: input.name,
    category: input.category,
    purchaseDate: input.purchaseDate,
    costRappen: input.costRappen,
    warrantyExpires: input.warrantyExpires,
    manufacturer: input.manufacturer,
    model: input.model,
    serialNumber: input.serialNumber,
    seller: input.seller,
  };
}

function toItem(row: ItemRow): Item {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    purchaseDate: row.purchase_date,
    costRappen: row.cost_rappen,
    warrantyExpires: row.warranty_expires,
    manufacturer: row.manufacturer,
    model: row.model,
    serialNumber: row.serial_number,
    seller: row.seller,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
