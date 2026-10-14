# 0003: Warranty expiry notifications

- Status: accepted
- Date: 2026-10-10

## Context

Users want an email when an item's warranty expires. Requirements agreed with the user:

- One household, no login; recipients are configured (`WARRANTY_NOTIFY_TO`).
- One email on the expiry day (no reminder beforehand). "Warranty until DD.MM.YYYY" includes that
  day, so the email says the warranty _ends today_.
- Items entered with an expiry date already in the past never trigger an email.
- Email via SMTP; development works without an SMTP server.

## Decision

- **Scheduling**: an in-process job in the Express server checks at startup and then hourly. In
  the dev server it starts with the first request, because the build also loads `server.ts`. No
  external cron. A `globalThis` flag ensures one job per process, also when the dev server reloads
  `server.ts`.
- **Selection**: items with `warranty_expires <= today` and `warranty_notified_at IS NULL`. "Today" is
  the date in `APP_TIMEZONE` (default `Europe/Zurich`). Missed days (server down) are caught up on the
  next check.
- **State on the item**: `warranty_notified_at` records that an item needs no (more) email.
  - Set when the email was sent.
  - Set at create/update time when the expiry date is today or earlier, so already expired items are
    never announced.
  - Cleared when the expiry date is changed to a future date, so the item is announced again later.
- **Email**: one email per check listing all due items. Normally sent on the expiry day ("Warranty
  ends today: …"); items found later because the server was down are described as ended ("Warranty
  ended: …"). The list shows "Ends today" on that day and "Expired" afterwards; both use the
  server's date (`today` in the `GET /api/items` response), so UI and email agree. Items are marked only after the
  email was sent successfully; on failure they are retried at the next check.
- **Transport**: Nodemailer with `SMTP_*` settings. Without `SMTP_HOST`, a console transport logs the
  email instead. Without `WARRANTY_NOTIFY_TO`, the check does nothing and logs that once.

## Consequences

- Emails are only sent while the server runs; the hourly catch-up covers restarts.
- Running more than one server process against the same database could send duplicate emails. This
  is acceptable for a single-household deployment; a multi-instance setup would need a lock or an
  external scheduler.
- Per-user recipients (after a login feature) will replace `WARRANTY_NOTIFY_TO`.
