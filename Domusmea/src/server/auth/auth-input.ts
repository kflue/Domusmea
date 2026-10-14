import { z } from 'zod';
import {
  ChangePasswordInput,
  DEFAULT_PASSWORD,
  LoginInput,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  SetupInput,
  USERNAME_PATTERN,
} from '../../shared/auth';

// Not trimmed: spaces may be part of a password.
const newPasswordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH)
  .max(MAX_PASSWORD_LENGTH)
  .regex(/^\P{Cc}*$/u, 'Must not contain control characters');

/** Whether a new password differs from the username and the default password (ignoring case). */
const differsFrom = (username: string, password: string) =>
  ![DEFAULT_PASSWORD, username.toLowerCase()].includes(password.toLowerCase());

const REUSED_MESSAGE = 'Must differ from the username and the default password';

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
    password: newPasswordSchema,
  })
  .refine(({ username, password }) => differsFrom(username, password), {
    path: ['password'],
    message: REUSED_MESSAGE,
  }) satisfies z.ZodType<SetupInput, unknown>;

/** Validates the body of `PUT /api/account/password` for the account named `username`. */
export function changePasswordInputSchema(username: string) {
  return z
    .strictObject({
      currentPassword: z.string().min(1).max(MAX_PASSWORD_LENGTH),
      newPassword: newPasswordSchema,
    })
    .refine(({ newPassword }) => differsFrom(username, newPassword), {
      path: ['newPassword'],
      message: REUSED_MESSAGE,
    })
    .refine(({ currentPassword, newPassword }) => currentPassword !== newPassword, {
      path: ['newPassword'],
      message: 'Must differ from the current password',
    }) satisfies z.ZodType<ChangePasswordInput, unknown>;
}
