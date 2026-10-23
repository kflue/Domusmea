import { CapexFigures, CapexYear } from './finance-totals';
import { Item, ITEM_CATEGORIES, ITEM_CATEGORY_LABELS } from './item';

/** Category of items without a category. */
export const OTHER_CATEGORY = 'other';

const CATEGORY_ORDER: readonly string[] = [...ITEM_CATEGORIES, OTHER_CATEGORY];
const CATEGORY_LABELS: Record<string, string> = { ...ITEM_CATEGORY_LABELS, other: 'Other' };

/**
 * Item purchases as the capex source of the finance dashboard (ADR 0017): each item with a cost
 * counts in the year of its purchase date, by its category, uncategorized ones as "Other". An item
 * bought after `today` is planned; once its date has passed it counts as spent.
 */
export function itemCapex(items: readonly Item[], today: string): CapexFigures {
  const rows = new Map<string, CapexYear>();
  let withoutCost = 0;
  for (const item of items) {
    if (item.costRappen === null) {
      withoutCost++;
      continue;
    }
    const category = item.category ?? OTHER_CATEGORY;
    const year = item.purchaseDate.slice(0, 4);
    const key = `${year} ${category}`;
    const row = rows.get(key) ?? {
      year,
      category,
      categoryLabel: CATEGORY_LABELS[category],
      spentRappen: 0,
      plannedRappen: 0,
    };
    if (item.purchaseDate > today) {
      row.plannedRappen += item.costRappen;
    } else {
      row.spentRappen += item.costRappen;
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
        : [`${withoutCost} ${withoutCost === 1 ? 'item' : 'items'} without cost`],
  };
}
