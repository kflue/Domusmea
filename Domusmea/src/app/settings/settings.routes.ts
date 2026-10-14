import { Routes } from '@angular/router';

export const settingsRoutes: Routes = [
  {
    path: '',
    title: 'Settings · Domusmea',
    loadComponent: () => import('./settings-page').then((m) => m.SettingsPage),
  },
];
