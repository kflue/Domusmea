import { monthRange, OpexFigures } from './finance-totals';
import { JournalEntry } from './journal';

/** Number and total cost of the repairs linked to the item `itemId` (ADR 0017). */
export function itemRepairs(
  entries: readonly JournalEntry[],
  itemId: number,
): { count: number; totalRappen: number } {
  const repairs = entries.filter((entry) => entry.itemId === itemId);
  return {
    count: repairs.length,
    totalRappen: repairs.reduce((sum, entry) => sum + (entry.costRappen ?? 0), 0),
  };
}

/**
 * Repairs & Maintenance as an opex source of the finance dashboard (ADR 0017): each repair counts
 * at full cost in the month of its date. Every month from the first repair with a cost up to the
 * month of `today` is covered, CHF 0 without repairs, so the total line has no gaps. Repairs dated
 * after `today` are left out; without any repair cost there are no months and no line.
 */
export function repairOpex(entries: readonly JournalEntry[], today: string): OpexFigures {
  const done = entries.filter((entry) => entry.date <= today);
  const costed = done.filter((entry) => entry.costRappen !== null);
  const withoutCost = done.length - costed.length;
  const current = today.slice(0, 7);
  const monthly: Record<string, number> = {};
  if (costed.length) {
    const first = costed.reduce((min, entry) => (entry.date < min ? entry.date : min), today);
    for (const month of monthRange(first.slice(0, 7), current)) {
      monthly[month] = 0;
    }
    for (const entry of costed) {
      monthly[entry.date.slice(0, 7)] += entry.costRappen ?? 0;
    }
  }
  return {
    currentMonthlyRappen: monthly[current] ?? 0,
    monthly,
    notes:
      withoutCost === 0
        ? []
        : [`${withoutCost} ${withoutCost === 1 ? 'repair' : 'repairs'} without cost`],
  };
}
