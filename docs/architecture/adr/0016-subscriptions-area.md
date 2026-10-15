# 0016: Subscriptions as their own area

- Status: accepted
- Date: 2026-10-15
- Changes: [0009](0009-subscriptions-and-finance-area.md) (finance area),
  [0013](0013-finance-dashboard-and-sources.md) (subscriptions under `/finance`)

## Context

The subscriptions lived at `/finance/subscriptions` without a menu entry; the only way there was a
link on the finance dashboard. The home owner wants them in the side navigation, next to Energy &
utilities as running costs (ADR 0015), with their totals on the page like Repairs & investments.

## Decision

- **Own area**: the feature moves from `src/app/finance/subscriptions/` to `src/app/subscriptions/`,
  laid out like `utilities/`: `subscriptions.routes.ts`, `subscriptions.nav.ts` and
  `subscriptions.finance.ts`. Pages: `/subscriptions`, `/subscriptions/new`, `/subscriptions/:id`.
  The form routes need `finance:write`.
- **Navigation**: topic "Subscriptions" in the **Opex** group, last in the menu (`finance:read`).
- **API unchanged**: `/api/subscriptions` with the `finance:read` / `finance:write` permissions.
  Subscriptions are a finance topic; only the page address changes.
- **Old addresses redirect**: `/finance/subscriptions` and `/finance/subscriptions/:id` (including
  `new`) redirect to the new pages, so bookmarks keep working.
- **Totals with a year select**, like the journal: per month and per year at today's prices (planning,
  whatever the year), and _Paid in <year>_ for the selected year, up to today while it runs
  (`paidInYearRappen`). The years offered are those with billings plus the current one
  (`billingYears`), both in `src/shared/subscription-costs.ts`.
- **No charts** on the page: charts and the comparison across cost categories stay on the finance
  dashboard, whose subscriptions source now links to `/subscriptions`.

## Consequences

- The finance area under `/finance` is the dashboard alone.
- The page and the dashboard compute from the same shared functions, so their figures agree.
- The page address and the API name are the same, but the permissions stay `finance:*`; a separate
  `subscriptions:*` permission would need a migration and is not worth it for one household.
