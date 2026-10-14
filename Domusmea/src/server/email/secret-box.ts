import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/** Encrypts short secrets (the SMTP password) for storage in the database (ADR 0006). */
export interface SecretBox {
  /** `context` is authenticated with the secret: decrypting needs the same context. */
  encrypt(plaintext: string, context: string): string;
  /** Throws if `sealed` was not encrypted with this key and context, or was modified. */
  decrypt(sealed: string, context: string): string;
}

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * AES-256-GCM with a random IV per secret and `context` as additional authenticated data; stored as
 * `v1:<iv>:<tag>:<ciphertext>` (base64).
 */
export function createSecretBox(key: Buffer): SecretBox {
  if (key.length !== 32) {
    throw new Error('The encryption key must be 32 bytes.');
  }
  return {
    encrypt(plaintext, context) {
      const iv = randomBytes(IV_LENGTH);
      const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
      cipher.setAAD(Buffer.from(context, 'utf8'));
      const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      return [VERSION, iv, cipher.getAuthTag(), ciphertext]
        .map((part) => (typeof part === 'string' ? part : part.toString('base64')))
        .join(':');
    },
    decrypt(sealed, context) {
      const [version, ivText, tagText, ciphertext] = sealed.split(':');
      const iv = Buffer.from(ivText ?? '', 'base64');
      const tag = Buffer.from(tagText ?? '', 'base64');
      if (
        version !== VERSION ||
        ciphertext === undefined ||
        iv.length !== IV_LENGTH ||
        tag.length !== TAG_LENGTH
      ) {
        throw new Error('Unknown secret format.');
      }
      const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
      decipher.setAAD(Buffer.from(context, 'utf8'));
      decipher.setAuthTag(tag);
      return Buffer.concat([
        decipher.update(Buffer.from(ciphertext, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    },
  };
}

/**
 * Secret box from `SETTINGS_KEY` (32 random bytes, base64, e.g. `openssl rand -base64 32`).
 * Returns `undefined` (logged if the value is invalid) when no usable key is configured; then no
 * password can be stored.
 */
export function secretBoxFromEnv(value: string | undefined): SecretBox | undefined {
  if (!value) {
    return undefined;
  }
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32) {
    console.error('Invalid SETTINGS_KEY: expected 32 bytes in base64; passwords cannot be stored.');
    return undefined;
  }
  return createSecretBox(key);
}
