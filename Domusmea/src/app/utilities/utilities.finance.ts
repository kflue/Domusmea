import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { UtilityEntry } from '../../shared/utility';
import type { FinanceSource } from '../finance/dashboard/finance-sources';

/** Energy & utilities on the finance dashboard: the cost per month of the bills (ADR 0012, 0013). */
export function utilitiesFinanceSource(): FinanceSource {
  const http = inject(HttpClient);
  return {
    kind: 'opex',
    id: 'utilities',
    label: 'Energy & utilities',
    permission: 'finance:read',
    link: '/utilities',
    order: 20,
    load: async () => {
      // Imported here, not at the top, so registering the source keeps the initial bundle small.
      const [api, costs] = await Promise.all([
        import('./utilities-api'),
        import('../../shared/utility-costs'),
      ]);
      return costs.utilityOpex(await firstValueFrom(http.get<UtilityEntry[]>(api.UTILITIES_URL)));
    },
  };
}
