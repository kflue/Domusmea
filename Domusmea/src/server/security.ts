import { RequestHandler } from 'express';

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

/**
 * Host names accepted by the API: local addresses, `ALLOWED_HOSTS` (comma-separated; `*.example.ch`
 * matches subdomains) and, inside GitHub Codespaces, this codespace's forwarded-port host names.
 * Rejecting other `Host` headers blocks DNS-rebinding attacks from websites the user visits.
 */
export function allowedHostMatcher(
  env: NodeJS.ProcessEnv = process.env,
): (host: string) => boolean {
  const patterns = [
    ...LOCAL_HOSTS,
    ...(env['ALLOWED_HOSTS'] ?? '')
      .split(',')
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  ];
  const codespace = env['CODESPACE_NAME'];
  const forwardingDomain = env['GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN'];
  return (hostname) =>
    patterns.some((pattern) =>
      pattern.startsWith('*.') ? hostname.endsWith(pattern.slice(1)) : hostname === pattern,
    ) ||
    (!!codespace &&
      !!forwardingDomain &&
      hostname.startsWith(`${codespace}-`) &&
      hostname.endsWith(`.${forwardingDomain}`));
}

/** Host name of a `Host` header value (without port), or `undefined` if it cannot be parsed. */
export function hostnameOf(host: string | undefined): string | undefined {
  if (!host) {
    return undefined;
  }
  try {
    return new URL(`http://${host}`).hostname;
  } catch {
    return undefined;
  }
}

/** Rejects requests whose `Host` is not allowed (see {@link allowedHostMatcher}). */
export function requireAllowedHost(isAllowed: (hostname: string) => boolean): RequestHandler {
  return (req, res, next) => {
    const hostname = hostnameOf(req.headers.host);
    if (hostname && isAllowed(hostname)) {
      next();
    } else {
      res.status(403).json({ error: 'forbidden-host' });
    }
  };
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Rejects state-changing requests sent from other sites (CSRF): the API has no login, so any page the
 * user visits could otherwise try to change data in the background. Browsers report the relation in
 * `Sec-Fetch-Site`; the `Origin` must also be an allowed host. The origin is not compared with `Host`,
 * which proxies such as Codespaces port forwarding may rewrite.
 */
export function rejectCrossSiteWrites(isAllowed: (hostname: string) => boolean): RequestHandler {
  return (req, res, next) => {
    const fetchSite = req.headers['sec-fetch-site'];
    const origin = req.headers.origin;
    const crossSite =
      !SAFE_METHODS.has(req.method) &&
      ((fetchSite !== undefined && fetchSite !== 'same-origin' && fetchSite !== 'none') ||
        (origin !== undefined && !isAllowedOrigin(origin, isAllowed)));
    if (crossSite) {
      res.status(403).json({ error: 'cross-site-request' });
    } else {
      next();
    }
  };
}

/** Whether an `Origin` header names an allowed host; `null` and unparsable origins are not. */
function isAllowedOrigin(origin: string, isAllowed: (hostname: string) => boolean): boolean {
  try {
    return isAllowed(new URL(origin).hostname);
  } catch {
    return false;
  }
}

/** Basic security headers for all responses; framing is denied (no clickjacking of delete). */
export const securityHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
};
