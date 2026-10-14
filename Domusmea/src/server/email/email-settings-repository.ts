import { DatabaseSync } from 'node:sqlite';
import {
  DEFAULT_SMTP_PORT,
  EmailSettings,
  EmailSettingsInput,
  SmtpSecurity,
} from '../../shared/email-settings';
import { SmtpConfig } from './mailer';
import { SecretBox } from './secret-box';

interface EmailSettingsRow {
  smtp_host: string | null;
  smtp_port: number;
  smtp_security: SmtpSecurity;
  smtp_username: string | null;
  smtp_password: string | null;
  from_address: string | null;
  recipients: string;
}

/** What the mailer needs: the SMTP server with the decrypted password, and the recipients. */
export interface MailConfig {
  /** `null` when no SMTP server is configured. */
  smtp: SmtpConfig | null;
  recipients: string[];
}

/** The stored SMTP password cannot be decrypted (key missing or changed, or row modified). */
export class PasswordUnreadableError extends Error {}

/**
 * Persistence of the email settings (one row, ADR 0006). The SMTP password is stored encrypted with
 * `secretBox` and only leaves this class decrypted for the mailer, never through `get()`.
 */
export class EmailSettingsRepository {
  constructor(
    private readonly db: DatabaseSync,
    private readonly secretBox: SecretBox | undefined,
    private readonly now: () => string,
  ) {}

  /** Whether a password can be stored (an encryption key is configured). */
  get canStorePassword(): boolean {
    return this.secretBox !== undefined;
  }

  get(): EmailSettings {
    const row = this.row();
    return {
      host: row?.smtp_host ?? null,
      port: row?.smtp_port ?? DEFAULT_SMTP_PORT,
      security: row?.smtp_security ?? 'starttls',
      username: row?.smtp_username ?? null,
      passwordSet: (row?.smtp_password ?? null) !== null,
      from: row?.from_address ?? null,
      recipients: recipientsOf(row),
      canStorePassword: this.canStorePassword,
    };
  }

  /**
   * Saves the settings. Without a new password, the stored one is kept only while host, port,
   * security and username stay the same, so it is never sent to another server or in plain text.
   * Throws if a password is given but `canStorePassword` is false.
   */
  save(input: EmailSettingsInput): EmailSettings {
    const old = this.row();
    let password: string | null;
    if (input.password === undefined) {
      const sameServer =
        old !== undefined &&
        old.smtp_host === input.host &&
        old.smtp_port === input.port &&
        old.smtp_security === input.security &&
        old.smtp_username === input.username;
      password = sameServer ? old.smtp_password : null;
    } else if (input.password === null) {
      password = null;
    } else if (this.secretBox) {
      password = this.secretBox.encrypt(input.password, serverContext(input));
    } else {
      throw new Error('No encryption key configured; cannot store the SMTP password.');
    }
    this.db
      .prepare(
        `INSERT INTO email_settings (id, smtp_host, smtp_port, smtp_security, smtp_username,
           smtp_password, from_address, recipients, updated_at)
         VALUES (1, :host, :port, :security, :username, :password, :from, :recipients, :now)
         ON CONFLICT (id) DO UPDATE SET
           smtp_host = excluded.smtp_host, smtp_port = excluded.smtp_port,
           smtp_security = excluded.smtp_security, smtp_username = excluded.smtp_username,
           smtp_password = excluded.smtp_password, from_address = excluded.from_address,
           recipients = excluded.recipients, updated_at = excluded.updated_at`,
      )
      .run({
        host: input.host,
        port: input.port,
        security: input.security,
        username: input.username,
        password,
        from: input.from,
        recipients: JSON.stringify(input.recipients),
        now: this.now(),
      });
    return this.get();
  }

  /** Settings for sending. Throws if the stored password cannot be decrypted (key changed). */
  mailConfig(): MailConfig {
    const row = this.row();
    const recipients = recipientsOf(row);
    if (!row?.smtp_host) {
      return { smtp: null, recipients };
    }
    return {
      smtp: {
        host: row.smtp_host,
        port: row.smtp_port,
        security: row.smtp_security,
        username: row.smtp_username,
        password: row.smtp_password === null ? null : this.decrypt(row.smtp_password, row),
        from: row.from_address ?? '',
      },
      recipients,
    };
  }

  private row(): EmailSettingsRow | undefined {
    return this.db
      .prepare(
        `SELECT smtp_host, smtp_port, smtp_security, smtp_username, smtp_password, from_address,
           recipients
         FROM email_settings WHERE id = 1`,
      )
      .get() as EmailSettingsRow | undefined;
  }

  private decrypt(sealed: string, row: EmailSettingsRow): string {
    const unreadable = 'The stored SMTP password cannot be decrypted.';
    if (!this.secretBox) {
      throw new PasswordUnreadableError(`${unreadable} SETTINGS_KEY is not set.`);
    }
    try {
      return this.secretBox.decrypt(
        sealed,
        serverContext({
          host: row.smtp_host,
          port: row.smtp_port,
          security: row.smtp_security,
          username: row.smtp_username,
        }),
      );
    } catch (error) {
      throw new PasswordUnreadableError(
        `${unreadable} Check SETTINGS_KEY or enter the password again.`,
        { cause: error },
      );
    }
  }
}

/**
 * Binds the encrypted password to its server: if host, port, security or username are changed in
 * the database directly, the password can no longer be decrypted (ADR 0006).
 */
function serverContext(
  server: Pick<EmailSettingsInput, 'host' | 'port' | 'security' | 'username'>,
): string {
  return JSON.stringify([server.host, server.port, server.security, server.username]);
}

function recipientsOf(row: EmailSettingsRow | undefined): string[] {
  return row ? (JSON.parse(row.recipients) as string[]) : [];
}
