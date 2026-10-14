import { HttpErrorResponse, httpResource } from '@angular/common/http';
import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { form, FormField, maxLength, submit, validate } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { DEFAULT_TIME_ZONE, todayIn } from '../../../shared/format';
import {
  JOURNAL_KIND_LABELS,
  JOURNAL_KINDS,
  JOURNAL_NOTES_MAX_LENGTH,
  JOURNAL_TEXT_MAX_LENGTH,
  JournalEntry,
} from '../../../shared/journal';
import { ItemsApi } from '../../items/items-api';
import { parseChf } from '../../shared/chf-input';
import { FieldErrors } from '../../shared/field-errors';
import { JournalApi } from '../journal-api';
import { newJournalForm, toFormModel, toJournalEntryInput } from './journal-form-model';

const KIND_HINTS = {
  repair: 'Keeps the house in shape, e.g. fixing, servicing, replacing like for like.',
  investment: 'Adds value, e.g. an extension, solar panels, a better heating system.',
};

/** Create (`/journal/new`) or edit (`/journal/:id`) a journal entry. */
@Component({
  selector: 'app-journal-form',
  imports: [FormField, RouterLink, FieldErrors],
  templateUrl: './journal-form.html',
})
export class JournalForm {
  private readonly api = inject(JournalApi);
  private readonly itemsApi = inject(ItemsApi);
  private readonly router = inject(Router);

  /** Route parameter; absent when creating. */
  readonly id = input<string>();

  protected readonly kinds = JOURNAL_KINDS.map((value) => ({
    value,
    label: JOURNAL_KIND_LABELS[value],
    hint: KIND_HINTS[value],
  }));

  protected readonly existing = httpResource<JournalEntry>(() => {
    const id = this.id();
    return id ? `/api/journal/${encodeURIComponent(id)}` : undefined;
  });

  protected readonly isEdit = computed(() => this.id() !== undefined);

  /**
   * Items the entry can be linked to, by name. Includes the entry's current item, so the link is
   * kept even if the item list cannot be loaded.
   */
  protected readonly itemOptions = computed(() => {
    const list = this.itemsApi.list;
    const options = (list.hasValue() ? list.value().items : []).map((item) => ({
      id: String(item.id),
      name: item.name,
    }));
    const entry = this.existing.value();
    if (entry?.itemId && !options.some((option) => option.id === String(entry.itemId))) {
      options.push({ id: String(entry.itemId), name: entry.itemName ?? 'Linked item' });
    }
    return options.sort((a, b) => a.name.localeCompare(b.name));
  });

  protected readonly model = linkedSignal(() =>
    this.existing.hasValue()
      ? toFormModel(this.existing.value())
      : newJournalForm(todayIn(DEFAULT_TIME_ZONE)),
  );

  protected readonly entryForm = form(this.model, (path) => {
    validate(path.date, ({ value }) =>
      value() ? undefined : { kind: 'required', message: 'Enter the date of the work.' },
    );
    // `required` accepts blanks, which the API rejects after trimming.
    validate(path.title, ({ value }) =>
      value().trim() ? undefined : { kind: 'required', message: 'Describe the work.' },
    );
    for (const field of [path.title, path.contractor]) {
      maxLength(field, JOURNAL_TEXT_MAX_LENGTH, {
        message: `Use at most ${JOURNAL_TEXT_MAX_LENGTH} characters.`,
      });
    }
    maxLength(path.notes, JOURNAL_NOTES_MAX_LENGTH, {
      message: `Use at most ${JOURNAL_NOTES_MAX_LENGTH} characters.`,
    });
    validate(path.cost, ({ value }) =>
      parseChf(value()) === undefined
        ? { kind: 'chf', message: 'Enter an amount in CHF, e.g. 1299.50.' }
        : undefined,
    );
  });

  protected readonly saveError = signal('');

  protected save(event: Event): void {
    event.preventDefault();
    submit(this.entryForm, async () => {
      this.saveError.set('');
      const input = toJournalEntryInput(this.model());
      const id = this.existing.value()?.id;
      try {
        await (id === undefined ? this.api.create(input) : this.api.update(id, input));
        await this.router.navigate(['/journal']);
      } catch (error) {
        this.saveError.set(
          error instanceof HttpErrorResponse && error.status === 400
            ? 'The entry was rejected by the server. Please check the entries.'
            : 'The entry could not be saved. Please try again.',
        );
      }
    });
  }
}
