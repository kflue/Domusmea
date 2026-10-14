import express, { Router } from 'express';
import { EmailSettings, TestEmailError } from '../../shared/email-settings';
import { jsonErrors, validationError } from '../api-errors';
import { emailSettingsInputSchema } from './email-settings-input';
import { EmailSettingsRepository, PasswordUnreadableError } from './email-settings-repository';
import { createMailer, Mail, Mailer, SmtpConfig } from './mailer';

/** Minimum time between two test emails, until a login restricts the settings (ADR 0006). */
export const TEST_EMAIL_INTERVAL_MS = 30_000;

/**
 * REST API for the email settings, mounted at `/api/settings/email` (ADR 0006). `repository` is
 * resolved per request so the database is only opened when the API is used.
 */
export function createEmailSettingsRouter(
  repository: () => EmailSettingsRepository,
  mailerFor: (smtp: SmtpConfig | null) => Mailer = createMailer,
  now: () => number = Date.now,
): Router {
  const router = express.Router();
  router.use(express.json({ limit: '16kb' }));

  router.get('/', (_req, res) => {
    res.json(repository().get());
  });

  router.put('/', (req, res) => {
    const input = emailSettingsInputSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json(validationError(input.error));
      return;
    }
    if (input.data.password && !repository().canStorePassword) {
      res.status(400).json({
        error: 'invalid',
        fields: { password: ['Cannot be stored: SETTINGS_KEY is not set on the server'] },
      });
      return;
    }
    res.json(repository().save(input.data));
  });

  /**
   * Sends a test email with the saved settings, to the saved recipients only, at most once per
   * `TEST_EMAIL_INTERVAL_MS`.
   */
  let lastTestAt = Number.NEGATIVE_INFINITY;
  router.post('/test', async (_req, res) => {
    const refusal = testRefusal(repository().get());
    if (refusal) {
      res.status(409).json({ error: refusal } satisfies TestEmailError);
      return;
    }
    if (now() - lastTestAt < TEST_EMAIL_INTERVAL_MS) {
      res.status(429).json({ error: 'too-soon' } satisfies TestEmailError);
      return;
    }
    lastTestAt = now();
    try {
      const { smtp, recipients } = repository().mailConfig();
      await mailerFor(smtp).send(testMail(recipients));
      res.status(204).end();
    } catch (error) {
      console.error('Test email failed', error);
      res
        .status(502)
        .json({ error: 'send-failed', message: failureMessage(error) } satisfies TestEmailError);
    }
  });

  router.use(jsonErrors);
  return router;
}

/** Why a test email cannot be sent with these settings, if it cannot. */
function testRefusal(settings: EmailSettings): TestEmailError['error'] | undefined {
  if (!settings.host) {
    return 'no-smtp-host';
  }
  return settings.recipients.length === 0 ? 'no-recipients' : undefined;
}

function testMail(recipients: readonly string[]): Mail {
  return {
    to: recipients,
    subject: 'Domusmea test email',
    text: [
      'This is a test email from Domusmea. Your email settings work.',
      'Reminder emails are sent to the same recipients as this email.',
      'Domusmea',
    ].join('\n\n'),
  };
}

/**
 * Nodemailer error codes as fixed messages. The server's reply is only included where it comes from
 * an SMTP server that greeted us; otherwise the test email could read banners of other services
 * (port probing, ADR 0006).
 */
const FAILURES: Record<string, { message: string; withReply?: boolean }> = {
  EDNS: { message: 'The server name could not be found.' },
  ECONNECTION: { message: 'The server could not be reached.' },
  ETIMEDOUT: { message: 'The server did not answer in time.' },
  ESOCKET: { message: 'The connection to the server failed.' },
  ETLS: { message: 'No secure connection could be established.' },
  EAUTH: { message: 'The server rejected the user name or password.', withReply: true },
  EENVELOPE: { message: 'The server rejected the sender or a recipient.', withReply: true },
  EMESSAGE: { message: 'The server rejected the email.', withReply: true },
};

/** Why the test email failed, as shown on the settings page. */
function failureMessage(error: unknown): string {
  if (error instanceof PasswordUnreadableError) {
    return error.message;
  }
  const { code, response } = (error ?? {}) as { code?: unknown; response?: unknown };
  const failure = typeof code === 'string' ? FAILURES[code] : undefined;
  if (!failure) {
    return 'The server did not respond like an SMTP server.';
  }
  if (!failure.withReply || typeof response !== 'string') {
    return failure.message;
  }
  const reply = response
    .replaceAll(/\p{Cc}+/gu, ' ')
    .trim()
    .slice(0, 200);
  return `${failure.message} The server replied: ${reply}`;
}
