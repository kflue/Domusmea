/** How often a subscription is billed. */
export const BILLING_INTERVALS = ['monthly', 'annual'] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export const BILLING_INTERVAL_LABELS: Record<BillingInterval, string> = {
  monthly: 'Monthly',
  annual: 'Annually',
};

/** Maximum length of the subscription name. */
export const SUBSCRIPTION_NAME_MAX_LENGTH = 200;
/** Maximum number of price changes per subscription. */
export const MAX_PRICE_CHANGES = 100;
/**
 * Highest price per billing, CHF 1'000'000. Keeps sums over many subscriptions and years far below
 * `Number.MAX_SAFE_INTEGER`.
 */
export const MAX_PRICE_RAPPEN = 100_000_000;
/** Longest notice period in months. */
export const MAX_NOTICE_MONTHS = 24;

/** A new price per billing, charged for billings on or after `validFrom` (ADR 0009). */
export interface PriceChange {
  /** `YYYY-MM-DD`, after the subscription's start date. */
  validFrom: string;
  costRappen: number;
}

/**
 * A recurring cost such as a streaming service or an insurance, as returned by
 * `/api/subscriptions`. Billings fall on the day of `startDate`, every month or year (ADR 0009).
 * Calendar dates are `YYYY-MM-DD`, timestamps ISO 8601 UTC, money integer Rappen (ADR 0004).
 */
export interface Subscription {
  id: number;
  name: string;
  interval: BillingInterval;
  /** Price per billing from `startDate` until the first price change. */
  costRappen: number;
  /** First billing. */
  startDate: string;
  /** Cancelled: billings after this date are not counted. `null` while it runs. */
  endDate: string | null;
  /** Price history, oldest first. */
  priceChanges: PriceChange[];
  /**
   * Months of notice needed to cancel before the contract renews on the anniversary of `startDate`;
   * `0` means until the day before. `null`: cancellable any time, no reminder (ADR 0010).
   */
  noticeMonths: number | null;
  createdAt: string;
  updatedAt: string;
}

/** Request body of `POST /api/subscriptions` and `PUT /api/subscriptions/:id`. */
export type SubscriptionInput = Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>;
