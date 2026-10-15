import { CapexFigures, CapexYear } from './finance-totals';
import { ITEM_CATEGORIES, ITEM_CATEGORY_LABELS, ItemCategory } from './item';
import { JournalEntry } from './journal';

/** Category of investments whose item has no category, or that are not linked to an item. */
export const OTHER_CATEGORY = 'other';

const CATEGORY_ORDER: readonly string[] = [...ITEM_CATEGORIES, OTHER_CATEGORY];
const CATEGORY_LABELS: Record<string, string> = { ...ITEM_CATEGORY_LABELS, other: 'Other' };

/**
 * Investments from the journal as a capex source of the finance dashboard (ADR 0014): entries of
 * kind `investment` with a cost, grouped by year and by the category of the item they are linked
 * to (`itemCategories`, item id → category), unlinked or uncategorized ones as "Other". An entry
 * dated after `today` is planned; once its date has passed it counts as spent.
 */
export function journalCapex(
  entries: readonly JournalEntry[],
  itemCategories: ReadonlyMap<number, ItemCategory | null>,
  today: string,
): CapexFigures {
  const investments = entries.filter((entry) => entry.kind === 'investment');
  const rows = new Map<string, CapexYear>();
  let withoutCost = 0;
  for (const entry of investments) {
    if (entry.costRappen === null) {
      withoutCost++;
      continue;
    }
    const category =
      (entry.itemId === null ? null : itemCategories.get(entry.itemId)) ?? OTHER_CATEGORY;
    const year = entry.date.slice(0, 4);
    const key = `${year} ${category}`;
    const row = rows.get(key) ?? {
      year,
      category,
      categoryLabel: CATEGORY_LABELS[category],
      spentRappen: 0,
      plannedRappen: 0,
    };
    if (entry.date > today) {
      row.plannedRappen += entry.costRappen;
    } else {
      row.spentRappen += entry.costRappen;
    }
    rows.set(key, row);
  }
  return {
    // By category first: the dashboard orders its lines by first appearance.
    years: [...rows.values()].sort(
      (a, b) =>
        CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) ||
        a.year.localeCompare(b.year),
    ),
    notes:
      withoutCost === 0
        ? []
        : [`${withoutCost} ${withoutCost === 1 ? 'investment' : 'investments'} without cost`],
  };
}
