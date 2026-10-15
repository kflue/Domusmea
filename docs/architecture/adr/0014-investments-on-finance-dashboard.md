# 0014: Investments on the finance dashboard

- Status: accepted
- Date: 2026-10-15

## Context

Phase 2 of the finance dashboard (ADR 0013) adds investments: what was and will be invested in the
house per year and category, to budget the coming years and to keep value-adding investments apart
from deductible repairs for the Swiss tax return. Investments are journal entries of kind
`investment`; they have no status and no category of their own. The PRD's open questions decided
how to tell plans from spending (Q2) and how to categorise (Q1).

## Decision

- **Capex sources**: the registry of ADR 0013 gets a second kind, `capex`, whose `load(today)`
  returns `CapexFigures` (`src/shared/finance-totals.ts`): one row per year and category with the
  amount spent and the amount planned, plus notes. A source may report several categories. The
  journal is the first capex source (`journal/journal.finance.ts`, permission `journal:read`);
  without that permission the investments section is hidden.
- **Planned = dated after today** (Q2). There is no status field: an entry for February 2028 is
  planned until that day, then it counts as spent without an edit. The current year shows both.
- **Category = the linked item's category** (Q1, option b): Appliance or Building part; entries
  without an item, or whose item has no category, count as "Other". The source reads
  `/api/items` for the categories, and only with `items:read`; without it every investment counts
  as "Other". No new field, no migration; the journal form and API are unchanged.
- Entries without a cost are left out and counted in a note ("3 investments without cost").
- **Tile**: the current year's total split into spent and planned, and the planned total for the
  next five years. **Chart**: a line per category plus the total, from the first year with an
  investment (at most ten years back) to the last planned year; a year without investments is a
  real 0. Planned years are drawn with dashed segments and hollow points, so shape and not only
  colour separates them; the current year's tooltip shows the split.
- Calculations are pure functions in `src/shared/investment-totals.ts` and `finance-totals.ts`.

## Consequences

- The categories are coarse; a dedicated investment category (option a of Q1) would need a field,
  a migration and an ADR of its own.
- A plan whose date passes without the work being done silently becomes "spent"; the owner has to
  move or delete it. A "planned" hint in the journal (P1, R13) would make plans visible there.
- Investments over ten years old are not shown in the chart.
