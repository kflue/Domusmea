import { Routes } from '@angular/router';

/** The finance area (ADR 0009); `/finance` itself is reserved for the dashboard. */
export const financeRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'subscriptions' },
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
