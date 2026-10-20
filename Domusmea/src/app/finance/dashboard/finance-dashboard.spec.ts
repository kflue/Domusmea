import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Permission, SessionUser } from '../../../shared/auth';
import { CapexFigures, lastMonths, OpexFigures } from '../../../shared/finance-totals';
import { DEFAULT_TIME_ZONE, todayIn } from '../../../shared/format';
import { AuthApi } from '../../auth/auth-api';
import { CostChart } from './cost-chart/cost-chart';
import { CostChartData } from './cost-chart/cost-chart-config';
import { FinanceDashboard } from './finance-dashboard';
import { FinanceSource, provideFinanceSource } from './finance-sources';
import { Investments } from './investments/investments';
import { RunningCosts } from './running-costs/running-costs';

/** Stands in for the canvas chart, which jsdom cannot draw. */
@Component({ selector: 'app-cost-chart', template: '' })
class FakeChart {
  readonly data = input.required<CostChartData>();
  readonly label = input.required<string>();
}

const today = todayIn(DEFAULT_TIME_ZONE);
const months = lastMonths(today, 24);
const year = Number(today.slice(0, 4));
const current = months[23];
const previous = months[22];

function opex(
  id: string,
  order: number,
  figures: OpexFigures | Error,
  permission: Permission = 'finance:read',
): () => FinanceSource {
  return () => ({
    kind: 'opex',
    id,
    label: id[0].toUpperCase() + id.slice(1),
    permission,
    link: `/${id}`,
    order,
    load: () => (figures instanceof Error ? Promise.reject(figures) : Promise.resolve(figures)),
  });
}

const subscriptions = opex('subscriptions', 10, {
  currentMonthlyRappen: 8_500,
  monthly: { [previous]: 8_000, [current]: 8_500 },
});
const utilities = opex('utilities', 20, {
  currentMonthlyRappen: 20_000,
  monthly: { [previous]: 21_000 },
});
/** A category no dashboard code knows about (R8). */
const taxes = opex('taxes', 30, { currentMonthlyRappen: 50_000, monthly: { [current]: 50_000 } });
const empty = (id: string, order: number) =>
  opex(id, order, { currentMonthlyRappen: 0, monthly: {} });

function capex(id: string, figures: CapexFigures | Error): () => FinanceSource {
  return () => ({
    kind: 'capex',
    id,
    label: 'Investments',
    permission: 'items:read',
    link: '/items',
    order: 10,
    load: () => (figures instanceof Error ? Promise.reject(figures) : Promise.resolve(figures)),
  });
}

const row = (offset: number, category: string, spentRappen: number, plannedRappen = 0) => ({
  year: String(year + offset),
  category,
  categoryLabel: category[0].toUpperCase() + category.slice(1),
  spentRappen,
  plannedRappen,
});
const items = capex('items', {
  years: [
    row(-1, 'appliance', 500_000),
    row(0, 'other', 1_800_000, 1_200_000),
    row(2, 'appliance', 0, 300_000),
  ],
  notes: ['3 items without cost'],
});

describe('FinanceDashboard', () => {
  let http: HttpTestingController;

  function setup(sources: (() => FinanceSource)[]) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        ...sources.map(provideFinanceSource),
      ],
    });
    for (const section of [RunningCosts, Investments]) {
      TestBed.overrideComponent(section, {
        remove: { imports: [CostChart] },
        add: { imports: [FakeChart] },
      });
    }
    http = TestBed.inject(HttpTestingController);
  }

  afterEach(() => {
    http.verify();
    document.body.innerHTML = '';
  });

  async function render(permissions: Permission[] = ['finance:read']) {
    const user: SessionUser = {
      username: 'anna',
      role: 'Owner',
      permissions,
      setupRequired: false,
    };
    const session = TestBed.inject(AuthApi).currentUser();
    http.expectOne('/api/auth/session').flush({ user });
    await session;
    const fixture = TestBed.createComponent(FinanceDashboard);
    document.body.appendChild(fixture.nativeElement);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const section = (name: string) => element.querySelector<HTMLElement>(name);
    const chartIn = (name: string) =>
      (
        fixture.debugElement
          .query((d) => d.name === name)
          ?.query((d) => d.name === 'app-cost-chart')?.componentInstance as FakeChart | undefined
      )?.data();
    return {
      element,
      section,
      chartData: () => chartIn('app-running-costs'),
      capexData: () => chartIn('app-investments'),
      kpis: (name = 'app-running-costs') =>
        [...(section(name)?.querySelectorAll('dl > div') ?? [])].map((div) =>
          [...div.children]
            .map((part) => part.textContent)
            .join(' ')
            .replaceAll(/\s+/g, ' ')
            .trim(),
        ),
    };
  }

  it('shows the monthly recurring cost with each category, its share and a link (R2)', async () => {
    setup([utilities, subscriptions]);
    const { element, kpis } = await render();
    expect(kpis()).toEqual([
      expect.stringMatching(/^Total this month CHF\s285\.00$/),
      expect.stringMatching(/^Subscriptions CHF\s85\.00 \(30\s?%\)$/),
      expect.stringMatching(/^Utilities CHF\s200\.00 \(70\s?%\)$/),
    ]);
    const links = [...element.querySelectorAll('dl a')].map((a) => a.getAttribute('href'));
    expect(links).toEqual(['/subscriptions', '/utilities']);
  });

  it('draws a line per category and the total only where every category has a value (R3)', async () => {
    setup([subscriptions, utilities]);
    const { element, chartData } = await render();
    const data = chartData()!;
    expect(data.periods).toHaveLength(24);
    expect(data.periods[23]).toMatch(/^[A-Z][a-z]{2} \d{4}$/);
    expect(data.series.map((s) => [s.label, s.values.slice(21)])).toEqual([
      ['Subscriptions', [null, 8_000, 8_500]],
      ['Utilities', [null, 21_000, null]],
      ['Total', [null, 29_000, null]],
    ]);
    // The table is the chart's text alternative, newest month first.
    const rows = [...element.querySelectorAll('tbody tr')].map((row) =>
      [...row.children].map((cell) => cell.textContent?.trim()),
    );
    expect(rows).toHaveLength(24);
    expect(rows[0]).toEqual([data.periods[23], '85.00', '–', '–']);
    expect(element.querySelector('app-investments')).toBeNull();
    expect(rows[1]).toEqual([data.periods[22], '80.00', '210.00', '290.00']);
  });

  it('includes a newly registered source without dashboard changes (R8)', async () => {
    setup([subscriptions, utilities, taxes]);
    const { kpis, chartData } = await render();
    expect(kpis()[0]).toMatch(/CHF\s785\.00$/);
    expect(kpis()[3]).toMatch(/^Taxes CHF\s500\.00/);
    expect(chartData()!.series.map((s) => s.label)).toEqual([
      'Subscriptions',
      'Utilities',
      'Taxes',
      'Total',
    ]);
  });

  it('skips sources the role may not read', async () => {
    setup([subscriptions, opex('utilities', 20, new Error('never loaded'), 'journal:read')]);
    const { kpis, chartData } = await render();
    expect(kpis()).toHaveLength(2);
    expect(chartData()!.series.map((s) => s.label)).toEqual(['Subscriptions']);
  });

  it('reports a source that fails and still shows the others', async () => {
    setup([subscriptions, opex('utilities', 20, new Error('offline'))]);
    const { element, kpis } = await render();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Utilities could not be loaded',
    );
    expect(kpis()[0]).toMatch(/CHF\s85\.00$/);
  });

  it('shows the notes of opex sources under the tile', async () => {
    setup([
      subscriptions,
      opex('repairs', 30, {
        currentMonthlyRappen: 0,
        monthly: {},
        notes: ['2 repairs without cost'],
      }),
    ]);
    const { section } = await render();
    expect(section('app-running-costs')?.textContent).toContain('2 repairs without cost');
  });

  it('shows the notes also when there are no running costs yet', async () => {
    setup([
      opex('repairs', 30, {
        currentMonthlyRappen: 0,
        monthly: {},
        notes: ['1 repair without cost'],
      }),
    ]);
    const { section } = await render();
    expect(section('app-running-costs')?.textContent).toContain('No running costs yet');
    expect(section('app-running-costs')?.textContent).toContain('1 repair without cost');
  });

  it('explains itself without any data and links to where costs are entered (R1)', async () => {
    setup([empty('subscriptions', 10), empty('utilities', 20)]);
    const { element, chartData } = await render();
    expect(element.textContent).toContain('No running costs yet');
    expect([...element.querySelectorAll('li a')].map((a) => a.getAttribute('href'))).toEqual([
      '/subscriptions',
      '/utilities',
    ]);
    expect(chartData()).toBeUndefined();
  });

  it('shows this year spent and planned and the plan for the next five years (R4)', async () => {
    setup([subscriptions, items]);
    const { section, kpis } = await render(['finance:read', 'items:read']);
    expect(kpis('app-investments')).toEqual([
      expect.stringMatching(
        new RegExp(
          `^${year} CHF\\s30.000\\.00 CHF\\s18.000\\.00 spent, CHF\\s12.000\\.00 planned$`,
        ),
      ),
      expect.stringMatching(new RegExp(`^Planned ${year + 1}–${year + 5} CHF\\s3.000\\.00$`)),
    ]);
    expect(section('app-investments')?.textContent).toContain('3 items without cost');
  });

  it('draws past and planned years per category, the current year split (R5)', async () => {
    setup([items]);
    const { capexData } = await render(['finance:read', 'items:read']);
    const data = capexData()!;
    expect(data.periods).toEqual([
      String(year - 1),
      String(year),
      String(year + 1),
      String(year + 2),
    ]);
    expect(data.plannedFrom).toBe(2);
    expect(data.series.map((s) => [s.label, s.values])).toEqual([
      ['Appliance', [500_000, 0, 0, 300_000]],
      ['Other', [0, 3_000_000, 0, 0]],
      ['Total', [500_000, 3_000_000, 0, 300_000]],
    ]);
    expect(data.series[1].details?.[1]).toMatch(/^CHF\s18.000\.00 spent, CHF\s12.000\.00 planned$/);
  });

  it('hides the investments without items:read (story 8)', async () => {
    setup([subscriptions, items]);
    const { element, kpis } = await render(['finance:read']);
    expect(element.querySelector('app-investments')).toBeNull();
    expect(kpis()[0]).toMatch(/CHF\s85\.00$/);
  });

  it('explains the investments without any and reports a failing capex source', async () => {
    setup([capex('items', { years: [], notes: [] }), capex('vehicles', new Error('offline'))]);
    const { section } = await render(['finance:read', 'items:read']);
    const investments = section('app-investments')!;
    expect(investments.textContent).toContain('No investments with a cost yet');
    expect(investments.querySelector('[role="alert"]')?.textContent).toContain(
      'could not be loaded',
    );
  });
});
