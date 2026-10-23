import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { OpexFigures } from '../../../shared/finance-totals';
import { Item } from '../../../shared/item';
import { JournalEntry } from '../../../shared/journal';
import { Subscription } from '../../../shared/subscription';
import { UtilityEntry } from '../../../shared/utility';
import { itemsFinanceSource } from '../../items/items.finance';
import { journalFinanceSource } from '../../journal/journal.finance';
import { subscriptionsFinanceSource } from '../../subscriptions/subscriptions.finance';
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
        provideFinanceSource(itemsFinanceSource),
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
      ['journal', 'opex', '/journal'],
      ['items', 'capex', '/items'],
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

  it('load the repairs per month, future ones left out', async () => {
    const journal = TestBed.inject(FINANCE_SOURCES)[2];
    const figures = journal.load('2026-10-15');
    await settle();
    const repairs: Partial<JournalEntry>[] = [
      { date: '2026-09-03', costRappen: 60_000 },
      { date: '2026-11-01', costRappen: 1_000 },
    ];
    http.expectOne('/api/journal').flush(repairs);
    expect(await figures).toEqual({
      currentMonthlyRappen: 0,
      monthly: { '2026-09': 60_000, '2026-10': 0 },
      notes: [],
    });
  });

  it('load the item purchases by year and category', async () => {
    const items = TestBed.inject(FINANCE_SOURCES)[3];
    const figures = items.load('2026-10-15');
    await settle();
    const dishwasher: Partial<Item> = {
      category: 'appliance',
      purchaseDate: '2027-04-01',
      costRappen: 150_000,
    };
    http.expectOne('/api/items').flush({ today: '2026-10-15', items: [dishwasher] });
    expect(await figures).toEqual({
      years: [
        {
          year: '2027',
          category: 'appliance',
          categoryLabel: 'Appliance',
          spentRappen: 0,
          plannedRappen: 150_000,
        },
      ],
      notes: [],
    });
  });
});
