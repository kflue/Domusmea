/** Maximum length of the single-line text fields (title, contractor). */
export const JOURNAL_TEXT_MAX_LENGTH = 200;
/** Maximum length of the multi-line notes. */
export const JOURNAL_NOTES_MAX_LENGTH = 2000;

/**
 * A repair or maintenance job, as returned by `/api/journal`. Repairs keep the house's value, so they
 * are a running cost; investments are the items' purchases (ADR 0017).
 * Calendar dates are `YYYY-MM-DD`, timestamps ISO 8601 UTC, money integer Rappen (ADR 0004).
 */
export interface JournalEntry {
  id: number;
  /** When the work was done. */
  date: string;
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
