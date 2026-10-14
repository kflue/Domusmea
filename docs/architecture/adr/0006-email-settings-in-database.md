# 0006: Email settings in the database, configured in the UI

- Status: accepted
- Date: 2026-10-14
- Supersedes the configuration part of [ADR 0003](0003-warranty-expiry-notifications.md) (`SMTP_*`,
  `WARRANTY_NOTIFY_TO`) and the SMTP item of [ADR 0005](0005-no-login-network-safeguards.md)
  (`SMTP_SECURE`, `SMTP_REQUIRE_TLS`).

## Context

Home owners should configure the SMTP server for reminder emails on a Settings page instead of
through environment variables. Requirements agreed with the user:

- The page manages the SMTP server and the reminder recipients.
- The `SMTP_*` and `WARRANTY_NOTIFY_TO` environment variables are removed, not kept as a fallback.
- The SMTP password is encrypted at rest and never sent back to the browser.
- A "Send test email" button checks the settings.

There is still no login (ADR 0005): anyone who reaches `/api` can read and change the settings.

## Decision

- **Storage**: a single-row `email_settings` table (migration 2): host, port, security mode
  (`starttls`, `tls`, `none`), username, encrypted password, sender address, recipients (JSON array).
  No row means defaults (no server, port 587, STARTTLS, no recipients).
- **API**: `GET` and `PUT /api/settings/email`, `POST /api/settings/email/test`, under the `/api`
  guards of ADR 0005. Code in `src/server/email/`, contract in `src/shared/email-settings.ts`.
- **Password encryption**: AES-256-GCM with a random 12-byte IV and a 16-byte tag (both enforced
  when decrypting), key from `SETTINGS_KEY` (32 random bytes, base64). Host, port, security mode and
  username are authenticated with the password (AAD), so changing them directly in the database makes
  the password undecryptable instead of sending it elsewhere. The key is required for storing a
  password; without it the API rejects passwords and the page explains why, while password-less SMTP
  still works. A key next to the database would not protect a leaked copy of the data folder, so the
  key is not generated into a file.
- **Write-only password**: `GET` only returns `passwordSet`. A `PUT` without `password` keeps the
  stored one; `password: null` removes it. A kept password is also removed when host, port, security
  mode or username change. Otherwise a caller with API access could point the server at a host they
  control (or downgrade to no encryption) and receive the stored password.
- **Security modes**: STARTTLS is required in `starttls` mode (`requireTLS`); `none` is meant for
  local test servers and the page warns about it.
- **Applying changes**: the warranty check reads the settings at every run and builds a new
  Nodemailer transport, so changes apply without a restart. Without a server, emails are logged to
  the console (as before); without recipients, nothing is sent.
- **Test email**: sent with the saved settings to the saved recipients, at most once per 30 seconds.
  Failures are reported as fixed messages per Nodemailer error code; the server's reply is only
  included for login, envelope and message errors (after an SMTP greeting), so the endpoint cannot be
  used to read banners of other services. The full error is logged on the server. Transport timeouts
  are 15 s (connect, greeting) and 30 s (socket).
- **Reminder check**: reads the recipients first and decrypts the password only when an email is due,
  so a missing key does not log an error every hour.

## Consequences

- Existing deployments must enter their SMTP settings on the Settings page and set `SETTINGS_KEY`
  if the server needs a password; the old environment variables are ignored.
- Losing or changing `SETTINGS_KEY` makes the stored password unusable; the warranty check logs an
  error and the test email reports it until the password is entered again.
- Anyone with API access can still change the recipients while keeping the server, and then receive
  test and reminder emails sent through the household's account; they can also point the settings
  at other hosts (without the password) and learn whether they are reachable. Rate limiting stays a
  follow-up of ADR 0005; a login will restrict the Settings page.
