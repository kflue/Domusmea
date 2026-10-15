import { Routes } from '@angular/router';
import { setupGuard, signedInGuard, signedOutGuard } from './auth/auth-guards';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'items' },
  {
    path: 'login',
    title: 'Sign in · Domusmea',
    canActivate: [signedOutGuard],
    loadComponent: () => import('./auth/login/login').then((m) => m.LoginPage),
  },
  {
    path: 'setup',
    title: 'Choose your sign-in · Domusmea',
    canActivate: [setupGuard],
    loadComponent: () => import('./auth/setup/setup').then((m) => m.SetupPage),
  },
  {
    path: 'items',
    canActivate: [signedInGuard],
    loadChildren: () => import('./items/items.routes').then((m) => m.itemRoutes),
  },
  {
    path: 'journal',
    canActivate: [signedInGuard],
    loadChildren: () => import('./journal/journal.routes').then((m) => m.journalRoutes),
  },
  {
    path: 'finance',
    canActivate: [signedInGuard],
    loadChildren: () => import('./finance/finance.routes').then((m) => m.financeRoutes),
  },
  {
    path: 'settings',
    canActivate: [signedInGuard],
    loadChildren: () => import('./settings/settings.routes').then((m) => m.settingsRoutes),
  },
  { path: '**', redirectTo: 'items' },
];
