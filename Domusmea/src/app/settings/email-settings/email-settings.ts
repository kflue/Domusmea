import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { disabled, form, FormField, submit, validate } from '@angular/forms/signals';
import {
  MAX_RECIPIENTS,
  SMTP_HOST_PATTERN,
  SMTP_SECURITY_LABELS,
  SMTP_SECURITY_MODES,
  TestEmailError,
} from '../../../shared/email-settings';
import { FieldErrors } from '../../shared/field-errors';
import { SettingsApi } from '../settings-api';
import {
  dropsSavedPassword,
  EMAIL_PATTERN,
  EMPTY_EMAIL_SETTINGS_FORM,
  parsePort,
  parseRecipients,
  toEmailSettingsInput,
  toFormModel,
} from './email-settings-model';

const TEST_EMAIL_ERRORS: Record<TestEmailError['error'], string> = {
  'no-smtp-host': 'Save an SMTP server first.',
  'no-recipients': 'Save at least one recipient first.',
  'too-soon': 'Please wait half a minute before sending another test email.',
  'send-failed': 'The test email could not be sent.',
};

/** SMTP server and recipients for reminder emails (`/settings`, ADR 0006). */
@Component({
  selector: 'app-email-settings',
  imports: [FormField, FieldErrors],
  templateUrl: './email-settings.html',
})
export class EmailSettingsPage {
  private readonly api = inject(SettingsApi);

  protected readonly saved = this.api.email;

  protected readonly securityModes = SMTP_SECURITY_MODES.map((value) => ({
    value,
    label: SMTP_SECURITY_LABELS[value],
  }));

  protected readonly model = linkedSignal(() =>
    this.saved.hasValue() ? toFormModel(this.saved.value()) : EMPTY_EMAIL_SETTINGS_FORM,
  );

  protected readonly settingsForm = form(this.model, (path) => {
    validate(path.host, ({ value }) => {
      const host = value().trim();
      return host && !SMTP_HOST_PATTERN.test(host)
        ? { kind: 'host', message: 'Enter a host name such as smtp.example.ch.' }
        : undefined;
    });
    validate(path.port, ({ value }) =>
      parsePort(value()) === undefined
        ? { kind: 'port', message: 'Enter a port from 1 to 65535.' }
        : undefined,
    );
    validate(path.from, ({ value, valueOf }) => {
      const from = value().trim();
      if (!from) {
        return valueOf(path.host).trim()
          ? { kind: 'required', message: 'Enter the sender address.' }
          : undefined;
      }
      return EMAIL_PATTERN.test(from)
        ? undefined
        : { kind: 'email', message: 'Enter an email address.' };
    });
    validate(path.recipients, ({ value }) => {
      const recipients = parseRecipients(value());
      const invalid = recipients.filter((address) => !EMAIL_PATTERN.test(address));
      if (invalid.length) {
        return { kind: 'email', message: `Not an email address: ${invalid.join(', ')}.` };
      }
      return recipients.length > MAX_RECIPIENTS
        ? { kind: 'maxRecipients', message: `Enter at most ${MAX_RECIPIENTS} addresses.` }
        : undefined;
    });
    disabled(
      path.password,
      ({ valueOf }) => !this.saved.value()?.canStorePassword || valueOf(path.removePassword),
    );
  });

  protected readonly dropsPassword = computed(() => {
    const saved = this.saved.value();
    return saved !== undefined && dropsSavedPassword(saved, this.model());
  });

  /** Whether the form differs from the saved settings; the test email uses the saved ones. */
  protected readonly unsaved = computed(() => {
    const saved = this.saved.value();
    return (
      saved !== undefined && JSON.stringify(this.model()) !== JSON.stringify(toFormModel(saved))
    );
  });

  protected readonly saveStatus = signal('');
  protected readonly saveError = signal('');
  protected readonly testing = signal(false);
  protected readonly testResult = signal<{ ok: boolean; text: string } | undefined>(undefined);

  protected save(event: Event): void {
    event.preventDefault();
    submit(this.settingsForm, async () => {
      this.saveStatus.set('');
      this.saveError.set('');
      this.testResult.set(undefined);
      try {
        await this.api.saveEmail(toEmailSettingsInput(this.model()));
        this.saveStatus.set('Settings saved.');
      } catch (error) {
        this.saveError.set(
          error instanceof HttpErrorResponse && error.status === 400
            ? 'The settings were rejected by the server. Please check the entries.'
            : 'The settings could not be saved. Please try again.',
        );
      }
    });
  }

  protected async sendTestEmail(): Promise<void> {
    this.testing.set(true);
    this.testResult.set(undefined);
    try {
      await this.api.sendTestEmail();
      this.testResult.set({ ok: true, text: 'Test email sent. Check the recipients’ inboxes.' });
    } catch (error) {
      this.testResult.set({ ok: false, text: testErrorText(error) });
    } finally {
      this.testing.set(false);
    }
  }
}

function testErrorText(error: unknown): string {
  const body = error instanceof HttpErrorResponse ? (error.error as TestEmailError | null) : null;
  const text = body?.error && TEST_EMAIL_ERRORS[body.error];
  if (!text) {
    return 'The test email could not be sent. Please try again.';
  }
  return body.message ? `${text} The mail server reported: ${body.message}` : text;
}
