import { JournalEntry, JournalEntryInput } from '../../../shared/journal';
import { parseChf, rappenToChfText } from '../../shared/chf-input';

/** Form state: strings only, as Signal Forms binds inputs to non-null values. */
export interface JournalFormModel {
  date: string;
  title: string;
  /** Cost in CHF as typed, e.g. `1'299.50`. */
  cost: string;
  contractor: string;
  notes: string;
  /** Id of the linked item as the select's value; empty for none. */
  itemId: string;
}

/** A new repair done on `today` (`YYYY-MM-DD`). */
export function newJournalForm(today: string): JournalFormModel {
  return {
    date: today,
    title: '',
    cost: '',
    contractor: '',
    notes: '',
    itemId: '',
  };
}

export function toFormModel(entry: JournalEntry): JournalFormModel {
  return {
    date: entry.date,
    title: entry.title,
    cost: entry.costRappen === null ? '' : rappenToChfText(entry.costRappen),
    contractor: entry.contractor ?? '',
    notes: entry.notes ?? '',
    itemId: entry.itemId === null ? '' : String(entry.itemId),
  };
}

/** Converts a valid form model into the API body; empty fields become `null`. */
export function toJournalEntryInput(form: JournalFormModel): JournalEntryInput {
  const text = (value: string) => value.trim() || null;
  return {
    date: form.date,
    title: form.title.trim(),
    costRappen: parseChf(form.cost) ?? null,
    contractor: text(form.contractor),
    notes: text(form.notes),
    itemId: form.itemId ? Number(form.itemId) : null,
  };
}
