import { Component, computed, inject, input, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import { lastMonths, mrcSummary, OpexCategory, opexChart } from '../../../../shared/finance-totals';
import { formatChf, formatMonth, formatShare } from '../../../../shared/format';
import { CostChart } from '../cost-chart/cost-chart';
import { CostChartData, CostSeries } from '../cost-chart/cost-chart-config';
import { CostTable } from '../cost-table/cost-table';
import { OpexSource } from '../finance-sources';
import { loadAll } from '../finance-sources-loader';

/** Months shown in the running cost chart (R3). */
export const CHART_MONTHS = 24;

/**
 * Running costs on the finance dashboard (R2, R3): the monthly recurring cost now and per month for
 * the last 24 months, a line per opex source.
 */
@Component({
  selector: 'app-running-costs',
  imports: [RouterLink, CostChart, CostTable],
  templateUrl: './running-costs.html',
})
export class RunningCosts {
  /** The opex sources the user may read, in order. */
  readonly sources = input.required<readonly OpexSource[]>();
  /** `YYYY-MM-DD`. */
  readonly today = input.required<string>();

  protected readonly opex = resource({
    params: () => ({ sources: this.sources(), today: this.today() }),
    loader: ({ params }) => loadAll(params.sources, params.today),
  });

  private readonly results = computed(() => (this.opex.hasValue() ? this.opex.value() : []));
  private readonly categories = computed(() =>
    this.results().flatMap(({ source, figures }): OpexCategory[] =>
      figures ? [{ id: source.id, label: source.label, figures }] : [],
    ),
  );
  /** Sources that could not be loaded, each shown with an inline error (R8). */
  protected readonly failed = computed(() =>
    this.results()
      .filter((result) => !result.figures)
      .map((result) => result.source),
  );

  /** The MRC tile (R2), each category linking to its page. */
  protected readonly mrc = computed(() => {
    const summary = mrcSummary(this.categories());
    return {
      total: formatChf(summary.totalRappen),
      categories: summary.categories.map((category) => ({
        id: category.id,
        label: category.label,
        link: this.sources().find((source) => source.id === category.id)?.link ?? '/finance',
        amount: formatChf(category.rappen),
        share: formatShare(category.share),
      })),
      isZero: summary.totalRappen === 0,
    };
  });

  /** The MRC chart (R3): a line per category, plus the total when there are several. */
  protected readonly chart = computed((): CostChartData => {
    const months = lastMonths(this.today(), CHART_MONTHS);
    const chart = opexChart(this.categories(), months);
    const series: CostSeries[] = chart.categories.map(({ label, values }) => ({ label, values }));
    if (series.length > 1) {
      series.push({ label: 'Total', values: chart.total, total: true });
    }
    return { periods: months.map(formatMonth), series };
  });

  /** No running costs at all: show where to enter them (R1). */
  protected readonly isEmpty = computed(
    () => this.mrc().isZero && this.chart().series.length === 0,
  );
}
