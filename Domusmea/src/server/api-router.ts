import express, { Router } from 'express';
import { createAccountRouter } from './auth/account-router';
import { requirePermissions, requireSession } from './auth/access-control';
import { AuthRepository } from './auth/auth-repository';
import { createAuthRouter } from './auth/auth-router';
import { LoginThrottle } from './auth/login-throttle';
import { EmailSettingsRepository } from './email/email-settings-repository';
import { createEmailSettingsRouter } from './email/email-settings-router';
import { ItemRepository } from './items/item-repository';
import { createItemsRouter } from './items/items-router';

/** Repositories are resolved per request so the database is only opened when the API is used. */
export interface ApiServices {
  auth: () => AuthRepository;
  items: () => ItemRepository;
  emailSettings: () => EmailSettingsRepository;
  today: () => string;
  /** See `AuthRouterOptions.allowRemoteSetup`. */
  allowRemoteSetup: boolean;
  /** Always mark the session cookie `Secure` (`SECURE_COOKIES=true`). */
  secureCookies?: boolean;
  throttle?: LoginThrottle;
}

/**
 * The REST API, mounted at `/api` behind the host and same-origin checks (ADR 0005). Only
 * `/api/auth` is reachable without a session; every feature router after the session check is
 * mounted with the permissions it needs (ADR 0007). Unknown paths get a JSON 404.
 */
export function createApiRouter(services: ApiServices): Router {
  const router = express.Router();
  const { secureCookies = false, throttle = new LoginThrottle() } = services;
  router.use(
    '/auth',
    createAuthRouter(services.auth, {
      allowRemoteSetup: services.allowRemoteSetup,
      secureCookies,
      throttle,
    }),
  );

  router.use(requireSession(services.auth, secureCookies));
  router.use(
    '/account',
    requirePermissions({ read: 'account:manage', write: 'account:manage' }),
    createAccountRouter(services.auth, { throttle, secureCookies }),
  );
  router.use(
    '/items',
    requirePermissions({ read: 'items:read', write: 'items:write' }),
    createItemsRouter(services.items, services.today),
  );
  router.use(
    '/settings/email',
    requirePermissions({ read: 'settings:read', write: 'settings:write' }),
    createEmailSettingsRouter(services.emailSettings),
  );

  router.use((_req, res) => {
    res.status(404).json({ error: 'not-found' });
  });
  return router;
}
