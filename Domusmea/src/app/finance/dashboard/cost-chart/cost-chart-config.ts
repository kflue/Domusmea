import { InjectionToken } from '@angular/core';
import type { ChartConfiguration, PointStyle } from 'chart.js';
import { formatChf } from '../../../../shared/format';
import { ChartColors } from '../../../shared/chart-support';

/** One line of a cost chart. */
export interface CostSeries {
  label: string;
  /** Rappen per period; `null` draws no point (a gap). */
  values: readonly (number | null)[];
  /** The total over all categories: drawn in the text colour, thicker. */
  total?: boolean;
  /** Extra tooltip line per period, e.g. how a year splits into spent and planned. */
  details?: readonly (string | undefined)[];
}

/** What a cost chart draws: a value per period and series, in Rappen. */
export interface CostChartData {
  /** X-axis labels, oldest first, e.g. `Mar 2026` or `2027`. */
  periods: readonly string[];
  series: readonly CostSeries[];
  /**
   * Index of the first planned period (ADR 0013): from there on lines are dashed and points hollow,
   * so shape and not only colour tells plans from money spent. `undefined`: nothing is planned.
   */
  plannedFrom?: number;
}

/**
 * Category colours in legend order, each at least 3:1 against white and Tailwind gray-950
 * (WCAG 1.4.11): blue-500, amber-600, emerald-600, rose-500, violet-500, cyan-600, lime-700,
 * fuchsia-600. A new source takes the next one; chart code does not change.
 */
export const SERIES_COLORS = [
  '#3b82f6',
  '#d97706',
  '#059669',
  '#f43f5e',
  '#8b5cf6',
  '#0891b2',
  '#4d7c0f',
  '#c026d3',
] as const;

/** Point styles in the same order, so series differ in shape too; the total uses circles. */
export const SERIES_POINT_STYLES: readonly PointStyle[] = [
  'rect',
  'triangle',
  'rectRot',
  'star',
  'crossRot',
  'rectRounded',
  'cross',
  'circle',
];

/** A drawn chart; Chart.js stays behind this so it can be loaded lazily (ADR 0011). */
export interface CostChartHandle {
  update(data: CostChartData): void;
  /** Shows the tooltip of the period at `index`, or hides it. */
  showPeriod(index: number | undefined): void;
  destroy(): void;
}

export type CostChartFactory = (canvas: HTMLCanvasElement, colors: ChartColors) => CostChartHandle;

/** Loads Chart.js on first use, in the browser only. Tests provide a fake. */
export const COST_CHART_FACTORY = new InjectionToken<() => Promise<CostChartFactory>>(
  'COST_CHART_FACTORY',
  {
    providedIn: 'root',
    factory: () => () => import('./cost-chart-loader').then((m) => m.createCostChart),
  },
);

/** Tooltip and announcement text of one value, e.g. `Subscriptions · Mar 2026 · CHF 85.35`. */
export function valueText(series: CostSeries, period: string, rappen: number): string {
  return `${series.label} · ${period} · ${formatChf(rappen)}`;
}

type CostChartConfiguration = ChartConfiguration<'line', (number | null)[], string>;
type CostDataset = CostChartConfiguration['data']['datasets'][number];

function dataset(
  series: CostSeries,
  color: string,
  pointStyle: PointStyle,
  plannedFrom: number,
): CostDataset {
  const hollow = series.values.map((_, i) => (i >= plannedFrom ? 'rgba(0, 0, 0, 0)' : color));
  return {
    label: series.label,
    data: series.values.map((value) => (value === null ? null : value / 100)),
    borderColor: color,
    backgroundColor: color,
    pointBackgroundColor: hollow,
    pointBorderColor: color,
    pointStyle,
    pointRadius: series.total ? 4 : 3,
    pointHoverRadius: series.total ? 7 : 6,
    pointBorderWidth: 2,
    borderWidth: series.total ? 3 : 2,
    spanGaps: false,
    segment: {
      borderDash: (context) => (context.p1DataIndex >= plannedFrom ? [6, 4] : undefined),
    },
  };
}

/**
 * Chart.js configuration of a cost chart (R3, R5, R7): a line with a point on every value per
 * series, the y-axis in CHF from 0, and a tooltip per period listing the exact amounts.
 */
export function costChartConfig(data: CostChartData, colors: ChartColors): CostChartConfiguration {
  const plannedFrom = data.plannedFrom ?? Number.POSITIVE_INFINITY;
  let category = 0;
  const datasets = data.series.map((series) => {
    if (series.total) {
      return dataset(series, colors.text, 'circle', plannedFrom);
    }
    const index = category++;
    return dataset(
      series,
      SERIES_COLORS[index % SERIES_COLORS.length],
      SERIES_POINT_STYLES[index % SERIES_POINT_STYLES.length],
      plannedFrom,
    );
  });
  return {
    type: 'line',
    data: { labels: [...data.periods], datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { ticks: { color: colors.text }, grid: { color: colors.grid } },
        y: {
          type: 'linear',
          beginAtZero: true,
          title: { display: true, text: 'CHF', color: colors.text },
          ticks: { color: colors.text },
          grid: { color: colors.grid },
        },
      },
      plugins: {
        legend: { labels: { color: colors.text, usePointStyle: true } },
        tooltip: {
          usePointStyle: true,
          callbacks: {
            title: () => '',
            label: (item) => {
              const series = data.series[item.datasetIndex];
              const rappen = series?.values[item.dataIndex];
              if (!series || rappen === null || rappen === undefined) {
                return '';
              }
              const detail = series.details?.[item.dataIndex];
              const text = valueText(series, data.periods[item.dataIndex] ?? '', rappen);
              return detail ? [text, detail] : text;
            },
          },
        },
      },
    },
  };
}
