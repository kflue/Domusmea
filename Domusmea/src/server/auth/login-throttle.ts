/** Failed logins per username or client address before further attempts are refused. */
export const MAX_FAILED_LOGINS = 5;
/** Failures count within this window, and a block lasts this long. */
export const LOGIN_BLOCK_MS = 15 * 60_000;
/** Bound on tracked usernames and addresses, so failed logins cannot grow memory without limit. */
const MAX_TRACKED_KEYS = 10_000;

interface Failures {
  times: number[];
  blockedUntil: number;
}

/**
 * Slows down password guessing (ADR 0007): after {@link MAX_FAILED_LOGINS} failures for a key within
 * {@link LOGIN_BLOCK_MS}, that key is blocked for {@link LOGIN_BLOCK_MS}, even for the right password.
 * Callers record every attempt as a failure before checking the password and `reset` on success, so
 * parallel requests cannot pass the check while a slow password check is running. Kept in memory: a
 * restart clears it, which is acceptable for one household.
 */
export class LoginThrottle {
  private readonly failures = new Map<string, Failures>();

  constructor(private readonly now: () => number = Date.now) {}

  /** Whether any of `keys` (e.g. `user:anna`, `ip:192.0.2.1`) is blocked. */
  isBlocked(keys: readonly string[]): boolean {
    const now = this.now();
    return keys.some((key) => (this.failures.get(key)?.blockedUntil ?? 0) > now);
  }

  recordFailure(keys: readonly string[]): void {
    const now = this.now();
    for (const key of keys) {
      const entry = this.failures.get(key) ?? { times: [], blockedUntil: 0 };
      entry.times = entry.times.filter((time) => now - time < LOGIN_BLOCK_MS);
      entry.times.push(now);
      if (entry.times.length >= MAX_FAILED_LOGINS) {
        entry.blockedUntil = now + LOGIN_BLOCK_MS;
        entry.times = [];
      }
      this.failures.delete(key);
      this.failures.set(key, entry);
    }
    this.evict(now);
  }

  /** Forgets the failures of `keys`, after a successful login. */
  reset(keys: readonly string[]): void {
    for (const key of keys) {
      this.failures.delete(key);
    }
  }

  /**
   * Beyond {@link MAX_TRACKED_KEYS}, drops stale entries, then the least recently failed unblocked
   * ones. Active blocks are never dropped, so flooding the table cannot lift a block; their number is
   * bounded by how fast passwords can be checked.
   */
  private evict(now: number): void {
    if (this.failures.size <= MAX_TRACKED_KEYS) {
      return;
    }
    for (const [key, entry] of this.failures) {
      const stale = entry.times.every((time) => now - time >= LOGIN_BLOCK_MS);
      if (entry.blockedUntil <= now && stale) {
        this.failures.delete(key);
      }
    }
    for (const [key, entry] of this.failures) {
      if (this.failures.size <= MAX_TRACKED_KEYS) {
        break;
      }
      if (entry.blockedUntil <= now) {
        this.failures.delete(key);
      }
    }
  }
}

/**
 * Throttle key of a client address: IPv4 as is, IPv6 by its /64 network, since one connection
 * usually has a whole /64 to rotate through.
 */
export function addressKey(address: string): string {
  const ipv4 = address.replace(/^::ffff:(?=\d)/i, '');
  if (!ipv4.includes(':')) {
    return `ip:${ipv4}`;
  }
  const [head, tail] = address.split('%')[0].toLowerCase().split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const groups =
    tail === undefined
      ? left
      : [...left, ...new Array(8 - left.length - right.length).fill('0'), ...right];
  const network = groups.slice(0, 4).map((group) => Number.parseInt(group || '0', 16).toString(16));
  return `ip:${network.join(':')}::/64`;
}
