import { z } from 'zod';
import { optionalMultiLine, optionalText } from '../text-validation';
import {
  BILL_NOTES_MAX_LENGTH,
  COMMODITIES,
  COMMODITY_INFO,
  INVOICE_NUMBER_MAX_LENGTH,
  MAX_AMOUNT_MILLI,
  MAX_UTILITY_RAPPEN,
  UtilityBillInput,
  UtilityBillLine,
  UtilityEntryInput,
} from '../../shared/utility';

const rappen = z.number().int().min(-MAX_UTILITY_RAPPEN).max(MAX_UTILITY_RAPPEN);

const lineShape = {
  commodity: z.enum(COMMODITIES),
  amountMilli: z
    .number()
    .int()
    .min(0, 'Must not be negative')
    .max(MAX_AMOUNT_MILLI)
    .nullish()
    .transform((value) => value ?? null),
  costRappen: rappen.default(0),
  fixedFeeRappen: rappen.default(0),
};

/** Period and the bill's invoice number and notes (R11); empty text becomes `null`. */
const billShape = {
  periodFrom: z.iso.date(),
  periodTo: z.iso.date(),
  invoiceNumber: optionalText(INVOICE_NUMBER_MAX_LENGTH),
  notes: optionalMultiLine(BILL_NOTES_MAX_LENGTH),
};

/**
 * Commodity rules (ADR 0011): metered commodities need an amount, garbage has neither amount nor
 * usage cost, and only commodities with a fixed fee may have one. `path` locates the line.
 */
function checkLine(line: UtilityBillLine, ctx: z.RefinementCtx, path: (string | number)[]): void {
  const info = COMMODITY_INFO[line.commodity];
  if (info.unit === null) {
    if (line.amountMilli !== null) {
      ctx.addIssue({ code: 'custom', path: [...path, 'amountMilli'], message: 'Has no amount' });
    }
    if (line.costRappen !== 0) {
      ctx.addIssue({ code: 'custom', path: [...path, 'costRappen'], message: 'Fixed fee only' });
    }
  } else if (line.amountMilli === null) {
    ctx.addIssue({ code: 'custom', path: [...path, 'amountMilli'], message: 'Required' });
  }
  if (!info.hasFixedFee && line.fixedFeeRappen !== 0) {
    ctx.addIssue({
      code: 'custom',
      path: [...path, 'fixedFeeRappen'],
      message: 'Has no fixed fee',
    });
  }
}

function checkPeriod(input: { periodFrom: string; periodTo: string }, ctx: z.RefinementCtx): void {
  if (input.periodTo < input.periodFrom) {
    ctx.addIssue({ code: 'custom', path: ['periodTo'], message: 'Must not be before the start' });
  }
}

/**
 * Validates the body of `PUT /api/utilities/:id`. Unknown fields are rejected; a missing invoice
 * number or notes stays `undefined` (keep the stored value).
 */
export const utilityEntryInputSchema = z
  .strictObject({
    ...billShape,
    ...lineShape,
    invoiceNumber: billShape.invoiceNumber.optional(),
    notes: billShape.notes.optional(),
  })
  .superRefine((input, ctx) => {
    checkPeriod(input, ctx);
    checkLine(input, ctx, []);
  }) satisfies z.ZodType<UtilityEntryInput, unknown>;

/**
 * Validates the body of `POST /api/utilities`: a period and one to four lines, at most one per
 * commodity.
 */
export const utilityBillInputSchema = z
  .strictObject({
    ...billShape,
    lines: z.array(z.strictObject(lineShape)).min(1).max(COMMODITIES.length),
  })
  .superRefine((input, ctx) => {
    checkPeriod(input, ctx);
    input.lines.forEach((line, index) => checkLine(line, ctx, ['lines', index]));
    const commodities = input.lines.map((line) => line.commodity);
    if (new Set(commodities).size !== commodities.length) {
      ctx.addIssue({ code: 'custom', path: ['lines'], message: 'One line per commodity' });
    }
  }) satisfies z.ZodType<UtilityBillInput, unknown>;
