import { Component, computed, input, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  capexChart,
  capexSummary,
  CapexSeries,
  CapexYear,
} from '../../../../shared/finance-totals';
import { formatChf } from '../../../../shared/format';
import { CostChart } from '../cost-chart/cost-chart';
import { CostChartData, CostSeries } from '../cost-chart/cost-chart-config';
import { CostTable } from '../cost-table/cost-table';
import { CapexSource } from '../finance-sources';
import { loadAll } from '../finance-sources-loader';

/**
 * Investments on the finance dashboard (R4, R5): this year spent and planned, the plan for the next
 * years, and a line per capex category from past to planned years.
 */
@Component({
  selector: 'app-investments',
  imports: [RouterLink, CostChart, CostTable],
  templateUrl: './investments.html',
})
export class Investments {
  /** The capex sources the user may read, in order. */
  readonly sources = input.required<readonly CapexSource[]>();
  /** `YYYY-MM-DD`. */
  readonly today = input.required<string>();

  protected readonly capex = resource({
    params: () => ({ sources: this.sources(), today: this.today() }),
    loader: ({ params }) => loadAll(params.sources, params.today),
  });

  private readonly results = computed(() => (this.capex.hasValue() ? this.capex.value() : []));
  /** Rows of all sources; category keys get the source id so two sources never merge. */
  private readonly rows = computed(() =>
    this.results().flatMap(({ source, figures }): CapexYear[] =>
      (figures?.years ?? []).map((row) => ({ ...row, category: `${source.id}:${row.category}` })),
    ),
  );
  protected readonly notes = computed(() =>
    this.results().flatMap(({ figures }) => figures?.notes ?? []),
  );
  /** Sources that could not be loaded, each shown with an inline error (R8). */
  protected readonly failed = computed(() =>
    this.results()
      .filter((result) => !result.figures)
      .map((result) => result.source),
  );

  /** The investments tile (R4). */
  protected readonly summary = computed(() => {
    const summary = capexSummary(this.rows(), this.today());
    return {
      year: summary.year,
      total: formatChf(summary.spentRappen + summary.plannedRappen),
      spent: formatChf(summary.spentRappen),
      planned: formatChf(summary.plannedRappen),
      nextYears: `${summary.nextYears.from}–${summary.nextYears.to}`,
      nextYearsPlanned: formatChf(summary.nextYears.plannedRappen),
    };
  });

  /** The chart (R5): planned years dashed with hollow points; the current year's tooltip splits. */
  protected readonly chart = computed((): CostChartData => {
    const chart = capexChart(this.rows(), this.today());
    const toSeries = (series: CapexSeries, total = false): CostSeries => ({
      label: series.label,
      values: series.values,
      total,
      details: series.values.map((_, i) =>
        i === chart.currentIndex
          ? `${formatChf(series.spent[i])} spent, ${formatChf(series.planned[i])} planned`
          : undefined,
      ),
    });
    const series = chart.categories.map((category) => toSeries(category));
    if (series.length > 1) {
      series.push(toSeries(chart.total, true));
    }
    return { periods: chart.years, series, plannedFrom: chart.plannedFrom };
  });

  /** No investments with a cost: show where to enter them. */
  protected readonly isEmpty = computed(() => this.rows().length === 0);
}
