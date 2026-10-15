import { Routes } from '@angular/router';
import { permissionGuard } from '../auth/auth-guards';

/** The finance dashboard at `/finance` (ADR 0013). */
export const financeRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Finance · Domusmea',
    canActivate: [permissionGuard('finance:read')],
    loadComponent: () => import('./dashboard/finance-dashboard').then((m) => m.FinanceDashboard),
  },
  // The subscriptions moved to `/subscriptions` (ADR 0016); keep old links and bookmarks working.
  { path: 'subscriptions', pathMatch: 'full', redirectTo: '/subscriptions' },
  { path: 'subscriptions/:id', redirectTo: '/subscriptions/:id' },
];
