import { JournalEntry } from '../../../shared/journal';
import { newJournalForm, toFormModel, toJournalEntryInput } from './journal-form-model';

describe('journal form model conversion', () => {
  const entry: JournalEntry = {
    id: 3,
    date: '2026-09-01',
    title: 'Roof tiles replaced',
    costRappen: 2450000,
    contractor: null,
    notes: 'Roof south side.\nSubsidy applied for.',
    itemId: 7,
    itemName: 'Roof',
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
  };

  it('round-trips an entry through the form', () => {
    const form = toFormModel(entry);
    expect(form).toMatchObject({ cost: '24500.00', contractor: '', itemId: '7' });

    const { id, itemName, createdAt, updatedAt, ...input } = entry;
    expect(toJournalEntryInput(form)).toEqual(input);
  });

  it('starts a new entry today and turns blank fields into null', () => {
    const form = { ...newJournalForm('2026-10-14'), title: ' Fixed tap ', notes: ' \n ' };
    expect(toJournalEntryInput(form)).toEqual({
      date: '2026-10-14',
      title: 'Fixed tap',
      costRappen: null,
      contractor: null,
      notes: null,
      itemId: null,
    });
  });
});
