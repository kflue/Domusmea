import { z } from 'zod';
import { singleLine } from '../text-validation';
import {
  BILLING_INTERVALS,
  MAX_NOTICE_MONTHS,
  MAX_PRICE_CHANGES,
  MAX_PRICE_RAPPEN,
  SUBSCRIPTION_NAME_MAX_LENGTH,
  SubscriptionInput,
} from '../../shared/subscription';

const rappen = z.number().int().min(0).max(MAX_PRICE_RAPPEN);

/**
 * Validates the body of `POST /api/subscriptions` and `PUT /api/subscriptions/:id`. Unknown fields
 * are rejected. Price changes must fall after the start date and not after the end date, one per
 * day; they are returned oldest first.
 */
export const subscriptionInputSchema = z
  .strictObject({
    name: singleLine(SUBSCRIPTION_NAME_MAX_LENGTH).min(1),
    interval: z.enum(BILLING_INTERVALS),
    costRappen: rappen,
    startDate: z.iso.date(),
    endDate: z.iso
      .date()
      .nullish()
      .transform((value) => value ?? null),
    priceChanges: z
      .array(z.strictObject({ validFrom: z.iso.date(), costRappen: rappen }))
      .max(MAX_PRICE_CHANGES)
      .default([])
      .transform((changes) => [...changes].sort((a, b) => a.validFrom.localeCompare(b.validFrom))),
    noticeMonths: z
      .number()
      .int()
      .min(0)
      .max(MAX_NOTICE_MONTHS)
      .nullish()
      .transform((value) => value ?? null),
  })
  .superRefine((input, ctx) => {
    if (input.endDate !== null && input.endDate < input.startDate) {
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'Must not be before the start' });
    }
    const dates = input.priceChanges.map((change) => change.validFrom);
    const end = input.endDate;
    if (dates.some((date) => date <= input.startDate)) {
      ctx.addIssue({ code: 'custom', path: ['priceChanges'], message: 'Must be after the start' });
    }
    if (end !== null && dates.some((date) => date > end)) {
      ctx.addIssue({
        code: 'custom',
        path: ['priceChanges'],
        message: 'Must not be after the end',
      });
    }
    if (new Set(dates).size !== dates.length) {
      ctx.addIssue({ code: 'custom', path: ['priceChanges'], message: 'One change per day' });
    }
  }) satisfies z.ZodType<SubscriptionInput, unknown>;
