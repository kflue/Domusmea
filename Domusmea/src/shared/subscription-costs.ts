import { addDays, addMonths } from './calendar';
import { monthRange, OpexFigures } from './finance-totals';
import { PriceChange, Subscription } from './subscription';

/**
 * Cost calculations for subscriptions (ADR 0009). Dates are `YYYY-MM-DD` strings and never go
 * through `Date` (ADR 0004); amounts are Rappen.
 */

/** The fields of a subscription the calculations need. */
export type SubscriptionTerms = Pick<
  Subscription,
  'interval' | 'costRappen' | 'startDate' | 'endDate' | 'priceChanges'
>;

/** A single charge of a subscription. */
export interface Billing {
  date: string;
  costRappen: number;
}

/** Price per billing in effect on `date`. */
export function priceOn(terms: SubscriptionTerms, date: string): number {
  let price = terms.costRappen;
  for (const change of byDate(terms.priceChanges)) {
    if (change.validFrom > date) {
      break;
    }
    price = change.costRappen;
  }
  return price;
}

/**
 * Billings from `from` to `to` (both inclusive), oldest first. They fall on the start date's day,
 * or on the last day of shorter months (31 January → 28 February; 29 February → 28 February).
 */
export function billings(terms: SubscriptionTerms, from: string, to: string): Billing[] {
  const last = terms.endDate !== null && terms.endDate < to ? terms.endDate : to;
  const step = terms.interval === 'monthly' ? 1 : 12;
  const result: Billing[] = [];
  // Always counted from the start date, so a billing clamped to 28 February returns to the 31st.
  for (let months = 0; ; months += step) {
    const date = addMonths(terms.startDate, months);
    if (date > last) {
      return result;
    }
    if (date >= from) {
      result.push({ date, costRappen: priceOn(terms, date) });
    }
  }
}

/** Sum of the billings of all `subscriptions` from `from` to `to` (both inclusive). */
export function paidRappen(
  subscriptions: readonly SubscriptionTerms[],
  from: string,
  to: string,
): number {
  return subscriptions
    .flatMap((terms) => billings(terms, from, to))
    .reduce((total, billing) => total + billing.costRappen, 0);
}

/** Not cancelled as of `today`: no end date, or one that has not passed. Includes future starts. */
export function isActive(terms: SubscriptionTerms, today: string): boolean {
  return terms.endDate === null || terms.endDate >= today;
}

/** The price that applies now, or the first price of a subscription that has not started yet. */
export function currentPrice(terms: SubscriptionTerms, today: string): number {
  return priceOn(terms, today > terms.startDate ? today : terms.startDate);
}

/** Cost per month at the current price; annual prices divided by 12, unrounded. */
export function monthlyShare(terms: SubscriptionTerms, today: string): number {
  const price = currentPrice(terms, today);
  return terms.interval === 'monthly' ? price : price / 12;
}

/** Monthly cost of the active subscriptions, rounded once after summing exact shares. */
export function monthlyTotalRappen(
  subscriptions: readonly SubscriptionTerms[],
  today: string,
): number {
  return Math.round(
    subscriptions
      .filter((terms) => isActive(terms, today))
      .reduce((total, terms) => total + monthlyShare(terms, today), 0),
  );
}

/**
 * Monthly share of `terms` in the calendar month `month` (`YYYY-MM`) for the finance chart
 * (ADR 0013): the price in effect on the first day it runs that month, annual prices divided by 12,
 * so an annual billing is no spike. 0 in months it does not run at all. Unrounded.
 */
export function monthlyShareIn(terms: SubscriptionTerms, month: string): number {
  const first = `${month}-01`;
  const last = addDays(addMonths(first, 1), -1);
  if (terms.startDate > last || (terms.endDate !== null && terms.endDate < first)) {
    return 0;
  }
  const price = priceOn(terms, terms.startDate > first ? terms.startDate : first);
  return terms.interval === 'monthly' ? price : price / 12;
}

/**
 * Subscriptions as an opex source of the finance dashboard: the current monthly total as on this
 * page, and per month from the first start up to the month of `today` the rounded sum of the
 * monthly shares.
 */
export function subscriptionOpex(
  subscriptions: readonly SubscriptionTerms[],
  today: string,
): OpexFigures {
  const monthly: Record<string, number> = {};
  const first = subscriptions.reduce<string | undefined>(
    (min, terms) => (min === undefined || terms.startDate < min ? terms.startDate : min),
    undefined,
  );
  if (first !== undefined) {
    for (const month of monthRange(first.slice(0, 7), today.slice(0, 7))) {
      monthly[month] = Math.round(
        subscriptions.reduce((sum, terms) => sum + monthlyShareIn(terms, month), 0),
      );
    }
  }
  return {
    currentMonthlyRappen: subscriptions
      .filter((terms) => isActive(terms, today))
      .reduce((sum, terms) => sum + monthlyShare(terms, today), 0),
    monthly,
  };
}

/** Yearly cost of the active subscriptions at their current prices. */
export function annualTotalRappen(
  subscriptions: readonly SubscriptionTerms[],
  today: string,
): number {
  return subscriptions
    .filter((terms) => isActive(terms, today))
    .reduce(
      (total, terms) =>
        total + currentPrice(terms, today) * (terms.interval === 'monthly' ? 12 : 1),
      0,
    );
}

/** The next billing on or after `today`, or `undefined` if there is none before the end date. */
export function nextBilling(terms: SubscriptionTerms, today: string): Billing | undefined {
  // One interval ahead always contains a billing, unless the subscription ends before it.
  const [year, month, day] = today.split('-');
  const horizon = `${Number(year) + 1}-${month}-${day}`;
  return billings(terms, today, horizon)[0];
}

/** Price changes after `today`, oldest first. */
export function upcomingPriceChanges(terms: SubscriptionTerms, today: string): PriceChange[] {
  return byDate(terms.priceChanges).filter((change) => change.validFrom > today);
}

function byDate(changes: readonly PriceChange[]): PriceChange[] {
  return [...changes].sort((a, b) => a.validFrom.localeCompare(b.validFrom));
}
