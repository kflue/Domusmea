import { DOCUMENT } from '@angular/common';
import { afterNextRender, Component, computed, inject, Injector, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { nextCancellationDeadline } from '../../../shared/cancellation';
import { DEFAULT_TIME_ZONE, formatChf, formatDate, todayIn } from '../../../shared/format';
import { BILLING_INTERVAL_LABELS, Subscription } from '../../../shared/subscription';
import {
  annualTotalRappen,
  billingYears,
  currentPrice,
  isActive,
  monthlyShare,
  monthlyTotalRappen,
  nextBilling,
  paidInYearRappen,
  priceOn,
  upcomingPriceChanges,
} from '../../../shared/subscription-costs';
import { ConfirmDelete } from '../../shared/confirm-delete';
import { SubscriptionsApi } from '../subscriptions-api';

/** A subscription with its figures as of today, formatted for the tables. */
interface SubscriptionRow {
  subscription: Subscription;
  interval: string;
  price: string;
  perMonth: string;
  /** Next billing date, or the end date of a cancelled subscription. */
  date: string;
  /** Scheduled price changes, e.g. `CHF 23.90 from 01.01.2027`. */
  upcoming: string;
  /** Next cancellation deadline, e.g. `30.09.2026`; empty without a notice period. */
  cancelBy: string;
  /** The reminder for that deadline is due: time to decide. */
  cancelSoon: boolean;
}

/**
 * Subscriptions with their monthly and annual cost and what was paid in a selected year
 * (`/subscriptions`, ADR 0016). Cancelled ones are listed apart, collapsed (ADR 0009).
 */
@Component({
  selector: 'app-subscription-list',
  imports: [RouterLink, ConfirmDelete],
  templateUrl: './subscription-list.html',
})
export class SubscriptionList {
  private readonly api = inject(SubscriptionsApi);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  protected readonly list = this.api.list;
  protected readonly today = todayIn(DEFAULT_TIME_ZONE);
  protected readonly currentYear = this.today.slice(0, 4);
  /** Year of the "Paid in" total (`YYYY`); the current year by default. */
  protected readonly year = signal(this.currentYear);
  private readonly subscriptions = computed(() => (this.list.hasValue() ? this.list.value() : []));

  protected readonly active = computed(() =>
    this.subscriptions()
      .filter((subscription) => isActive(subscription, this.today))
      .map((subscription) => this.toRow(subscription, nextBilling(subscription, this.today)?.date)),
  );

  protected readonly cancelled = computed(() =>
    this.subscriptions()
      .filter((subscription) => !isActive(subscription, this.today))
      .map((subscription) => this.toRow(subscription, subscription.endDate ?? undefined)),
  );

  /** Years with billings and the current year, newest first. */
  protected readonly years = computed(() => billingYears(this.subscriptions(), this.today));

  /** Per month and per year at today's prices whatever the year; paid in the selected year. */
  protected readonly totals = computed(() => {
    const subscriptions = this.subscriptions();
    return {
      perMonth: formatChf(monthlyTotalRappen(subscriptions, this.today)),
      perYear: formatChf(annualTotalRappen(subscriptions, this.today)),
      paid: formatChf(paidInYearRappen(subscriptions, this.year(), this.today)),
    };
  });

  protected readonly deleteError = signal('');

  protected selectYear(event: Event): void {
    this.year.set((event.target as HTMLSelectElement).value);
  }

  protected async delete(subscription: Subscription): Promise<void> {
    this.deleteError.set('');
    try {
      await this.api.delete(subscription.id);
      // The row is gone; keep keyboard focus nearby.
      afterNextRender(() => this.document.getElementById('subscriptions-heading')?.focus(), {
        injector: this.injector,
      });
    } catch {
      this.deleteError.set(`“${subscription.name}” could not be deleted. Please try again.`);
    }
  }

  private toRow(subscription: Subscription, date: string | undefined): SubscriptionRow {
    // Cancelled subscriptions show the price they ended with.
    const price = isActive(subscription, this.today)
      ? currentPrice(subscription, this.today)
      : priceOn(subscription, subscription.endDate ?? this.today);
    const cancellation = nextCancellationDeadline(subscription, this.today);
    return {
      subscription,
      interval: BILLING_INTERVAL_LABELS[subscription.interval],
      price: formatChf(price),
      perMonth: formatChf(Math.round(monthlyShare(subscription, this.today))),
      date: date ? formatDate(date) : '–',
      upcoming: upcomingPriceChanges(subscription, this.today)
        .map((change) => `${formatChf(change.costRappen)} from ${formatDate(change.validFrom)}`)
        .join(', '),
      cancelBy: cancellation ? formatDate(cancellation.deadline) : '',
      cancelSoon: cancellation !== undefined && cancellation.remindOn <= this.today,
    };
  }
}
