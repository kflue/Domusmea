/** Item categories; `null` on an item means uncategorized. */
export const ITEM_CATEGORIES = ['appliance', 'building-part'] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export const ITEM_CATEGORY_LABELS: Record<ItemCategory, string> = {
  appliance: 'Appliance',
  'building-part': 'Building part',
};

/** Maximum length of the item's text fields, enforced by the API and the form. */
export const ITEM_TEXT_MAX_LENGTH = 200;

/**
 * An appliance or building part of the household, as returned by `/api/items`.
 * Calendar dates are `YYYY-MM-DD`, timestamps ISO 8601 UTC, money integer Rappen (ADR 0004).
 */
export interface Item {
  id: number;
  name: string;
  category: ItemCategory | null;
  /** Required (ADR 0017): it sets the item's capex year. */
  purchaseDate: string;
  costRappen: number | null;
  warrantyExpires: string | null;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  seller: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Response of `GET /api/items`: items plus the server's date, which defines warranty status. */
export interface ItemList {
  /** Today in the server's time zone (`APP_TIMEZONE`), `YYYY-MM-DD`. */
  today: string;
  items: Item[];
}

/** Request body of `POST /api/items` and `PUT /api/items/:id`. */
export type ItemInput = Omit<Item, 'id' | 'createdAt' | 'updatedAt'>;
