import express from 'express';
import { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../db';
import { testClock } from '../items/test-clock';
import { SubscriptionRepository } from './subscription-repository';
import { createSubscriptionsRouter } from './subscriptions-router';

describe('subscriptions router', () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    const repository = new SubscriptionRepository(
      openDatabase(':memory:'),
      testClock('2026-10-15').now,
    );
    const app = express().use(
      '/api/subscriptions',
      createSubscriptionsRouter(() => repository),
    );
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/subscriptions`;
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

  const minimal = {
    name: 'Car insurance',
    interval: 'annual',
    costRappen: 98000,
    startDate: '2025-03-01',
  };

  it('creates a subscription from a minimal body and lists it', async () => {
    const created = await send('POST', '', { ...minimal, name: ' Car insurance ' });
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({
      id: 1,
      name: 'Car insurance',
      endDate: null,
      priceChanges: [],
      noticeMonths: null,
    });

    const list = await fetch(baseUrl);
    expect(await list.json()).toEqual([expect.objectContaining({ name: 'Car insurance' })]);
  });

  it('stores price changes oldest first', async () => {
    const created = await send('POST', '', {
      ...minimal,
      priceChanges: [
        { validFrom: '2027-03-01', costRappen: 105000 },
        { validFrom: '2026-03-01', costRappen: 101000 },
      ],
    });
    expect((await created.json()).priceChanges).toEqual([
      { validFrom: '2026-03-01', costRappen: 101000 },
      { validFrom: '2027-03-01', costRappen: 105000 },
    ]);
  });

  it('rejects invalid input with field errors', async () => {
    const response = await send('POST', '', {
      name: '',
      interval: 'weekly',
      costRappen: 12.5,
      startDate: '2026-02-30',
      endDate: 'soon',
      priceChanges: [{ validFrom: '2026-01-01', costRappen: -1 }],
      noticeMonths: 25,
      extra: true,
    });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('invalid');
    expect(Object.keys(body.fields)).toEqual(
      expect.arrayContaining([
        'name',
        'interval',
        'costRappen',
        'startDate',
        'endDate',
        'priceChanges',
        'noticeMonths',
      ]),
    );
  });

  it('rejects dates that contradict each other', async () => {
    const fields = async (body: object) =>
      (await (await send('POST', '', { ...minimal, ...body })).json()).fields;

    expect(await fields({ endDate: '2025-02-28' })).toEqual({
      endDate: ['Must not be before the start'],
    });
    expect(await fields({ priceChanges: [{ validFrom: '2025-03-01', costRappen: 1 }] })).toEqual({
      priceChanges: ['Must be after the start'],
    });
    expect(
      await fields({
        endDate: '2026-12-31',
        priceChanges: [{ validFrom: '2027-01-01', costRappen: 1 }],
      }),
    ).toEqual({ priceChanges: ['Must not be after the end'] });
    const change = { validFrom: '2026-03-01', costRappen: 1 };
    expect(await fields({ priceChanges: [change, change] })).toEqual({
      priceChanges: ['One change per day'],
    });
  });

  it('caps prices at CHF 1 million and stores the notice period', async () => {
    const tooHigh = await send('POST', '', { ...minimal, costRappen: 100_000_001 });
    expect(Object.keys((await tooHigh.json()).fields)).toEqual(['costRappen']);
    const changeTooHigh = await send('POST', '', {
      ...minimal,
      priceChanges: [{ validFrom: '2026-03-01', costRappen: 100_000_001 }],
    });
    expect(changeTooHigh.status).toBe(400);

    const created = await send('POST', '', {
      ...minimal,
      costRappen: 100_000_000,
      noticeMonths: 3,
    });
    expect(await created.json()).toMatchObject({ costRappen: 100_000_000, noticeMonths: 3 });
  });

  it('answers malformed JSON with a JSON 400', async () => {
    const response = await send('POST', '', '{"name":');
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'bad-request' });
  });

  it('updates and deletes a subscription, with 404 for unknown ids', async () => {
    await send('POST', '', minimal);

    const updated = await send('PUT', '/1', { ...minimal, endDate: '2026-02-28' });
    expect(await updated.json()).toMatchObject({ endDate: '2026-02-28' });
    expect((await fetch(`${baseUrl}/1`)).status).toBe(200);

    expect((await send('DELETE', '/1')).status).toBe(204);
    expect((await fetch(`${baseUrl}/1`)).status).toBe(404);
    expect((await send('PUT', '/1', minimal)).status).toBe(404);
    expect((await send('DELETE', '/1')).status).toBe(404);
    expect((await fetch(`${baseUrl}/abc`)).status).toBe(404);
  });
});
