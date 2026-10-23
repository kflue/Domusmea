import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { ItemList } from '../../shared/item';
import type { FinanceSource } from '../finance/dashboard/finance-sources';

/** Item purchases on the finance dashboard, by year and category (ADR 0017). */
export function itemsFinanceSource(): FinanceSource {
  const http = inject(HttpClient);
  return {
    kind: 'capex',
    id: 'items',
    label: 'Appliances & building parts',
    permission: 'items:read',
    link: '/items',
    order: 10,
    load: async (today) => {
      // Imported here, not at the top, so registering the source keeps the initial bundle small.
      const [api, capex] = await Promise.all([
        import('./items-api'),
        import('../../shared/item-capex'),
      ]);
      const { items } = await firstValueFrom(http.get<ItemList>(api.ITEMS_URL));
      return capex.itemCapex(items, today);
    },
  };
}
