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

/** Optional single-line text: empty or missing becomes `null`. */
export const optionalText = (maxLength: number) =>
  singleLine(maxLength)
    .nullish()
    .transform((value) => value || null);
