import { z } from 'zod';
import { optionalText, singleLine } from '../text-validation';
import { ITEM_CATEGORIES, ITEM_TEXT_MAX_LENGTH, ItemInput } from '../../shared/item';

const itemText = optionalText(ITEM_TEXT_MAX_LENGTH);

const optionalDate = z.iso
  .date()
  .nullish()
  .transform((value) => value ?? null);

/** Validates the body of `POST /api/items` and `PUT /api/items/:id`. Unknown fields are rejected. */
export const itemInputSchema = z
  .strictObject({
    name: singleLine(ITEM_TEXT_MAX_LENGTH).min(1),
    category: z
      .enum(ITEM_CATEGORIES)
      .nullish()
      .transform((value) => value ?? null),
    purchaseDate: z.iso.date(),
    costRappen: z
      .number()
      .int()
      .min(0)
      .max(Number.MAX_SAFE_INTEGER)
      .nullish()
      .transform((value) => value ?? null),
    warrantyExpires: optionalDate,
    manufacturer: itemText,
    model: itemText,
    serialNumber: itemText,
    seller: itemText,
  })
  .refine((item) => !item.warrantyExpires || item.warrantyExpires >= item.purchaseDate, {
    path: ['warrantyExpires'],
    message: 'Must not be before the purchase date',
  }) satisfies z.ZodType<ItemInput, unknown>;
