import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { form, FormField, maxLength, submit, validate } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { DEFAULT_TIME_ZONE, formatChf, formatDate, todayIn } from '../../../shared/format';
import {
  BILL_NOTES_MAX_LENGTH,
  Commodity,
  COMMODITIES,
  COMMODITY_INFO,
  INVOICE_NUMBER_MAX_LENGTH,
  MAX_AMOUNT_MILLI,
  MAX_UTILITY_RAPPEN,
} from '../../../shared/utility';
import { nextBillingPeriod, overlappingEntries } from '../../../shared/utility-costs';
import { parseAmount } from '../../shared/amount-input';
import { parseSignedChf } from '../../shared/chf-input';
import { FieldErrors } from '../../shared/field-errors';
import { UtilitiesApi } from '../utilities-api';
import {
  isFilled,
  newBillForm,
  toBillInput,
  toEntryInput,
  toFormModel,
  UtilityBillFormModel,
} from './utility-bill-form-model';

const LIST_URL = '/utilities';

/** Validation error for a CHF amount (credits negative), or `undefined` if `text` is one. */
function chfError(text: string, required: boolean) {
  const rappen = parseSignedChf(text);
  if (rappen === null) {
    return required ? { kind: 'required', message: 'Enter the cost in CHF.' } : undefined;
  }
  if (rappen === undefined) {
    return { kind: 'chf', message: 'Enter CHF, e.g. 248.19, or -12.50 for a credit.' };
  }
  return Math.abs(rappen) > MAX_UTILITY_RAPPEN
    ? { kind: 'max', message: `Enter at most ${formatChf(MAX_UTILITY_RAPPEN)}.` }
    : undefined;
}

function amountError(text: string, unit: string) {
  const milli = parseAmount(text);
  if (milli === null) {
    return { kind: 'required', message: `Enter the amount in ${unit}.` };
  }
  if (milli === undefined) {
    return { kind: 'amount', message: `Enter ${unit} with up to 3 decimals, e.g. 812.5.` };
  }
  return milli > MAX_AMOUNT_MILLI
    ? { kind: 'max', message: `Enter at most ${MAX_AMOUNT_MILLI / 1000} ${unit}.` }
    : undefined;
}

/**
 * Enter a bill (`/utilities/new`): the billing period and a line per commodity; each filled line is
 * stored as one entry (R2). Edit one entry (`/utilities/:id`): its period and its line only.
 */
@Component({
  selector: 'app-utility-bill-form',
  imports: [FormField, RouterLink, FieldErrors],
  templateUrl: './utility-bill-form.html',
})
export class UtilityBillForm {
  private readonly api = inject(UtilitiesApi);
  private readonly router = inject(Router);

  /** Route parameter; absent when entering a new bill. */
  readonly id = input<string>();

  protected readonly list = this.api.list;
  protected readonly isEdit = computed(() => this.id() !== undefined);
  private readonly entries = computed(() => (this.list.hasValue() ? this.list.value() : []));

  /** The edited entry; `undefined` when new, or not (yet) in the list. */
  protected readonly existing = computed(() => {
    const id = Number(this.id());
    return this.entries().find((entry) => entry.id === id);
  });

  /** Commodities shown: all for a new bill, the entry's own one when editing. */
  protected readonly commodities = computed<readonly Commodity[]>(() => {
    const entry = this.existing();
    return entry ? [entry.commodity] : COMMODITIES;
  });

  protected readonly model = linkedSignal<UtilityBillFormModel>(() => {
    const entry = this.existing();
    return entry
      ? toFormModel(entry)
      : newBillForm(nextBillingPeriod(this.entries(), todayIn(DEFAULT_TIME_ZONE)));
  });

  /** Existing entries whose period overlaps the bill's, for the filled commodities. */
  protected readonly overlaps = computed(() => {
    const { periodFrom, periodTo, lines } = this.model();
    if (!periodFrom || !periodTo || periodTo < periodFrom) {
      return [];
    }
    return this.commodities()
      .filter((commodity) => isFilled(commodity, lines[commodity]))
      .flatMap((commodity) =>
        overlappingEntries(this.entries(), commodity, periodFrom, periodTo, this.existing()?.id),
      )
      .map(
        (entry) =>
          `${COMMODITY_INFO[entry.commodity].label} ${formatDate(entry.periodFrom)} – ${formatDate(entry.periodTo)}`,
      );
  });

  protected readonly info = COMMODITY_INFO;

  protected readonly billForm = form(this.model, (path) => {
    validate(path.periodFrom, ({ value }) =>
      value() ? undefined : { kind: 'required', message: 'Enter the first day of the period.' },
    );
    validate(path.periodTo, ({ value, valueOf }) => {
      if (!value()) {
        return { kind: 'required', message: 'Enter the last day of the period.' };
      }
      return value() < valueOf(path.periodFrom)
        ? { kind: 'order', message: 'The end must not be before the start.' }
        : undefined;
    });
    maxLength(path.invoiceNumber, INVOICE_NUMBER_MAX_LENGTH, {
      message: `Use at most ${INVOICE_NUMBER_MAX_LENGTH} characters.`,
    });
    maxLength(path.notes, BILL_NOTES_MAX_LENGTH, {
      message: `Use at most ${BILL_NOTES_MAX_LENGTH} characters.`,
    });
    for (const commodity of COMMODITIES) {
      const info = COMMODITY_INFO[commodity];
      const line = path.lines[commodity];
      const unit = info.unit;
      if (unit !== null) {
        validate(line.amount, ({ value, valueOf }) =>
          isFilled(commodity, valueOf(line)) ? amountError(value(), unit) : undefined,
        );
        validate(line.cost, ({ value, valueOf }) =>
          isFilled(commodity, valueOf(line)) ? chfError(value(), true) : undefined,
        );
      }
      if (info.hasFixedFee) {
        validate(line.fixedFee, ({ value }) => chfError(value(), false));
      }
    }
    validate(path.lines, ({ value }) =>
      this.commodities().some((commodity) => isFilled(commodity, value()[commodity]))
        ? undefined
        : { kind: 'required', message: 'Fill in at least one commodity from the bill.' },
    );
    validate(path.confirmOverlap, ({ value }) =>
      this.overlaps().length && !value()
        ? { kind: 'overlap', message: 'Confirm that this is not a bill entered before.' }
        : undefined,
    );
  });

  protected readonly saveError = signal('');

  protected save(event: Event): void {
    event.preventDefault();
    submit(this.billForm, async () => {
      this.saveError.set('');
      const model = this.model();
      const entry = this.existing();
      try {
        await (entry
          ? this.api.update(entry.id, toEntryInput(model, entry))
          : this.api.createBill(toBillInput(model)));
        await this.router.navigate([LIST_URL]);
      } catch (error) {
        this.saveError.set(
          error instanceof HttpErrorResponse && error.status === 400
            ? 'The bill was rejected by the server. Please check the entries.'
            : 'The bill could not be saved. Please try again.',
        );
      }
    });
  }
}
