import { Item, ItemCategory, ItemInput } from '../../../shared/item';
import { parseChf, rappenToChfText } from '../../shared/chf-input';

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

export function toFormModel(item: Item): ItemFormModel {
  return {
    name: item.name,
    category: item.category ?? '',
    purchaseDate: item.purchaseDate,
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
    purchaseDate: form.purchaseDate,
    costRappen: parseChf(form.cost) ?? null,
    warrantyExpires: form.warrantyExpires || null,
    manufacturer: text(form.manufacturer),
    model: text(form.model),
    serialNumber: text(form.serialNumber),
    seller: text(form.seller),
  };
}
