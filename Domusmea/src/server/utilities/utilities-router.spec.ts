import express from 'express';
import { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../db';
import { testClock } from '../items/test-clock';
import { createUtilitiesRouter } from './utilities-router';
import { UtilityRepository } from './utility-repository';

describe('utilities router', () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    const repository = new UtilityRepository(openDatabase(':memory:'), testClock('2026-10-15').now);
    const app = express().use(
      '/api/utilities',
      createUtilitiesRouter(() => repository),
    );
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/utilities`;
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

  const period = { periodFrom: '2026-07-01', periodTo: '2026-09-30' };
  const electricity = { commodity: 'electricity', amountMilli: 812_500, costRappen: 23_319 };

  it('creates one entry per bill line, with defaults, and lists them', async () => {
    const created = await send('POST', '', {
      ...period,
      lines: [electricity, { commodity: 'water', amountMilli: 21_000, costRappen: 4_200 }],
    });
    expect(created.status).toBe(201);
    expect(await created.json()).toEqual([
      expect.objectContaining({ id: 1, commodity: 'electricity', fixedFeeRappen: 0 }),
      expect.objectContaining({ id: 2, commodity: 'water', ...period }),
    ]);
    expect(await (await fetch(baseUrl)).json()).toHaveLength(2);
  });

  it('stores the invoice number and notes, empty ones as null', async () => {
    const created = await send('POST', '', {
      ...period,
      invoiceNumber: ' 2026-0815 ',
      notes: 'Final bill\nafter the meter change',
      lines: [electricity],
    });
    expect(await created.json()).toEqual([
      expect.objectContaining({
        invoiceNumber: '2026-0815',
        notes: 'Final bill\nafter the meter change',
      }),
    ]);
    const blank = await send('POST', '', {
      ...period,
      invoiceNumber: '',
      notes: ' ',
      lines: [electricity],
    });
    expect(await blank.json()).toEqual([
      expect.objectContaining({ invoiceNumber: null, notes: null }),
    ]);
  });

  it('rejects line breaks in the invoice number and overlong notes', async () => {
    const fields = async (body: object) =>
      (await (await send('POST', '', { ...period, lines: [electricity], ...body })).json()).fields;
    expect(Object.keys(await fields({ invoiceNumber: 'A\nB' }))).toEqual(['invoiceNumber']);
    expect(Object.keys(await fields({ invoiceNumber: 'x'.repeat(101) }))).toEqual([
      'invoiceNumber',
    ]);
    expect(Object.keys(await fields({ notes: 'x'.repeat(2001) }))).toEqual(['notes']);
    expect(Object.keys(await fields({ notes: 'a\u0000b' }))).toEqual(['notes']);
  });

  it('accepts credits and garbage as a fixed fee only', async () => {
    const created = await send('POST', '', {
      ...period,
      lines: [
        { ...electricity, costRappen: -5_000, fixedFeeRappen: -100 },
        { commodity: 'garbage', fixedFeeRappen: 4_500 },
      ],
    });
    expect(await created.json()).toEqual([
      expect.objectContaining({ costRappen: -5_000, fixedFeeRappen: -100 }),
      expect.objectContaining({ commodity: 'garbage', amountMilli: null, costRappen: 0 }),
    ]);
  });

  it('rejects invalid input with field errors', async () => {
    const response = await send('POST', '', {
      periodFrom: '2026-02-30',
      periodTo: 'soon',
      lines: [{ commodity: 'gas', amountMilli: -1, costRappen: 1.5 }],
      extra: true,
    });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('invalid');
    expect(Object.keys(body.fields)).toEqual(
      expect.arrayContaining(['periodFrom', 'periodTo', 'lines']),
    );
  });

  it('rejects a period ending before its start and breaks of the commodity rules', async () => {
    const fields = async (body: object) =>
      (await (await send('POST', '', { ...period, lines: [electricity], ...body })).json()).fields;

    expect(await fields({ periodTo: '2026-06-30' })).toEqual({
      periodTo: ['Must not be before the start'],
    });
    expect(await fields({ lines: [] })).toHaveProperty('lines');
    expect(await fields({ lines: [electricity, electricity] })).toEqual({
      lines: ['One line per commodity'],
    });
    for (const line of [
      { commodity: 'electricity', costRappen: 100 },
      { commodity: 'garbage', amountMilli: 1_000, fixedFeeRappen: 100 },
      { commodity: 'garbage', costRappen: 100 },
      { commodity: 'wastewater', amountMilli: 1_000, costRappen: 100, fixedFeeRappen: 100 },
    ]) {
      expect(await fields({ lines: [line] }), JSON.stringify(line)).toHaveProperty('lines');
    }
  });

  it('caps amounts and costs', async () => {
    const status = async (line: object) =>
      (await send('POST', '', { ...period, lines: [{ ...electricity, ...line }] })).status;
    expect(await status({ amountMilli: 1_000_000_001 })).toBe(400);
    expect(await status({ costRappen: -100_000_001 })).toBe(400);
    expect(await status({ amountMilli: 1_000_000_000, costRappen: 100_000_000 })).toBe(201);
  });

  it('answers malformed JSON with a JSON 400', async () => {
    const response = await send('POST', '', '{"periodFrom":');
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'bad-request' });
  });

  it('updates and deletes an entry, with 404 for unknown ids', async () => {
    await send('POST', '', { ...period, lines: [electricity] });
    const entry = { ...period, ...electricity, amountMilli: 800_000 };

    const updated = await send('PUT', '/1', { ...entry, notes: 'Checked' });
    expect(await updated.json()).toMatchObject({ amountMilli: 800_000, notes: 'Checked' });
    expect((await send('PUT', '/1', { ...entry, periodTo: '2026-01-01' })).status).toBe(400);
    const otherCommodity = await send('PUT', '/1', { ...entry, commodity: 'water' });
    expect(otherCommodity.status).toBe(400);
    expect((await otherCommodity.json()).fields).toEqual({ commodity: ['Cannot be changed'] });
    // Leaving out the notes keeps them.
    expect(await (await send('PUT', '/1', entry)).json()).toMatchObject({ notes: 'Checked' });
    expect((await fetch(`${baseUrl}/1`)).status).toBe(200);

    expect((await send('DELETE', '/1')).status).toBe(204);
    expect((await fetch(`${baseUrl}/1`)).status).toBe(404);
    expect((await send('PUT', '/1', entry)).status).toBe(404);
    expect((await send('DELETE', '/1')).status).toBe(404);
    expect((await fetch(`${baseUrl}/abc`)).status).toBe(404);
  });
});
