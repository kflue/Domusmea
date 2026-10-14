import { z } from 'zod';
import {
  DEFAULT_PASSWORD,
  LoginInput,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  SetupInput,
  USERNAME_PATTERN,
} from '../../shared/auth';

/** Validates the body of `POST /api/auth/login`; the credentials themselves are checked later. */
export const loginInputSchema = z.strictObject({
  username: z.string().max(64),
  password: z.string().max(MAX_PASSWORD_LENGTH),
}) satisfies z.ZodType<LoginInput, unknown>;

/** Validates the body of `POST /api/auth/setup`: the credentials that replace the default ones. */
export const setupInputSchema = z
  .strictObject({
    username: z
      .string()
      .trim()
      .regex(USERNAME_PATTERN, 'Use 3 to 32 letters, digits, ".", "_" or "-"'),
    // Not trimmed: spaces may be part of a password.
    password: z
      .string()
      .min(MIN_PASSWORD_LENGTH)
      .max(MAX_PASSWORD_LENGTH)
      .regex(/^\P{Cc}*$/u, 'Must not contain control characters'),
  })
  .refine(
    ({ username, password }) =>
      ![DEFAULT_PASSWORD, username.toLowerCase()].includes(password.toLowerCase()),
    { path: ['password'], message: 'Must differ from the username and the default password' },
  ) satisfies z.ZodType<SetupInput, unknown>;
