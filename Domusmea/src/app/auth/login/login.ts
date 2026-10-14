import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, signal } from '@angular/core';
import { form, FormField, submit, validate } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { AuthError } from '../../../shared/auth';
import { FieldErrors } from '../../shared/field-errors';
import { AuthApi, safeReturnUrl } from '../auth-api';

const LOGIN_ERRORS: Partial<Record<AuthError, string>> = {
  'invalid-credentials': 'The username or password is wrong.',
  'too-many-attempts': 'Too many failed attempts. Please wait 15 minutes and try again.',
  'setup-local-only':
    'The first sign-in with the default credentials only works on the server machine itself. ' +
    'Open Domusmea there, or start the server with ALLOW_REMOTE_SETUP=true.',
};

/** Sign-in page (`/login`, ADR 0007); afterwards goes on to `returnUrl` or the setup. */
@Component({
  selector: 'app-login',
  imports: [FormField, FieldErrors],
  templateUrl: './login.html',
})
export class LoginPage {
  private readonly auth = inject(AuthApi);
  private readonly router = inject(Router);

  /** Query parameter: the page that required the login. */
  readonly returnUrl = input<string>();

  protected readonly model = signal({ username: '', password: '' });

  protected readonly loginForm = form(this.model, (path) => {
    validate(path.username, ({ value }) =>
      value().trim() ? undefined : { kind: 'required', message: 'Enter your username.' },
    );
    validate(path.password, ({ value }) =>
      value() ? undefined : { kind: 'required', message: 'Enter your password.' },
    );
  });

  protected readonly error = signal('');

  protected signIn(event: Event): void {
    event.preventDefault();
    submit(this.loginForm, async () => {
      this.error.set('');
      try {
        const { username, password } = this.model();
        const user = await this.auth.login({ username: username.trim(), password });
        await this.router.navigateByUrl(
          user.setupRequired ? '/setup' : safeReturnUrl(this.returnUrl()),
        );
      } catch (error) {
        this.loginForm.password().reset('');
        this.error.set(loginErrorText(error));
      }
    });
  }
}

function loginErrorText(error: unknown): string {
  const code =
    error instanceof HttpErrorResponse
      ? (error.error as { error?: AuthError } | null)?.error
      : undefined;
  return (code && LOGIN_ERRORS[code]) ?? 'Signing in did not work. Please try again in a moment.';
}
