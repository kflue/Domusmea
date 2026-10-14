import { describe, expect, it } from 'vitest';
import { formatChf, formatDate, todayIn } from './format';

describe('formatChf', () => {
  it('formats Rappen as Swiss francs with thousands separator', () => {
    expect(formatChf(123450)).toMatch(/^CHF\s1.234\.50$/);
    expect(formatChf(0)).toMatch(/^CHF\s0\.00$/);
  });
});

describe('formatDate', () => {
  it('formats ISO dates as DD.MM.YYYY', () => {
    expect(formatDate('2026-03-07')).toBe('07.03.2026');
  });
});

describe('todayIn', () => {
  it('returns the calendar date in the given time zone', () => {
    const lateEveningUtc = new Date('2026-10-10T22:30:00Z');
    expect(todayIn('UTC', lateEveningUtc)).toBe('2026-10-10');
    expect(todayIn('Europe/Zurich', lateEveningUtc)).toBe('2026-10-11');
  });
});
