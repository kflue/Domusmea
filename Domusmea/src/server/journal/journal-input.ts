import { z } from 'zod';
import { optionalMultiLine, optionalText, singleLine } from '../text-validation';
import {
  JOURNAL_NOTES_MAX_LENGTH,
  JOURNAL_TEXT_MAX_LENGTH,
  JournalEntryInput,
} from '../../shared/journal';

/** Validates the body of `POST /api/journal` and `PUT /api/journal/:id`. Unknown fields are rejected. */
export const journalEntryInputSchema = z.strictObject({
  date: z.iso.date(),
  title: singleLine(JOURNAL_TEXT_MAX_LENGTH).min(1),
  costRappen: z
    .number()
    .int()
    .min(0)
    .max(Number.MAX_SAFE_INTEGER)
    .nullish()
    .transform((value) => value ?? null),
  contractor: optionalText(JOURNAL_TEXT_MAX_LENGTH),
  notes: optionalMultiLine(JOURNAL_NOTES_MAX_LENGTH),
  itemId: z
    .number()
    .int()
    .positive()
    .max(Number.MAX_SAFE_INTEGER)
    .nullish()
    .transform((value) => value ?? null),
}) satisfies z.ZodType<JournalEntryInput, unknown>;
