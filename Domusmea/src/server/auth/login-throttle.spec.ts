import { describe, expect, it } from 'vitest';
import { addressKey, LOGIN_BLOCK_MS, LoginThrottle, MAX_FAILED_LOGINS } from './login-throttle';

describe('LoginThrottle', () => {
  const keys = ['user:anna', 'ip:192.0.2.1'];

  it('blocks a key after too many failures, for the block time', () => {
    let now = 0;
    const throttle = new LoginThrottle(() => now);
    for (let i = 1; i < MAX_FAILED_LOGINS; i++) {
      throttle.recordFailure(keys);
    }
    expect(throttle.isBlocked(keys)).toBe(false);

    throttle.recordFailure(keys);
    expect(throttle.isBlocked(['user:anna'])).toBe(true);
    expect(throttle.isBlocked(['ip:192.0.2.1', 'user:ben'])).toBe(true);
    expect(throttle.isBlocked(['user:ben', 'ip:192.0.2.2'])).toBe(false);

    now += LOGIN_BLOCK_MS - 1;
    expect(throttle.isBlocked(keys)).toBe(true);
    now += 1;
    expect(throttle.isBlocked(keys)).toBe(false);
  });

  it('only counts failures within the window', () => {
    let now = 0;
    const throttle = new LoginThrottle(() => now);
    for (let i = 0; i < MAX_FAILED_LOGINS; i++) {
      throttle.recordFailure(keys);
      now += LOGIN_BLOCK_MS / 2;
    }
    expect(throttle.isBlocked(keys)).toBe(false);
  });

  it('forgets failures after a successful login', () => {
    const throttle = new LoginThrottle(() => 0);
    for (let i = 1; i < MAX_FAILED_LOGINS; i++) {
      throttle.recordFailure(keys);
    }
    throttle.reset(keys);
    throttle.recordFailure(keys);
    expect(throttle.isBlocked(keys)).toBe(false);
  });

  it('keeps active blocks when many other keys fail', () => {
    const throttle = new LoginThrottle(() => 0);
    for (let i = 0; i < MAX_FAILED_LOGINS; i++) {
      throttle.recordFailure(['user:anna']);
    }
    for (let i = 0; i < 10_050; i++) {
      throttle.recordFailure([`user:random-${i}`]);
    }
    expect(throttle.isBlocked(['user:anna'])).toBe(true);
  });
});

describe('addressKey', () => {
  it('keys IPv4 by address and IPv6 by /64 network', () => {
    expect(addressKey('192.0.2.1')).toBe('ip:192.0.2.1');
    expect(addressKey('::ffff:192.0.2.1')).toBe('ip:192.0.2.1');
    expect(addressKey('2001:db8:1:2:aaaa::1')).toBe('ip:2001:db8:1:2::/64');
    expect(addressKey('2001:DB8:1:2:bbbb:cccc:dddd:eeee')).toBe('ip:2001:db8:1:2::/64');
    expect(addressKey('2001:db8::5')).toBe('ip:2001:db8:0:0::/64');
    expect(addressKey('fe80::1%eth0')).toBe('ip:fe80:0:0:0::/64');
    expect(addressKey('::1')).toBe('ip:0:0:0:0::/64');
  });
});
