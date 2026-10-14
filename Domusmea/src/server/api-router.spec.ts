import express from 'express';
import { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApiRouter } from './api-router';
import { AuthRepository } from './auth/auth-repository';
import { hashPassword } from './auth/passwords';
import { openDatabase } from './db';
import { EmailSettingsRepository } from './email/email-settings-repository';
import { ItemRepository } from './items/item-repository';
import { testClock } from './items/test-clock';

/** One request per route of every feature router; each must require a session. */
const PROTECTED_ROUTES = [
  ['GET', '/items'],
  ['GET', '/items/1'],
  ['POST', '/items'],
  ['PUT', '/items/1'],
  ['DELETE', '/items/1'],
  ['GET', '/settings/email'],
  ['PUT', '/settings/email'],
  ['POST', '/settings/email/test'],
  ['GET', '/unknown'],
] as const;

describe('API router', () => {
  let server: Server;
  let baseUrl: string;
  let db: DatabaseSync;
  let auth: AuthRepository;

  beforeEach(async () => {
    db = openDatabase(':memory:');
    const clock = testClock('2026-10-14');
    auth = new AuthRepository(db, () => new Date().toISOString());
    const items = new ItemRepository(db, clock);
    const emailSettings = new EmailSettingsRepository(db, undefined, clock.now);
    const app = express().use(
      '/api',
      createApiRouter({
        auth: () => auth,
        items: () => items,
        emailSettings: () => emailSettings,
        today: clock.today,
        allowRemoteSetup: false,
      }),
    );
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  });

  afterEach(() => {
    server.close();
  });

  const send = (method: string, path: string, cookie?: string) =>
    fetch(baseUrl + path, {
      method,
      headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: method === 'GET' || method === 'DELETE' ? undefined : JSON.stringify({ name: 'Roof' }),
    });

  const sessionCookie = (id: number) => `domusmea_session=${auth.createSession(id)}`;

  it('requires a session for every route except /auth', async () => {
    for (const [method, path] of PROTECTED_ROUTES) {
      const response = await send(method, path);
      expect(response.status, `${method} ${path}`).toBe(401);
      expect(await response.json()).toEqual({ error: 'unauthenticated' });
    }
    expect((await send('GET', '/auth/session')).status).toBe(200);
  });

  it('allows only the setup with the default credentials', async () => {
    const cookie = sessionCookie(1);
    for (const [method, path] of PROTECTED_ROUTES) {
      const response = await send(method, path, cookie);
      expect(response.status, `${method} ${path}`).toBe(403);
      expect(await response.json()).toEqual({ error: 'setup-required' });
    }
  });

  it('serves the API after the setup', async () => {
    auth.completeSetup(1, 'anna', await hashPassword('a long kitchen password'));
    const cookie = sessionCookie(1);
    expect((await send('POST', '/items', cookie)).status).toBe(201);
    expect((await send('GET', '/settings/email', cookie)).status).toBe(200);
    expect((await send('GET', '/unknown', cookie)).status).toBe(404);
  });

  it('checks the permissions of the account role', async () => {
    auth.completeSetup(1, 'anna', await hashPassword('a long kitchen password'));
    db.exec(`INSERT INTO roles (id, name) VALUES (2, 'Viewer');
      INSERT INTO role_permissions (role_id, permission) VALUES (2, 'items:read');
      UPDATE users SET role_id = 2;`);
    const cookie = sessionCookie(1);

    expect((await send('GET', '/items', cookie)).status).toBe(200);
    for (const [method, path] of [
      ['POST', '/items'],
      ['DELETE', '/items/1'],
      ['GET', '/settings/email'],
    ]) {
      const response = await send(method, path, cookie);
      expect(response.status, `${method} ${path}`).toBe(403);
      expect(await response.json()).toEqual({ error: 'forbidden' });
    }
  });
});
