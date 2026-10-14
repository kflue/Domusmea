import { z } from 'zod';

/**
 * Single-line text: trimmed, no control characters (line breaks would let API callers shape the
 * text of emails).
 */
export const singleLine = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .regex(/^\P{Cc}*$/u, 'Must not contain line breaks or control characters');

/**
 * Optional multi-line text: line breaks and tabs allowed, other control characters not; trimmed,
 * empty or missing becomes `null`. Not for text that ends up in emails.
 */
export const optionalMultiLine = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    // A control character other than line feed, carriage return or tab.
    .refine((text) => !/[^\P{Cc}\n\r\t]/u.test(text), 'Must not contain control characters')
    .nullish()
    .transform((value) => value || null);

/** Optional single-line text: empty or missing becomes `null`. */
export const optionalText = (maxLength: number) =>
  singleLine(maxLength)
    .nullish()
    .transform((value) => value || null);
