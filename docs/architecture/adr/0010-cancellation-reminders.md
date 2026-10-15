# 0010: Email reminders before cancellation deadlines

- Status: accepted
- Date: 2026-10-15

## Context

Many subscriptions, especially insurances, renew automatically each year and can only be ended with
notice, e.g. three months before the renewal. Missing the deadline locks the owner in for another
year. The owner wants a notice period on each subscription and an email early enough to act on it:
about a third of the notice period before the deadline.

## Decision

- **Notice period**: an optional `noticeMonths` (0 to 24) per subscription. `null` means it can be
  cancelled any time (e.g. a streaming service) and gets no reminder. `0` means cancellable until the
  day before the renewal.
- **Renewal**: the contract renews every year on the anniversary of the first billing, whether it
  is billed monthly or annually (health insurance is billed monthly but renews yearly). Anniversaries
  are clamped like billings (29 February → 28 February in other years).
- **Deadline**: the notice must arrive by the day before `renewal − notice period`. Three months
  before a 1 January renewal → 30 September.
- **Reminder date**: `deadline − max(7 days, ⅓ of the notice period in days)`. Three months'
  notice → 31 days before the deadline, one month → 10 days, none → one week.
- **Rule in shared code**: `src/shared/cancellation.ts` (with date arithmetic in
  `src/shared/calendar.ts`), so the list page shows "Cancel by …" from the same calculation. The line
  is highlighted once the reminder is due.
- **Job**: like the warranty check (ADR 0003), an in-process hourly check
  (`src/server/subscriptions/cancellation-reminder.ts`) using the shared `startPeriodicCheck`. It
  sends one email to the Settings recipients (ADR 0006) listing every running subscription (no end
  date) whose reminder date has come and whose deadline has not passed.
- **State**: `subscriptions.cancel_reminded_for` stores the deadline last reminded of. A subscription
  is due again when its next deadline differs: the following year, or after its notice period or start
  date was changed. It is marked only after the email was sent; on failure the next check retries.
  Missed days are caught up until the deadline, never after it.
- **Price cap**: prices per billing are limited to CHF 1'000'000 (`MAX_PRICE_RAPPEN`), so totals
  over many subscriptions and years stay exact integers.

## Consequences

- A subscription entered with a deadline already in its reminder window is reminded at the next
  check, which is wanted: there is still time to act.
- Contracts that renew on another date than the first billing's anniversary (e.g. always on
  1 January) need the first billing set to that date for the deadline to be right.
- Setting an end date counts as cancelled and stops the reminders.
- The same single-process limitation as ADR 0003 applies: two server processes could send a reminder
  twice.
