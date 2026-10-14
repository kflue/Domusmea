/**
 * How the SMTP connection is secured: STARTTLS (required, usually port 587), implicit TLS (usually
 * port 465) or none (only for local test mail servers).
 */
export const SMTP_SECURITY_MODES = ['starttls', 'tls', 'none'] as const;
export type SmtpSecurity = (typeof SMTP_SECURITY_MODES)[number];

export const SMTP_SECURITY_LABELS: Record<SmtpSecurity, string> = {
  starttls: 'STARTTLS (port 587)',
  tls: 'TLS (port 465)',
  none: 'None (local test servers only)',
};

export const DEFAULT_SMTP_PORT = 587;

/** Characters of a host name or IP address (IPv6 with or without brackets). */
export const SMTP_HOST_PATTERN = /^[\w.:[\]-]+$/;

/** Maximum number of reminder email recipients. */
export const MAX_RECIPIENTS = 10;

/**
 * Email settings as returned by `GET /api/settings/email` (ADR 0006). The password is never sent to
 * the browser; `passwordSet` tells whether one is stored.
 */
export interface EmailSettings {
  /** SMTP server; `null` means emails are only logged to the server console. */
  host: string | null;
  port: number;
  security: SmtpSecurity;
  username: string | null;
  passwordSet: boolean;
  /** Sender address of the emails. */
  from: string | null;
  /** Recipients of reminder emails; without any, no email is sent. */
  recipients: string[];
  /** Whether the server can store a password (`SETTINGS_KEY` is set). */
  canStorePassword: boolean;
}

/** Request body of `PUT /api/settings/email`. */
export interface EmailSettingsInput {
  host: string | null;
  port: number;
  security: SmtpSecurity;
  username: string | null;
  /**
   * A new password, `null` to remove the stored one, or omitted to keep it. A kept password is still
   * removed when host, port, security or username change, so it is never sent to a different server
   * or without encryption.
   */
  password?: string | null;
  from: string | null;
  recipients: string[];
}

/** Error body of `POST /api/settings/email/test`. */
export interface TestEmailError {
  error: 'no-smtp-host' | 'no-recipients' | 'too-soon' | 'send-failed';
  /** What went wrong, for `send-failed`; includes the mail server's reply only after a greeting. */
  message?: string;
}
