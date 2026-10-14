import {
  DEFAULT_SMTP_PORT,
  EmailSettings,
  EmailSettingsInput,
  SmtpSecurity,
} from '../../../shared/email-settings';

/** Form state: strings and booleans, as Signal Forms binds inputs to non-null values. */
export interface EmailSettingsFormModel {
  host: string;
  port: string;
  security: SmtpSecurity;
  username: string;
  /** A new password; empty keeps the saved one. */
  password: string;
  removePassword: boolean;
  from: string;
  /** Addresses separated by line breaks, commas or semicolons. */
  recipients: string;
}

export const EMPTY_EMAIL_SETTINGS_FORM: EmailSettingsFormModel = {
  host: '',
  port: String(DEFAULT_SMTP_PORT),
  security: 'starttls',
  username: '',
  password: '',
  removePassword: false,
  from: '',
  recipients: '',
};

/** Rough address check; the API validates exactly. */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseRecipients(text: string): string[] {
  return text.split(/[\s,;]+/).filter(Boolean);
}

/** The port as a number, or `undefined` if it is not a valid port. */
export function parsePort(text: string): number | undefined {
  const port = Number(text.trim());
  return /^\d+$/.test(text.trim()) && port >= 1 && port <= 65535 ? port : undefined;
}

export function toFormModel(settings: EmailSettings): EmailSettingsFormModel {
  return {
    host: settings.host ?? '',
    port: String(settings.port),
    security: settings.security,
    username: settings.username ?? '',
    password: '',
    removePassword: false,
    from: settings.from ?? '',
    recipients: settings.recipients.join('\n'),
  };
}

/** Converts a valid form model into the API body; an empty password keeps the saved one. */
export function toEmailSettingsInput(form: EmailSettingsFormModel): EmailSettingsInput {
  const text = (value: string) => value.trim() || null;
  let password: string | null | undefined;
  if (form.removePassword) {
    password = null;
  } else if (form.password) {
    password = form.password;
  }
  return {
    host: text(form.host),
    port: parsePort(form.port) ?? DEFAULT_SMTP_PORT,
    security: form.security,
    username: text(form.username),
    password,
    from: text(form.from),
    recipients: parseRecipients(form.recipients),
  };
}

/**
 * Whether saving drops the saved password without a new one: the server keeps it only while host,
 * port, security and username stay the same (ADR 0006).
 */
export function dropsSavedPassword(saved: EmailSettings, form: EmailSettingsFormModel): boolean {
  if (!saved.passwordSet || form.password || form.removePassword) {
    return false;
  }
  const input = toEmailSettingsInput(form);
  return (
    input.host !== saved.host ||
    input.port !== saved.port ||
    input.security !== saved.security ||
    input.username !== saved.username
  );
}
