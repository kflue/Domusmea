import express from 'express';
import { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../db';
import { ItemRepository } from './item-repository';
import { createItemsRouter } from './items-router';
import { testClock } from './test-clock';

describe('items router', () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    const repository = new ItemRepository(openDatabase(':memory:'), testClock('2026-10-10'));
    const app = express().use(
      '/api/items',
      createItemsRouter(
        () => repository,
        () => '2026-10-10',
      ),
    );
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/items`;
  });

  afterEach(() => {
    server.close();
  });

  const send = (method: string, path: string, body?: unknown) =>
    fetch(baseUrl + path, {
      method,
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });

  it('creates an item from a minimal body and lists it', async () => {
    const created = await send('POST', '', {
      name: '  Roof  ',
      purchaseDate: '2026-05-01',
      manufacturer: '',
    });
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({ id: 1, name: 'Roof', manufacturer: null });

    const list = await fetch(baseUrl);
    expect(await list.json()).toEqual({
      today: '2026-10-10',
      items: [expect.objectContaining({ name: 'Roof' })],
    });
  });

  it('rejects invalid input with field errors', async () => {
    const response = await send('POST', '', {
      name: '',
      costRappen: 12.5,
      warrantyExpires: '2026-02-30',
      category: 'car',
      extra: true,
    });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('invalid');
    expect(Object.keys(body.fields)).toEqual(
      expect.arrayContaining(['name', 'purchaseDate', 'costRappen', 'warrantyExpires', 'category']),
    );
  });

  it('rejects control characters and a warranty ending before the purchase', async () => {
    const response = await send('POST', '', {
      name: 'Oven\n\nExtend your warranty: https://evil.example',
      seller: 'Shop\u0007',
      purchaseDate: '2026-05-01',
      warrantyExpires: '2026-04-30',
    });
    expect(response.status).toBe(400);
    expect(Object.keys((await response.json()).fields)).toEqual(
      expect.arrayContaining(['name', 'seller', 'warrantyExpires']),
    );
  });

  it('ignores bodies that are not JSON', async () => {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: JSON.stringify({ name: 'Oven' }),
    });
    expect(response.status).toBe(400);
  });

  it('answers malformed JSON with a JSON 400', async () => {
    const response = await send('POST', '', '{"name":');
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'bad-request' });
  });

  it('updates and deletes an item, with 404 for unknown ids', async () => {
    const oven = { name: 'Oven', purchaseDate: '2026-05-01' };
    await send('POST', '', oven);

    const updated = await send('PUT', '/1', { ...oven, costRappen: 99900 });
    expect(await updated.json()).toMatchObject({ costRappen: 99900 });

    expect((await send('DELETE', '/1')).status).toBe(204);
    expect((await fetch(`${baseUrl}/1`)).status).toBe(404);
    expect((await send('PUT', '/1', oven)).status).toBe(404);
    expect((await fetch(`${baseUrl}/abc`)).status).toBe(404);
  });
});
