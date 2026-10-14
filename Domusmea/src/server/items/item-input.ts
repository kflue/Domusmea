import { z } from 'zod';
import { ITEM_CATEGORIES, ITEM_TEXT_MAX_LENGTH, ItemInput } from '../../shared/item';

/**
 * Single-line text: trimmed, no control characters (line breaks would let API callers shape the
 * warranty email's text).
 */
const singleLine = () =>
  z
    .string()
    .trim()
    .max(ITEM_TEXT_MAX_LENGTH)
    .regex(/^\P{Cc}*$/u, 'Must not contain line breaks or control characters');

/** Optional text: empty or missing becomes `null`. */
const optionalText = singleLine()
  .nullish()
  .transform((value) => value || null);

const optionalDate = z.iso
  .date()
  .nullish()
  .transform((value) => value ?? null);

/** Validates the body of `POST /api/items` and `PUT /api/items/:id`. Unknown fields are rejected. */
export const itemInputSchema = z
  .strictObject({
    name: singleLine().min(1),
    category: z
      .enum(ITEM_CATEGORIES)
      .nullish()
      .transform((value) => value ?? null),
    purchaseDate: optionalDate,
    costRappen: z
      .number()
      .int()
      .min(0)
      .max(Number.MAX_SAFE_INTEGER)
      .nullish()
      .transform((value) => value ?? null),
    warrantyExpires: optionalDate,
    manufacturer: optionalText,
    model: optionalText,
    serialNumber: optionalText,
    seller: optionalText,
  })
  .refine(
    (item) =>
      !item.purchaseDate || !item.warrantyExpires || item.warrantyExpires >= item.purchaseDate,
    { path: ['warrantyExpires'], message: 'Must not be before the purchase date' },
  ) satisfies z.ZodType<ItemInput, unknown>;
