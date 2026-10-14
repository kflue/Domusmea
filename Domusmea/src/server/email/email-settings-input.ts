import { z } from 'zod';
import {
  EmailSettingsInput,
  MAX_RECIPIENTS,
  SMTP_HOST_PATTERN,
  SMTP_SECURITY_MODES,
} from '../../shared/email-settings';
import { optionalText } from '../text-validation';

const emailAddress = z.email().max(254);

/** Validates the body of `PUT /api/settings/email`. Unknown fields are rejected. */
export const emailSettingsInputSchema = z
  .strictObject({
    host: optionalText(253).refine((host) => host === null || SMTP_HOST_PATTERN.test(host), {
      message: 'Must be a host name or IP address',
    }),
    port: z.number().int().min(1).max(65535),
    security: z.enum(SMTP_SECURITY_MODES),
    username: optionalText(254),
    // Not trimmed: spaces may be part of a password.
    password: z
      .string()
      .min(1)
      .max(1024)
      .regex(/^\P{Cc}*$/u, 'Must not contain control characters')
      .nullish(),
    from: emailAddress.nullish().transform((value) => value ?? null),
    recipients: z.array(emailAddress).max(MAX_RECIPIENTS),
  })
  .refine((settings) => !settings.host || settings.from, {
    path: ['from'],
    message: 'Required when an SMTP server is set',
  }) satisfies z.ZodType<EmailSettingsInput, unknown>;
