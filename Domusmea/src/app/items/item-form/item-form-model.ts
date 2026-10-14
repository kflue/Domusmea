import { Item, ItemCategory, ItemInput } from '../../../shared/item';

/** Form state: strings only, as Signal Forms binds inputs to non-null values. */
export interface ItemFormModel {
  name: string;
  category: ItemCategory | '';
  purchaseDate: string;
  /** Cost in CHF as typed, e.g. `1'299.50`. */
  cost: string;
  warrantyExpires: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  seller: string;
}

export const EMPTY_ITEM_FORM: ItemFormModel = {
  name: '',
  category: '',
  purchaseDate: '',
  cost: '',
  warrantyExpires: '',
  manufacturer: '',
  model: '',
  serialNumber: '',
  seller: '',
};

const CHF_AMOUNT = /^(\d+)(?:[.,](\d{1,2}))?$/;

/**
 * Parses a CHF amount into Rappen. Accepts `1299`, `1299.5`, `1'299.50`, `1 299,50`.
 * Returns `null` for an empty value and `undefined` for invalid input.
 */
export function parseChf(text: string): number | null | undefined {
  const compact = text.replaceAll(/['’\s]/g, '');
  if (compact === '') {
    return null;
  }
  const match = CHF_AMOUNT.exec(compact);
  if (!match) {
    return undefined;
  }
  const rappen = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return Number.isSafeInteger(rappen) ? rappen : undefined;
}

/** Rappen as an editable amount, e.g. `129950` → `1299.50`. */
export function rappenToChfText(rappen: number): string {
  const francs = Math.trunc(rappen / 100);
  return `${francs}.${String(rappen % 100).padStart(2, '0')}`;
}

export function toFormModel(item: Item): ItemFormModel {
  return {
    name: item.name,
    category: item.category ?? '',
    purchaseDate: item.purchaseDate ?? '',
    cost: item.costRappen === null ? '' : rappenToChfText(item.costRappen),
    warrantyExpires: item.warrantyExpires ?? '',
    manufacturer: item.manufacturer ?? '',
    model: item.model ?? '',
    serialNumber: item.serialNumber ?? '',
    seller: item.seller ?? '',
  };
}

/** Converts a valid form model into the API body; empty fields become `null`. */
export function toItemInput(form: ItemFormModel): ItemInput {
  const text = (value: string) => value.trim() || null;
  return {
    name: form.name.trim(),
    category: form.category || null,
    purchaseDate: form.purchaseDate || null,
    costRappen: parseChf(form.cost) ?? null,
    warrantyExpires: form.warrantyExpires || null,
    manufacturer: text(form.manufacturer),
    model: text(form.model),
    serialNumber: text(form.serialNumber),
    seller: text(form.seller),
  };
}
