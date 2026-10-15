import { describe, expect, it } from 'vitest';
import { addDays, addMonths, daysBetween } from './calendar';

describe('calendar', () => {
  it('adds months, clamped to the end of shorter months', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
    expect(addMonths('2027-01-01', -3)).toBe('2026-10-01');
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
    expect(addMonths('2024-02-29', 12)).toBe('2025-02-28');
  });

  it('adds days across months, years and daylight saving changes', () => {
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('counts the days between two dates', () => {
    expect(daysBetween('2026-10-01', '2027-01-01')).toBe(92);
    expect(daysBetween('2026-03-01', '2026-03-31')).toBe(30);
    expect(daysBetween('2027-01-01', '2026-12-25')).toBe(-7);
  });
});
