import express, { Request, Router } from 'express';
import { AuthError, SessionResponse } from '../../shared/auth';
import { jsonErrors, validationError } from '../api-errors';
import {
  clearSessionCookie,
  forwardedClient,
  isLocalRequest,
  isProxied,
  sessionToken,
  setSessionCookie,
  toSessionUser,
} from './access-control';
import { loginInputSchema, setupInputSchema } from './auth-input';
import { AuthRepository, DEFAULT_PASSWORD_HASH } from './auth-repository';
import { addressKey, LoginThrottle } from './login-throttle';
import { hashPassword, verifyPassword } from './passwords';

export interface AuthRouterOptions {
  /**
   * Accept the first-run setup from other machines too (`ALLOW_REMOTE_SETUP=true`). Off by default:
   * the default credentials are public, so anyone on the network could otherwise claim the account.
   */
  allowRemoteSetup: boolean;
  /** Always mark the session cookie `Secure` (`SECURE_COOKIES=true`). */
  secureCookies?: boolean;
  throttle?: LoginThrottle;
}

/**
 * Login, logout, session and first-run setup, mounted at `/api/auth` before the session check
 * (ADR 0007). `repository` is resolved per request so the database is only opened when used.
 */
export function createAuthRouter(
  repository: () => AuthRepository,
  { allowRemoteSetup, secureCookies = false, throttle = new LoginThrottle() }: AuthRouterOptions,
): Router {
  const router = express.Router();
  router.use(express.json({ limit: '4kb' }));
  const setupAllowedFrom = (req: Request) => allowRemoteSetup || isLocalRequest(req);

  router.get('/session', (req, res) => {
    const token = sessionToken(req);
    const account = token ? repository().sessionAccount(token) : undefined;
    res.json({ user: account ? toSessionUser(account) : null } satisfies SessionResponse);
  });

  router.post('/login', async (req, res) => {
    const input = loginInputSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json(validationError(input.error));
      return;
    }
    const { username, password } = input.data;
    // Behind a proxy all clients share its address, so only the username is throttled.
    const keys = [`user:${username.toLowerCase()}`];
    if (!isProxied(req) && req.socket.remoteAddress) {
      keys.push(addressKey(req.socket.remoteAddress));
    }
    if (throttle.isBlocked(keys)) {
      res.status(429).json({ error: 'too-many-attempts' satisfies AuthError });
      return;
    }
    // Counted before the slow password check, so parallel requests see it; reset on success.
    throttle.recordFailure(keys);
    const found = repository().credentials(username);
    // Unknown usernames are checked against a hash too, so they take as long as wrong passwords.
    const valid = await verifyPassword(password, found?.passwordHash ?? DEFAULT_PASSWORD_HASH);
    if (!found || !valid) {
      res.status(401).json({ error: 'invalid-credentials' satisfies AuthError });
      return;
    }
    if (found.account.setupRequired && !setupAllowedFrom(req)) {
      res.status(403).json({ error: 'setup-local-only' satisfies AuthError });
      return;
    }
    throttle.reset(keys);
    const previous = sessionToken(req);
    if (previous) {
      repository().deleteSession(previous);
    }
    repository().recordSignIn(
      found.account.id,
      req.socket.remoteAddress ?? 'unknown',
      isProxied(req) ? forwardedClient(req) : null,
    );
    setSessionCookie(req, res, repository().createSession(found.account.id), secureCookies);
    res.json({ user: toSessionUser(found.account) } satisfies SessionResponse);
  });

  router.post('/logout', (req, res) => {
    const token = sessionToken(req);
    if (token) {
      repository().deleteSession(token);
    }
    clearSessionCookie(req, res, secureCookies);
    res.status(204).end();
  });

  /** Replaces the default credentials; only once, and only with a session from the default login. */
  router.post('/setup', async (req, res) => {
    const token = sessionToken(req);
    const account = token ? repository().sessionAccount(token) : undefined;
    if (!account) {
      res.status(401).json({ error: 'unauthenticated' satisfies AuthError });
      return;
    }
    if (!account.setupRequired) {
      res.status(403).json({ error: 'forbidden' satisfies AuthError });
      return;
    }
    if (!setupAllowedFrom(req)) {
      res.status(403).json({ error: 'setup-local-only' satisfies AuthError });
      return;
    }
    const input = setupInputSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json(validationError(input.error));
      return;
    }
    const passwordHash = await hashPassword(input.data.password);
    const updated = repository().completeSetup(account.id, input.data.username, passwordHash);
    if (!updated) {
      res.status(403).json({ error: 'forbidden' satisfies AuthError });
      return;
    }
    setSessionCookie(req, res, repository().createSession(updated.id), secureCookies);
    res.json({ user: toSessionUser(updated) } satisfies SessionResponse);
  });

  router.use(jsonErrors);
  return router;
}
