import { Routes } from '@angular/router';

export const settingsRoutes: Routes = [
  {
    path: '',
    title: 'Settings · Domusmea',
    loadComponent: () => import('./email-settings/email-settings').then((m) => m.EmailSettingsPage),
  },
];
