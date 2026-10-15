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
import { CHART_FACTORY, ChartColors, ChartHandle, ChartPeriod } from './utility-chart-config';

/** Colours of the surrounding text, so axes and legend follow light and dark mode. */
function pageColors(element: HTMLElement): ChartColors {
  const text = getComputedStyle(element).color || 'rgb(55, 65, 81)';
  const [red, green, blue] = text.match(/\d+/g) ?? ['55', '65', '81'];
  return { text, grid: `rgba(${red}, ${green}, ${blue}, 0.15)` };
}

/**
 * Bar and line chart of one commodity (R5), drawn in the browser with Chart.js loaded on first use.
 * The canvas is focusable: arrow keys, Home and End step through the periods, showing the tooltip
 * and announcing it; the table next to the chart is its full text alternative.
 */
@Component({
  selector: 'app-utility-chart',
  template: `
    <div class="relative h-64 w-full">
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
    @if (canCompare()) {
      <label class="mt-2 flex items-center gap-2 text-sm">
        <input type="checkbox" [checked]="compare()" (change)="toggleCompare($event)" />
        Compare with the same quarter a year earlier
      </label>
    }
  `,
})
export class UtilityChart {
  private readonly loadFactory = inject(CHART_FACTORY);

  /** Oldest first. */
  readonly periods = input.required<readonly ChartPeriod[]>();
  /** Unit of the amount; `null` draws the cost alone. */
  readonly unit = input.required<string | null>();
  /** Accessible name, e.g. what the chart shows and that the table lists the figures. */
  readonly label = input.required<string>();

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly chart = signal<ChartHandle | undefined>(undefined);
  protected readonly selected = signal<number | undefined>(undefined);
  /** Overlay the year-earlier figures (R8). */
  protected readonly compare = signal(false);
  protected readonly canCompare = computed(() =>
    this.periods().some((period) => period.previous !== null),
  );

  protected readonly announcement = computed(() => {
    const period = this.periods()[this.selected() ?? -1];
    return period ? `${period.label}: ${period.details.join(', ')}` : '';
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
      const periods = this.periods();
      this.chart()?.update(periods, this.unit(), this.compare() && this.canCompare());
      if ((this.selected() ?? -1) >= periods.length) {
        this.selected.set(undefined);
      }
    });
  }

  protected toggleCompare(event: Event): void {
    this.compare.set((event.target as HTMLInputElement).checked);
  }

  protected select(index: number | undefined): void {
    this.selected.set(index);
    this.chart()?.showPeriod(index);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const last = this.periods().length - 1;
    const current = this.selected();
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
        next = current === undefined ? 0 : Math.min(current + 1, last);
        break;
      case 'ArrowLeft':
        next = current === undefined ? last : Math.max(current - 1, 0);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = last;
        break;
      case 'Escape':
        this.select(undefined);
        return;
      default:
        return;
    }
    event.preventDefault();
    if (last >= 0) {
      this.select(next);
    }
  }
}
