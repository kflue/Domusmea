import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subscription } from '../../../../shared/subscription';
import { SubscriptionList } from './subscription-list';

const netflix: Subscription = {
  id: 1,
  name: 'Netflix',
  interval: 'monthly',
  costRappen: 1890,
  startDate: '2025-01-20',
  endDate: null,
  priceChanges: [{ validFrom: '2027-01-01', costRappen: 2190 }],
  noticeMonths: null,
  createdAt: '2025-01-20T10:00:00.000Z',
  updatedAt: '2025-01-20T10:00:00.000Z',
};

const subscriptions: Subscription[] = [
  {
    ...netflix,
    id: 2,
    name: 'Car insurance',
    interval: 'annual',
    costRappen: 120000,
    startDate: '2024-03-01',
    priceChanges: [],
    noticeMonths: 3,
  },
  netflix,
  {
    ...netflix,
    id: 3,
    name: 'Newspaper',
    costRappen: 3000,
    startDate: '2025-06-05',
    endDate: '2026-02-28',
    priceChanges: [],
  },
];

/** Lets pending promise callbacks (async handlers after an HTTP response) run, then syncs Angular. */
async function settle() {
  await new Promise((resolve) => setTimeout(resolve));
  TestBed.tick();
}

describe('SubscriptionList', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T10:00:00Z'));
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  async function render(response: Subscription[]) {
    const fixture = TestBed.createComponent(SubscriptionList);
    // Attached to the document so focus can be checked.
    document.body.appendChild(fixture.nativeElement);
    TestBed.tick();
    http.expectOne('/api/subscriptions').flush(response);
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  afterEach(() => {
    http.verify();
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  const rowTexts = (element: HTMLElement, selector = 'table') =>
    [...element.querySelectorAll(`${selector} tbody tr`)].map((row) => row.textContent ?? '');

  it('shows active subscriptions with monthly share, next billing and upcoming prices', async () => {
    const { element } = await render(subscriptions);
    const rows = rowTexts(element, 'table:not(details table)');

    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('Car insurance');
    expect(rows[0]).toContain('Annually');
    expect(rows[0]).toMatch(/CHF\s1.200\.00\s*CHF\s100\.00/);
    expect(rows[0]).toContain('01.03.2027');
    // Renews 01.03.2027 with 3 months' notice; the reminder is due from 31.10.2026.
    expect(rows[0]).toContain('Cancel by 30.11.2026');
    expect(rows[1]).not.toContain('Cancel by');
    expect(rows[1]).toContain('Netflix');
    expect(rows[1]).toMatch(/CHF\s21\.90 from 01\.01\.2027/);
    expect(rows[1]).toContain('20.10.2026');
  });

  it('totals the active subscriptions and what was paid this year', async () => {
    const { element } = await render(subscriptions);
    const totals = element.querySelector('dl')?.textContent ?? '';
    expect(totals).toMatch(/Per month\s*CHF\s118\.90/);
    expect(totals).toMatch(/Per year\s*CHF\s1.426\.80/);
    // Car insurance once, Netflix 9 × 18.90 (20 January to 20 September), newspaper 2 × 30.00.
    expect(totals).toMatch(/Paid in 2026 so far\s*CHF\s1.430\.10/);
  });

  it('lists cancelled subscriptions collapsed below the active ones', async () => {
    const { element } = await render(subscriptions);
    const details = element.querySelector('details')!;
    expect(details.open).toBe(false);
    expect(details.querySelector('summary')?.textContent).toContain('Cancelled subscriptions (1)');
    expect(details.classList).toContain('text-gray-500');
    const rows = rowTexts(element, 'details table');
    expect(rows).toEqual([expect.stringContaining('Newspaper')]);
    expect(rows[0]).toContain('28.02.2026');
  });

  it('has no cancelled section when nothing was cancelled', async () => {
    const { element } = await render([netflix]);
    expect(element.querySelector('details')).toBeNull();
  });

  it('invites to add the first subscription when there are none', async () => {
    const { element } = await render([]);
    expect(element.textContent).toContain('No subscriptions yet.');
    expect(element.querySelector('table')).toBeNull();
  });

  it('deletes after confirmation and moves focus to the heading', async () => {
    const { fixture, element } = await render([netflix]);
    element.querySelector<HTMLButtonElement>('[aria-label="Delete Netflix"]')!.click();
    await fixture.whenStable();
    element.querySelector<HTMLButtonElement>('[aria-label="Confirm: delete Netflix"]')!.click();
    http.expectOne({ method: 'DELETE', url: '/api/subscriptions/1' }).flush(null);
    await settle();
    http.expectOne('/api/subscriptions').flush([]);
    await fixture.whenStable();
    expect(document.activeElement).toBe(element.querySelector('#subscriptions-heading'));
  });

  it('reports a failed delete', async () => {
    const { fixture, element } = await render([netflix]);
    element.querySelector<HTMLButtonElement>('[aria-label="Delete Netflix"]')!.click();
    await fixture.whenStable();
    element.querySelector<HTMLButtonElement>('[aria-label="Confirm: delete Netflix"]')!.click();
    http
      .expectOne({ method: 'DELETE', url: '/api/subscriptions/1' })
      .flush(null, { status: 500, statusText: 'Server Error' });
    await settle();
    await fixture.whenStable();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('could not be deleted');
  });
});
