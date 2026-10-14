# 0004: Money as integer Rappen, dates as ISO strings

- Status: accepted
- Date: 2026-10-10

## Context

Items have a purchase cost and purchase/warranty dates. Floating-point amounts cause rounding errors,
and `Date` objects shift calendar dates across time zones (a date picked in Zurich can become the
previous day in UTC).

## Decision

- **Money**: CHF only. Stored and sent over the API as an integer number of Rappen (`costRappen`,
  `CHF 12.50` = `1250`). The UI converts at the form boundary and formats as `CHF 1'234.50`
  (`de-CH`).
- **Calendar dates** (purchase date, warranty expiry): ISO `YYYY-MM-DD` strings everywhere (SQLite
  `TEXT`, JSON, `<input type="date">`). Comparisons are string comparisons, which sort correctly.
- **Timestamps** (created, updated, notified): ISO 8601 UTC strings.

## Consequences

- No currency column; supporting other currencies later needs a migration and a currency field.
- Code never converts calendar dates to `Date` for storage or comparison; "today" is computed once as
  a `YYYY-MM-DD` string in `APP_TIMEZONE`.
