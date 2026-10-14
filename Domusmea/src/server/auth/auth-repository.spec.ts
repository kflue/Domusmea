import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import { PERMISSIONS } from '../../shared/auth';
import { openDatabase } from '../db';
import { AuthRepository, DEFAULT_PASSWORD_HASH, SESSION_IDLE_MS } from './auth-repository';

describe('AuthRepository', () => {
  let db: DatabaseSync;
  let now: number;
  let repository: AuthRepository;

  beforeEach(() => {
    db = openDatabase(':memory:');
    now = Date.parse('2026-10-14T08:00:00.000Z');
    repository = new AuthRepository(db, () => new Date(now).toISOString());
  });

  const owner = () => repository.credentials('admin')!.account;

  it('creates the default account with the Owner role and every permission', () => {
    expect(repository.credentials('ADMIN')).toEqual({
      account: {
        id: 1,
        username: 'admin',
        role: 'Owner',
        permissions: [...PERMISSIONS],
        setupRequired: true,
      },
      passwordHash: DEFAULT_PASSWORD_HASH,
    });
    new AuthRepository(db, () => new Date(now).toISOString());
    expect(db.prepare('SELECT COUNT(*) AS count FROM users').get()).toEqual({ count: 1 });
  });

  it('completes the setup once and ends the old sessions', () => {
    const token = repository.createSession(owner().id);

    const account = repository.completeSetup(1, 'anna', 'scrypt$new');
    expect(account).toMatchObject({ username: 'anna', setupRequired: false });
    expect(repository.credentials('admin')).toBeUndefined();
    expect(repository.credentials('Anna')?.passwordHash).toBe('scrypt$new');
    expect(repository.sessionAccount(token)).toBeUndefined();

    expect(repository.completeSetup(1, 'mallory', 'scrypt$other')).toBeUndefined();
    expect(repository.credentials('anna')?.passwordHash).toBe('scrypt$new');
  });

  it('keeps sessions while they are used and ends them after the idle time', () => {
    const token = repository.createSession(owner().id);
    expect(repository.sessionAccount(token)?.username).toBe('admin');
    expect(repository.sessionAccount('unknown')).toBeUndefined();

    now += SESSION_IDLE_MS - 1000;
    expect(repository.sessionAccount(token)).toBeDefined();
    now += SESSION_IDLE_MS - 1000;
    expect(repository.sessionAccount(token)).toBeDefined();
    now += SESSION_IDLE_MS + 1;
    expect(repository.sessionAccount(token)).toBeUndefined();

    const other = repository.createSession(owner().id);
    repository.deleteSession(other);
    expect(repository.sessionAccount(other)).toBeUndefined();
  });

  it('stores only hashes of session tokens', () => {
    const token = repository.createSession(owner().id);
    const rows = db.prepare('SELECT token_hash FROM sessions').all() as { token_hash: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].token_hash).not.toContain(token);
  });

  it('resets to the default credentials without touching other data', () => {
    db.exec(`INSERT INTO items (name, created_at, updated_at) VALUES ('Roof', 'x', 'x')`);
    repository.completeSetup(1, 'anna', 'scrypt$new');
    const token = repository.createSession(1);

    repository.resetToDefault();
    expect(repository.credentials('anna')).toBeUndefined();
    expect(owner()).toMatchObject({ id: 1, setupRequired: true });
    expect(repository.sessionAccount(token)).toBeUndefined();
    expect(db.prepare('SELECT COUNT(*) AS count FROM items').get()).toEqual({ count: 1 });
  });

  it('gives an account only the permissions of its role', () => {
    db.exec(`INSERT INTO roles (id, name) VALUES (2, 'Viewer');
      INSERT INTO role_permissions (role_id, permission) VALUES (2, 'items:read'), (2, 'unknown');
      UPDATE users SET role_id = 2;`);
    expect(owner()).toMatchObject({ role: 'Viewer', permissions: ['items:read'] });
  });
});
