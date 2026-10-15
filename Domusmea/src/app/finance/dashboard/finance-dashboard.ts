import { Component, computed, inject, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  lastMonths,
  mrcSummary,
  OpexCategory,
  opexChart,
  OpexFigures,
} from '../../../shared/finance-totals';
import {
  DEFAULT_TIME_ZONE,
  formatChf,
  formatFrancs,
  formatMonth,
  formatShare,
  todayIn,
} from '../../../shared/format';
import { AuthApi } from '../../auth/auth-api';
import { CostChart } from './cost-chart/cost-chart';
import { CostChartData, CostSeries } from './cost-chart/cost-chart-config';
import { FINANCE_SOURCES, OpexSource } from './finance-sources';

/** Months shown in the running cost chart (R3). */
export const CHART_MONTHS = 24;

/** A source after loading; `figures` is `undefined` when it failed. */
interface Loaded<S, F> {
  source: S;
  figures: F | undefined;
}

/** A table row: a period and one formatted cell per chart series. */
interface TableRow {
  period: string;
  cells: string[];
}

/** Loads every source the user may see, in parallel; one failing does not stop the others. */
async function loadAll<S extends { load: (today: string) => Promise<F> }, F>(
  sources: readonly S[],
  today: string,
): Promise<Loaded<S, F>[]> {
  const settled = await Promise.allSettled(sources.map((source) => source.load(today)));
  return sources.map((source, i) => {
    const result = settled[i];
    return { source, figures: result.status === 'fulfilled' ? result.value : undefined };
  });
}

/** Table rows of chart data, newest period first. */
function tableRows(data: CostChartData): TableRow[] {
  return data.periods
    .map((period, i) => ({
      period,
      cells: data.series.map((series) => {
        const value = series.values[i];
        return value === null || value === undefined ? '–' : formatFrancs(value);
      }),
    }))
    .reverse();
}

/**
 * The finance dashboard at `/finance` (ADR 0013): the monthly recurring cost now and over the last
 * 24 months, per category. Categories come from the sources registered with
 * `provideFinanceSource(...)`; this component only combines and draws their figures.
 */
@Component({
  selector: 'app-finance-dashboard',
  imports: [RouterLink, CostChart],
  templateUrl: './finance-dashboard.html',
})
export class FinanceDashboard {
  private readonly auth = inject(AuthApi);
  private readonly sources = [...inject(FINANCE_SOURCES)].sort((a, b) => a.order - b.order);
  private readonly today = todayIn(DEFAULT_TIME_ZONE);
  private readonly months = lastMonths(this.today, CHART_MONTHS);

  /** Opex sources the user's role may read (R8). */
  protected readonly opexSources = computed(() =>
    this.sources.filter(
      (source): source is OpexSource => source.kind === 'opex' && this.auth.can(source.permission),
    ),
  );

  protected readonly opex = resource({
    params: () => this.opexSources(),
    loader: ({ params }) => loadAll<OpexSource, OpexFigures>(params, this.today),
  });

  private readonly opexResults = computed(() => (this.opex.hasValue() ? this.opex.value() : []));
  private readonly opexCategories = computed(() =>
    this.opexResults().flatMap(({ source, figures }): OpexCategory[] =>
      figures ? [{ id: source.id, label: source.label, figures }] : [],
    ),
  );
  /** Sources that could not be loaded, each shown with an inline error (R8). */
  protected readonly opexFailed = computed(() =>
    this.opexResults()
      .filter((result) => !result.figures)
      .map((result) => result.source),
  );

  /** The MRC tile (R2), each category linking to its page. */
  protected readonly mrc = computed(() => {
    const summary = mrcSummary(this.opexCategories());
    return {
      total: formatChf(summary.totalRappen),
      categories: summary.categories.map((category) => ({
        id: category.id,
        label: category.label,
        link: this.sources.find((source) => source.id === category.id)?.link ?? '/finance',
        amount: formatChf(category.rappen),
        share: formatShare(category.share),
      })),
      isZero: summary.totalRappen === 0,
    };
  });

  /** The MRC chart (R3): a line per category, plus the total when there are several. */
  protected readonly opexChart = computed((): CostChartData => {
    const chart = opexChart(this.opexCategories(), this.months);
    const series: CostSeries[] = chart.categories.map(({ label, values }) => ({ label, values }));
    if (series.length > 1) {
      series.push({ label: 'Total', values: chart.total, total: true });
    }
    return { periods: this.months.map(formatMonth), series };
  });
  protected readonly opexRows = computed(() => tableRows(this.opexChart()));

  /** No running costs at all: show where to enter them (R1). */
  protected readonly opexEmpty = computed(
    () =>
      this.opex.hasValue() &&
      this.opexFailed().length === 0 &&
      this.mrc().isZero &&
      this.opexChart().series.length === 0,
  );
}
