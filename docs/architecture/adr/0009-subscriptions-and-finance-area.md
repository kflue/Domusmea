# 0009: Subscriptions with price history in a finance area

- Status: accepted; the finance area part changed by [0016](0016-subscriptions-area.md)
- Date: 2026-10-15

## Context

The home owner wants to track recurring costs such as streaming services, newspapers and car or
health insurance: the name, the billing date and the cost, billed monthly or annually. Annual costs
must also show as a monthly amount. The subscriptions will feed a separate finance dashboard for
planning (what will it cost per month) and reporting (what has it cost so far). Prices change over
time (health insurance every January), and a change must not rewrite what was paid before it.

## Decision

- **Model**: a subscription has a name, an interval (`monthly` or `annual`), a price per billing, a
  first billing date (`startDate`) and an optional end date. Billings are derived, not stored: they
  fall on the start date's day every month or year, or on the last day of shorter months (31 January
  → 28 February; 29 February → 28 February). Billings after the end date are not counted.
- **Price history**: the price set with the subscription applies from the first billing. Later prices
  are price changes (`validFrom`, `costRappen`), stored in `subscription_price_changes`, at most one
  per day, after the start and not after the end. Each billing is charged at the price in effect on
  its date. The API sends and replaces a subscription together with its whole history.
- **Two views of cost**, both in `src/shared/subscription-costs.ts`, used by the UI and by the coming
  dashboard:
  - _Planning_: the monthly share of each active subscription at its current price (annual ÷ 12).
    Totals add up the exact shares and round once, so twelve monthly shares add up to the annual
    amount.
  - _Reporting_: the actual billings in a period, e.g. "paid this year so far" from 1 January to
    today. Cancelled subscriptions count for the billings they had.
- **Calculated in the browser**: the API returns the subscriptions; totals are computed from them
  with the shared functions. A household has a few dozen subscriptions at most.
- **Finance area**: the side-navigation topic "Finance" (`/finance`) with the subscriptions at
  `/finance/subscriptions`. `/finance` redirects there until the dashboard takes its place. The
  API is `/api/subscriptions`, guarded by the new permissions `finance:read` and `finance:write`,
  which the migration grants to roles that have the journal permissions.
- **Prices** are capped at CHF 1'000'000 per billing (see ADR 0010), so sums stay exact.
- **Cancelled subscriptions** (end date before today) are listed apart, in grey, in a collapsed
  section below the active ones.

## Consequences

- Correcting the first price changes the cost of every billing until the first price change; a price
  increase is recorded as a price change instead.
- Changing the interval or the start date also changes past billings; switching from annual to
  monthly billing is recorded by ending the subscription and adding a new one.
- "Today" for the totals is the browser's date in `Europe/Zurich`, like the journal's default date.
  Reports computed on the server would use `APP_TIMEZONE`.
- The dashboard can reuse `billings()` and `paidRappen()` for any period (per month, per year)
  without API changes.
