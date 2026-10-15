import { Routes } from '@angular/router';
import { permissionGuard } from '../auth/auth-guards';

/** The finance area (ADR 0009): the dashboard at `/finance` (ADR 0013) and the subscriptions. */
export const financeRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Finance · Domusmea',
    canActivate: [permissionGuard('finance:read')],
    loadComponent: () => import('./dashboard/finance-dashboard').then((m) => m.FinanceDashboard),
  },
  {
    path: 'subscriptions',
    title: 'Subscriptions · Domusmea',
    loadComponent: () =>
      import('./subscriptions/subscription-list/subscription-list').then((m) => m.SubscriptionList),
  },
  {
    path: 'subscriptions/new',
    title: 'New subscription · Domusmea',
    loadComponent: () =>
      import('./subscriptions/subscription-form/subscription-form').then((m) => m.SubscriptionForm),
  },
  {
    path: 'subscriptions/:id',
    title: 'Edit subscription · Domusmea',
    loadComponent: () =>
      import('./subscriptions/subscription-form/subscription-form').then((m) => m.SubscriptionForm),
  },
];
