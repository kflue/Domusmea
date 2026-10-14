import nodemailer from 'nodemailer';

export interface Mail {
  to: readonly string[];
  subject: string;
  text: string;
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

/**
 * SMTP mailer from `SMTP_*` environment variables. Without `SMTP_HOST` emails are written to the
 * console instead, so development works without a mail server (ADR 0003).
 */
export function createMailer(env: NodeJS.ProcessEnv = process.env): Mailer {
  const host = env['SMTP_HOST'];
  if (!host) {
    return {
      async send(mail) {
        console.log(
          `[mail] SMTP_HOST not set, email not sent\nTo: ${mail.to.join(', ')}\nSubject: ${mail.subject}\n\n${mail.text}`,
        );
      },
    };
  }
  const user = env['SMTP_USER'];
  const secure = env['SMTP_SECURE'] === 'true';
  const transport = nodemailer.createTransport({
    host,
    port: Number(env['SMTP_PORT'] ?? 587),
    secure,
    // Without implicit TLS, insist on STARTTLS so a network attacker cannot downgrade the connection
    // and read the password. SMTP_REQUIRE_TLS=false allows plain local test servers.
    requireTLS: !secure && env['SMTP_REQUIRE_TLS'] !== 'false',
    auth: user ? { user, pass: env['SMTP_PASS'] } : undefined,
  });
  const from = env['SMTP_FROM'] ?? user;
  return {
    async send(mail) {
      await transport.sendMail({ from, to: [...mail.to], subject: mail.subject, text: mail.text });
    },
  };
}
