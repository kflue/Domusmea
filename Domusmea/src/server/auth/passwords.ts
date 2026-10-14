import { randomBytes, scrypt, type ScryptOptions, timingSafeEqual } from 'node:crypto';

/**
 * scrypt cost: about 100 ms and 32 MiB per hash on a small server. The parameters are stored with
 * each hash, so they can be raised later without invalidating existing passwords.
 */
const COST = { N: 2 ** 15, r: 8, p: 1 } as const;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

/** Hashes a password as `scrypt$N$r$p$<salt>$<hash>` (base64), with a random salt. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const hash = await derive(password, salt, COST);
  return ['scrypt', COST.N, COST.r, COST.p, salt.toString('base64'), hash.toString('base64')].join(
    '$',
  );
}

/** Whether `password` matches `stored` (from {@link hashPassword}); `false` for malformed hashes. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split('$');
  const cost = { N: Number(n), r: Number(r), p: Number(p) };
  if (
    scheme !== 'scrypt' ||
    !salt ||
    !hash ||
    ![cost.N, cost.r, cost.p].every((value) => Number.isSafeInteger(value) && value > 0)
  ) {
    return false;
  }
  const expected = Buffer.from(hash, 'base64');
  const actual = await derive(password, Buffer.from(salt, 'base64'), cost, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function derive(
  password: string,
  salt: Buffer,
  cost: { N: number; r: number; p: number },
  length = KEY_LENGTH,
): Promise<Buffer> {
  const options: ScryptOptions = { ...cost, maxmem: 256 * cost.N * cost.r };
  return new Promise((resolve, reject) =>
    scrypt(password.normalize('NFC'), salt, length, options, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );
}
