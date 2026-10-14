import express, { Router } from 'express';
import { AccountInfo, AuthError } from '../../shared/auth';
import { jsonErrors, validationError } from '../api-errors';
import { accountOf, clearSessionCookie, setSessionCookie } from './access-control';
import { changePasswordInputSchema } from './auth-input';
import { AuthRepository } from './auth-repository';
import { LoginThrottle } from './login-throttle';
import { hashPassword, verifyPassword } from './passwords';

export interface AccountRouterOptions {
  /** Limits guesses of the current password, per account (own keys, so typos do not block login). */
  throttle: LoginThrottle;
  /** Always mark the session cookie `Secure` (`SECURE_COOKIES=true`). */
  secureCookies?: boolean;
}

/**
 * The signed-in user's own account, mounted at `/api/account` after the session check with the
 * `account:manage` permission (ADR 0007): recent sign-ins, password change, sign out everywhere.
 */
export function createAccountRouter(
  repository: () => AuthRepository,
  { throttle, secureCookies = false }: AccountRouterOptions,
): Router {
  const router = express.Router();
  router.use(express.json({ limit: '4kb' }));

  router.get('/', (_req, res) => {
    const { id, username } = accountOf(res);
    res.json({
      username,
      recentSignIns: repository().recentSignIns(id),
    } satisfies AccountInfo);
  });

  /**
   * Changes the password after checking the current one (throttled like logins), ends every session
   * of the account and signs this browser in again with a new session token.
   */
  router.put('/password', async (req, res) => {
    const { id, username } = accountOf(res);
    const input = changePasswordInputSchema(username).safeParse(req.body);
    if (!input.success) {
      res.status(400).json(validationError(input.error));
      return;
    }
    const keys = [`password-change:${id}`];
    if (throttle.isBlocked(keys)) {
      res.status(429).json({ error: 'too-many-attempts' satisfies AuthError });
      return;
    }
    // Counted before the slow password check, so parallel requests see it; reset on success.
    throttle.recordFailure(keys);
    const stored = repository().passwordHash(id);
    if (!stored || !(await verifyPassword(input.data.currentPassword, stored))) {
      // 400, not 401: the session is still valid, only the entered password is wrong.
      res.status(400).json({ error: 'invalid', fields: { currentPassword: ['Wrong password'] } });
      return;
    }
    throttle.reset(keys);
    const passwordHash = await hashPassword(input.data.newPassword);
    setSessionCookie(req, res, repository().changePassword(id, passwordHash), secureCookies);
    res.status(204).end();
  });

  /** Ends every session of the account, this one included. */
  router.post('/sign-out-everywhere', (req, res) => {
    repository().deleteSessionsOf(accountOf(res).id);
    clearSessionCookie(req, res, secureCookies);
    res.status(204).end();
  });

  router.use(jsonErrors);
  return router;
}
