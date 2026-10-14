import { randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import { EmailSettingsInput } from '../../shared/email-settings';
import { openDatabase } from '../db';
import { EmailSettingsRepository } from './email-settings-repository';
import { createSecretBox } from './secret-box';

const smtp: EmailSettingsInput = {
  host: 'smtp.example.ch',
  port: 587,
  security: 'starttls',
  username: 'home@example.ch',
  password: 'secret',
  from: 'home@example.ch',
  recipients: ['anna@example.ch', 'ben@example.ch'],
};

describe('EmailSettingsRepository', () => {
  let db: DatabaseSync;
  let repository: EmailSettingsRepository;
  const now = () => '2026-10-14T08:00:00.000Z';

  beforeEach(() => {
    db = openDatabase(':memory:');
    repository = new EmailSettingsRepository(db, createSecretBox(randomBytes(32)), now);
  });

  const storedPassword = () =>
    (db.prepare('SELECT smtp_password FROM email_settings').get() as { smtp_password: string })
      .smtp_password;

  it('has defaults before anything was saved', () => {
    expect(repository.get()).toEqual({
      host: null,
      port: 587,
      security: 'starttls',
      username: null,
      passwordSet: false,
      from: null,
      recipients: [],
      canStorePassword: true,
    });
    expect(repository.mailConfig()).toEqual({ smtp: null, recipients: [] });
  });

  it('stores the password encrypted and never returns it from get()', () => {
    const saved = repository.save(smtp);

    expect(saved).toMatchObject({ host: 'smtp.example.ch', passwordSet: true });
    expect(JSON.stringify(saved)).not.toContain('secret');
    expect(storedPassword()).not.toContain('secret');
    expect(repository.mailConfig()).toEqual({
      smtp: {
        host: 'smtp.example.ch',
        port: 587,
        security: 'starttls',
        username: 'home@example.ch',
        password: 'secret',
        from: 'home@example.ch',
      },
      recipients: ['anna@example.ch', 'ben@example.ch'],
    });
  });

  it('keeps the password while the server stays the same, removes it on request', () => {
    repository.save(smtp);
    repository.save({ ...smtp, password: undefined, recipients: ['anna@example.ch'] });
    expect(repository.mailConfig().smtp?.password).toBe('secret');

    repository.save({ ...smtp, password: null });
    expect(repository.get().passwordSet).toBe(false);
  });

  it.each([
    ['host', { host: 'smtp.evil.example' }],
    ['port', { port: 2525 }],
    ['security', { security: 'none' as const }],
    ['username', { username: 'other' }],
  ])('removes a kept password when the %s changes', (_field, change) => {
    repository.save(smtp);
    repository.save({ ...smtp, ...change, password: undefined });
    expect(repository.get().passwordSet).toBe(false);
  });

  it('cannot decrypt a password whose server was changed in the database directly', () => {
    repository.save(smtp);
    db.exec(`UPDATE email_settings SET smtp_host = 'smtp.evil.example'`);
    expect(() => repository.mailConfig()).toThrow('cannot be decrypted');
  });

  it('cannot store or read a password without an encryption key', () => {
    repository.save(smtp);
    const withoutKey = new EmailSettingsRepository(db, undefined, now);

    expect(withoutKey.get()).toMatchObject({ passwordSet: true, canStorePassword: false });
    expect(() => withoutKey.save(smtp)).toThrow('No encryption key');
    expect(() => withoutKey.mailConfig()).toThrow('SETTINGS_KEY is not set');
    expect(() =>
      new EmailSettingsRepository(db, createSecretBox(randomBytes(32)), now).mailConfig(),
    ).toThrow('Check SETTINGS_KEY');
  });
});
