import express from 'express';
import { randomBytes } from 'node:crypto';
import { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../db';
import { EmailSettingsRepository } from './email-settings-repository';
import { createEmailSettingsRouter, TEST_EMAIL_INTERVAL_MS } from './email-settings-router';
import { Mail, Mailer, SmtpConfig } from './mailer';
import { createSecretBox } from './secret-box';

const settings = {
  host: ' smtp.example.ch ',
  port: 465,
  security: 'tls',
  username: 'home@example.ch',
  password: ' secret ',
  from: 'home@example.ch',
  recipients: ['anna@example.ch'],
};

describe('email settings router', () => {
  let server: Server;
  let baseUrl: string;
  let repository: EmailSettingsRepository;
  let sent: { smtp: SmtpConfig | null; mail: Mail }[];
  let mailer: (smtp: SmtpConfig | null) => Mailer;
  let clock: number;

  async function start(canStorePassword = true) {
    repository = new EmailSettingsRepository(
      openDatabase(':memory:'),
      canStorePassword ? createSecretBox(randomBytes(32)) : undefined,
      () => '2026-10-14T08:00:00.000Z',
    );
    const app = express().use(
      '/api/settings/email',
      createEmailSettingsRouter(
        () => repository,
        (smtp) => mailer(smtp),
        () => clock,
      ),
    );
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/settings/email`;
  }

  beforeEach(async () => {
    sent = [];
    clock = 1_000_000;
    mailer = (smtp) => ({ send: async (mail) => void sent.push({ smtp, mail }) });
    await start();
  });

  afterEach(() => {
    server.close();
  });

  const send = (method: string, path: string, body?: unknown) =>
    fetch(baseUrl + path, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('saves the settings and returns them without the password', async () => {
    const saved = await send('PUT', '', settings);
    expect(saved.status).toBe(200);
    const body = await saved.json();
    expect(body).toMatchObject({ host: 'smtp.example.ch', passwordSet: true });
    expect(JSON.stringify(body)).not.toContain('secret');
    expect(await (await fetch(baseUrl)).json()).toEqual(body);
    // Passwords are not trimmed.
    expect(repository.mailConfig().smtp?.password).toBe(' secret ');
  });

  it('rejects invalid settings with field errors', async () => {
    const response = await send('PUT', '', {
      host: 'smtp.example.ch\r\nRCPT TO:<x@evil.example>',
      port: 70000,
      security: 'ssl',
      password: '',
      from: null,
      recipients: ['not-an-address'],
      extra: true,
    });
    expect(response.status).toBe(400);
    expect(Object.keys((await response.json()).fields)).toEqual(
      expect.arrayContaining(['host', 'port', 'security', 'password', 'recipients']),
    );

    const withoutFrom = await send('PUT', '', { ...settings, from: null });
    expect((await withoutFrom.json()).fields).toEqual({
      from: ['Required when an SMTP server is set'],
    });
  });

  it('refuses a password when the server has no encryption key', async () => {
    server.close();
    await start(false);
    const response = await send('PUT', '', settings);
    expect(response.status).toBe(400);
    expect(Object.keys((await response.json()).fields)).toEqual(['password']);
    expect((await send('PUT', '', { ...settings, password: undefined })).status).toBe(200);
  });

  it('sends a test email to the saved recipients', async () => {
    await send('PUT', '', settings);
    const response = await send('POST', '/test');

    expect(response.status).toBe(204);
    expect(sent).toHaveLength(1);
    expect(sent[0].smtp).toMatchObject({ host: 'smtp.example.ch', password: ' secret ' });
    expect(sent[0].mail).toMatchObject({
      to: ['anna@example.ch'],
      subject: 'Domusmea test email',
    });
  });

  it('explains why a test email cannot be sent', async () => {
    expect(await (await send('POST', '/test')).json()).toEqual({ error: 'no-smtp-host' });

    await send('PUT', '', { ...settings, recipients: [] });
    const response = await send('POST', '/test');
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'no-recipients' });

    await send('PUT', '', settings);
    const failWith = (error: object) => {
      mailer = () => ({ send: () => Promise.reject(Object.assign(new Error('failed'), error)) });
      clock += TEST_EMAIL_INTERVAL_MS;
      return send('POST', '/test');
    };

    const failed = await failWith({ code: 'EAUTH', response: '535 5.7.8\r\nrejected' });
    expect(failed.status).toBe(502);
    expect(await failed.json()).toEqual({
      error: 'send-failed',
      message:
        'The server rejected the user name or password. The server replied: 535 5.7.8 rejected',
    });
  });

  it('does not reveal replies of services that are not SMTP servers', async () => {
    await send('PUT', '', { ...settings, port: 22 });
    mailer = () => ({
      send: () =>
        Promise.reject(
          Object.assign(new Error('Invalid greeting. response=SSH-2.0-OpenSSH_9.6'), {
            code: 'EPROTOCOL',
            response: 'SSH-2.0-OpenSSH_9.6',
          }),
        ),
    });
    const body = await (await send('POST', '/test')).json();
    expect(body).toEqual({
      error: 'send-failed',
      message: 'The server did not respond like an SMTP server.',
    });
  });

  it('allows one test email per interval', async () => {
    await send('PUT', '', settings);
    expect((await send('POST', '/test')).status).toBe(204);
    const tooSoon = await send('POST', '/test');
    expect(tooSoon.status).toBe(429);
    expect(await tooSoon.json()).toEqual({ error: 'too-soon' });

    clock += TEST_EMAIL_INTERVAL_MS;
    expect((await send('POST', '/test')).status).toBe(204);
    expect(sent).toHaveLength(2);
  });
});
