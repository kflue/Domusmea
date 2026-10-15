import { HttpClient } from '@angular/common/http';
import { computed, inject, Service, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  LoginInput,
  Permission,
  SessionResponse,
  SessionUser,
  SetupInput,
} from '../../shared/auth';

const AUTH_URL = '/api/auth';

/**
 * Access to `/api/auth` and the signed-in user (ADR 0007). `user` is `undefined` until the session
 * was loaded, then the user or `null` when signed out.
 */
@Service()
export class AuthApi {
  private readonly http = inject(HttpClient);
  private readonly current = signal<SessionUser | null | undefined>(undefined);
  private loading: Promise<SessionUser | null> | undefined;

  readonly user = this.current.asReadonly();
  /** The signed-in user once the first-run setup is done; the navigation is hidden before. */
  readonly activeUser = computed(() => {
    const user = this.current();
    return user && !user.setupRequired ? user : undefined;
  });

  /**
   * Whether the active user's role has `permission`, e.g. to hide controls the API would reject.
   * Reactive when read in a template or `computed`.
   */
  can(permission: Permission): boolean {
    return this.activeUser()?.permissions.includes(permission) ?? false;
  }

  /** The signed-in user, asking the server only the first time. */
  async currentUser(): Promise<SessionUser | null> {
    const known = this.current();
    if (known !== undefined) {
      return known;
    }
    this.loading ??= firstValueFrom(this.http.get<SessionResponse>(`${AUTH_URL}/session`))
      .then(({ user }) => {
        this.current.set(user);
        return user;
      })
      .finally(() => (this.loading = undefined));
    return this.loading;
  }

  /** Signs in; rejects with the server's `AuthError` (401, 403 or 429). */
  async login(input: LoginInput): Promise<SessionUser> {
    return this.signedIn(
      await firstValueFrom(this.http.post<SessionResponse>(`${AUTH_URL}/login`, input)),
    );
  }

  /** Replaces the default credentials (first-run setup) and stays signed in. */
  async setup(input: SetupInput): Promise<SessionUser> {
    return this.signedIn(
      await firstValueFrom(this.http.post<SessionResponse>(`${AUTH_URL}/setup`, input)),
    );
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post<void>(`${AUTH_URL}/logout`, null));
    } finally {
      this.current.set(null);
    }
  }

  /** Forgets the user after the server reported that the session ended. */
  sessionEnded(): void {
    this.current.set(null);
  }

  private signedIn({ user }: SessionResponse): SessionUser {
    if (!user) {
      throw new Error('The server did not return the signed-in user.');
    }
    this.current.set(user);
    return user;
  }
}

/**
 * Where to go after signing in: `returnUrl` if it is a path inside the app, otherwise the start
 * page. Rejects `//host` and `/\host`, which browsers treat as other sites.
 */
export function safeReturnUrl(returnUrl: string | undefined): string {
  return returnUrl && /^\/(?![/\\])/.test(returnUrl) ? returnUrl : '/';
}
