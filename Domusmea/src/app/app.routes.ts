import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'items' },
  { path: 'items', loadChildren: () => import('./items/items.routes').then((m) => m.itemRoutes) },
  {
    path: 'settings',
    loadChildren: () => import('./settings/settings.routes').then((m) => m.settingsRoutes),
  },
  { path: '**', redirectTo: 'items' },
];
