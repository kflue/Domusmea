import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { createApiRouter } from './server/api-router';
import {
  allowRemoteSetup,
  authRepository,
  secureCookies,
  clock,
  emailSettingsRepository,
  itemRepository,
  journalRepository,
  startBackgroundJobs,
} from './server/app-services';
import {
  allowedHostMatcher,
  rejectCrossSiteWrites,
  requireAllowedHost,
  securityHeaders,
} from './server/security';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

app.disable('x-powered-by');
app.use(securityHeaders);

/**
 * The build loads this module without serving requests, so background jobs start with the first
 * request (dev server) or when the server starts listening (below), not at import time.
 */
app.use((_req, _res, next) => {
  startBackgroundJobs();
  next();
});

/**
 * REST API (docs/architecture/README.md): only allowed host names and same-origin writes are
 * accepted (ADR 0005), and everything except `/api/auth` requires a session (ADR 0007).
 */
const isAllowedHost = allowedHostMatcher();
app.use(
  '/api',
  requireAllowedHost(isAllowedHost),
  rejectCrossSiteWrites(isAllowedHost),
  createApiRouter({
    auth: authRepository,
    items: itemRepository,
    journal: journalRepository,
    emailSettings: emailSettingsRepository,
    today: clock.today,
    allowRemoteSetup,
    secureCookies,
  }),
);

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (process.argv.includes('--reset-login') && isMainModule(import.meta.url)) {
  // Forgotten password (ADR 0007): back to admin / admin and the first-run setup.
  authRepository().resetToDefault();
  console.log('Login reset. Sign in with admin / admin and choose new credentials.');
} else if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = Number(process.env['PORT'] || 4000);
  // Local only by default (ADR 0005); set HOST to reach the app from other devices (ADR 0007).
  const host = process.env['HOST'] || '127.0.0.1';
  app.listen(port, host, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://${host}:${port}`);
    startBackgroundJobs();
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
