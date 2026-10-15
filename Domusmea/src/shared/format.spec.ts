import { describe, expect, it } from 'vitest';
import {
  formatAmount,
  formatChf,
  formatDate,
  formatDateTime,
  formatFrancs,
  formatMonth,
  formatPercentChange,
  formatShare,
  formatUnitPrice,
  todayIn,
} from './format';

describe('formatChf', () => {
  it('formats Rappen as Swiss francs with thousands separator', () => {
    expect(formatChf(123450)).toMatch(/^CHF\s1.234\.50$/);
    expect(formatChf(0)).toMatch(/^CHF\s0\.00$/);
  });
});

describe('formatFrancs, formatAmount and formatUnitPrice', () => {
  it('format numbers for columns that state the unit in the header', () => {
    expect(formatFrancs(123450)).toMatch(/^1.234\.50$/);
    expect(formatFrancs(-50)).toMatch(/^[-−]0\.50$/);
    expect(formatAmount(1_234_500)).toMatch(/^1.234\.5$/);
    expect(formatAmount(21_000)).toBe('21');
    expect(formatAmount(125)).toBe('0.125');
    expect(formatUnitPrice(28.7)).toBe('0.2870');
  });

  it('formats a change in percent with its sign', () => {
    expect(formatPercentChange(12.34)).toMatch(/^\+12\.3\s?%$/);
    expect(formatPercentChange(-4)).toMatch(/^[-−]4\.0\s?%$/);
    expect(formatPercentChange(0)).toMatch(/^0\.0\s?%$/);
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

describe('formatDateTime', () => {
  it('formats a timestamp in Swiss notation and local time', () => {
    expect(formatDateTime('2026-10-14T20:45:00.000Z')).toBe('14.10.2026, 22:45');
    expect(formatDateTime('2026-01-05T07:03:00.000Z', 'UTC')).toBe('05.01.2026, 07:03');
  });
});

describe('formatMonth and formatShare', () => {
  it('formats a month as its short English name and year', () => {
    expect(formatMonth('2026-03')).toBe('Mar 2026');
    expect(formatMonth('2025-12-31')).toBe('Dec 2025');
  });

  it('formats a share in whole percent', () => {
    expect(formatShare(0.7019)).toMatch(/^70\s?%$/);
    expect(formatShare(0)).toMatch(/^0\s?%$/);
  });
});
