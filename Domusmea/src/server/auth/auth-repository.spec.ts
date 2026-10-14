import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_SIGN_INS, PERMISSIONS } from '../../shared/auth';
import { openDatabase } from '../db';
import { AuthRepository, SESSION_IDLE_MS } from './auth-repository';
import { verifyPassword } from './passwords';

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

  it('creates the default account with the Owner role and every permission', async () => {
    const credentials = repository.credentials('ADMIN')!;
    expect(credentials.account).toEqual({
      id: 1,
      username: 'admin',
      role: 'Owner',
      permissions: [...PERMISSIONS],
      setupRequired: true,
    });
    expect(await verifyPassword('admin', credentials.passwordHash)).toBe(true);
    expect(repository.decoyPasswordHash()).toBe(credentials.passwordHash);
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

  it('resets to the default credentials without touching other data', async () => {
    db.exec(`INSERT INTO items (name, created_at, updated_at) VALUES ('Roof', 'x', 'x')`);
    repository.completeSetup(1, 'anna', 'scrypt$new');
    const token = repository.createSession(1);

    repository.resetToDefault();
    expect(repository.credentials('anna')).toBeUndefined();
    expect(await verifyPassword('admin', repository.credentials('admin')!.passwordHash)).toBe(true);
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

  it('keeps the newest sign-ins per account', () => {
    for (let i = 0; i < MAX_SIGN_INS + 2; i++) {
      now += 1000;
      repository.recordSignIn(1, `192.0.2.${i}`, i === 0 ? null : '198.51.100.1');
    }
    const signIns = repository.recentSignIns(1);
    expect(signIns).toHaveLength(MAX_SIGN_INS);
    expect(signIns[0]).toEqual({
      at: new Date(now).toISOString(),
      address: `192.0.2.${MAX_SIGN_INS + 1}`,
      forwardedFor: '198.51.100.1',
    });
    expect(signIns.at(-1)?.address).toBe('192.0.2.2');
  });

  it('changes the password and replaces every session with a new one', () => {
    const current = repository.createSession(1);
    const other = repository.createSession(1);
    const renewed = repository.changePassword(1, 'scrypt$changed');
    expect(repository.passwordHash(1)).toBe('scrypt$changed');
    expect(repository.sessionAccount(current)).toBeUndefined();
    expect(repository.sessionAccount(other)).toBeUndefined();
    expect(repository.sessionAccount(renewed)).toBeDefined();

    repository.deleteSessionsOf(1);
    expect(repository.sessionAccount(renewed)).toBeUndefined();
  });
});
