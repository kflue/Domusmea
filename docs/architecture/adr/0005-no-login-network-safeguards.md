# 0005: No login yet; safeguards for the unauthenticated API

- Status: accepted; the SMTP item is superseded by [ADR 0006](0006-email-settings-in-database.md)
- Date: 2026-10-11

## Context

Domusmea serves one household and has no login yet (ADR 0003 context). Anyone who can send requests
to the API can read, change and delete all data. A security review of the items feature found:

- The server listened on all network interfaces, so every device on the same network had full access.
- Websites the user visits could reach the API on `localhost` through DNS rebinding (Angular's
  `allowedHosts` check only covers SSR pages, not `/api`) or try cross-site writes (CSRF).
- Item text ends up in warranty emails sent from the household's own address.

## Decision

Until a login exists:

- **Local by default**: the built server binds `127.0.0.1`; `HOST` opts into other interfaces
  (only behind a reverse proxy with authentication, or on a trusted network).
- **Host allowlist on `/api`**: `localhost`, `127.0.0.1`, `[::1]`, `ALLOWED_HOSTS` (comma-separated,
  `*.domain` for subdomains) and, inside GitHub Codespaces, this codespace's forwarded-port hosts.
  Other `Host` headers get 403 (blocks DNS rebinding).
- **Same-origin writes only**: non-GET API requests with a cross-site `Origin` or
  `Sec-Fetch-Site` get 403; only `application/json` bodies are parsed.
- **Single-line text**: item text fields reject control characters (no line breaks), so API callers
  cannot shape the email text. Email headers are additionally protected by Nodemailer.
- **SMTP**: `requireTLS` unless `SMTP_SECURE=true` (implicit TLS); `SMTP_REQUIRE_TLS=false` only for
  local test mail servers.
- **Headers**: no `X-Powered-By`; `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Content-Security-Policy: frame-ancestors 'none'`, `Referrer-Policy: same-origin` on all responses.

## Consequences

- Deploying for access from other devices requires setting `HOST` and `ALLOWED_HOSTS`, and should
  wait for a login or use an authenticating reverse proxy.
- Deferred (tracked as follow-ups): rate limiting of writes, a maximum item count, and a cap on items
  per warranty email. Without them, a client with API access can grow the database without bound.
- A full Content-Security-Policy (scripts, styles) is deferred; it needs to be compatible with Angular
  hydration and Tailwind.
