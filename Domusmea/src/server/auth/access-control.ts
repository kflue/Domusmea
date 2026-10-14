import { Request, RequestHandler, Response } from 'express';
import { AuthError, Permission, SessionUser } from '../../shared/auth';
import { Account, AuthRepository, SESSION_IDLE_MS } from './auth-repository';

export const SESSION_COOKIE = 'domusmea_session';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** The session token from the request's cookie, if any. */
export function sessionToken(req: Request): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [name, ...value] = part.trim().split('=');
    if (name === SESSION_COOKIE && value.length) {
      return value.join('=') || undefined;
    }
  }
  return undefined;
}

/**
 * Sets the session cookie: not readable by scripts, only sent by this site's own pages (no CSRF), and
 * only over HTTPS when the request came over HTTPS (directly or through a proxy).
 */
export function setSessionCookie(req: Request, res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: isHttps(req),
    path: '/',
    maxAge: SESSION_IDLE_MS,
  });
}

export function clearSessionCookie(req: Request, res: Response): void {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'strict',
    secure: isHttps(req),
    path: '/',
  });
}

/**
 * Whether the request passed through a proxy. The socket address is then the proxy's (often a
 * loopback address), not the client's.
 */
export function isProxied(req: Request): boolean {
  return ['forwarded', 'x-forwarded-for', 'x-real-ip'].some((name) => name in req.headers);
}

/**
 * Whether the client connected from the server machine itself, directly: requests through a proxy
 * on the same machine (reverse proxy, Codespaces port forwarding) do not count (ADR 0007).
 */
export function isLocalRequest(req: Request): boolean {
  if (isProxied(req)) {
    return false;
  }
  const address = req.socket.remoteAddress ?? '';
  // IPv4 loopback (127.0.0.0/8), also as an IPv4-mapped IPv6 address, or IPv6 loopback.
  return address.replace(/^::ffff:/i, '').startsWith('127.') || address === '::1';
}

/** The user as sent to the browser (without the database id). */
export function toSessionUser({
  username,
  role,
  permissions,
  setupRequired,
}: Account): SessionUser {
  return { username, role, permissions, setupRequired };
}

/** The account of the request's session, set by {@link requireSession}. */
export function accountOf(res: Response): Account {
  return res.locals['account'] as Account;
}

/**
 * Lets requests through only with a valid session of an account that finished the first-run setup
 * (ADR 0007): 401 `unauthenticated` without one, 403 `setup-required` with the default credentials.
 * Each request renews the cookie, so the session lasts while it is used.
 */
export function requireSession(repository: () => AuthRepository): RequestHandler {
  return (req, res, next) => {
    const token = sessionToken(req);
    const account = token ? repository().sessionAccount(token) : undefined;
    if (!token || !account) {
      if (token) {
        clearSessionCookie(req, res);
      }
      res.status(401).json({ error: 'unauthenticated' satisfies AuthError });
      return;
    }
    if (account.setupRequired) {
      res.status(403).json({ error: 'setup-required' satisfies AuthError });
      return;
    }
    setSessionCookie(req, res, token);
    res.locals['account'] = account;
    next();
  };
}

/**
 * Requires the `read` permission for GET, HEAD and OPTIONS and `write` for all other methods; 403
 * `forbidden` if the signed-in account's role lacks it. Mounted with each API router.
 */
export function requirePermissions(permissions: {
  read: Permission;
  write: Permission;
}): RequestHandler {
  return (req, res, next) => {
    const needed = SAFE_METHODS.has(req.method) ? permissions.read : permissions.write;
    if (accountOf(res)?.permissions.includes(needed)) {
      next();
    } else {
      res.status(403).json({ error: 'forbidden' satisfies AuthError });
    }
  };
}

function isHttps(req: Request): boolean {
  const forwarded = req.headers['x-forwarded-proto'];
  const proto = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0].trim();
  return req.secure || proto === 'https';
}
