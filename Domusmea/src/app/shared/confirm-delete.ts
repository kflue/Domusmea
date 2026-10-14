import {
  afterNextRender,
  Component,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

/**
 * A Delete button that asks for confirmation in place. Keyboard focus follows the swapped buttons;
 * after `confirmed`, the parent decides where focus goes (the row usually disappears).
 */
@Component({
  selector: 'app-confirm-delete',
  template: `
    @if (confirming()) {
      <button
        #confirmButton
        type="button"
        class="btn-danger"
        [attr.aria-label]="'Confirm: delete ' + name()"
        (click)="confirmed.emit()"
      >
        Confirm delete
      </button>
      <button
        type="button"
        class="btn-secondary ml-2"
        [attr.aria-label]="'Keep ' + name()"
        (click)="cancel()"
      >
        Cancel
      </button>
    } @else {
      <button
        #deleteButton
        type="button"
        class="btn-secondary"
        [attr.aria-label]="'Delete ' + name()"
        (click)="ask()"
      >
        Delete
      </button>
    }
  `,
})
export class ConfirmDelete {
  private readonly injector = inject(Injector);

  /** What is deleted, for the buttons' accessible names. */
  readonly name = input.required<string>();
  readonly confirmed = output();

  protected readonly confirming = signal(false);
  private readonly confirmButton = viewChild<ElementRef<HTMLButtonElement>>('confirmButton');
  private readonly deleteButton = viewChild<ElementRef<HTMLButtonElement>>('deleteButton');

  protected ask(): void {
    this.confirming.set(true);
    this.focusAfterRender(this.confirmButton);
  }

  protected cancel(): void {
    this.confirming.set(false);
    this.focusAfterRender(this.deleteButton);
  }

  private focusAfterRender(button: () => ElementRef<HTMLButtonElement> | undefined): void {
    afterNextRender(() => button()?.nativeElement.focus(), { injector: this.injector });
  }
}
