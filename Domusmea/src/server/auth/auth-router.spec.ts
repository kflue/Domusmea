import express from 'express';
import { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../db';
import { AuthRepository } from './auth-repository';
import { createAuthRouter } from './auth-router';
import { MAX_FAILED_LOGINS } from './login-throttle';
import { hashPassword } from './passwords';

const NEW_CREDENTIALS = { username: 'anna', password: 'a long kitchen password' };

describe('auth router', () => {
  let server: Server | undefined;
  let baseUrl: string;

  /** Starts the router; `remote` makes requests look like they come from another machine. */
  async function start({ allowRemoteSetup = false, remote = false } = {}) {
    const repository = new AuthRepository(openDatabase(':memory:'), () => new Date().toISOString());
    const app = express();
    if (remote) {
      app.use((req, _res, next) => {
        Object.defineProperty(req.socket, 'remoteAddress', { value: '192.0.2.10' });
        next();
      });
    }
    app.use(
      '/api/auth',
      createAuthRouter(() => repository, { allowRemoteSetup }),
    );
    server = app.listen(0);
    await new Promise((resolve) => server!.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/auth`;
    return repository;
  }

  afterEach(() => {
    server?.close();
  });

  const send = (path: string, body?: unknown, cookie?: string, headers: object = {}) =>
    fetch(baseUrl + path, {
      method: body === undefined && !path.startsWith('/log') ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  /** The `name=value` part of the session cookie set by a response. */
  const cookieOf = (response: Response) =>
    response.headers
      .getSetCookie()
      .find((cookie) => cookie.startsWith('domusmea_session='))
      ?.split(';')[0];

  async function login(username: string, password: string) {
    const response = await send('/login', { username, password });
    return { response, cookie: cookieOf(response) };
  }

  it('reports no user without a session', async () => {
    await start();
    expect(await (await send('/session')).json()).toEqual({ user: null });
  });

  it('leads the default login to the setup, then accepts only the new credentials', async () => {
    await start();
    const first = await login('admin', 'admin');
    expect(first.response.status).toBe(200);
    expect(await first.response.json()).toEqual({
      user: expect.objectContaining({ username: 'admin', role: 'Owner', setupRequired: true }),
    });
    const setCookie = first.response.headers.getSetCookie()[0];
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/SameSite=Strict/);
    expect(setCookie).not.toMatch(/Secure/);

    const invalid = await send('/setup', { username: 'a', password: 'short' }, first.cookie);
    expect(invalid.status).toBe(400);
    expect(Object.keys((await invalid.json()).fields)).toEqual(['username', 'password']);
    const sameAsName = await send(
      '/setup',
      { username: 'anna.meier.home', password: 'ANNA.MEIER.HOME' },
      first.cookie,
    );
    expect((await sameAsName.json()).fields.password).toEqual([
      'Must differ from the username and the default password',
    ]);

    const setup = await send('/setup', NEW_CREDENTIALS, first.cookie);
    expect(setup.status).toBe(200);
    expect(await setup.json()).toEqual({
      user: expect.objectContaining({ username: 'anna', setupRequired: false }),
    });
    const setupCookie = cookieOf(setup);
    expect(setupCookie).not.toBe(first.cookie);
    expect(await (await send('/session', undefined, first.cookie)).json()).toEqual({ user: null });
    expect((await send('/session', undefined, setupCookie)).status).toBe(200);

    expect((await login('admin', 'admin')).response.status).toBe(401);
    const again = await send(
      '/setup',
      { username: 'mallory', password: 'x'.repeat(12) },
      setupCookie,
    );
    expect(again.status).toBe(403);
    expect((await login('Anna', NEW_CREDENTIALS.password)).response.status).toBe(200);
  });

  it('answers wrong usernames and wrong passwords the same way', async () => {
    await start();
    const unknown = await login('nobody', 'admin');
    const wrong = await login('admin', 'wrong');
    expect([unknown.response.status, wrong.response.status]).toEqual([401, 401]);
    expect(await unknown.response.json()).toEqual({ error: 'invalid-credentials' });
    expect(await wrong.response.json()).toEqual({ error: 'invalid-credentials' });
    expect(unknown.cookie).toBeUndefined();
  });

  it('blocks logins after too many failures, even with the right password', async () => {
    await start();
    for (let i = 0; i < MAX_FAILED_LOGINS; i++) {
      await login('admin', `guess ${i}`);
    }
    const blocked = await login('admin', 'admin');
    expect(blocked.response.status).toBe(429);
    expect(await blocked.response.json()).toEqual({ error: 'too-many-attempts' });
  });

  it('counts parallel login attempts before checking the passwords', async () => {
    await start();
    const attempts = await Promise.all(
      Array.from({ length: MAX_FAILED_LOGINS + 3 }, (_, i) => login('admin', `guess ${i}`)),
    );
    const statuses = attempts.map(({ response }) => response.status).sort();
    expect(statuses.filter((status) => status === 401)).toHaveLength(MAX_FAILED_LOGINS);
    expect(statuses.filter((status) => status === 429)).toHaveLength(3);
  });

  it('treats requests through a proxy as remote and throttles them by username only', async () => {
    await start();
    const proxied = { 'x-forwarded-for': '198.51.100.7' };
    const refused = await send(
      '/login',
      { username: 'admin', password: 'admin' },
      undefined,
      proxied,
    );
    expect(refused.status).toBe(403);
    expect(await refused.json()).toEqual({ error: 'setup-local-only' });

    for (let i = 0; i < MAX_FAILED_LOGINS; i++) {
      await send('/login', { username: `user${i}`, password: 'wrong' }, undefined, proxied);
    }
    // Other usernames behind the same proxy are not blocked.
    const other = await send(
      '/login',
      { username: 'admin', password: 'wrong' },
      undefined,
      proxied,
    );
    expect(other.status).toBe(401);
  });

  it('refuses the setup from other machines unless allowed', async () => {
    await start({ remote: true });
    const refused = await login('admin', 'admin');
    expect(refused.response.status).toBe(403);
    expect(await refused.response.json()).toEqual({ error: 'setup-local-only' });
    expect(refused.cookie).toBeUndefined();

    server!.close();
    await start({ remote: true, allowRemoteSetup: true });
    const allowed = await login('admin', 'admin');
    expect(allowed.response.status).toBe(200);
    expect((await send('/setup', NEW_CREDENTIALS, allowed.cookie)).status).toBe(200);
  });

  it('accepts the chosen credentials from other machines after the setup', async () => {
    const repository = await start({ remote: true });
    repository.completeSetup(1, 'anna', await hashPassword(NEW_CREDENTIALS.password));
    const { response, cookie } = await login('anna', NEW_CREDENTIALS.password);
    expect(response.status).toBe(200);
    expect(await (await send('/session', undefined, cookie)).json()).toEqual({
      user: expect.objectContaining({ username: 'anna' }),
    });
  });

  it('ends the session on logout', async () => {
    await start();
    const { cookie } = await login('admin', 'admin');
    const logout = await send('/logout', undefined, cookie);
    expect(logout.status).toBe(204);
    expect(logout.headers.getSetCookie()[0]).toMatch(/^domusmea_session=;/);
    expect(await (await send('/session', undefined, cookie)).json()).toEqual({ user: null });
  });

  it('marks the cookie Secure behind an HTTPS proxy', async () => {
    await start();
    const response = await send('/login', { username: 'admin', password: 'admin' }, undefined, {
      'x-forwarded-proto': 'https',
    });
    expect(response.headers.getSetCookie()[0]).toMatch(/Secure/);
  });
});
