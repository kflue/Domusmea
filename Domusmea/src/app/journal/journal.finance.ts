import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { ItemCategory, ItemList } from '../../shared/item';
import type { JournalEntry } from '../../shared/journal';
import { AuthApi } from '../auth/auth-api';
import type { FinanceSource } from '../finance/dashboard/finance-sources';

/**
 * Investments from the journal on the finance dashboard, by the category of their item (ADR 0014).
 * Without `items:read` the items are not loaded and every investment counts as "Other".
 */
export function journalFinanceSource(): FinanceSource {
  const http = inject(HttpClient);
  const auth = inject(AuthApi);
  return {
    kind: 'capex',
    id: 'journal',
    label: 'Repairs & investments',
    permission: 'journal:read',
    link: '/journal',
    order: 10,
    load: async (today) => {
      // Imported here, not at the top, so registering the source keeps the initial bundle small.
      const [journalApi, itemsApi, totals] = await Promise.all([
        import('./journal-api'),
        import('../items/items-api'),
        import('../../shared/investment-totals'),
      ]);
      const [entries, items] = await Promise.all([
        firstValueFrom(http.get<JournalEntry[]>(journalApi.JOURNAL_URL)),
        auth.can('items:read')
          ? firstValueFrom(http.get<ItemList>(itemsApi.ITEMS_URL)).then((list) => list.items)
          : Promise.resolve([]),
      ]);
      const categories = new Map<number, ItemCategory | null>(
        items.map((item) => [item.id, item.category]),
      );
      return totals.journalCapex(entries, categories, today);
    },
  };
}
