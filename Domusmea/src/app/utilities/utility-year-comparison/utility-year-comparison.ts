import { Component, computed, input } from '@angular/core';
import { formatAmount, formatFrancs, formatPercentChange } from '../../../shared/format';
import { COMMODITIES, COMMODITY_INFO, UtilityEntry } from '../../../shared/utility';
import { yearOverYear } from '../../../shared/utility-costs';

interface ComparisonRow {
  commodity: string;
  /** `Q1–Q3`, or `Q1, Q2, Q4` with gaps. */
  quarters: string;
  amount: string;
  amountChange: string;
  cost: string;
  costChange: string;
}

interface YearGroup {
  year: string;
  rows: ComparisonRow[];
}

/** `[1, 2, 3]` → `Q1–Q3`, `[2]` → `Q2`, `[1, 2, 4]` → `Q1, Q2, Q4`. */
export function quarterRange(quarters: readonly number[]): string {
  const first = quarters[0];
  const last = quarters.at(-1) ?? first;
  if (quarters.length === last - first + 1) {
    return first === last ? `Q${first}` : `Q${first}–Q${last}`;
  }
  return quarters.map((quarter) => `Q${quarter}`).join(', ');
}

const change = (percent: number | undefined) =>
  percent === undefined ? '–' : formatPercentChange(percent);

/**
 * Totals per year and commodity with the change against the same quarters of the year before (R8,
 * ADR 0012), newest year first.
 */
@Component({
  selector: 'app-utility-year-comparison',
  template: `
    <div class="overflow-x-auto">
      <table class="w-full border-collapse text-left">
        <caption class="sr-only">
          Totals per year and commodity, newest year first, with the change against the same
          quarters of the year before
        </caption>
        <thead>
          <tr class="border-b border-gray-300">
            <th scope="col" class="p-2">Year</th>
            <th scope="col" class="p-2">Commodity</th>
            <th scope="col" class="p-2">Quarters</th>
            <th scope="col" class="p-2 text-right">Amount</th>
            <th scope="col" class="p-2 text-right">Change</th>
            <th scope="col" class="p-2 text-right">Cost (CHF)</th>
            <th scope="col" class="p-2 text-right">Change</th>
          </tr>
        </thead>
        @for (group of years(); track group.year) {
          <tbody class="border-b border-gray-300">
            @for (row of group.rows; track row.commodity; let first = $first) {
              <tr class="border-b border-gray-200 last:border-0">
                @if (first) {
                  <th scope="rowgroup" class="p-2 align-top" [rowSpan]="group.rows.length">
                    {{ group.year }}
                  </th>
                }
                <th scope="row" class="p-2 font-medium">{{ row.commodity }}</th>
                <td class="p-2 whitespace-nowrap">{{ row.quarters }}</td>
                <td class="p-2 text-right whitespace-nowrap tabular-nums">{{ row.amount }}</td>
                <td class="p-2 text-right whitespace-nowrap tabular-nums">
                  {{ row.amountChange }}
                </td>
                <td class="p-2 text-right whitespace-nowrap tabular-nums">{{ row.cost }}</td>
                <td class="p-2 text-right whitespace-nowrap tabular-nums">{{ row.costChange }}</td>
              </tr>
            }
          </tbody>
        }
      </table>
    </div>
    <p class="mt-2 text-sm text-gray-600">
      Each year is compared with the same quarters of the year before; “–” means a quarter is
      missing there. A bill counts towards the quarter in which its period ends.
    </p>
  `,
})
export class UtilityYearComparison {
  readonly entries = input.required<readonly UtilityEntry[]>();

  protected readonly years = computed<YearGroup[]>(() => {
    const groups = new Map<string, ComparisonRow[]>();
    for (const commodity of COMMODITIES) {
      const info = COMMODITY_INFO[commodity];
      for (const year of yearOverYear(this.entries(), commodity)) {
        const row: ComparisonRow = {
          commodity: info.label,
          quarters: quarterRange(year.quarters),
          amount:
            info.unit === null || year.amountMilli === null
              ? ''
              : `${formatAmount(year.amountMilli)} ${info.unit}`,
          amountChange: info.unit === null ? '' : change(year.amountChange),
          cost: formatFrancs(year.totalRappen),
          costChange: change(year.costChange),
        };
        groups.set(year.year, [...(groups.get(year.year) ?? []), row]);
      }
    }
    return [...groups]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([year, rows]) => ({ year, rows }));
  });
}
