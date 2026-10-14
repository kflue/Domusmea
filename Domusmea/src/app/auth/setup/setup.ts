import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { form, FormField, submit, validate } from '@angular/forms/signals';
import { Router } from '@angular/router';
import {
  AuthError,
  MIN_PASSWORD_LENGTH,
  newPasswordProblem,
  USERNAME_PATTERN,
} from '../../../shared/auth';
import { FieldErrors } from '../../shared/field-errors';
import { AuthApi } from '../auth-api';

/**
 * First-run setup (`/setup`, ADR 0007): replaces the default credentials `admin` / `admin` with the
 * owner's own. Afterwards only the new ones work.
 */
@Component({
  selector: 'app-setup',
  imports: [FormField, FieldErrors],
  templateUrl: './setup.html',
})
export class SetupPage {
  private readonly auth = inject(AuthApi);
  private readonly router = inject(Router);

  protected readonly minPasswordLength = MIN_PASSWORD_LENGTH;

  protected readonly model = signal({ username: '', password: '', confirmation: '' });

  protected readonly setupForm = form(this.model, (path) => {
    validate(path.username, ({ value }) =>
      USERNAME_PATTERN.test(value().trim())
        ? undefined
        : { kind: 'username', message: 'Use 3 to 32 letters, digits, “.”, “_” or “-”.' },
    );
    validate(path.password, ({ value, valueOf }) => {
      const message = newPasswordProblem(value(), valueOf(path.username));
      return message ? { kind: 'password', message } : undefined;
    });
    validate(path.confirmation, ({ value, valueOf }) =>
      value() === valueOf(path.password)
        ? undefined
        : { kind: 'mismatch', message: 'The passwords do not match.' },
    );
  });

  protected readonly error = signal('');

  protected save(event: Event): void {
    event.preventDefault();
    submit(this.setupForm, async () => {
      this.error.set('');
      try {
        const { username, password } = this.model();
        await this.auth.setup({ username: username.trim(), password });
        await this.router.navigateByUrl('/');
      } catch (error) {
        await this.handleError(error);
      }
    });
  }

  private async handleError(error: unknown): Promise<void> {
    const response = error instanceof HttpErrorResponse ? error : undefined;
    const code = (response?.error as { error?: AuthError } | null)?.error;
    if (response?.status === 401 || code === 'forbidden') {
      // The session ended, or the setup was already done: sign in again.
      this.auth.sessionEnded();
      await this.router.navigateByUrl('/login');
      return;
    }
    this.error.set(setupErrorText(code, response?.status));
  }
}

function setupErrorText(code: AuthError | undefined, status: number | undefined): string {
  if (code === 'setup-local-only') {
    return 'The setup only works on the server machine itself, unless ALLOW_REMOTE_SETUP=true is set.';
  }
  if (status === 400) {
    return 'The server rejected the entries. Please check them.';
  }
  return 'The new credentials could not be saved. Please try again.';
}
