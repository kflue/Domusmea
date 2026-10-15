import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Database-backed pages render in the browser so they always show current data; the sign-in
  // pages too, since they depend on the session.
  { path: 'login', renderMode: RenderMode.Client },
  { path: 'setup', renderMode: RenderMode.Client },
  { path: 'items', renderMode: RenderMode.Client },
  { path: 'items/**', renderMode: RenderMode.Client },
  { path: 'journal', renderMode: RenderMode.Client },
  { path: 'journal/**', renderMode: RenderMode.Client },
  { path: 'finance', renderMode: RenderMode.Client },
  { path: 'finance/**', renderMode: RenderMode.Client },
  { path: 'utilities', renderMode: RenderMode.Client },
  { path: 'utilities/**', renderMode: RenderMode.Client },
  { path: 'settings', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Prerender },
];
