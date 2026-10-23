import { DOCUMENT } from '@angular/common';
import { afterNextRender, Component, computed, inject, Injector, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatChf, formatDate } from '../../../shared/format';
import { JournalEntry } from '../../../shared/journal';
import { ConfirmDelete } from '../../shared/confirm-delete';
import { JournalApi } from '../journal-api';

/** Repairs & Maintenance (`/journal`): the repairs, filterable by year, with their total. */
@Component({
  selector: 'app-journal-list',
  imports: [RouterLink, ConfirmDelete],
  templateUrl: './journal-list.html',
})
export class JournalList {
  private readonly api = inject(JournalApi);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  protected readonly list = this.api.list;
  private readonly entries = computed(() => (this.list.hasValue() ? this.list.value() : []));
  protected readonly formatChf = formatChf;
  protected readonly formatDate = formatDate;

  /** Selected year (`YYYY`), or empty for all years. */
  protected readonly year = signal('');

  /** Years with entries, newest first. */
  protected readonly years = computed(() =>
    [...new Set(this.entries().map((entry) => entry.date.slice(0, 4)))].sort((a, b) =>
      b.localeCompare(a),
    ),
  );

  protected readonly shown = computed(() => {
    const year = this.year();
    return year
      ? this.entries().filter((entry) => entry.date.startsWith(`${year}-`))
      : this.entries();
  });

  /** Cost of the shown repairs, formatted. */
  protected readonly total = computed(() =>
    formatChf(this.shown().reduce((total, entry) => total + (entry.costRappen ?? 0), 0)),
  );

  protected readonly deleteError = signal('');

  /** Item and contractor of an entry, e.g. `Boiler · Heizung Meier AG`. */
  protected details(entry: JournalEntry): string {
    return [entry.itemName, entry.contractor].filter(Boolean).join(' · ');
  }

  protected selectYear(event: Event): void {
    this.year.set((event.target as HTMLSelectElement).value);
  }

  protected async delete(entry: JournalEntry): Promise<void> {
    this.deleteError.set('');
    try {
      await this.api.delete(entry.id);
      // The row is gone; keep keyboard focus nearby.
      afterNextRender(() => this.document.getElementById('journal-heading')?.focus(), {
        injector: this.injector,
      });
    } catch {
      this.deleteError.set(`“${entry.title}” could not be deleted. Please try again.`);
    }
  }
}
