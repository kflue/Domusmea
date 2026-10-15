import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Permission, SessionUser } from '../../../shared/auth';
import { UtilityEntry } from '../../../shared/utility';
import { AuthApi } from '../../auth/auth-api';
import { UtilityChart } from '../utility-chart/utility-chart';
import { ChartPeriod } from '../utility-chart/utility-chart-config';
import { UtilityOverview } from './utility-overview';

/** Stands in for the canvas chart, which jsdom cannot draw. */
@Component({ selector: 'app-utility-chart', template: '' })
class FakeChart {
  readonly periods = input.required<readonly ChartPeriod[]>();
  readonly unit = input.required<string | null>();
  readonly label = input.required<string>();
}

let nextId = 1;
function entry(overrides: Partial<UtilityEntry>): UtilityEntry {
  return {
    id: nextId++,
    billId: 1,
    commodity: 'electricity',
    periodFrom: '2026-04-01',
    periodTo: '2026-06-30',
    amountMilli: 1_000_000,
    costRappen: 28_700,
    fixedFeeRappen: 1_500,
    invoiceNumber: null,
    notes: null,
    createdAt: '2026-07-10T08:00:00.000Z',
    updatedAt: '2026-07-10T08:00:00.000Z',
    ...overrides,
  };
}

const entries = [
  entry({ id: 1, invoiceNumber: '2026-0815', notes: 'Meter replaced\nin May' }),
  entry({
    id: 2,
    periodFrom: '2025-12-15',
    periodTo: '2026-03-31',
    amountMilli: 0,
    costRappen: -500,
  }),
  entry({ id: 3, periodFrom: '2025-07-01', periodTo: '2025-09-30', amountMilli: 812_500 }),
  entry({ id: 4, commodity: 'garbage', amountMilli: null, costRappen: 0, fixedFeeRappen: 4_500 }),
];

/** Lets pending promise callbacks (async handlers after an HTTP response) run, then syncs Angular. */
async function settle() {
  await new Promise((resolve) => setTimeout(resolve));
  TestBed.tick();
}

describe('UtilityOverview', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.overrideComponent(UtilityOverview, {
      remove: { imports: [UtilityChart] },
      add: { imports: [FakeChart] },
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    document.body.innerHTML = '';
  });

  async function render(response: UtilityEntry[], permissions: Permission[] = ['finance:write']) {
    const user: SessionUser = {
      username: 'anna',
      role: 'Owner',
      permissions,
      setupRequired: false,
    };
    const auth = TestBed.inject(AuthApi);
    const session = auth.currentUser();
    http.expectOne('/api/auth/session').flush({ user });
    await session;
    const fixture = TestBed.createComponent(UtilityOverview);
    document.body.appendChild(fixture.nativeElement);
    TestBed.tick();
    http.expectOne('/api/utilities').flush(response);
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  const section = (element: HTMLElement, commodity: string) =>
    element.querySelector<HTMLElement>(`section[aria-labelledby="${commodity}-heading"]`)!;
  const commodityRows = (element: HTMLElement, commodity: string) =>
    rowTexts(section(element, commodity));
  const rowTexts = (element: HTMLElement) =>
    [...element.querySelectorAll('tbody tr')].map((row) =>
      [...row.children]
        .map((cell) =>
          [...cell.childNodes]
            .filter((node) => node.nodeType !== Node.COMMENT_NODE)
            .map((node) => node.textContent?.trim())
            .join(' '),
        )
        .join(' ')
        .replaceAll(/\s+/g, ' ')
        .trim(),
    );

  it('lists each period newest first with a total per year and the price per unit', async () => {
    const { element } = await render(entries);
    const electricity = section(element, 'electricity');
    const headers = [...electricity.querySelectorAll('thead th')].map((th) =>
      th.textContent?.trim(),
    );
    expect(headers.slice(0, 6)).toEqual([
      'Period',
      'Amount (kWh)',
      'Usage cost (CHF)',
      'Fixed fee (CHF)',
      'Total (CHF)',
      'Price (CHF/kWh)',
    ]);
    const rows = rowTexts(electricity);
    expect(rows).toHaveLength(5);
    expect(rows[0]).toMatch(
      /^Q2 2026 01\.04\.2026 – 30\.06\.2026 Invoice 2026-0815 Meter replaced in May 1.000 287\.00 15\.00 302\.00 0\.2870/,
    );
    // An irregular period counts to its end year; amount 0 has no price per unit.
    expect(rows[1]).toMatch(/^15\.12\.2025 – 31\.03\.2026 0 [-−]5\.00 15\.00 10\.00 Edit/);
    expect(rows[2]).toMatch(/^Total 2026 1.000 282\.00 30\.00 312\.00 0\.2820$/);
    expect(rows[3]).toContain('Q3 2025');
    expect(rows[4]).toMatch(/^Total 2025 812\.5 287\.00 15\.00 302\.00 0\.3532$/);
  });

  it('sums the last twelve billed months, together and per commodity', async () => {
    const { element } = await render(entries);
    const summary = element.querySelector<HTMLElement>('[aria-labelledby="last-twelve-heading"]')!;
    expect(summary.querySelector('h2')?.textContent).toContain('01.07.2025 – 30.06.2026');
    const text = summary.textContent?.replaceAll(/\s+/g, ' ') ?? '';
    // Electricity 302.00 + 10.00 + 302.00, garbage 45.00.
    expect(text).toMatch(/All utilities\s*CHF\s659\.00/);
    expect(text).toMatch(/Electricity\s*CHF\s614\.00/);
    expect(text).toMatch(/Garbage\s*CHF\s45\.00/);
    expect(text).not.toContain('Water');
  });

  it('compares each year with the same quarters of the year before', async () => {
    const { element } = await render([
      ...entries,
      entry({
        periodFrom: '2025-04-01',
        periodTo: '2025-06-30',
        amountMilli: 800_000,
        costRappen: 20_000,
      }),
      entry({
        periodFrom: '2025-01-01',
        periodTo: '2025-03-31',
        amountMilli: 900_000,
        costRappen: 25_000,
      }),
    ]);
    const rows = rowTexts(
      element.querySelector<HTMLElement>('[aria-labelledby="year-comparison-heading"]')!,
    );
    // 2026: Q1 (irregular, ends in March) and Q2 against Q1–Q2 2025.
    expect(rows[0]).toMatch(
      /^2026 Electricity Q1–Q2 1.000 kWh [−-]41\.2\s?% 312\.00 [−-]35\.0\s?%$/,
    );
    expect(rows[1]).toMatch(/^Garbage Q2 45\.00 –$/);
    expect(rows[2]).toMatch(/^2025 Electricity Q1–Q3 2.512\.5 kWh – 782\.00 –$/);
  });

  it('shows garbage as a flat fee and an empty state per commodity', async () => {
    const { element } = await render(entries);
    const garbage = section(element, 'garbage');
    expect(garbage.querySelector('h2')?.textContent).toContain('(flat fee)');
    expect([...garbage.querySelectorAll('thead th')].map((th) => th.textContent?.trim())).toEqual([
      'Period',
      'Cost (CHF)',
      'Actions',
    ]);
    expect(commodityRows(element, 'garbage')[0]).toMatch(/^Q2 2026 .* 45\.00/);
    expect(section(element, 'water').textContent).toContain('No water entries yet.');
    expect(section(element, 'water').querySelector('app-utility-chart')).toBeNull();
  });

  it('passes the periods oldest first to the chart', async () => {
    const { fixture } = await render(entries);
    const chart = fixture.debugElement
      .queryAll((node) => node.componentInstance instanceof FakeChart)
      .map((node) => node.componentInstance as FakeChart)[0];
    expect(chart.unit()).toBe('kWh');
    expect(chart.periods().map((period) => period.label)).toEqual([
      'Q3 2025',
      '15.12.2025 – 31.03.2026',
      'Q2 2026',
    ]);
    expect(chart.periods()[2]).toMatchObject({ amount: 1000, cost: 302, previous: null });
    expect(chart.periods()[2].details.join(' ')).toMatch(/Price: CHF 0\.2870\/kWh/);
  });

  it('gives the chart the same quarter a year earlier', async () => {
    const { fixture } = await render([
      ...entries,
      entry({ periodFrom: '2025-04-01', periodTo: '2025-06-30', amountMilli: 800_000 }),
    ]);
    const chart = fixture.debugElement
      .queryAll((node) => node.componentInstance instanceof FakeChart)
      .map((node) => node.componentInstance as FakeChart)[0];
    const q2 = chart.periods().at(-1)!;
    expect(q2.previous).toEqual({ amount: 800, cost: 302 });
    expect(q2.details.at(-1)).toMatch(/^A year earlier: 800 kWh, CHF\s302\.00$/);
  });

  it('invites to add the first bill when there are none', async () => {
    const { element } = await render([]);
    expect(element.textContent).toContain('No bills yet.');
    expect(element.querySelector('a[href="/utilities/new"]')).not.toBeNull();
    expect(element.querySelector('table')).toBeNull();
  });

  it('shows no add, edit or delete controls without finance:write', async () => {
    const { element } = await render(entries, ['finance:read']);
    expect(element.querySelector('table')).not.toBeNull();
    expect(element.textContent).not.toContain('Add bill');
    expect(element.querySelector('[aria-label^="Edit"]')).toBeNull();
    expect(element.querySelector('[aria-label^="Delete"]')).toBeNull();
  });

  it('deletes after confirmation and moves focus to the commodity heading', async () => {
    const { fixture, element } = await render(entries);
    element.querySelector<HTMLButtonElement>('[aria-label="Delete Garbage Q2 2026"]')!.click();
    await fixture.whenStable();
    element
      .querySelector<HTMLButtonElement>('[aria-label="Confirm: delete Garbage Q2 2026"]')!
      .click();
    http.expectOne({ method: 'DELETE', url: '/api/utilities/4' }).flush(null);
    await settle();
    http.expectOne('/api/utilities').flush(entries.slice(0, 3));
    await fixture.whenStable();
    expect(document.activeElement).toBe(element.querySelector('#garbage-heading'));
    expect(section(element, 'garbage').textContent).toContain('No garbage entries yet.');
  });

  it('reports a failed delete', async () => {
    const { fixture, element } = await render(entries);
    element.querySelector<HTMLButtonElement>('[aria-label="Delete Garbage Q2 2026"]')!.click();
    await fixture.whenStable();
    element
      .querySelector<HTMLButtonElement>('[aria-label="Confirm: delete Garbage Q2 2026"]')!
      .click();
    http
      .expectOne({ method: 'DELETE', url: '/api/utilities/4' })
      .flush(null, { status: 500, statusText: 'Server Error' });
    await settle();
    await fixture.whenStable();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('could not be deleted');
  });
});
