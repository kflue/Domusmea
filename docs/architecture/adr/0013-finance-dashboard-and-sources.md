# 0013: Finance dashboard and cost source registry

- Status: accepted
- Date: 2026-10-15

## Context

The finance area (ADR 0009) redirected `/finance` to the subscriptions, and the shared cost
functions for a dashboard already existed (ADR 0009, ADR 0012). The home owner wants to see what the
house costs per month to run (opex) without adding up the subscriptions and utilities pages by hand,
and how that cost developed (PRD "Finance Dashboard — recurring costs and investments", phase 1).
More cost categories will follow, such as taxes from a separate Income & taxes area, and must not
require changes to the dashboard.

## Decision

- **Dashboard at `/finance`** (`RenderMode.Client`, lazy, guarded by `finance:read`). Subscriptions
  stay at `/finance/subscriptions`; the side-navigation topic "Finance" now lands on the dashboard.
- **Source registry**: each cost category is a _finance source_ registered by its feature with
  `provideFinanceSource(factory)` in `app.config.ts`, like nav topics (ADR 0008). A source declares
  `id`, `label`, `permission`, `link`, `order` and `kind: 'opex'`, and a `load(today)` returning plain
  `OpexFigures` (`src/shared/finance-totals.ts`): the current monthly cost, unrounded, and a cost per
  calendar month `YYYY-MM`. The factory runs in an injection context when the dashboard first injects
  the sources; `load` imports the feature's API path and shared cost code with `import()`, so
  registering a source adds only its metadata to the initial bundle. The dashboard skips sources
  whose permission the role lacks and shows an inline error for one that fails, with the others
  still drawn.
- **Monthly recurring cost (MRC)**: subscriptions count their monthly share (annual ÷ 12) as on
  their page; utilities the cost of the last twelve billed months ÷ 12 (ADR 0012). The total is the
  sum of the exact amounts, rounded once.
- **Cost per month** for the chart, last 24 months up to the current one: subscriptions by the
  monthly share of every subscription running in that month at the price in effect on the first day
  it runs there (`monthlyShareIn`), so an annual billing is no spike; utilities by `paidRappen` for
  each month a bill covers. A month a source does not cover (a bill not entered yet, months before
  the first subscription) has no value: the chart shows a gap, never 0, and the total is drawn only
  for months every drawn category covers. A total line appears once there are two categories.
- **Charts**: Chart.js line charts with a point on every value, a tooltip "series · period · CHF"
  on hover and keyboard focus, the y-axis in CHF from 0. Chart.js is registered in one module,
  `app/shared/chart-js.ts`, imported only by the lazy chart loaders (`utility-chart`, `cost-chart`),
  so it stays a single lazy chunk. Category colours and point styles come from one ordered palette
  of eight colours, each at least 3:1 against white and gray-950, assigned by `order`; the total is
  drawn in the text colour. Planned periods (for investments, phase 2) are drawn dashed with hollow
  points. A table of the same figures below each chart is its text alternative.
- Calculations stay in the browser with shared pure functions (ADR 0009); no new endpoint.

## Consequences

- A new opex category (taxes, insurance, mortgage interest) is one `<feature>.finance.ts` file, a
  shared function returning `OpexFigures` and one `provideFinanceSource(...)` line; dashboard and
  chart code stay unchanged, as a unit test with a fake "Taxes" source checks.
- Each source loads its full list once per dashboard visit, separately from its feature's
  `httpResource`; with a few hundred rows this is cheaper than a server aggregation endpoint.
- A subscription counts a full monthly share in its first and last month even if it runs only part
  of them, and a price change counts from the following month; both are close enough for a trend.
- The initial bundle grows by about 2 kB raw (1.5 kB transferred), mostly from esbuild re-splitting
  shared chunks; the dashboard is a 10 kB lazy chunk and Chart.js remains one lazy chunk.
- Rejected: a server-side dashboard endpoint (duplicates the shared functions, no data volume to
  justify it) and a stacked area chart (hides gaps and makes per-category trends hard to read).
