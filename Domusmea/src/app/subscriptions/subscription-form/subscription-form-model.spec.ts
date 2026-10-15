import { Subscription } from '../../../shared/subscription';
import { newSubscriptionForm, toFormModel, toSubscriptionInput } from './subscription-form-model';

describe('subscription form model conversion', () => {
  const subscription: Subscription = {
    id: 3,
    name: 'Car insurance',
    interval: 'annual',
    costRappen: 98000,
    startDate: '2024-03-01',
    endDate: null,
    priceChanges: [
      { validFrom: '2025-03-01', costRappen: 101000 },
      { validFrom: '2026-03-01', costRappen: 104550 },
    ],
    noticeMonths: null,
    createdAt: '2024-03-01T10:00:00.000Z',
    updatedAt: '2026-03-01T10:00:00.000Z',
  };

  it('round-trips a subscription through the form', () => {
    const form = toFormModel(subscription);
    expect(form).toMatchObject({
      cost: '980.00',
      endDate: '',
      priceChanges: [
        { validFrom: '2025-03-01', cost: '1010.00' },
        { validFrom: '2026-03-01', cost: '1045.50' },
      ],
    });

    const { id, createdAt, updatedAt, ...input } = subscription;
    expect(toSubscriptionInput(form)).toEqual(input);
  });

  it('starts a new monthly subscription today and sorts price changes by date', () => {
    const form = {
      ...newSubscriptionForm('2026-10-15'),
      name: ' Netflix ',
      cost: '18.90',
      priceChanges: [
        { validFrom: '2027-06-01', cost: '23.90' },
        { validFrom: '2027-01-01', cost: '21.90' },
      ],
    };
    expect(toSubscriptionInput(form)).toEqual({
      name: 'Netflix',
      interval: 'monthly',
      costRappen: 1890,
      startDate: '2026-10-15',
      endDate: null,
      noticeMonths: null,
      priceChanges: [
        { validFrom: '2027-01-01', costRappen: 2190 },
        { validFrom: '2027-06-01', costRappen: 2390 },
      ],
    });
  });
});
