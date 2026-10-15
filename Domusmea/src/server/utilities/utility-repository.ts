import { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { Commodity, UtilityBillInput, UtilityEntry, UtilityEntryInput } from '../../shared/utility';

interface UtilityEntryRow {
  id: number;
  bill_id: number;
  commodity: Commodity;
  period_from: string;
  period_to: string;
  amount_milli: number | null;
  cost_rappen: number;
  fixed_fee_rappen: number;
  invoice_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const SELECT = `SELECT e.id, e.bill_id, e.commodity, e.period_from, e.period_to, e.amount_milli,
    e.cost_rappen, e.fixed_fee_rappen, b.invoice_number, b.notes, e.created_at, e.updated_at
  FROM utility_entries e JOIN utility_bills b ON b.id = e.bill_id`;

/**
 * Persistence of utility bills (ADR 0011, 0012): a bill row with the invoice number and notes, and
 * an entry per commodity and billing period. A bill without entries is deleted with its last one.
 */
export class UtilityRepository {
  constructor(
    private readonly db: DatabaseSync,
    private readonly now: () => string,
  ) {}

  /** All entries, newest period first. */
  list(): UtilityEntry[] {
    return (
      this.db
        .prepare(`${SELECT} ORDER BY e.period_to DESC, e.period_from DESC, e.id DESC`)
        .all() as unknown as UtilityEntryRow[]
    ).map(toEntry);
  }

  get(id: number): UtilityEntry | undefined {
    const row = this.db.prepare(`${SELECT} WHERE e.id = ?`).get(id) as UtilityEntryRow | undefined;
    return row && toEntry(row);
  }

  /** Stores the bill and each of its lines as an entry, all or none. */
  createBill(bill: UtilityBillInput): UtilityEntry[] {
    const ids = this.transaction(() => {
      const now = this.now();
      const billId = Number(
        this.db
          .prepare(
            `INSERT INTO utility_bills (invoice_number, notes, created_at, updated_at)
             VALUES (?, ?, ?, ?)`,
          )
          .run(bill.invoiceNumber, bill.notes, now, now).lastInsertRowid,
      );
      const insert = this.db.prepare(
        `INSERT INTO utility_entries (bill_id, commodity, period_from, period_to, amount_milli,
           cost_rappen, fixed_fee_rappen, created_at, updated_at)
         VALUES (:billId, :commodity, :periodFrom, :periodTo, :amountMilli, :costRappen,
           :fixedFeeRappen, :now, :now)`,
      );
      return bill.lines.map((line) =>
        Number(
          insert.run({
            ...toParams({ ...line, periodFrom: bill.periodFrom, periodTo: bill.periodTo }),
            billId,
            now,
          }).lastInsertRowid,
        ),
      );
    });
    return ids.map((id) => this.get(id) as UtilityEntry);
  }

  /**
   * Replaces the entry's figures, and its bill's invoice number and notes where given. The
   * commodity is part of the match, so it never changes.
   */
  update(id: number, input: UtilityEntryInput): UtilityEntry | undefined {
    const changed = this.transaction(() => {
      const now = this.now();
      const { changes } = this.db
        .prepare(
          `UPDATE utility_entries SET
             period_from = :periodFrom, period_to = :periodTo,
             amount_milli = :amountMilli, cost_rappen = :costRappen,
             fixed_fee_rappen = :fixedFeeRappen, updated_at = :now
           WHERE id = :id AND commodity = :commodity`,
        )
        .run({ ...toParams(input), id, now });
      const bill = `WHERE id = (SELECT bill_id FROM utility_entries WHERE id = ?)`;
      if (changes && input.invoiceNumber !== undefined) {
        this.db
          .prepare(`UPDATE utility_bills SET invoice_number = ?, updated_at = ? ${bill}`)
          .run(input.invoiceNumber, now, id);
      }
      if (changes && input.notes !== undefined) {
        this.db
          .prepare(`UPDATE utility_bills SET notes = ?, updated_at = ? ${bill}`)
          .run(input.notes, now, id);
      }
      return changes > 0;
    });
    return changed ? this.get(id) : undefined;
  }

  /** Deletes the entry, and its bill when no other entry is left on it. */
  delete(id: number): boolean {
    return this.transaction(() => {
      const row = this.db.prepare('SELECT bill_id FROM utility_entries WHERE id = ?').get(id) as
        { bill_id: number } | undefined;
      if (!row) {
        return false;
      }
      this.db.prepare('DELETE FROM utility_entries WHERE id = ?').run(id);
      this.db
        .prepare(
          `DELETE FROM utility_bills
           WHERE id = ? AND NOT EXISTS (SELECT 1 FROM utility_entries WHERE bill_id = ?)`,
        )
        .run(row.bill_id, row.bill_id);
      return true;
    });
  }

  private transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
}

/** The entry's own columns; invoice number and notes are stored on the bill. */
function toParams(
  input: Omit<UtilityEntryInput, 'invoiceNumber' | 'notes'>,
): Record<string, SQLInputValue> {
  return {
    commodity: input.commodity,
    periodFrom: input.periodFrom,
    periodTo: input.periodTo,
    amountMilli: input.amountMilli,
    costRappen: input.costRappen,
    fixedFeeRappen: input.fixedFeeRappen,
  };
}

function toEntry(row: UtilityEntryRow): UtilityEntry {
  return {
    id: row.id,
    billId: row.bill_id,
    commodity: row.commodity,
    periodFrom: row.period_from,
    periodTo: row.period_to,
    amountMilli: row.amount_milli,
    costRappen: row.cost_rappen,
    fixedFeeRappen: row.fixed_fee_rappen,
    invoiceNumber: row.invoice_number,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
