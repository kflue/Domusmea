import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Database-backed pages render in the browser so they always show current data.
  { path: 'items', renderMode: RenderMode.Client },
  { path: 'items/**', renderMode: RenderMode.Client },
  { path: 'settings', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Prerender },
];
