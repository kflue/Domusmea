import { Component, computed, input } from '@angular/core';
import { FieldState } from '@angular/forms/signals';

/** Validation messages of a Signal Forms field, shown once the field was touched. */
@Component({
  selector: 'app-field-errors',
  template: `
    @if (messages().length) {
      <p [id]="errorId()" class="mt-1 text-sm text-red-700">{{ messages().join(' ') }}</p>
    }
  `,
})
export class FieldErrors {
  readonly field = input.required<FieldState<unknown>>();
  /** Id referenced by the input's `aria-describedby`. */
  readonly errorId = input.required<string>();

  protected readonly messages = computed(() => {
    const field = this.field();
    return field.touched() ? field.errors().map((error) => error.message ?? 'Invalid value.') : [];
  });
}
