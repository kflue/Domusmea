# 0011: Utility bills per commodity, charts with Chart.js

- Status: accepted
- Date: 2026-10-15

## Context

The home owner gets a quarterly bill from the municipal energy and utilities company covering
electricity (kWh), water (m³), waste water (m³) and garbage (a flat fee, "Pauschale"). Electricity
and water also have a fixed fee. The bills should be captured in a couple of minutes and shown per
commodity as a table and a chart, with totals per year (PRD "Energy Dashboard"). No chart library
was installed, and the existing pages must keep their bundle size.

## Decision

- **Model**: one entry per commodity and billing period (`utility_entries`): `period_from`,
  `period_to`, `amount_milli`, `cost_rappen`, `fixed_fee_rappen`. A bill is entered once
  (`POST /api/utilities` with one line per billed commodity, stored in one transaction); edits and
  deletes work on single entries. The commodities and their units are defined once in
  `src/shared/utility.ts`; in the database the commodity is a plain string key, so adding one
  (gas, district heating) needs no migration.
- **Exact sums**: amounts are integer thousandths of the unit (up to 3 decimals), money integer
  Rappen (ADR 0004). Credits are negative costs; amounts are never negative.
- **Commodity rules**, checked by the API: metered commodities need an amount; garbage has neither
  amount nor usage cost, only its flat fee (`fixed_fee_rappen`); waste water has no fixed fee.
- **Price per unit** = usage cost ÷ amount, fixed fee excluded; blank for an amount of 0.
- **Years**: bills follow calendar quarters. An irregular period (move-in, final bill) counts
  towards the year of its end date; there is no splitting by days.
- **Overlaps** with an existing period of the same commodity are a warning in the form, not an API
  error, because final bills can overlap.
- **Calculated in the browser** with `src/shared/utility-costs.ts`, like ADR 0009: the API returns
  all entries without paging (4 commodities × 4 quarters × 20 years = 320 rows).
- **Own navigation topic** "Energy & utilities" at `/utilities` (`RenderMode.Client`), guarded by the
  `finance:read` / `finance:write` permissions. The finance dashboard will only show the utility
  cost per month through shared functions.
- **Charts with Chart.js 4** (MIT): bars for the amount, a line for the cost on a second axis,
  tooltips. It is imported dynamically from `utility-chart/chart-loader.ts` in `afterNextRender`, so
  it is never part of the initial bundle or the server render, and registers only the controllers,
  elements and scales it uses. Measured: a lazy chunk of 173 kB raw, 53 kB transferred; the
  initial bundle is unchanged. Axis and legend colours come from the surrounding text colour, so a
  future dark theme applies; the series colours have at least 3:1 contrast on light and dark
  backgrounds. The canvas is focusable and steps through the periods with the arrow keys, and the
  table next to each chart is its text alternative.

## Consequences

- Hand-drawn SVG would have avoided the dependency but meant writing scales, tooltips and
  responsive layout ourselves; Chart.js costs one lazy download on the first visit to `/utilities`.
- The canvas is not part of the accessibility tree; the announcement of the selected period and the
  tables carry the information for screen readers.
- Meter readings can be added later by computing `amount_milli` from them; per-day normalisation of
  irregular periods is not done.
