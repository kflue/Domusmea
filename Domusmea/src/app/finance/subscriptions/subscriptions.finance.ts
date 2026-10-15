import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { Subscription } from '../../../shared/subscription';
import type { FinanceSource } from '../dashboard/finance-sources';

/** Subscriptions on the finance dashboard: their monthly share (ADR 0009, 0013). */
export function subscriptionsFinanceSource(): FinanceSource {
  const http = inject(HttpClient);
  return {
    kind: 'opex',
    id: 'subscriptions',
    label: 'Subscriptions',
    permission: 'finance:read',
    link: '/finance/subscriptions',
    order: 10,
    load: async (today) => {
      // Imported here, not at the top, so registering the source keeps the initial bundle small.
      const [api, costs] = await Promise.all([
        import('./subscriptions-api'),
        import('../../../shared/subscription-costs'),
      ]);
      const subscriptions = await firstValueFrom(http.get<Subscription[]>(api.SUBSCRIPTIONS_URL));
      return costs.subscriptionOpex(subscriptions, today);
    },
  };
}
