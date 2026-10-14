import { Routes } from '@angular/router';

export const journalRoutes: Routes = [
  {
    path: '',
    title: 'Repairs & investments · Domusmea',
    loadComponent: () => import('./journal-list/journal-list').then((m) => m.JournalList),
  },
  {
    path: 'new',
    title: 'New journal entry · Domusmea',
    loadComponent: () => import('./journal-form/journal-form').then((m) => m.JournalForm),
  },
  {
    path: ':id',
    title: 'Edit journal entry · Domusmea',
    loadComponent: () => import('./journal-form/journal-form').then((m) => m.JournalForm),
  },
];
