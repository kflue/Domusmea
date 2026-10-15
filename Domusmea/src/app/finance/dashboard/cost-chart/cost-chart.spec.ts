import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CostChart } from './cost-chart';
import {
  COST_CHART_FACTORY,
  costChartConfig,
  CostChartData,
  CostChartHandle,
  SERIES_COLORS,
} from './cost-chart-config';

const data: CostChartData = {
  periods: ['Feb 2026', 'Mar 2026'],
  series: [
    { label: 'Subscriptions', values: [8_000, 8_535] },
    { label: 'Utilities', values: [20_000, null] },
    { label: 'Total', values: [28_000, null], total: true },
  ],
};

describe('costChartConfig', () => {
  const colors = { text: 'rgb(0, 0, 0)', grid: 'rgba(0, 0, 0, 0.15)' };

  it('draws a line with points per series in CHF, the y-axis from 0 (R7)', () => {
    const config = costChartConfig(data, colors);
    expect(config.data.labels).toEqual(['Feb 2026', 'Mar 2026']);
    expect(config.data.datasets.map((d) => [d.label, d.data, d.borderColor])).toEqual([
      ['Subscriptions', [80, 85.35], SERIES_COLORS[0]],
      ['Utilities', [200, null], SERIES_COLORS[1]],
      ['Total', [280, null], colors.text],
    ]);
    expect(config.data.datasets[0]).toMatchObject({ pointRadius: 3, spanGaps: false });
    expect(config.options?.scales?.['y']).toMatchObject({
      beginAtZero: true,
      title: { text: 'CHF' },
    });
  });

  it('shows series, period and exact amount in the tooltip', () => {
    const label = costChartConfig(data, colors).options?.plugins?.tooltip?.callbacks?.label as (
      item: object,
    ) => string;
    expect(label({ datasetIndex: 0, dataIndex: 1 })).toMatch(
      /^Subscriptions · Mar 2026 · CHF\s85\.35$/,
    );
    expect(label({ datasetIndex: 1, dataIndex: 1 })).toBe('');
  });

  it('dashes the line and hollows the points from the first planned period (R5)', () => {
    const planned = costChartConfig({ ...data, plannedFrom: 1 }, colors).data.datasets[0];
    expect(planned.pointBackgroundColor).toEqual([SERIES_COLORS[0], 'rgba(0, 0, 0, 0)']);
    const segment = planned.segment as {
      borderDash: (context: { p1DataIndex: number }) => unknown;
    };
    const dash = segment.borderDash;
    expect(dash({ p1DataIndex: 1 })).toEqual([6, 4]);
    expect(dash({ p1DataIndex: 0 })).toBeUndefined();
  });
});

@Component({
  imports: [CostChart],
  template: `<app-cost-chart [data]="data()" label="Running costs." />`,
})
class Host {
  readonly data = signal(data);
}

describe('CostChart', () => {
  let handle: { [K in keyof CostChartHandle]: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    handle = { update: vi.fn(), showPeriod: vi.fn(), destroy: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: COST_CHART_FACTORY, useValue: () => Promise.resolve(() => handle) }],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
    const canvas = (fixture.nativeElement as HTMLElement).querySelector('canvas')!;
    const press = async (key: string) => {
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key }));
      await fixture.whenStable();
    };
    return { fixture, canvas, press };
  }

  it('draws the data and redraws when it changes', async () => {
    const { fixture } = await render();
    expect(handle.update).toHaveBeenLastCalledWith(data);
    const fewer = { ...data, series: [data.series[0]] };
    fixture.componentInstance.data.set(fewer);
    await fixture.whenStable();
    expect(handle.update).toHaveBeenLastCalledWith(fewer);
  });

  it('steps through the periods with the keyboard and announces every value', async () => {
    const { fixture, canvas, press } = await render();
    expect(canvas.tabIndex).toBe(0);
    expect(canvas.getAttribute('aria-label')).toContain('Running costs.');
    const live = () =>
      (fixture.nativeElement as HTMLElement).querySelector('[aria-live]')?.textContent?.trim();

    await press('End');
    expect(handle.showPeriod).toHaveBeenLastCalledWith(1);
    expect(live()).toMatch(/^Subscriptions · Mar 2026 · CHF\s85\.35$/);
    await press('ArrowLeft');
    expect(live()).toContain('Utilities · Feb 2026');
    expect(live()).toContain('Total · Feb 2026');
    await press('Escape');
    expect(handle.showPeriod).toHaveBeenLastCalledWith(undefined);
    expect(live()).toBe('');
  });

  it('destroys the chart with the component', async () => {
    const { fixture } = await render();
    fixture.destroy();
    expect(handle.destroy).toHaveBeenCalled();
  });
});
