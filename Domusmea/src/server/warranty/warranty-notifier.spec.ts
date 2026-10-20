import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openDatabase } from '../db';
import { ItemRepository } from '../items/item-repository';
import { testClock } from '../items/test-clock';
import { Mail, Mailer } from '../email/mailer';
import { notifyExpiredWarranties, WarrantyNotifierDeps } from './warranty-notifier';

describe('notifyExpiredWarranties', () => {
  let clock: ReturnType<typeof testClock>;
  let repository: ItemRepository;
  let sent: Mail[];
  let deps: WarrantyNotifierDeps;

  const item = { category: null, purchaseDate: '2026-01-15', costRappen: null, model: null };
  const mailer: Mailer = { send: async (mail) => void sent.push(mail) };

  beforeEach(() => {
    clock = testClock('2026-10-01');
    repository = new ItemRepository(openDatabase(':memory:'), clock);
    sent = [];
    deps = {
      repository: () => repository,
      recipients: () => ['home@example.ch'],
      mailer: () => mailer,
      today: clock.today,
    };
    repository.create({
      ...item,
      name: 'Dishwasher',
      warrantyExpires: '2026-10-10',
      manufacturer: 'V-Zug',
      serialNumber: 'SN-1',
      seller: 'Fust',
    });
    repository.create({
      ...item,
      name: 'Oven',
      warrantyExpires: '2027-01-01',
      manufacturer: null,
      serialNumber: null,
      seller: null,
    });
  });

  it('emails each expired item once', async () => {
    expect(await notifyExpiredWarranties(deps)).toBe(0);

    clock.set('2026-10-10');
    expect(await notifyExpiredWarranties(deps)).toBe(1);
    expect(await notifyExpiredWarranties(deps)).toBe(0);

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toEqual(['home@example.ch']);
    expect(sent[0].subject).toBe('Warranty ends today: Dishwasher');
    expect(sent[0].text).toContain('The warranty of the following item ends today:');
    expect(sent[0].text).toContain('Warranty until: 10.10.2026');
    expect(sent[0].text).toContain('Bought from: Fust');
    expect(sent[0].text).not.toContain('Oven');
  });

  it('catches up on missed days with one email for all items', async () => {
    clock.set('2027-02-01');
    await notifyExpiredWarranties(deps);

    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toBe('Warranty ended for 2 items');
    expect(sent[0].text).toContain('end today or have ended');
  });

  it('retries at the next check when sending fails', async () => {
    clock.set('2026-10-10');
    const failing = { send: vi.fn().mockRejectedValue(new Error('SMTP down')) };

    await expect(notifyExpiredWarranties({ ...deps, mailer: () => failing })).rejects.toThrow(
      'SMTP down',
    );
    expect(await notifyExpiredWarranties(deps)).toBe(1);
  });

  it('creates the mailer (decrypting the password) only when an email is due', async () => {
    const mailerFactory = vi.fn(() => mailer);
    expect(await notifyExpiredWarranties({ ...deps, mailer: mailerFactory })).toBe(0);
    expect(mailerFactory).not.toHaveBeenCalled();
  });

  it('sends nothing without recipients', async () => {
    clock.set('2026-10-10');
    expect(await notifyExpiredWarranties({ ...deps, recipients: () => [] })).toBe(0);
    expect(sent).toEqual([]);
  });
});
