# 0012: Utility year-over-year comparison, monthly cost and bill notes

- Status: accepted
- Date: 2026-10-15

## Context

Phase 2 of the Energy & utilities feature (ADR 0011) adds a year-over-year view, the cost of the
last twelve months, a shared cost function for the coming finance dashboard and an invoice number
and notes per bill. Each needs a rule the PRD leaves open: what a year is compared with while it is
still running, how a quarterly bill becomes a monthly cost, and where notes live when a bill is
stored as one entry per commodity.

## Decision

- **Like-for-like years**: a year is compared with the same quarters of the year before. 2026 with
  Q1–Q3 so far is compared with Q1–Q3 2025, not with all of 2025. An entry counts towards the
  quarter of its end date. If one of those quarters has no entry a year earlier, there is no
  change figure ("–") rather than a misleading one. Change = (this year − last year) ÷ |last year|.
- **Chart overlay**: each chart can overlay the same calendar quarter a year earlier, as outlined,
  translucent bars and a dashed cost line (shape, not only colour, tells them apart). Irregular
  periods have no counterpart.
- **Monthly cost** (`paidRappen(entries, from, to)` in `src/shared/utility-costs.ts`): an entry's
  total (usage cost plus fixed fee) is spread evenly over the calendar months its period touches;
  `from` and `to` select whole months. The exact shares are summed and rounded once, so the months
  of a bill add up to its total. The finance dashboard uses only this function; usage, charts and
  tables stay on `/utilities`.
- **Last twelve months** means the twelve months up to the last billed month (Oct 2025–Sep 2026
  after a Q3 2026 bill), not up to today, so an outstanding bill does not make the total look low.
- **Bills as rows**: `utility_bills` holds the invoice number and notes; every entry belongs to one
  bill (`bill_id`, `ON DELETE CASCADE`). Editing an entry's invoice number or notes changes them for
  the whole bill, and deleting the last entry deletes the bill. The migration of ADR 0011 was
  extended instead of adding one, because it had not been released.
- Notes are multi-line text without other control characters, at most 2000 characters; the invoice
  number is one line of at most 100. Both are optional and stored as `NULL` when empty.

## Consequences

- A year's change figure appears only once the previous year has the same quarters, so the first
  year of data shows totals without changes.
- Spreading by months, not days, slightly misallocates irregular periods (a bill from 15 May counts
  half for May); per-day normalisation remains a P2 option.
- Periods of a bill's entries can still be edited one by one and may then differ; the bill only
  groups them for the invoice number and notes.
