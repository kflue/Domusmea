import { describe, expect, it } from 'vitest';
import {
  annualTotalRappen,
  billings,
  currentPrice,
  isActive,
  monthlyShare,
  monthlyTotalRappen,
  nextBilling,
  paidRappen,
  priceOn,
  SubscriptionTerms,
  upcomingPriceChanges,
} from './subscription-costs';

const netflix: SubscriptionTerms = {
  interval: 'monthly',
  costRappen: 1890,
  startDate: '2026-01-15',
  endDate: null,
  priceChanges: [],
};

const carInsurance: SubscriptionTerms = {
  interval: 'annual',
  costRappen: 100000,
  startDate: '2024-03-01',
  endDate: null,
  priceChanges: [],
};

const dates = (terms: SubscriptionTerms, from: string, to: string) =>
  billings(terms, from, to).map((billing) => billing.date);

describe('subscription costs', () => {
  it('bills monthly on the start day, from the start date on', () => {
    expect(dates(netflix, '2025-01-01', '2026-04-15')).toEqual([
      '2026-01-15',
      '2026-02-15',
      '2026-03-15',
      '2026-04-15',
    ]);
    expect(dates(netflix, '2026-02-16', '2026-03-14')).toEqual([]);
  });

  it('moves billings to the last day of shorter months', () => {
    const endOfMonth = { ...netflix, startDate: '2024-01-31' };
    expect(dates(endOfMonth, '2024-01-01', '2024-05-01')).toEqual([
      '2024-01-31',
      '2024-02-29',
      '2024-03-31',
      '2024-04-30',
    ]);
    const leapDay = { ...carInsurance, startDate: '2024-02-29' };
    expect(dates(leapDay, '2024-01-01', '2028-12-31')).toEqual([
      '2024-02-29',
      '2025-02-28',
      '2026-02-28',
      '2027-02-28',
      '2028-02-29',
    ]);
  });

  it('stops billing after the end date', () => {
    const cancelled = { ...netflix, endDate: '2026-03-15' };
    expect(dates(cancelled, '2026-01-01', '2026-12-31')).toEqual([
      '2026-01-15',
      '2026-02-15',
      '2026-03-15',
    ]);
    expect(isActive(cancelled, '2026-03-15')).toBe(true);
    expect(isActive(cancelled, '2026-03-16')).toBe(false);
    expect(nextBilling(cancelled, '2026-03-16')).toBeUndefined();
  });

  it('charges each billing at the price in effect on its date', () => {
    const raised = {
      ...netflix,
      priceChanges: [
        { validFrom: '2026-06-01', costRappen: 2390 },
        { validFrom: '2026-03-15', costRappen: 2190 },
      ],
    };
    expect(priceOn(raised, '2026-03-14')).toBe(1890);
    expect(priceOn(raised, '2026-03-15')).toBe(2190);
    expect(priceOn(raised, '2026-07-01')).toBe(2390);
    expect(billings(raised, '2026-01-01', '2026-06-30').map((b) => b.costRappen)).toEqual([
      1890, 1890, 2190, 2190, 2190, 2390,
    ]);
    expect(upcomingPriceChanges(raised, '2026-04-01')).toEqual([
      { validFrom: '2026-06-01', costRappen: 2390 },
    ]);
  });

  it('sums what was paid in a period, including cancelled subscriptions', () => {
    const cancelled = { ...netflix, endDate: '2026-02-28' };
    // Car insurance on 1 March, Netflix in January and February.
    expect(paidRappen([carInsurance, cancelled], '2026-01-01', '2026-10-15')).toBe(103780);
    expect(paidRappen([carInsurance], '2026-01-01', '2026-02-28')).toBe(0);
  });

  it('breaks annual prices down per month and rounds totals once', () => {
    expect(monthlyShare(netflix, '2026-10-15')).toBe(1890);
    expect(monthlyShare(carInsurance, '2026-10-15')).toBeCloseTo(8333.33);
    // Three annual 1000.00 shares are 3 × 83.333… = 250.00, not 3 × 83.33.
    const three = [carInsurance, carInsurance, carInsurance];
    expect(monthlyTotalRappen(three, '2026-10-15')).toBe(25000);
    expect(annualTotalRappen([netflix, carInsurance], '2026-10-15')).toBe(122680);
  });

  it('leaves cancelled subscriptions out of the planning totals', () => {
    const cancelled = { ...netflix, endDate: '2026-02-28' };
    expect(monthlyTotalRappen([carInsurance, cancelled], '2026-10-15')).toBe(8333);
    expect(annualTotalRappen([carInsurance, cancelled], '2026-10-15')).toBe(100000);
  });

  it('plans subscriptions that start later with their first price', () => {
    const later = {
      ...netflix,
      startDate: '2027-01-15',
      priceChanges: [{ validFrom: '2027-06-01', costRappen: 2390 }],
    };
    expect(isActive(later, '2026-10-15')).toBe(true);
    expect(currentPrice(later, '2026-10-15')).toBe(1890);
    expect(nextBilling(later, '2026-10-15')).toEqual({ date: '2027-01-15', costRappen: 1890 });
  });

  it('finds the next billing, today included', () => {
    expect(nextBilling(netflix, '2026-10-15')).toEqual({ date: '2026-10-15', costRappen: 1890 });
    expect(nextBilling(netflix, '2026-10-16')?.date).toBe('2026-11-15');
    expect(nextBilling(carInsurance, '2026-03-02')?.date).toBe('2027-03-01');
  });
});
