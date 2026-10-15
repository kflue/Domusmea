import { beforeEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { SubscriptionInput } from '../../shared/subscription';
import { openDatabase } from '../db';
import { testClock } from '../items/test-clock';
import { SubscriptionRepository } from './subscription-repository';

const netflix: SubscriptionInput = {
  name: 'Netflix',
  interval: 'monthly',
  costRappen: 1890,
  startDate: '2025-01-15',
  endDate: null,
  priceChanges: [],
  noticeMonths: null,
};

describe('SubscriptionRepository', () => {
  let db: DatabaseSync;
  let repository: SubscriptionRepository;

  beforeEach(() => {
    db = openDatabase(':memory:');
    repository = new SubscriptionRepository(db, testClock('2026-10-15').now);
  });

  it('creates, reads, updates and deletes subscriptions with their price history', () => {
    const created = repository.create({
      ...netflix,
      priceChanges: [{ validFrom: '2026-01-15', costRappen: 2190 }],
    });
    expect(created).toEqual({
      ...netflix,
      id: 1,
      priceChanges: [{ validFrom: '2026-01-15', costRappen: 2190 }],
      createdAt: '2026-10-15T08:00:00.000Z',
      updatedAt: '2026-10-15T08:00:00.000Z',
    });

    const changes = [
      { validFrom: '2026-01-15', costRappen: 2190 },
      { validFrom: '2026-09-15', costRappen: 2390 },
    ];
    const updated = repository.update(created.id, {
      ...netflix,
      endDate: '2026-12-31',
      priceChanges: changes,
    });
    expect(updated).toMatchObject({ endDate: '2026-12-31', priceChanges: changes });

    expect(repository.update(created.id, netflix)?.priceChanges).toEqual([]);

    expect(repository.delete(created.id)).toBe(true);
    expect(repository.get(created.id)).toBeUndefined();
    expect(repository.update(created.id, netflix)).toBeUndefined();
    expect(repository.delete(created.id)).toBe(false);
    expect(db.prepare('SELECT COUNT(*) AS n FROM subscription_price_changes').get()).toEqual({
      n: 0,
    });
  });

  it('lists subscriptions by name, each with its own price changes', () => {
    repository.create({ ...netflix, name: 'tagesanzeiger' });
    repository.create({
      ...netflix,
      name: 'Car insurance',
      interval: 'annual',
      priceChanges: [{ validFrom: '2026-01-15', costRappen: 99000 }],
    });
    repository.create(netflix);

    const list = repository.list();
    expect(list.map((subscription) => subscription.name)).toEqual([
      'Car insurance',
      'Netflix',
      'tagesanzeiger',
    ]);
    expect(list.map((subscription) => subscription.priceChanges.length)).toEqual([1, 0, 0]);
  });

  it('keeps the old data when a price change cannot be stored', () => {
    const created = repository.create(netflix);
    const duplicate = { validFrom: '2026-01-15', costRappen: 2190 };
    expect(() =>
      repository.update(created.id, {
        ...netflix,
        name: 'Renamed',
        priceChanges: [duplicate, duplicate],
      }),
    ).toThrow();
    expect(repository.get(created.id)).toMatchObject({ name: 'Netflix', priceChanges: [] });
  });

  it('gives the finance permissions to roles that have the journal permissions', () => {
    const permissions = db
      .prepare("SELECT permission FROM role_permissions WHERE permission LIKE 'finance:%'")
      .all()
      .map((row) => row['permission']);
    expect(permissions.sort()).toEqual(['finance:read', 'finance:write']);
  });
});
