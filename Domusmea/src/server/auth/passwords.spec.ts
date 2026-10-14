import { describe, expect, it } from 'vitest';
import { DEFAULT_PASSWORD_HASH } from './auth-repository';
import { hashPassword, verifyPassword } from './passwords';

describe('passwords', () => {
  it('verifies a hashed password and rejects others', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(hash).toMatch(/^scrypt\$32768\$8\$1\$[\w+/=]+\$[\w+/=]+$/);
    expect(await verifyPassword('correct horse battery', hash)).toBe(true);
    expect(await verifyPassword('correct horse batter', hash)).toBe(false);
  });

  it('salts every hash', async () => {
    expect(await hashPassword('same password')).not.toBe(await hashPassword('same password'));
  });

  it('treats malformed hashes as not matching', async () => {
    for (const stored of ['', 'plain', 'bcrypt$1$2$3$a$b', 'scrypt$0$8$1$c2FsdA==$aGFzaA==']) {
      expect(await verifyPassword('admin', stored), stored).toBe(false);
    }
  });

  it('ships the hash of the default password', async () => {
    expect(await verifyPassword('admin', DEFAULT_PASSWORD_HASH)).toBe(true);
  });
});
