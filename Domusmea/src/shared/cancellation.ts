import { addDays, addMonths, daysBetween } from './calendar';
import { Subscription } from './subscription';

/**
 * Cancellation deadlines and their reminders (ADR 0010). Contracts renew on the anniversary of the
 * first billing; to end one, the notice must arrive by the deadline before that renewal.
 */

/** The fields of a subscription the deadline needs. */
export type CancellationTerms = Pick<Subscription, 'startDate' | 'endDate' | 'noticeMonths'>;

export interface CancellationDeadline {
  /** Next contract renewal, an anniversary of the first billing. */
  renewal: string;
  /** Last day the notice can arrive to end the contract before `renewal`. */
  deadline: string;
  /** Day the reminder email is due. */
  remindOn: string;
}

/** The reminder comes at least this many days before the deadline. */
export const MIN_REMINDER_DAYS = 7;

/**
 * Days between the reminder and the deadline: a third of the notice period, so there is time to
 * act, but at least a week (3 months' notice → 31 days, 1 month → 10, none → 7).
 */
export function reminderLeadDays(renewal: string, noticeMonths: number): number {
  const noticeDays = daysBetween(addMonths(renewal, -noticeMonths), renewal);
  return Math.max(MIN_REMINDER_DAYS, Math.round(noticeDays / 3));
}

/**
 * The next deadline on or after `today`, or `undefined` for subscriptions without a notice period
 * or that are already cancelled (have an end date).
 */
export function nextCancellationDeadline(
  terms: CancellationTerms,
  today: string,
): CancellationDeadline | undefined {
  const { noticeMonths } = terms;
  if (noticeMonths === null || terms.endDate !== null) {
    return undefined;
  }
  // Each anniversary is counted from the start date, so a 29 February start keeps its day.
  for (let years = 1; ; years++) {
    const renewal = addMonths(terms.startDate, years * 12);
    const deadline = addDays(addMonths(renewal, -noticeMonths), -1);
    if (deadline >= today) {
      const remindOn = addDays(deadline, -reminderLeadDays(renewal, noticeMonths));
      return { renewal, deadline, remindOn };
    }
  }
}
