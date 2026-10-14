# 0007: Login with one owner account and extensible roles

- Status: accepted
- Date: 2026-10-14
- Supersedes the "no login" premise of [ADR 0005](0005-no-login-network-safeguards.md); its host
  allowlist, same-origin writes and security headers stay in place.

## Context

Anyone who could reach `/api` could read and change all household data, so the server had to stay
on `127.0.0.1`. The home owner wants a login before the app is opened to other devices:

- One role that may do everything, built so more roles (and users) can be added later.
- The first login is `admin` / `admin`; it must lead straight to choosing a username and password,
  after which only those work.

## Decision

- **Accounts and roles in SQLite** (migration 3): `users` (username unique, case-insensitive;
  scrypt hash; role; `must_change_credentials`), `roles`, `role_permissions`. Permissions are a
  closed list in `src/shared/auth.ts` (`items:read`, `items:write`, `settings:read`,
  `settings:write`, `account:manage`). The seeded role **Owner** holds all of them. A new role is a
  migration inserting it and its permissions; a new permission is granted to Owner by the migration
  that introduces it.
- **Default account**: `AuthRepository` creates `admin` with the hash of `admin` and
  `must_change_credentials = 1` when no user exists. That account only gets a setup session: every
  API route answers 403 `setup-required` except `/api/auth/session`, `/login`, `/logout` and
  `/setup`. `POST /api/auth/setup` (username 3 to 32 of `A-Za-z0-9._-`; password 12 to 256
  characters, not the username or `admin`) replaces the credentials once, atomically, and ends all
  sessions.
- **Setup only from the server machine**: the default credentials are public, so the default login
  and the setup are refused (403 `setup-local-only`) unless the request comes directly from a
  loopback address without proxy headers (`Forwarded`, `X-Forwarded-For`, `X-Real-IP`).
  `ALLOW_REMOTE_SETUP=true` lifts this, for example for a headless server or Codespaces port
  forwarding.
- **Passwords**: scrypt (`node:crypto`, N=2^15, r=8, p=1, 16-byte salt); parameters are stored with
  each hash. Unknown usernames are checked against a dummy hash so they take as long as wrong
  passwords, and both get the same 401 `invalid-credentials`.
- **Sessions**: a random 256-bit token in the cookie `domusmea_session` (`HttpOnly`,
  `SameSite=Strict`, `Path=/`, `Secure` when the request or the proxy's `X-Forwarded-Proto` is
  HTTPS); only its SHA-256 is stored. Sessions end after 7 days without a request. Login and setup
  issue a new token.
- **Access control in one place**: `src/server/api-router.ts` mounts `/api/auth` first, then
  `requireSession`, then every feature router with `requirePermissions({ read, write })` (read for
  GET/HEAD/OPTIONS, write otherwise). A test requests every route without a session (401), with the
  setup session (403) and with a role lacking permissions (403).
- **Brute force**: in memory, 5 failed logins per username or client address (IPv6 by /64) within
  15 minutes block that key for 15 minutes, also for the right password. Each attempt counts before
  the password check, so parallel requests cannot pass. Behind a proxy only the username is used.
  Active blocks are never evicted.
- **Recovery**: `npm run reset-login` (the built server with `--reset-login`) resets the owner to
  `admin` / `admin`, requires the setup again and ends all sessions; household data is untouched.
- **UI**: `/login` and `/setup` (`RenderMode.Client`), route guards on the data pages, and an HTTP
  interceptor that sends 401 responses to `/login?returnUrl=…` (in-app paths only).

## Consequences

- The server may be exposed with `HOST` and `ALLOWED_HOSTS` once the setup is done, preferably
  behind HTTPS. A reverse proxy should send `X-Forwarded-Proto` so the cookie is `Secure`.
- After a fresh install or a reset, the setup must be done on the server machine (or with
  `ALLOW_REMOTE_SETUP=true`).
- A restart clears the login throttle.
- Deferred (P1 of the spec): changing the password in Settings, signing out everywhere, showing the
  last sign-in. Later: more users and roles, hiding UI actions by permission, passkeys or 2FA.
