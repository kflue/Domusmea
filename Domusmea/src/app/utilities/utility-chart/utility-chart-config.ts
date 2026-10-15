import { InjectionToken } from '@angular/core';
import type { ChartConfiguration } from 'chart.js';
import { ChartColors } from '../../shared/chart-support';

/** One billing period as drawn in the chart, oldest first. */
export interface ChartPeriod {
  /** X-axis label, e.g. `Q3 2026`. */
  label: string;
  /** Amount in the unit, or `null` for commodities without one. */
  amount: number | null;
  /** Total cost in CHF. */
  cost: number;
  /** The same quarter a year earlier, for the overlay (R8); `null` if there is none. */
  previous: { amount: number | null; cost: number } | null;
  /** Tooltip lines: amount, cost and price per unit. */
  details: string[];
}

/**
 * Series colours, at least 3:1 against both a white and a near-black background (WCAG 1.4.11):
 * Tailwind blue-500 for the amount, amber-600 for the cost.
 */
export const AMOUNT_COLOR = '#3b82f6';
export const COST_COLOR = '#d97706';
/** Fill of the year-earlier bars; their outline in the series colour carries the contrast. */
const PREVIOUS_AMOUNT_FILL = 'rgba(59, 130, 246, 0.25)';
const PREVIOUS_COST_FILL = 'rgba(217, 119, 6, 0.25)';

/** A drawn chart; Chart.js stays behind this so it can be loaded lazily (ADR 0011). */
export interface ChartHandle {
  /**
   * Replaces the data; `unit` `null` draws the cost as bars on a single axis. `compare` overlays
   * the same quarter a year earlier.
   */
  update(periods: readonly ChartPeriod[], unit: string | null, compare: boolean): void;
  /** Shows the tooltip of the period at `index`, or hides it. */
  showPeriod(index: number | undefined): void;
  destroy(): void;
}

export type ChartFactory = (canvas: HTMLCanvasElement, colors: ChartColors) => ChartHandle;

/** Loads Chart.js on first use, in the browser only. Tests provide a fake. */
export const CHART_FACTORY = new InjectionToken<() => Promise<ChartFactory>>('CHART_FACTORY', {
  providedIn: 'root',
  factory: () => () => import('./chart-loader').then((m) => m.createChart),
});

/**
 * Index of the dataset that carries the tooltip and keyboard selection: the current period's bars,
 * which follow the year-earlier bars when comparing.
 */
export function mainDatasetIndex(compare: boolean): number {
  return compare ? 1 : 0;
}

type UtilityChartConfiguration = ChartConfiguration<'bar' | 'line', (number | null)[], string>;
type UtilityDataset = UtilityChartConfiguration['data']['datasets'][number];

/**
 * The series, the main one at {@link mainDatasetIndex}: the cost as bars without a unit, otherwise
 * the amount as bars and the cost as a line; with `compare`, the year-earlier series around them.
 */
function datasets(
  periods: readonly ChartPeriod[],
  unit: string | null,
  compare: boolean,
): UtilityDataset[] {
  const cost = {
    label: 'Cost (CHF)',
    data: periods.map((period) => period.cost),
    yAxisID: 'cost',
    backgroundColor: COST_COLOR,
    borderColor: COST_COLOR,
  };
  const earlierCost = {
    ...cost,
    label: 'Cost a year earlier (CHF)',
    data: periods.map((period) => period.previous?.cost ?? null),
  };
  if (unit === null) {
    const bars: UtilityDataset[] = [{ ...cost, type: 'bar' }];
    if (compare) {
      bars.unshift({
        ...earlierCost,
        type: 'bar',
        backgroundColor: PREVIOUS_COST_FILL,
        borderWidth: 2,
      });
    }
    return bars;
  }
  const series: UtilityDataset[] = [
    {
      type: 'bar',
      label: `Amount (${unit})`,
      data: periods.map((period) => period.amount),
      yAxisID: 'amount',
      backgroundColor: AMOUNT_COLOR,
      // Chart.js places bars by `order`: the year-earlier bar (2) left of the current one.
      order: 3,
    },
    { ...cost, type: 'line', pointRadius: 4, borderWidth: 2, order: 1 },
  ];
  if (compare) {
    series.unshift({
      type: 'bar',
      label: `Amount a year earlier (${unit})`,
      data: periods.map((period) => period.previous?.amount ?? null),
      yAxisID: 'amount',
      backgroundColor: PREVIOUS_AMOUNT_FILL,
      borderColor: AMOUNT_COLOR,
      borderWidth: 2,
      order: 2,
    });
    series.push({
      ...earlierCost,
      type: 'line',
      borderDash: [6, 4],
      pointStyle: 'rectRot',
      pointRadius: 4,
      borderWidth: 2,
      order: 0,
    });
  }
  return series;
}

/**
 * Chart.js configuration: the amount per period as bars on the left axis and the cost as a line on
 * the right one, oldest period left (R5). Without a unit (garbage) the cost is drawn as bars alone.
 */
export function chartConfig(
  periods: readonly ChartPeriod[],
  unit: string | null,
  colors: ChartColors,
  compare = false,
): UtilityChartConfiguration {
  const costAsBars = unit === null;
  const main = mainDatasetIndex(compare);
  const axis = (title: string, position: 'left' | 'right', drawGrid: boolean) => ({
    type: 'linear' as const,
    position,
    beginAtZero: true,
    title: { display: true, text: title, color: colors.text },
    ticks: { color: colors.text },
    grid: { color: colors.grid, drawOnChartArea: drawGrid },
  });
  return {
    type: 'bar',
    data: {
      labels: periods.map((period) => period.label),
      datasets: datasets(periods, unit, compare),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { ticks: { color: colors.text }, grid: { color: colors.grid } },
        ...(costAsBars ? {} : { amount: axis(`Amount (${unit})`, 'left', true) }),
        cost: axis('Cost (CHF)', costAsBars ? 'left' : 'right', costAsBars),
      },
      plugins: {
        legend: { labels: { color: colors.text } },
        tooltip: {
          // One block per period, not one per series.
          filter: (item) => item.datasetIndex === main,
          callbacks: {
            title: (items) => periods[items[0]?.dataIndex ?? 0]?.label ?? '',
            label: (item) => periods[item.dataIndex]?.details ?? '',
          },
        },
      },
    },
  };
}
