import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createSecretBox, secretBoxFromEnv } from './secret-box';

describe('secret box', () => {
  const box = createSecretBox(randomBytes(32));

  it('round-trips a secret without storing it in plain text', () => {
    const sealed = box.encrypt('pä ss:word', 'server');
    expect(sealed).not.toContain('pä ss');
    expect(sealed).not.toBe(box.encrypt('pä ss:word', 'server'));
    expect(box.decrypt(sealed, 'server')).toBe('pä ss:word');
  });

  it('rejects a modified secret, another context or a different key', () => {
    const [version, iv, tag, ciphertext] = box.encrypt('secret', 'server').split(':');
    const tampered = Buffer.from(ciphertext, 'base64');
    tampered[0] ^= 1;
    const sealed = (parts: string[]) => parts.join(':');
    expect(() =>
      box.decrypt(sealed([version, iv, tag, tampered.toString('base64')]), 'server'),
    ).toThrow();
    expect(() => box.decrypt(sealed([version, iv, tag, ciphertext]), 'other server')).toThrow();
    expect(() =>
      createSecretBox(randomBytes(32)).decrypt(box.encrypt('secret', 'server'), 'server'),
    ).toThrow();
    expect(() => box.decrypt('garbage', 'server')).toThrow('Unknown secret format.');
  });

  it('rejects a truncated authentication tag', () => {
    const [version, iv, tag, ciphertext] = box.encrypt('secret', 'server').split(':');
    const shortTag = Buffer.from(tag, 'base64').subarray(0, 4).toString('base64');
    expect(() => box.decrypt([version, iv, shortTag, ciphertext].join(':'), 'server')).toThrow(
      'Unknown secret format.',
    );
  });

  it('reads a 32-byte base64 key from SETTINGS_KEY', () => {
    expect(secretBoxFromEnv(undefined)).toBeUndefined();
    expect(secretBoxFromEnv('too-short')).toBeUndefined();
    expect(secretBoxFromEnv(randomBytes(32).toString('base64'))).toBeDefined();
  });
});
