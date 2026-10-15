import { Routes } from '@angular/router';
import { permissionGuard } from '../auth/auth-guards';

/** Subscriptions with their totals (ADR 0009, 0016). */
export const subscriptionRoutes: Routes = [
  {
    path: '',
    title: 'Subscriptions · Domusmea',
    loadComponent: () =>
      import('./subscription-list/subscription-list').then((m) => m.SubscriptionList),
  },
  {
    path: 'new',
    title: 'New subscription · Domusmea',
    canActivate: [permissionGuard('finance:write')],
    loadComponent: () =>
      import('./subscription-form/subscription-form').then((m) => m.SubscriptionForm),
  },
  {
    path: ':id',
    title: 'Edit subscription · Domusmea',
    canActivate: [permissionGuard('finance:write')],
    loadComponent: () =>
      import('./subscription-form/subscription-form').then((m) => m.SubscriptionForm),
  },
];
