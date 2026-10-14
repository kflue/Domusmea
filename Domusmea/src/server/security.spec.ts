import express from 'express';
import { request as httpRequest, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  allowedHostMatcher,
  hostnameOf,
  rejectCrossSiteWrites,
  requireAllowedHost,
} from './security';

describe('allowedHostMatcher', () => {
  it('allows local hosts, ALLOWED_HOSTS and this codespace only', () => {
    const allowed = allowedHostMatcher({
      ALLOWED_HOSTS: 'home.example.ch, *.lan.example.ch',
      CODESPACE_NAME: 'humble-space',
      GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: 'app.github.dev',
    });
    for (const host of [
      'localhost',
      '127.0.0.1',
      '[::1]',
      'home.example.ch',
      'nas.lan.example.ch',
    ]) {
      expect(allowed(host), host).toBe(true);
    }
    expect(allowed('humble-space-4200.app.github.dev')).toBe(true);
    for (const host of ['evil.example', 'other-space-4200.app.github.dev', 'lan.example.ch']) {
      expect(allowed(host), host).toBe(false);
    }
  });

  it('extracts host names from Host headers', () => {
    expect(hostnameOf('localhost:4200')).toBe('localhost');
    expect(hostnameOf('[::1]:4000')).toBe('[::1]');
    expect(hostnameOf(undefined)).toBeUndefined();
  });
});

describe('API request guards', () => {
  let server: Server;
  let port: number;

  beforeEach(async () => {
    const app = express()
      .use(
        requireAllowedHost(allowedHostMatcher({})),
        rejectCrossSiteWrites(allowedHostMatcher({})),
      )
      .use((_req, res) => {
        res.json({ ok: true });
      });
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterEach(() => {
    server.close();
  });

  /** `node:http` instead of `fetch`, which overrides `Host` and adds `Sec-Fetch-*` headers. */
  const request = (method: string, headers: Record<string, string>) =>
    new Promise<number | undefined>((resolve, reject) => {
      httpRequest({ port, method, headers }, (response) => {
        response.resume();
        resolve(response.statusCode);
      })
        .on('error', reject)
        .end();
    });

  it('rejects unknown Host headers (DNS rebinding)', async () => {
    expect(await request('GET', { host: `localhost:${port}` })).toBe(200);
    expect(await request('GET', { host: `evil.example:${port}` })).toBe(403);
  });

  it('rejects cross-site writes but allows same-origin ones and reads', async () => {
    const host = `localhost:${port}`;
    expect(await request('POST', { host, origin: `http://${host}` })).toBe(200);
    // Proxies may rewrite Host; an allowed origin with a same-origin fetch is still accepted.
    expect(
      await request('POST', {
        host,
        origin: 'http://127.0.0.1:4200',
        'sec-fetch-site': 'same-origin',
      }),
    ).toBe(200);
    expect(await request('POST', { host, 'sec-fetch-site': 'same-origin' })).toBe(200);
    expect(await request('POST', { host, origin: 'https://evil.example' })).toBe(403);
    expect(await request('DELETE', { host, 'sec-fetch-site': 'cross-site' })).toBe(403);
    expect(await request('POST', { host, origin: 'null' })).toBe(403);
    expect(await request('GET', { host, origin: 'https://evil.example' })).toBe(200);
  });
});
