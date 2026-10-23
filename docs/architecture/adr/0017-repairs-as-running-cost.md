# 0017: Repairs as a running cost, investments from items

- Status: accepted
- Date: 2026-10-15
- Supersedes: the journal parts of [0014](0014-investments-on-finance-dashboard.md) (investments as
  journal entries, category of the linked item)

## Context

An appliance or building part already carries its purchase date and cost on `/items`, yet the
investments section of the finance dashboard counted only journal entries of kind `investment`. An
owner who bought a heat pump had to enter it twice. Repairs and maintenance keep the house's
value, recur and are tax-deductible, so they are a running cost; they were listed under capex and
appeared on no dashboard.

## Decision

- **The journal holds only repairs.** `JOURNAL_KINDS`, the `kind` column and its CHECK are gone;
  migration 8 deletes the entries of kind `investment` (the data loss is accepted, no conversion)
  and rebuilds `journal_entries` without the column. A request body with `kind` is rejected (400).
  The URL `/journal` and the `journal:*` permissions stay.
- **Repairs & Maintenance is an opex source** (`journal/journal.finance.ts`, `repairOpex` in
  `src/shared/repair-costs.ts`). Each repair counts at full cost in the month of its date, with no
  spreading. Every month from the first repair with a cost up to the current month is covered,
  CHF 0 without repairs, so the total line has no gaps. The cost this month is that month's
  repairs. Repairs dated after today are left out; repairs without a cost are counted in a note.
  The source needs `journal:read` on top of the dashboard's `finance:read`. In the side navigation
  the topic is "Repairs & Maintenance" in the Opex group.
- **Item purchases are the only capex source** (`items/items.finance.ts`, `itemCapex` in
  `src/shared/item-capex.ts`, permission `items:read`). An item with a cost counts in its purchase
  year under its category (Appliance, Building part, uncategorized as Other); a purchase date after
  today is planned. Items without a cost are counted in a note. Tile and chart stay as in ADR 0014.
- **Purchase date required.** `items.purchase_date` is `NOT NULL`, and the form and the API require
  it, because it decides the year. Migration 8 fills a missing date with the date the item was
  entered, or its warranty expiry if earlier (so the item still passes validation), and logs the
  affected item ids, not their free-text names; the server always starts and the owner corrects
  the dates afterwards.
- **Opex figures may carry notes** (`OpexFigures.notes`), shown under the running costs tile.
- **Lifetime cost of an item**: the item's edit page sums its linked repairs and adds the purchase
  cost, computed in the browser from `/api/journal` (only with `journal:read`).
- **Migrations run with foreign keys off** and `PRAGMA foreign_key_check` before commit, SQLite's
  procedure for table rebuilds; otherwise dropping `items` would clear every repair's item link
  through `ON DELETE SET NULL`. A migration step may be SQL or a function (for logging).

## Consequences

- Each purchase is entered once; the capex chart and the item list cannot disagree.
- Old investment entries are lost; back up `domusmea.db` before deploying.
- A renovation that is not an item has no place in capex yet; the capex registry stays open for a
  later source.
- A single large repair makes its month spike in the running costs chart; that is intended, it is
  what the house cost that month.
