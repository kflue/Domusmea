import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UtilityChart } from './utility-chart';
import { CHART_FACTORY, chartConfig, ChartHandle, ChartPeriod } from './utility-chart-config';

const periods: ChartPeriod[] = [
  {
    label: 'Q1 2026',
    amount: 900,
    cost: 270.5,
    previous: null,
    details: ['Amount: 900 kWh', 'Cost: CHF 270.50'],
  },
  {
    label: 'Q2 2026',
    amount: 812.5,
    cost: 248.19,
    previous: { amount: 780, cost: 236 },
    details: ['Amount: 812.5 kWh'],
  },
];

describe('chartConfig', () => {
  const colors = { text: 'rgb(0, 0, 0)', grid: 'rgba(0, 0, 0, 0.15)' };

  it('draws the amount as bars and the cost as a line on a second axis', () => {
    const config = chartConfig(periods, 'kWh', colors);
    expect(config.data.labels).toEqual(['Q1 2026', 'Q2 2026']);
    expect(config.data.datasets.map((d) => [d.type, d.yAxisID, d.data])).toEqual([
      ['bar', 'amount', [900, 812.5]],
      ['line', 'cost', [270.5, 248.19]],
    ]);
    expect(Object.keys(config.options?.scales ?? {})).toEqual(['x', 'amount', 'cost']);
  });

  it('overlays the year before as outlined bars and a dashed line', () => {
    const config = chartConfig(periods, 'kWh', colors, true);
    expect(config.data.datasets.map((d) => [d.type, d.label, d.data])).toEqual([
      ['bar', 'Amount a year earlier (kWh)', [null, 780]],
      ['bar', 'Amount (kWh)', [900, 812.5]],
      ['line', 'Cost (CHF)', [270.5, 248.19]],
      ['line', 'Cost a year earlier (CHF)', [null, 236]],
    ]);
    expect(config.data.datasets[3]).toMatchObject({ borderDash: [6, 4] });
    const filter = config.options?.plugins?.tooltip?.filter as (item: object) => boolean;
    expect(filter({ datasetIndex: 1 })).toBe(true);
    expect(filter({ datasetIndex: 0 })).toBe(false);
    expect(chartConfig(periods, null, colors, true).data.datasets.map((d) => d.label)).toEqual([
      'Cost a year earlier (CHF)',
      'Cost (CHF)',
    ]);
  });

  it('draws the cost alone as bars without a unit', () => {
    const config = chartConfig(periods, null, colors);
    expect(config.data.datasets.map((d) => [d.type, d.yAxisID])).toEqual([['bar', 'cost']]);
    expect(Object.keys(config.options?.scales ?? {})).toEqual(['x', 'cost']);
  });
});

@Component({
  imports: [UtilityChart],
  template: `<app-utility-chart [periods]="periods()" unit="kWh" label="Electricity." />`,
})
class Host {
  readonly periods = signal(periods);
}

describe('UtilityChart', () => {
  let handle: { [K in keyof ChartHandle]: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    handle = { update: vi.fn(), showPeriod: vi.fn(), destroy: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: CHART_FACTORY, useValue: () => Promise.resolve(() => handle) }],
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

  it('draws the periods and redraws when they change', async () => {
    const { fixture } = await render();
    expect(handle.update).toHaveBeenLastCalledWith(periods, 'kWh', false);
    fixture.componentInstance.periods.set([periods[0]]);
    await fixture.whenStable();
    expect(handle.update).toHaveBeenLastCalledWith([periods[0]], 'kWh', false);
  });

  it('overlays the year before when asked, if there is one', async () => {
    const { fixture } = await render();
    const element = fixture.nativeElement as HTMLElement;
    const checkbox = element.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    expect(checkbox.parentElement?.textContent).toContain('same quarter a year earlier');
    checkbox.click();
    await fixture.whenStable();
    expect(handle.update).toHaveBeenLastCalledWith(periods, 'kWh', true);

    fixture.componentInstance.periods.set([periods[0]]);
    await fixture.whenStable();
    expect(element.querySelector('input[type="checkbox"]')).toBeNull();
    expect(handle.update).toHaveBeenLastCalledWith([periods[0]], 'kWh', false);
  });

  it('is focusable and steps through the periods with the keyboard, announcing each', async () => {
    const { fixture, canvas, press } = await render();
    expect(canvas.tabIndex).toBe(0);
    expect(canvas.getAttribute('aria-label')).toContain('Electricity.');
    const live = () => fixture.nativeElement.querySelector('[aria-live]')?.textContent?.trim();

    await press('ArrowRight');
    expect(handle.showPeriod).toHaveBeenLastCalledWith(0);
    expect(live()).toBe('Q1 2026: Amount: 900 kWh, Cost: CHF 270.50');
    await press('End');
    expect(handle.showPeriod).toHaveBeenLastCalledWith(1);
    await press('ArrowRight');
    expect(handle.showPeriod).toHaveBeenLastCalledWith(1);
    await press('Home');
    expect(handle.showPeriod).toHaveBeenLastCalledWith(0);
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
