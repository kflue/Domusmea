import { CancellationDeadline, nextCancellationDeadline } from '../../shared/cancellation';
import { formatChf, formatDate } from '../../shared/format';
import { BILLING_INTERVAL_LABELS, Subscription } from '../../shared/subscription';
import { currentPrice } from '../../shared/subscription-costs';
import { Mail, Mailer } from '../email/mailer';
import { startPeriodicCheck } from '../periodic-check';
import { SubscriptionRepository } from './subscription-repository';

export interface CancellationReminderDeps {
  repository: () => SubscriptionRepository;
  /** Email recipients from the current settings; with none, nothing is sent or marked. */
  recipients: () => readonly string[];
  /** Mailer for the current settings; only created when an email is due. */
  mailer: () => Mailer;
  /** Today's date in the app time zone as `YYYY-MM-DD`. */
  today: () => string;
}

/** A subscription whose cancellation reminder is due. */
export interface DueReminder {
  subscription: Subscription;
  deadline: CancellationDeadline;
}

/**
 * Sends one email listing the subscriptions whose reminder date has come and whose cancellation
 * deadline has not passed, unless that deadline was already reminded of; then marks them. If
 * sending fails, nothing is marked and the next check retries (ADR 0010). Returns the number of
 * subscriptions in the email.
 */
export async function remindOfCancellationDeadlines(
  deps: CancellationReminderDeps,
): Promise<number> {
  const recipients = deps.recipients();
  if (recipients.length === 0) {
    return 0;
  }
  const today = deps.today();
  const repository = deps.repository();
  const due = repository.listWithNoticePeriod().flatMap(({ subscription, remindedFor }) => {
    const deadline = nextCancellationDeadline(subscription, today);
    return deadline && deadline.remindOn <= today && deadline.deadline !== remindedFor
      ? [{ subscription, deadline }]
      : [];
  });
  if (due.length === 0) {
    return 0;
  }
  await deps.mailer().send(cancellationMail(due, recipients, today));
  for (const { subscription, deadline } of due) {
    repository.markCancellationReminded(subscription.id, deadline.deadline);
  }
  return due.length;
}

export function cancellationMail(
  due: readonly DueReminder[],
  to: readonly string[],
  today: string,
): Mail {
  const sorted = [...due].sort((a, b) => a.deadline.deadline.localeCompare(b.deadline.deadline));
  const subject =
    sorted.length === 1
      ? `Cancel by ${formatDate(sorted[0].deadline.deadline)}: ${sorted[0].subscription.name}`
      : `Cancellation deadlines for ${sorted.length} subscriptions`;
  const intro =
    sorted.length === 1
      ? 'To end the following subscription before it renews, the notice must arrive by the deadline:'
      : 'To end the following subscriptions before they renew, the notice must arrive by the deadlines:';
  return {
    to,
    subject,
    text: [intro, ...sorted.map((reminder) => describe(reminder, today)), 'Domusmea'].join('\n\n'),
  };
}

function describe({ subscription, deadline }: DueReminder, today: string): string {
  const notice =
    subscription.noticeMonths === 1 ? '1 month' : `${subscription.noticeMonths} months`;
  const interval = BILLING_INTERVAL_LABELS[subscription.interval].toLowerCase();
  return [
    `- ${subscription.name}`,
    `  Cancel by: ${formatDate(deadline.deadline)}`,
    `  Renews on: ${formatDate(deadline.renewal)}`,
    `  Notice period: ${notice}`,
    `  Price: ${formatChf(currentPrice(subscription, today))} ${interval}`,
  ].join('\n');
}

/** Checks for due cancellation reminders now and then hourly. Returns a function that stops it. */
export function startCancellationReminder(deps: CancellationReminderDeps): () => void {
  return startPeriodicCheck('Cancellation reminder', () => remindOfCancellationDeadlines(deps));
}
