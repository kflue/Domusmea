import { Item } from '../../../shared/item';
import { EMPTY_ITEM_FORM, toFormModel, toItemInput } from './item-form-model';

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
    const form = { ...EMPTY_ITEM_FORM, name: ' Roof ', purchaseDate: '2010-06-01', seller: '  ' };
    expect(toItemInput(form)).toEqual({
      name: 'Roof',
      category: null,
      purchaseDate: '2010-06-01',
      costRappen: null,
      warrantyExpires: null,
      manufacturer: null,
      model: null,
      serialNumber: null,
      seller: null,
    });
  });
});
