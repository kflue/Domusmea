/**
 * Kinds of journal entries. They are kept apart because Swiss tax returns treat them differently:
 * repairs and maintenance keep the house's value (deductible), investments add to it.
 */
export const JOURNAL_KINDS = ['repair', 'investment'] as const;
export type JournalKind = (typeof JOURNAL_KINDS)[number];

export const JOURNAL_KIND_LABELS: Record<JournalKind, string> = {
  repair: 'Repair or maintenance',
  investment: 'Investment',
};

/** Maximum length of the single-line text fields (title, contractor). */
export const JOURNAL_TEXT_MAX_LENGTH = 200;
/** Maximum length of the multi-line notes. */
export const JOURNAL_NOTES_MAX_LENGTH = 2000;

/**
 * Work done on the house, as returned by `/api/journal`.
 * Calendar dates are `YYYY-MM-DD`, timestamps ISO 8601 UTC, money integer Rappen (ADR 0004).
 */
export interface JournalEntry {
  id: number;
  /** When the work was done. */
  date: string;
  kind: JournalKind;
  title: string;
  costRappen: number | null;
  /** Company or person who did the work. */
  contractor: string | null;
  notes: string | null;
  /** Appliance or building part the work was done on; `null` if none or deleted since. */
  itemId: number | null;
  /** Name of that item, for display. */
  itemName: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Request body of `POST /api/journal` and `PUT /api/journal/:id`. */
export type JournalEntryInput = Omit<JournalEntry, 'id' | 'itemName' | 'createdAt' | 'updatedAt'>;
