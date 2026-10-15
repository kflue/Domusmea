import { Routes } from '@angular/router';
import { permissionGuard } from '../auth/auth-guards';

/** Utility bills per commodity (ADR 0011). */
export const utilityRoutes: Routes = [
  {
    path: '',
    title: 'Energy & utilities · Domusmea',
    loadComponent: () =>
      import('./utility-overview/utility-overview').then((m) => m.UtilityOverview),
  },
  {
    path: 'new',
    title: 'New bill · Domusmea',
    canActivate: [permissionGuard('finance:write')],
    loadComponent: () =>
      import('./utility-bill-form/utility-bill-form').then((m) => m.UtilityBillForm),
  },
  {
    path: ':id',
    title: 'Edit bill entry · Domusmea',
    canActivate: [permissionGuard('finance:write')],
    loadComponent: () =>
      import('./utility-bill-form/utility-bill-form').then((m) => m.UtilityBillForm),
  },
];
