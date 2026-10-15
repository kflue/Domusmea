import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { OpexFigures } from '../../../shared/finance-totals';
import { JournalEntry } from '../../../shared/journal';
import { Subscription } from '../../../shared/subscription';
import { UtilityEntry } from '../../../shared/utility';
import { subscriptionsFinanceSource } from '../../subscriptions/subscriptions.finance';
import { journalFinanceSource } from '../../journal/journal.finance';
import { utilitiesFinanceSource } from '../../utilities/utilities.finance';
import { FINANCE_SOURCES, provideFinanceSource } from './finance-sources';

describe('finance sources', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideFinanceSource(subscriptionsFinanceSource),
        provideFinanceSource(utilitiesFinanceSource),
        provideFinanceSource(journalFinanceSource),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** Lets the dynamic imports and the request start. */
  const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

  it('are registered in order and request nothing until loaded', () => {
    const sources = TestBed.inject(FINANCE_SOURCES);
    expect(sources.map((s) => [s.id, s.kind, s.link])).toEqual([
      ['subscriptions', 'opex', '/subscriptions'],
      ['utilities', 'opex', '/utilities'],
      ['journal', 'capex', '/journal'],
    ]);
    http.expectNone('/api/subscriptions');
  });

  it('load the subscriptions as monthly shares', async () => {
    const [subscriptions] = TestBed.inject(FINANCE_SOURCES);
    const figures = subscriptions.load('2026-10-15');
    await settle();
    const annual: Partial<Subscription> = {
      interval: 'annual',
      costRappen: 12_000,
      startDate: '2026-09-01',
      endDate: null,
      priceChanges: [],
    };
    http.expectOne('/api/subscriptions').flush([annual]);
    expect(await figures).toEqual({
      currentMonthlyRappen: 1_000,
      monthly: { '2026-09': 1_000, '2026-10': 1_000 },
    });
  });

  it('load the utilities per billed month', async () => {
    const [, utilities] = TestBed.inject(FINANCE_SOURCES);
    const figures = utilities.load('2026-10-15');
    await settle();
    const bill: Partial<UtilityEntry> = {
      commodity: 'garbage',
      periodFrom: '2026-07-01',
      periodTo: '2026-09-30',
      costRappen: 0,
      fixedFeeRappen: 6_000,
    };
    http.expectOne('/api/utilities').flush([bill]);
    const { monthly } = (await figures) as OpexFigures;
    expect(monthly).toEqual({ '2026-07': 2_000, '2026-08': 2_000, '2026-09': 2_000 });
  });

  it('load the investments, as "Other" without permission to read the items', async () => {
    const journal = TestBed.inject(FINANCE_SOURCES)[2];
    const figures = journal.load('2026-10-15');
    await settle();
    const investment: Partial<JournalEntry> = {
      date: '2027-03-01',
      kind: 'investment',
      costRappen: 900_000,
      itemId: 4,
    };
    http.expectOne('/api/journal').flush([investment]);
    http.expectNone('/api/items');
    expect(await figures).toEqual({
      years: [
        {
          year: '2027',
          category: 'other',
          categoryLabel: 'Other',
          spentRappen: 0,
          plannedRappen: 900_000,
        },
      ],
      notes: [],
    });
  });
});
