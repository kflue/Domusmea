import { DOCUMENT } from '@angular/common';
import { HttpErrorResponse, httpResource } from '@angular/common/http';
import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { applyEach, form, FormField, maxLength, submit, validate } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { DEFAULT_TIME_ZONE, formatChf, todayIn } from '../../../shared/format';
import {
  BILLING_INTERVAL_LABELS,
  BILLING_INTERVALS,
  MAX_NOTICE_MONTHS,
  MAX_PRICE_CHANGES,
  MAX_PRICE_RAPPEN,
  Subscription,
  SUBSCRIPTION_NAME_MAX_LENGTH,
} from '../../../shared/subscription';
import { parseChf } from '../../shared/chf-input';
import { FieldErrors } from '../../shared/field-errors';
import { SubscriptionsApi } from '../subscriptions-api';
import { newSubscriptionForm, toFormModel, toSubscriptionInput } from './subscription-form-model';

const LIST_URL = '/subscriptions';

/** Validation error for a required CHF price up to the maximum, or `undefined` if `text` is one. */
function priceError(text: string) {
  const rappen = parseChf(text);
  if (typeof rappen !== 'number') {
    return { kind: 'chf', message: 'Enter the price in CHF, e.g. 18.90.' };
  }
  return rappen > MAX_PRICE_RAPPEN
    ? { kind: 'max', message: `Enter at most ${formatChf(MAX_PRICE_RAPPEN)}.` }
    : undefined;
}

/** Notice periods offered in the select, in months; `0` cancels until the day before renewal. */
const NOTICE_MONTHS = [0, 1, 2, 3, 4, 6, 12].filter((months) => months <= MAX_NOTICE_MONTHS);

function noticeOption(months: number) {
  let label = `${months} months`;
  if (months === 0) {
    label = 'Until the day before renewal';
  } else if (months === 1) {
    label = '1 month';
  }
  return { value: String(months), label };
}

/** Create (`/subscriptions/new`) or edit (`/subscriptions/:id`) a subscription. */
@Component({
  selector: 'app-subscription-form',
  imports: [FormField, RouterLink, FieldErrors],
  templateUrl: './subscription-form.html',
})
export class SubscriptionForm {
  private readonly api = inject(SubscriptionsApi);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);

  /** Route parameter; absent when creating. */
  readonly id = input<string>();

  protected readonly intervals = BILLING_INTERVALS.map((value) => ({
    value,
    label: BILLING_INTERVAL_LABELS[value],
  }));
  protected readonly maxPriceChanges = MAX_PRICE_CHANGES;
  private readonly noticeOptions = NOTICE_MONTHS.map(noticeOption);

  /**
   * Options including the subscription's stored period, so a value set through the API (up to
   * 24 months) is kept when editing.
   */
  protected readonly noticeChoices = computed(() => {
    const stored = this.existing.value()?.noticeMonths ?? null;
    return stored === null || NOTICE_MONTHS.includes(stored)
      ? this.noticeOptions
      : [...this.noticeOptions, noticeOption(stored)];
  });

  protected readonly existing = httpResource<Subscription>(() => {
    const id = this.id();
    return id ? `/api/subscriptions/${encodeURIComponent(id)}` : undefined;
  });

  protected readonly isEdit = computed(() => this.id() !== undefined);

  protected readonly model = linkedSignal(() =>
    this.existing.hasValue()
      ? toFormModel(this.existing.value())
      : newSubscriptionForm(todayIn(DEFAULT_TIME_ZONE)),
  );

  protected readonly subscriptionForm = form(this.model, (path) => {
    // `required` accepts blanks, which the API rejects after trimming.
    validate(path.name, ({ value }) =>
      value().trim() ? undefined : { kind: 'required', message: 'Enter a name.' },
    );
    maxLength(path.name, SUBSCRIPTION_NAME_MAX_LENGTH, {
      message: `Use at most ${SUBSCRIPTION_NAME_MAX_LENGTH} characters.`,
    });
    validate(path.cost, ({ value }) => priceError(value()));
    validate(path.startDate, ({ value }) =>
      value() ? undefined : { kind: 'required', message: 'Enter the date of the first billing.' },
    );
    validate(path.endDate, ({ value, valueOf }) =>
      value() && value() < valueOf(path.startDate)
        ? { kind: 'order', message: 'The end must not be before the first billing.' }
        : undefined,
    );
    applyEach(path.priceChanges, (change) => {
      validate(change.validFrom, ({ value, valueOf }) => {
        const date = value();
        const end = valueOf(path.endDate);
        if (!date) {
          return { kind: 'required', message: 'Enter the date from which the price applies.' };
        }
        if (date <= valueOf(path.startDate)) {
          return { kind: 'order', message: 'Must be after the first billing.' };
        }
        if (end && date > end) {
          return { kind: 'order', message: 'Must not be after the end.' };
        }
        const sameDay = valueOf(path.priceChanges).filter((other) => other.validFrom === date);
        return sameDay.length > 1
          ? { kind: 'duplicate', message: 'Only one price change per day.' }
          : undefined;
      });
      validate(change.cost, ({ value }) => priceError(value()));
    });
  });

  /** Monthly share of an annual price, e.g. `CHF 83.33 per month`; empty otherwise. */
  protected readonly monthlyHint = computed(() => {
    const { interval, cost } = this.model();
    const rappen = parseChf(cost);
    return interval === 'annual' && typeof rappen === 'number'
      ? `${formatChf(Math.round(rappen / 12))} per month`
      : '';
  });

  private readonly addButton = viewChild<ElementRef<HTMLButtonElement>>('addButton');

  protected addPriceChange(): void {
    this.model.update((model) => ({
      ...model,
      priceChanges: [...model.priceChanges, { validFrom: '', cost: '' }],
    }));
    const index = this.model().priceChanges.length - 1;
    this.afterRender(() => this.document.getElementById(`change-date-${index}`)?.focus());
  }

  protected removePriceChange(index: number): void {
    this.model.update((model) => ({
      ...model,
      priceChanges: model.priceChanges.filter((_, i) => i !== index),
    }));
    this.afterRender(() => this.addButton()?.nativeElement.focus());
  }

  protected readonly saveError = signal('');

  protected save(event: Event): void {
    event.preventDefault();
    submit(this.subscriptionForm, async () => {
      this.saveError.set('');
      const input = toSubscriptionInput(this.model());
      const id = this.existing.value()?.id;
      try {
        await (id === undefined ? this.api.create(input) : this.api.update(id, input));
        await this.router.navigate([LIST_URL]);
      } catch (error) {
        this.saveError.set(
          error instanceof HttpErrorResponse && error.status === 400
            ? 'The subscription was rejected by the server. Please check the entries.'
            : 'The subscription could not be saved. Please try again.',
        );
      }
    });
  }

  private afterRender(fn: () => void): void {
    afterNextRender(fn, { injector: this.injector });
  }
}
