import { Item } from '../../../shared/item';
import { EMPTY_ITEM_FORM, parseChf, toFormModel, toItemInput } from './item-form-model';

describe('parseChf', () => {
  it('parses amounts with Swiss separators into Rappen', () => {
    expect(parseChf('1299')).toBe(129900);
    expect(parseChf("1'299.5")).toBe(129950);
    expect(parseChf('1’299.05')).toBe(129905);
    expect(parseChf(' 1 299,50 ')).toBe(129950);
    expect(parseChf('0.10')).toBe(10);
  });

  it('returns null for empty and undefined for invalid input', () => {
    expect(parseChf('  ')).toBeNull();
    expect(parseChf('12.345')).toBeUndefined();
    expect(parseChf('-5')).toBeUndefined();
    expect(parseChf('abc')).toBeUndefined();
    expect(parseChf('9'.repeat(20))).toBeUndefined();
  });
});

describe('form model conversion', () => {
  const item: Item = {
    id: 7,
    name: 'Dishwasher',
    category: 'appliance',
    purchaseDate: '2024-03-01',
    costRappen: 129905,
    warrantyExpires: '2026-03-01',
    manufacturer: 'V-Zug',
    model: null,
    serialNumber: null,
    seller: 'Fust',
    createdAt: '2024-03-01T10:00:00.000Z',
    updatedAt: '2024-03-01T10:00:00.000Z',
  };

  it('round-trips an item through the form', () => {
    const form = toFormModel(item);
    expect(form.cost).toBe('1299.05');
    expect(form.model).toBe('');

    const { id, createdAt, updatedAt, ...input } = item;
    expect(toItemInput(form)).toEqual(input);
  });

  it('turns empty and blank fields into null', () => {
    expect(toItemInput({ ...EMPTY_ITEM_FORM, name: ' Roof ', seller: '  ' })).toEqual({
      name: 'Roof',
      category: null,
      purchaseDate: null,
      costRappen: null,
      warrantyExpires: null,
      manufacturer: null,
      model: null,
      serialNumber: null,
      seller: null,
    });
  });
});
