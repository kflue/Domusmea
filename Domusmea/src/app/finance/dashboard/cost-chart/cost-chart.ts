import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { pageColors, stepPeriod } from '../../../shared/chart-support';
import { COST_CHART_FACTORY, CostChartData, CostChartHandle, valueText } from './cost-chart-config';

/**
 * Line chart of costs per period and series (R3, R5, R7), drawn with Chart.js loaded on first use.
 * The canvas is focusable: arrow keys, Home and End step through the periods, showing the tooltip
 * and announcing every value; a table next to the chart is its full text alternative.
 */
@Component({
  selector: 'app-cost-chart',
  template: `
    <div class="relative h-72 w-full">
      <canvas
        #canvas
        tabindex="0"
        role="img"
        class="rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        [attr.aria-label]="label() + ' Use the arrow keys to step through the periods.'"
        (keydown)="onKeydown($event)"
        (blur)="select(undefined)"
      ></canvas>
    </div>
    <p class="sr-only" aria-live="polite">{{ announcement() }}</p>
  `,
})
export class CostChart {
  private readonly loadFactory = inject(COST_CHART_FACTORY);

  readonly data = input.required<CostChartData>();
  /** Accessible name: what the chart shows and where the table with the figures is. */
  readonly label = input.required<string>();

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly chart = signal<CostChartHandle | undefined>(undefined);
  protected readonly selected = signal<number | undefined>(undefined);

  protected readonly announcement = computed(() => {
    const { periods, series } = this.data();
    const index = this.selected();
    const period = index === undefined ? undefined : periods[index];
    if (index === undefined || period === undefined) {
      return '';
    }
    return series
      .flatMap((line) => {
        const value = line.values[index];
        const detail = line.details?.[index];
        if (value === null || value === undefined) {
          return [];
        }
        return [valueText(line, period, value) + (detail ? ` (${detail})` : '')];
      })
      .join(', ');
  });

  constructor() {
    let destroyed = false;
    inject(DestroyRef).onDestroy(() => {
      destroyed = true;
      this.chart()?.destroy();
    });
    afterNextRender(async () => {
      const create = await this.loadFactory();
      if (!destroyed) {
        const canvas = this.canvas().nativeElement;
        this.chart.set(create(canvas, pageColors(canvas)));
      }
    });
    effect(() => {
      const data = this.data();
      this.chart()?.update(data);
      if ((this.selected() ?? -1) >= data.periods.length) {
        this.selected.set(undefined);
      }
    });
  }

  protected select(index: number | undefined): void {
    this.selected.set(index);
    this.chart()?.showPeriod(index);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const step = stepPeriod(event.key, this.selected(), this.data().periods.length);
    if (step) {
      event.preventDefault();
      this.select(step.index);
    }
  }
}
