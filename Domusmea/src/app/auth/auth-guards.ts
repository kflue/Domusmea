import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthError } from '../../shared/auth';
import { AuthApi } from './auth-api';

/** Pages with household data: signed-out visitors go to the login, then back here. */
export const signedInGuard: CanActivateFn = async (_route, state) => {
  const router = inject(Router);
  const user = await inject(AuthApi).currentUser();
  if (!user) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }
  return user.setupRequired ? router.createUrlTree(['/setup']) : true;
};

/** The first-run setup: only while signed in with the default credentials. */
export const setupGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const user = await inject(AuthApi).currentUser();
  return user?.setupRequired ? true : router.createUrlTree([user ? '/' : '/login']);
};

/** The login page: signed-in users go on to the app (or the setup). */
export const signedOutGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const user = await inject(AuthApi).currentUser();
  if (!user) {
    return true;
  }
  return router.createUrlTree([user.setupRequired ? '/setup' : '/']);
};

/**
 * Sends the user to the login when the API reports that the session ended (401), and to the setup
 * when it is still required. Requests to `/api/auth` handle their errors themselves.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthApi);
  const router = inject(Router);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        req.url.startsWith('/api/') &&
        !req.url.startsWith('/api/auth/')
      ) {
        const code = (error.error as { error?: AuthError } | null)?.error;
        if (error.status === 401) {
          auth.sessionEnded();
          void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
        } else if (error.status === 403 && code === 'setup-required') {
          void router.navigate(['/setup']);
        }
      }
      return throwError(() => error);
    }),
  );
};
