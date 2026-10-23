import { Routes } from '@angular/router';

export const journalRoutes: Routes = [
  {
    path: '',
    title: 'Repairs & Maintenance · Domusmea',
    loadComponent: () => import('./journal-list/journal-list').then((m) => m.JournalList),
  },
  {
    path: 'new',
    title: 'New repair · Domusmea',
    loadComponent: () => import('./journal-form/journal-form').then((m) => m.JournalForm),
  },
  {
    path: ':id',
    title: 'Edit repair · Domusmea',
    loadComponent: () => import('./journal-form/journal-form').then((m) => m.JournalForm),
  },
];
