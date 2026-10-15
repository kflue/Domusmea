import { DatabaseSync, SQLInputValue } from 'node:sqlite';
import {
  BillingInterval,
  PriceChange,
  Subscription,
  SubscriptionInput,
} from '../../shared/subscription';

interface SubscriptionRow {
  id: number;
  name: string;
  interval: BillingInterval;
  cost_rappen: number;
  start_date: string;
  end_date: string | null;
  notice_months: number | null;
  created_at: string;
  updated_at: string;
}

interface PriceChangeRow {
  subscription_id: number;
  valid_from: string;
  cost_rappen: number;
}

const SELECT = `SELECT id, name, interval, cost_rappen, start_date, end_date, notice_months,
    created_at, updated_at
  FROM subscriptions`;
const SELECT_CHANGES = `SELECT subscription_id, valid_from, cost_rappen
  FROM subscription_price_changes`;

/**
 * Persistence of subscriptions and their price history. Also owns `cancel_reminded_for`, the
 * cancellation deadline the last reminder was about (ADR 0010).
 */
export class SubscriptionRepository {
  constructor(
    private readonly db: DatabaseSync,
    private readonly now: () => string,
  ) {}

  /** All subscriptions by name. */
  list(): Subscription[] {
    const rows = this.db
      .prepare(`${SELECT} ORDER BY name COLLATE NOCASE, id`)
      .all() as unknown as SubscriptionRow[];
    const changes = this.db
      .prepare(`${SELECT_CHANGES} ORDER BY valid_from`)
      .all() as unknown as PriceChangeRow[];
    const changesById = new Map<number, PriceChangeRow[]>();
    for (const change of changes) {
      changesById.set(change.subscription_id, [
        ...(changesById.get(change.subscription_id) ?? []),
        change,
      ]);
    }
    return rows.map((row) => toSubscription(row, changesById.get(row.id) ?? []));
  }

  get(id: number): Subscription | undefined {
    const row = this.db.prepare(`${SELECT} WHERE id = ?`).get(id) as SubscriptionRow | undefined;
    if (!row) {
      return undefined;
    }
    const changes = this.db
      .prepare(`${SELECT_CHANGES} WHERE subscription_id = ? ORDER BY valid_from`)
      .all(id) as unknown as PriceChangeRow[];
    return toSubscription(row, changes);
  }

  create(input: SubscriptionInput): Subscription {
    const id = this.transaction(() => {
      const now = this.now();
      const { lastInsertRowid } = this.db
        .prepare(
          `INSERT INTO subscriptions (name, interval, cost_rappen, start_date, end_date,
             notice_months, created_at, updated_at)
           VALUES (:name, :interval, :costRappen, :startDate, :endDate, :noticeMonths, :now, :now)`,
        )
        .run({ ...toParams(input), now });
      const id = Number(lastInsertRowid);
      this.insertChanges(id, input.priceChanges);
      return id;
    });
    return this.get(id) as Subscription;
  }

  /** Replaces the subscription including its whole price history. */
  update(id: number, input: SubscriptionInput): Subscription | undefined {
    const changed = this.transaction(() => {
      const { changes } = this.db
        .prepare(
          `UPDATE subscriptions SET
             name = :name, interval = :interval, cost_rappen = :costRappen,
             start_date = :startDate, end_date = :endDate, notice_months = :noticeMonths,
             updated_at = :now
           WHERE id = :id`,
        )
        .run({ ...toParams(input), id, now: this.now() });
      if (changes) {
        this.db.prepare('DELETE FROM subscription_price_changes WHERE subscription_id = ?').run(id);
        this.insertChanges(id, input.priceChanges);
      }
      return changes > 0;
    });
    return changed ? this.get(id) : undefined;
  }

  /**
   * Running subscriptions with a notice period, each with the deadline it was last reminded of
   * (`null` if never).
   */
  listWithNoticePeriod(): { subscription: Subscription; remindedFor: string | null }[] {
    const reminded = new Map(
      (
        this.db
          .prepare(
            `SELECT id, cancel_reminded_for FROM subscriptions
             WHERE notice_months IS NOT NULL AND end_date IS NULL`,
          )
          .all() as { id: number; cancel_reminded_for: string | null }[]
      ).map((row) => [row.id, row.cancel_reminded_for]),
    );
    return this.list()
      .filter((subscription) => reminded.has(subscription.id))
      .map((subscription) => ({
        subscription,
        remindedFor: reminded.get(subscription.id) ?? null,
      }));
  }

  /** Records that the reminder for `deadline` was sent. */
  markCancellationReminded(id: number, deadline: string): void {
    this.db
      .prepare('UPDATE subscriptions SET cancel_reminded_for = ? WHERE id = ?')
      .run(deadline, id);
  }

  /** Deletes the subscription and its price history. */
  delete(id: number): boolean {
    return this.db.prepare('DELETE FROM subscriptions WHERE id = ?').run(id).changes > 0;
  }

  private insertChanges(id: number, changes: readonly PriceChange[]): void {
    const insert = this.db.prepare(
      `INSERT INTO subscription_price_changes (subscription_id, valid_from, cost_rappen)
       VALUES (?, ?, ?)`,
    );
    for (const change of changes) {
      insert.run(id, change.validFrom, change.costRappen);
    }
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

function toParams(input: SubscriptionInput): Record<string, SQLInputValue> {
  return {
    name: input.name,
    interval: input.interval,
    costRappen: input.costRappen,
    startDate: input.startDate,
    endDate: input.endDate,
    noticeMonths: input.noticeMonths,
  };
}

function toSubscription(row: SubscriptionRow, changes: PriceChangeRow[]): Subscription {
  return {
    id: row.id,
    name: row.name,
    interval: row.interval,
    costRappen: row.cost_rappen,
    startDate: row.start_date,
    endDate: row.end_date,
    priceChanges: changes.map((change) => ({
      validFrom: change.valid_from,
      costRappen: change.cost_rappen,
    })),
    noticeMonths: row.notice_months,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
