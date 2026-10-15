import { BillingInterval, Subscription, SubscriptionInput } from '../../../shared/subscription';
import { parseChf, rappenToChfText } from '../../shared/chf-input';

/** A price change as edited in the form. */
export interface PriceChangeFormModel {
  validFrom: string;
  /** New price in CHF as typed. */
  cost: string;
}

/** Form state: strings only, as Signal Forms binds inputs to non-null values. */
export interface SubscriptionFormModel {
  name: string;
  interval: BillingInterval;
  /** Price per billing in CHF as typed, e.g. `18.90`. */
  cost: string;
  startDate: string;
  /** Empty while the subscription runs. */
  endDate: string;
  priceChanges: PriceChangeFormModel[];
  /** Months as the select's value; empty for no notice period. */
  noticeMonths: string;
}

/** A new monthly subscription first billed on `today` (`YYYY-MM-DD`). */
export function newSubscriptionForm(today: string): SubscriptionFormModel {
  return {
    name: '',
    interval: 'monthly',
    cost: '',
    startDate: today,
    endDate: '',
    priceChanges: [],
    noticeMonths: '',
  };
}

export function toFormModel(subscription: Subscription): SubscriptionFormModel {
  return {
    name: subscription.name,
    interval: subscription.interval,
    cost: rappenToChfText(subscription.costRappen),
    startDate: subscription.startDate,
    endDate: subscription.endDate ?? '',
    priceChanges: subscription.priceChanges.map((change) => ({
      validFrom: change.validFrom,
      cost: rappenToChfText(change.costRappen),
    })),
    noticeMonths: subscription.noticeMonths === null ? '' : String(subscription.noticeMonths),
  };
}

/** Converts a valid form model into the API body, with price changes oldest first. */
export function toSubscriptionInput(form: SubscriptionFormModel): SubscriptionInput {
  return {
    name: form.name.trim(),
    interval: form.interval,
    costRappen: parseChf(form.cost) ?? 0,
    startDate: form.startDate,
    endDate: form.endDate || null,
    priceChanges: form.priceChanges
      .map((change) => ({ validFrom: change.validFrom, costRappen: parseChf(change.cost) ?? 0 }))
      .sort((a, b) => a.validFrom.localeCompare(b.validFrom)),
    noticeMonths: form.noticeMonths === '' ? null : Number(form.noticeMonths),
  };
}
