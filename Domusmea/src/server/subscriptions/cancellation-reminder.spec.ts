import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SubscriptionInput } from '../../shared/subscription';
import { openDatabase } from '../db';
import { Mail, Mailer } from '../email/mailer';
import { testClock } from '../items/test-clock';
import { CancellationReminderDeps, remindOfCancellationDeadlines } from './cancellation-reminder';
import { SubscriptionRepository } from './subscription-repository';

const carInsurance: SubscriptionInput = {
  name: 'Car insurance',
  interval: 'annual',
  costRappen: 98000,
  startDate: '2024-01-01',
  endDate: null,
  priceChanges: [{ validFrom: '2026-01-01', costRappen: 104550 }],
  noticeMonths: 3,
};

describe('remindOfCancellationDeadlines', () => {
  let clock: ReturnType<typeof testClock>;
  let repository: SubscriptionRepository;
  let sent: Mail[];
  let deps: CancellationReminderDeps;

  const mailer: Mailer = { send: async (mail) => void sent.push(mail) };

  beforeEach(() => {
    clock = testClock('2026-08-29');
    repository = new SubscriptionRepository(openDatabase(':memory:'), clock.now);
    sent = [];
    deps = {
      repository: () => repository,
      recipients: () => ['home@example.ch'],
      mailer: () => mailer,
      today: clock.today,
    };
    repository.create(carInsurance);
    // No reminders: cancellable any time, or already cancelled.
    repository.create({
      ...carInsurance,
      name: 'Netflix',
      interval: 'monthly',
      noticeMonths: null,
    });
    repository.create({ ...carInsurance, name: 'Old insurance', endDate: '2026-12-31' });
  });

  it('reminds once per deadline, a third of the notice period ahead', async () => {
    expect(await remindOfCancellationDeadlines(deps)).toBe(0);

    clock.set('2026-08-30');
    expect(await remindOfCancellationDeadlines(deps)).toBe(1);
    expect(await remindOfCancellationDeadlines(deps)).toBe(0);

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toEqual(['home@example.ch']);
    expect(sent[0].subject).toBe('Cancel by 30.09.2026: Car insurance');
    expect(sent[0].text).toContain('Renews on: 01.01.2027');
    expect(sent[0].text).toContain('Notice period: 3 months');
    expect(sent[0].text).toMatch(/Price: CHF\s1.045\.50 annually/);
    expect(sent[0].text).not.toContain('Netflix');

    // The following year's deadline gets its own reminder.
    clock.set('2027-08-30');
    expect(await remindOfCancellationDeadlines(deps)).toBe(1);
    expect(sent[1].subject).toBe('Cancel by 30.09.2027: Car insurance');
  });

  it('catches up until the deadline, but not after it', async () => {
    clock.set('2026-09-30');
    expect(await remindOfCancellationDeadlines(deps)).toBe(1);

    const late = new SubscriptionRepository(openDatabase(':memory:'), clock.now);
    late.create(carInsurance);
    clock.set('2026-10-01');
    expect(await remindOfCancellationDeadlines({ ...deps, repository: () => late })).toBe(0);
  });

  it('reminds again when the deadline changes', async () => {
    clock.set('2026-08-30');
    await remindOfCancellationDeadlines(deps);
    repository.update(1, { ...carInsurance, noticeMonths: 1 });

    clock.set('2026-11-20');
    expect(await remindOfCancellationDeadlines(deps)).toBe(1);
    expect(sent[1].subject).toBe('Cancel by 30.11.2026: Car insurance');
  });

  it('lists several subscriptions in one email, earliest deadline first', async () => {
    repository.create({ ...carInsurance, name: 'Household insurance', startDate: '2024-02-01' });
    // Car insurance: deadline 30.09.2026; household insurance: 31.10.2026, reminded from 30.09.
    clock.set('2026-09-30');
    expect(await remindOfCancellationDeadlines(deps)).toBe(2);
    expect(sent[0].subject).toBe('Cancellation deadlines for 2 subscriptions');
    expect(sent[0].text.indexOf('Car insurance')).toBeLessThan(
      sent[0].text.indexOf('Household insurance'),
    );
  });

  it('retries at the next check when sending fails, and sends nothing without recipients', async () => {
    clock.set('2026-08-30');
    expect(await remindOfCancellationDeadlines({ ...deps, recipients: () => [] })).toBe(0);
    const failing = { send: vi.fn().mockRejectedValue(new Error('SMTP down')) };
    await expect(remindOfCancellationDeadlines({ ...deps, mailer: () => failing })).rejects.toThrow(
      'SMTP down',
    );
    expect(await remindOfCancellationDeadlines(deps)).toBe(1);
  });
});
