import { HttpErrorResponse, httpResource } from '@angular/common/http';
import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { form, FormField, maxLength, submit, validate } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import {
  Item,
  ITEM_CATEGORIES,
  ITEM_CATEGORY_LABELS,
  ITEM_TEXT_MAX_LENGTH,
} from '../../../shared/item';
import { FieldErrors } from '../../shared/field-errors';
import { ItemsApi } from '../items-api';
import { parseChf } from '../../shared/chf-input';
import { EMPTY_ITEM_FORM, toFormModel, toItemInput } from './item-form-model';

const TEXT_FIELDS = ['name', 'manufacturer', 'model', 'serialNumber', 'seller'] as const;

/** Create (`/items/new`) or edit (`/items/:id`) an item. */
@Component({
  selector: 'app-item-form',
  imports: [FormField, RouterLink, FieldErrors],
  templateUrl: './item-form.html',
})
export class ItemForm {
  private readonly api = inject(ItemsApi);
  private readonly router = inject(Router);

  /** Route parameter; absent when creating. */
  readonly id = input<string>();

  protected readonly categories = ITEM_CATEGORIES.map((value) => ({
    value,
    label: ITEM_CATEGORY_LABELS[value],
  }));

  protected readonly existing = httpResource<Item>(() => {
    const id = this.id();
    return id ? `/api/items/${encodeURIComponent(id)}` : undefined;
  });

  protected readonly isEdit = computed(() => this.id() !== undefined);

  protected readonly model = linkedSignal(() =>
    this.existing.hasValue() ? toFormModel(this.existing.value()) : EMPTY_ITEM_FORM,
  );

  protected readonly itemForm = form(this.model, (path) => {
    // `required` accepts blanks, which the API rejects after trimming.
    validate(path.name, ({ value }) =>
      value().trim() ? undefined : { kind: 'required', message: 'Enter a name.' },
    );
    for (const field of TEXT_FIELDS) {
      maxLength(path[field], ITEM_TEXT_MAX_LENGTH, {
        message: `Use at most ${ITEM_TEXT_MAX_LENGTH} characters.`,
      });
    }
    validate(path.cost, ({ value }) =>
      parseChf(value()) === undefined
        ? { kind: 'chf', message: 'Enter an amount in CHF, e.g. 1299.50.' }
        : undefined,
    );
    validate(path.warrantyExpires, ({ value, valueOf }) => {
      const purchased = valueOf(path.purchaseDate);
      return value() && purchased && value() < purchased
        ? { kind: 'beforePurchase', message: 'The warranty cannot end before the purchase date.' }
        : undefined;
    });
  });

  protected readonly saveError = signal('');

  protected save(event: Event): void {
    event.preventDefault();
    submit(this.itemForm, async () => {
      this.saveError.set('');
      const input = toItemInput(this.model());
      const id = this.existing.value()?.id;
      try {
        await (id === undefined ? this.api.create(input) : this.api.update(id, input));
        await this.router.navigate(['/items']);
      } catch (error) {
        this.saveError.set(
          error instanceof HttpErrorResponse && error.status === 400
            ? 'The item was rejected by the server. Please check the entries.'
            : 'The item could not be saved. Please try again.',
        );
      }
    });
  }
}
