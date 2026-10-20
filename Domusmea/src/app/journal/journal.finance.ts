import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { JournalEntry } from '../../shared/journal';
import type { FinanceSource } from '../finance/dashboard/finance-sources';

/**
 * Repairs & Maintenance on the finance dashboard: each repair in the month it was done (ADR 0017).
 * Needs `journal:read` on top of the dashboard's `finance:read`.
 */
export function journalFinanceSource(): FinanceSource {
  const http = inject(HttpClient);
  return {
    kind: 'opex',
    id: 'journal',
    label: 'Repairs & Maintenance',
    permission: 'journal:read',
    link: '/journal',
    order: 30,
    load: async (today) => {
      // Imported here, not at the top, so registering the source keeps the initial bundle small.
      const [api, costs] = await Promise.all([
        import('./journal-api'),
        import('../../shared/repair-costs'),
      ]);
      return costs.repairOpex(
        await firstValueFrom(http.get<JournalEntry[]>(api.JOURNAL_URL)),
        today,
      );
    },
  };
}
