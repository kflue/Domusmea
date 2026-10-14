import nodemailer from 'nodemailer';
import { SmtpSecurity } from '../../shared/email-settings';

export interface Mail {
  to: readonly string[];
  subject: string;
  text: string;
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

/** SMTP connection with the decrypted password, from the email settings (ADR 0006). */
export interface SmtpConfig {
  host: string;
  port: number;
  security: SmtpSecurity;
  username: string | null;
  password: string | null;
  from: string;
}

/**
 * Mailer for the given SMTP server. Without one, emails are written to the console instead, so
 * development works without a mail server (ADR 0003).
 */
export function createMailer(smtp: SmtpConfig | null): Mailer {
  if (!smtp) {
    return {
      async send(mail) {
        console.log(
          `[mail] No SMTP server configured, email not sent\nTo: ${mail.to.join(', ')}\nSubject: ${mail.subject}\n\n${mail.text}`,
        );
      },
    };
  }
  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.security === 'tls',
    // With STARTTLS, insist on the upgrade so a network attacker cannot downgrade the connection and
    // read the password. 'none' is meant for local test mail servers only.
    requireTLS: smtp.security === 'starttls',
    ignoreTLS: smtp.security === 'none',
    auth: smtp.username ? { user: smtp.username, pass: smtp.password ?? '' } : undefined,
    // Fail fast so the settings page's test email reports unreachable servers quickly.
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });
  return {
    async send(mail) {
      await transport.sendMail({
        from: smtp.from,
        to: [...mail.to],
        subject: mail.subject,
        text: mail.text,
      });
    },
  };
}
