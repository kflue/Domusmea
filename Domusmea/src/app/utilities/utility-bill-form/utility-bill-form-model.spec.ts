import { UtilityEntry } from '../../../shared/utility';
import {
  isFilled,
  newBillForm,
  toBillInput,
  toEntryInput,
  toFormModel,
} from './utility-bill-form-model';

const water: UtilityEntry = {
  id: 3,
  billId: 1,
  commodity: 'water',
  periodFrom: '2026-04-01',
  periodTo: '2026-06-30',
  amountMilli: 21_500,
  costRappen: -1_250,
  fixedFeeRappen: 3_000,
  invoiceNumber: 'W-17',
  notes: 'Leak repaired',
  createdAt: '2026-07-10T08:00:00.000Z',
  updatedAt: '2026-07-10T08:00:00.000Z',
};

describe('utility bill form model', () => {
  it('only counts the fields a commodity uses as filled', () => {
    expect(isFilled('electricity', { amount: '', cost: ' ', fixedFee: '' })).toBe(false);
    expect(isFilled('electricity', { amount: '', cost: '', fixedFee: '5' })).toBe(true);
    expect(isFilled('wastewater', { amount: '', cost: '', fixedFee: '5' })).toBe(false);
    expect(isFilled('garbage', { amount: '12', cost: '', fixedFee: '' })).toBe(false);
    expect(isFilled('garbage', { amount: '', cost: '', fixedFee: '45' })).toBe(true);
  });

  it('turns the filled lines into a bill', () => {
    const form = newBillForm({ from: '2026-07-01', to: '2026-09-30' });
    form.lines.electricity = { amount: "1'234.5", cost: '354.30', fixedFee: '' };
    form.lines.garbage = { amount: '', cost: '', fixedFee: '45' };
    form.notes = '  ';
    expect(toBillInput(form)).toEqual({
      periodFrom: '2026-07-01',
      periodTo: '2026-09-30',
      invoiceNumber: null,
      notes: null,
      lines: [
        { commodity: 'electricity', amountMilli: 1_234_500, costRappen: 35_430, fixedFeeRappen: 0 },
        { commodity: 'garbage', amountMilli: null, costRappen: 0, fixedFeeRappen: 4_500 },
      ],
    });
  });

  it('edits an entry and converts it back unchanged', () => {
    const form = toFormModel(water);
    expect(form.lines.water).toEqual({ amount: '21.5', cost: '-12.50', fixedFee: '30.00' });
    expect(form.lines.electricity).toEqual({ amount: '', cost: '', fixedFee: '' });
    expect(toEntryInput(form, water)).toEqual({
      commodity: 'water',
      periodFrom: '2026-04-01',
      periodTo: '2026-06-30',
      amountMilli: 21_500,
      costRappen: -1_250,
      fixedFeeRappen: 3_000,
    });
    form.notes = ' Leak repaired twice ';
    form.invoiceNumber = '';
    expect(toEntryInput(form, water)).toMatchObject({
      invoiceNumber: null,
      notes: 'Leak repaired twice',
    });
  });
});
