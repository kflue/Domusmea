import express from 'express';
import { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApiRouter } from '../api-router';
import { openDatabase } from '../db';
import { EmailSettingsRepository } from '../email/email-settings-repository';
import { ItemRepository } from '../items/item-repository';
import { testClock } from '../items/test-clock';
import { AuthRepository } from './auth-repository';
import { MAX_FAILED_LOGINS } from './login-throttle';
import { hashPassword } from './passwords';

const PASSWORD = 'a long kitchen password';
const NEW_PASSWORD = 'another long password';

describe('account router', () => {
  let server: Server;
  let baseUrl: string;
  let auth: AuthRepository;

  async function start(secureCookies = false) {
    const db = openDatabase(':memory:');
    const clock = testClock('2026-10-14');
    auth = new AuthRepository(db, () => new Date().toISOString());
    auth.completeSetup(1, 'anna', await hashPassword(PASSWORD));
    const app = express().use(
      '/api',
      createApiRouter({
        auth: () => auth,
        items: () => new ItemRepository(db, clock),
        emailSettings: () => new EmailSettingsRepository(db, undefined, clock.now),
        today: clock.today,
        allowRemoteSetup: false,
        secureCookies,
      }),
    );
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  }

  beforeEach(() => start());

  afterEach(() => {
    server.close();
  });

  const send = (method: string, path: string, cookie?: string, body?: unknown, headers = {}) =>
    fetch(baseUrl + path, {
      method,
      headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  async function login(password = PASSWORD, headers = {}) {
    const response = await send(
      'POST',
      '/auth/login',
      undefined,
      {
        username: 'anna',
        password,
      },
      headers,
    );
    return {
      response,
      cookie: response.headers
        .getSetCookie()
        .find((cookie) => cookie.startsWith('domusmea_session='))
        ?.split(';')[0],
    };
  }

  const changePassword = (
    cookie: string | undefined,
    currentPassword: string,
    newPassword: string,
  ) => send('PUT', '/account/password', cookie, { currentPassword, newPassword });

  it('lists recent sign-ins, newest first, with the address a proxy reported', async () => {
    await login();
    const { cookie } = await login(PASSWORD, { 'x-forwarded-for': '198.51.100.7, 10.0.0.1' });

    const response = await send('GET', '/account', cookie);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.username).toBe('anna');
    expect(body.recentSignIns).toEqual([
      {
        at: expect.any(String),
        address: expect.stringContaining('127.0.0.1'),
        forwardedFor: '198.51.100.7',
      },
      { at: expect.any(String), address: expect.stringContaining('127.0.0.1'), forwardedFor: null },
    ]);
  });

  it('records only IP addresses reported by a proxy', async () => {
    const { cookie } = await login(PASSWORD, { 'x-forwarded-for': 'home laptop, 10.0.0.1' });
    const { recentSignIns } = await (await send('GET', '/account', cookie)).json();
    expect(recentSignIns[0].forwardedFor).toBeNull();
  });

  it('changes the password and replaces every session, this one with a new token', async () => {
    const other = await login();
    const { cookie } = await login();

    const changed = await changePassword(cookie, PASSWORD, NEW_PASSWORD);
    expect(changed.status).toBe(204);
    const sessionCookies = changed.headers
      .getSetCookie()
      .filter((setCookie) => setCookie.startsWith('domusmea_session='));
    expect(sessionCookies).toHaveLength(1);
    const renewed = sessionCookies[0].split(';')[0];
    expect(renewed).not.toBe(cookie);

    expect((await send('GET', '/account', renewed)).status).toBe(200);
    expect((await send('GET', '/account', cookie)).status).toBe(401);
    expect((await send('GET', '/account', other.cookie)).status).toBe(401);
    expect((await login(PASSWORD)).response.status).toBe(401);
    expect((await login(NEW_PASSWORD)).response.status).toBe(200);
  });

  it('rejects a wrong current password and weak new passwords', async () => {
    const { cookie } = await login();

    const wrong = await changePassword(cookie, 'not my password', NEW_PASSWORD);
    expect(wrong.status).toBe(400);
    expect(await wrong.json()).toEqual({
      error: 'invalid',
      fields: { currentPassword: ['Wrong password'] },
    });

    const weak = await changePassword(cookie, PASSWORD, 'short');
    expect(Object.keys((await weak.json()).fields)).toEqual(['newPassword']);
    const same = await changePassword(cookie, PASSWORD, PASSWORD);
    expect((await same.json()).fields.newPassword).toEqual([
      'Must differ from the current password',
    ]);
    const username = await changePassword(cookie, PASSWORD, 'ANNA');
    expect(username.status).toBe(400);

    expect((await login(PASSWORD)).response.status).toBe(200);
  });

  it('throttles guesses of the current password without blocking the login', async () => {
    const { cookie } = await login();
    for (let i = 0; i < MAX_FAILED_LOGINS; i++) {
      await changePassword(cookie, `guess ${i}`, NEW_PASSWORD);
    }
    const blocked = await changePassword(cookie, PASSWORD, NEW_PASSWORD);
    expect(blocked.status).toBe(429);
    expect((await login()).response.status).toBe(200);
  });

  it('signs out on all devices, this one included', async () => {
    const other = await login();
    const { cookie } = await login();

    const response = await send('POST', '/account/sign-out-everywhere', cookie);
    expect(response.status).toBe(204);
    expect(response.headers.getSetCookie()[0]).toMatch(/^domusmea_session=;/);
    expect((await send('GET', '/account', cookie)).status).toBe(401);
    expect((await send('GET', '/account', other.cookie)).status).toBe(401);
  });

  it('marks cookies Secure with SECURE_COOKIES, even over plain HTTP', async () => {
    server.close();
    await start(true);
    const { response, cookie } = await login();
    expect(response.headers.getSetCookie()[0]).toMatch(/; Secure/);
    const renewed = await send('GET', '/account', cookie);
    expect(renewed.headers.getSetCookie()[0]).toMatch(/; Secure/);
  });
});
