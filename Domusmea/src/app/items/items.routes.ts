import { Routes } from '@angular/router';

export const itemRoutes: Routes = [
  {
    path: '',
    title: 'Appliances & building parts · Domusmea',
    loadComponent: () => import('./item-list/item-list').then((m) => m.ItemList),
  },
  {
    path: 'new',
    title: 'New item · Domusmea',
    loadComponent: () => import('./item-form/item-form').then((m) => m.ItemForm),
  },
  {
    path: ':id',
    title: 'Edit item · Domusmea',
    loadComponent: () => import('./item-form/item-form').then((m) => m.ItemForm),
  },
];
