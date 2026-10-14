import { HttpErrorResponse } from '@angular/common/http';
import { DOCUMENT } from '@angular/common';
import { afterNextRender, Component, computed, inject, Injector, signal } from '@angular/core';
import { form, FormField, submit, validate } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { MIN_PASSWORD_LENGTH, newPasswordProblem, SignIn } from '../../../shared/auth';
import { formatDateTime } from '../../../shared/format';
import { FieldErrors } from '../../shared/field-errors';
import { AccountApi } from '../account-api';

const EMPTY_PASSWORD_FORM = { currentPassword: '', newPassword: '', confirmation: '' };

/**
 * Sign-in and security on the Settings page (ADR 0007): recent sign-ins, password change and
 * signing out on all devices.
 */
@Component({
  selector: 'app-account-settings',
  imports: [FormField, FieldErrors],
  providers: [AccountApi],
  templateUrl: './account-settings.html',
})
export class AccountSettings {
  private readonly api = inject(AccountApi);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  protected readonly account = this.api.account;
  protected readonly minPasswordLength = MIN_PASSWORD_LENGTH;

  protected readonly signIns = computed(() =>
    (this.account.value()?.recentSignIns ?? []).map((signIn) => ({
      when: formatDateTime(signIn.at),
      where: describeAddress(signIn),
    })),
  );

  protected readonly model = signal(EMPTY_PASSWORD_FORM);

  protected readonly passwordForm = form(this.model, (path) => {
    validate(path.currentPassword, ({ value }) =>
      value() ? undefined : { kind: 'required', message: 'Enter your current password.' },
    );
    validate(path.newPassword, ({ value, valueOf }) => {
      const message =
        newPasswordProblem(value(), this.account.value()?.username ?? '') ??
        (value() === valueOf(path.currentPassword)
          ? 'Choose a password that differs from the current one.'
          : undefined);
      return message ? { kind: 'password', message } : undefined;
    });
    validate(path.confirmation, ({ value, valueOf }) =>
      value() === valueOf(path.newPassword)
        ? undefined
        : { kind: 'mismatch', message: 'The passwords do not match.' },
    );
  });

  protected readonly passwordStatus = signal('');
  protected readonly passwordError = signal('');
  protected readonly confirmingSignOut = signal(false);
  protected readonly signingOut = signal(false);
  protected readonly signOutError = signal('');

  protected changePassword(event: Event): void {
    event.preventDefault();
    submit(this.passwordForm, async () => {
      this.passwordStatus.set('');
      this.passwordError.set('');
      const { currentPassword, newPassword } = this.model();
      try {
        await this.api.changePassword({ currentPassword, newPassword });
        this.passwordForm().reset(EMPTY_PASSWORD_FORM);
        this.passwordStatus.set('Password changed. All other devices were signed out.');
      } catch (error) {
        this.passwordError.set(passwordErrorText(error));
      }
    });
  }

  protected askToSignOut(): void {
    this.confirmingSignOut.set(true);
    this.focusAfterRender('sign-out-confirm');
  }

  protected cancelSignOut(): void {
    this.confirmingSignOut.set(false);
    this.focusAfterRender('sign-out-start');
  }

  protected async signOutEverywhere(): Promise<void> {
    this.signingOut.set(true);
    this.signOutError.set('');
    try {
      await this.api.signOutEverywhere();
      await this.router.navigateByUrl('/login');
    } catch {
      this.signOutError.set('Signing out did not work. Please try again.');
      this.cancelSignOut();
    } finally {
      this.signingOut.set(false);
    }
  }

  /** Keeps keyboard focus on the action area when buttons are swapped. */
  private focusAfterRender(elementId: string): void {
    afterNextRender(() => this.document.getElementById(elementId)?.focus(), {
      injector: this.injector,
    });
  }
}

/** The address of a sign-in; a proxy's report of the client comes first, marked as such. */
function describeAddress({ address, forwardedFor }: SignIn): string {
  const direct = address.replace(/^::ffff:(?=\d)/i, '');
  return forwardedFor ? `${forwardedFor} (reported by the proxy at ${direct})` : direct;
}

function passwordErrorText(error: unknown): string {
  const response = error instanceof HttpErrorResponse ? error : undefined;
  const fields = (response?.error as { fields?: Record<string, string[]> } | null)?.fields;
  if (response?.status === 400 && fields?.['currentPassword']) {
    return 'The current password is wrong.';
  }
  if (response?.status === 429) {
    return 'Too many wrong passwords. Please wait 15 minutes and try again.';
  }
  return response?.status === 400
    ? 'The server rejected the new password. Please check the entries.'
    : 'The password could not be changed. Please try again.';
}
