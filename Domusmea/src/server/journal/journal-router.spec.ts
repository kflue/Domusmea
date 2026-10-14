import express from 'express';
import { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../db';
import { ItemRepository } from '../items/item-repository';
import { testClock } from '../items/test-clock';
import { JournalRepository } from './journal-repository';
import { createJournalRouter } from './journal-router';

describe('journal router', () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    const db = openDatabase(':memory:');
    const clock = testClock('2026-10-14');
    new ItemRepository(db, clock).create({
      name: 'Boiler',
      category: 'appliance',
      purchaseDate: null,
      costRappen: null,
      warrantyExpires: null,
      manufacturer: null,
      model: null,
      serialNumber: null,
      seller: null,
    });
    const repository = new JournalRepository(db, clock.now);
    const app = express().use(
      '/api/journal',
      createJournalRouter(() => repository),
    );
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/journal`;
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

  const minimal = { date: '2026-09-01', kind: 'repair', title: 'Serviced boiler' };

  it('creates an entry from a minimal body and lists it', async () => {
    const created = await send('POST', '', { ...minimal, title: '  Serviced boiler ', notes: '' });
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({
      id: 1,
      title: 'Serviced boiler',
      notes: null,
      itemId: null,
    });

    const list = await fetch(baseUrl);
    expect(await list.json()).toEqual([expect.objectContaining({ title: 'Serviced boiler' })]);
  });

  it('keeps line breaks in notes and links an existing item', async () => {
    const created = await send('POST', '', {
      ...minimal,
      notes: 'Burner cleaned.\r\nNext service in 2027.',
      itemId: 1,
    });
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({
      notes: 'Burner cleaned.\r\nNext service in 2027.',
      itemName: 'Boiler',
    });
  });

  it('rejects invalid input with field errors', async () => {
    const response = await send('POST', '', {
      date: '2026-02-30',
      kind: 'gift',
      title: '',
      costRappen: -1,
      contractor: 'Meier\nAG',
      notes: 'Bell\u0007',
      itemId: 1.5,
      extra: true,
    });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('invalid');
    expect(Object.keys(body.fields)).toEqual(
      expect.arrayContaining([
        'date',
        'kind',
        'title',
        'costRappen',
        'contractor',
        'notes',
        'itemId',
      ]),
    );
  });

  it('rejects an unknown item', async () => {
    const response = await send('POST', '', { ...minimal, itemId: 42 });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'invalid',
      fields: { itemId: ['Unknown item'] },
    });
  });

  it('answers malformed JSON with a JSON 400', async () => {
    const response = await send('POST', '', '{"title":');
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'bad-request' });
  });

  it('updates and deletes an entry, with 404 for unknown ids', async () => {
    await send('POST', '', minimal);

    const updated = await send('PUT', '/1', { ...minimal, kind: 'investment', costRappen: 99900 });
    expect(await updated.json()).toMatchObject({ kind: 'investment', costRappen: 99900 });
    expect((await fetch(`${baseUrl}/1`)).status).toBe(200);

    expect((await send('DELETE', '/1')).status).toBe(204);
    expect((await fetch(`${baseUrl}/1`)).status).toBe(404);
    expect((await send('PUT', '/1', minimal)).status).toBe(404);
    expect((await send('DELETE', '/1')).status).toBe(404);
    expect((await fetch(`${baseUrl}/abc`)).status).toBe(404);
  });
});
