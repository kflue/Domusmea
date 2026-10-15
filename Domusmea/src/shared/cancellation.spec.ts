import { describe, expect, it } from 'vitest';
import { CancellationTerms, nextCancellationDeadline, reminderLeadDays } from './cancellation';

const carInsurance: CancellationTerms = {
  startDate: '2024-01-01',
  endDate: null,
  noticeMonths: 3,
};

describe('cancellation deadlines', () => {
  it('ends the notice period the day before the renewal, minus the notice', () => {
    expect(nextCancellationDeadline(carInsurance, '2026-08-01')).toEqual({
      renewal: '2027-01-01',
      deadline: '2026-09-30',
      // A third of the 92 days' notice.
      remindOn: '2026-08-30',
    });
  });

  it('moves on to the next renewal once the deadline has passed', () => {
    expect(nextCancellationDeadline(carInsurance, '2026-09-30')?.deadline).toBe('2026-09-30');
    expect(nextCancellationDeadline(carInsurance, '2026-10-01')).toMatchObject({
      renewal: '2028-01-01',
      deadline: '2027-09-30',
    });
  });

  it('gives a third of the notice period to act, at least a week', () => {
    expect(reminderLeadDays('2027-01-01', 3)).toBe(31);
    expect(reminderLeadDays('2027-01-01', 1)).toBe(10);
    expect(reminderLeadDays('2027-01-01', 12)).toBe(122);
    expect(reminderLeadDays('2027-01-01', 0)).toBe(7);
  });

  it('allows cancelling until the day before the renewal without a notice period', () => {
    const newspaper = { startDate: '2025-06-05', endDate: null, noticeMonths: 0 };
    expect(nextCancellationDeadline(newspaper, '2026-05-01')).toEqual({
      renewal: '2026-06-05',
      deadline: '2026-06-04',
      remindOn: '2026-05-28',
    });
  });

  it('keeps the start day for renewals of a 29 February start', () => {
    const leap = { startDate: '2024-02-29', endDate: null, noticeMonths: 1 };
    expect(nextCancellationDeadline(leap, '2027-03-01')?.renewal).toBe('2028-02-29');
  });

  it('has no deadline without a notice period or once cancelled', () => {
    expect(nextCancellationDeadline({ ...carInsurance, noticeMonths: null }, '2026-08-01')).toBe(
      undefined,
    );
    expect(nextCancellationDeadline({ ...carInsurance, endDate: '2026-12-31' }, '2026-08-01')).toBe(
      undefined,
    );
  });
});
