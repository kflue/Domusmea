import { Component, computed, input } from '@angular/core';
import { formatFrancs } from '../../../../shared/format';
import { CostChartData } from '../cost-chart/cost-chart-config';

/**
 * The figures of a cost chart as a table, newest period first, collapsed by default: the chart's
 * text alternative (R7).
 */
@Component({
  selector: 'app-cost-table',
  template: `
    <details class="mb-2">
      <summary class="cursor-pointer text-sm text-blue-700 underline">{{ summary() }}</summary>
      <div class="mt-2 overflow-x-auto">
        <table class="w-full border-collapse text-left">
          <caption class="sr-only">
            {{
              caption()
            }}
          </caption>
          <thead>
            <tr class="border-b border-gray-300">
              <th scope="col" class="p-2">{{ periodHeader() }}</th>
              @for (series of data().series; track series.label) {
                <th scope="col" class="p-2 text-right">{{ series.label }} (CHF)</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.period) {
              <tr class="border-b border-gray-200">
                <th scope="row" class="p-2 font-medium whitespace-nowrap">{{ row.period }}</th>
                @for (cell of row.cells; track $index) {
                  <td class="p-2 text-right whitespace-nowrap tabular-nums">{{ cell }}</td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
    </details>
  `,
})
export class CostTable {
  readonly data = input.required<CostChartData>();
  /** Text of the toggle, e.g. `Figures per month`. */
  readonly summary = input.required<string>();
  readonly caption = input.required<string>();
  /** Header of the first column, e.g. `Month`. */
  readonly periodHeader = input.required<string>();

  protected readonly rows = computed(() => {
    const data = this.data();
    return data.periods
      .map((period, i) => ({
        period:
          data.plannedFrom !== undefined && i >= data.plannedFrom ? `${period} (planned)` : period,
        cells: data.series.map((series) => {
          const value = series.values[i];
          return value === null || value === undefined ? '–' : formatFrancs(value);
        }),
      }))
      .reverse();
  });
}
