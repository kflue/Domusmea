import { DOCUMENT } from '@angular/common';
import { afterNextRender, Component, computed, inject, Injector, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  formatAmount,
  formatChf,
  formatDate,
  formatFrancs,
  formatUnitPrice,
} from '../../../shared/format';
import {
  Commodity,
  COMMODITIES,
  COMMODITY_INFO,
  CommodityInfo,
  UtilityEntry,
} from '../../../shared/utility';
import {
  calendarQuarter,
  entriesOf,
  lastTwelveBilledMonths,
  paidRappen,
  rappenPerUnit,
  sameQuarterYearBefore,
  totalRappen,
  UsageTotal,
  yearTotals,
} from '../../../shared/utility-costs';
import { AuthApi } from '../../auth/auth-api';
import { ConfirmDelete } from '../../shared/confirm-delete';
import { UtilitiesApi } from '../utilities-api';
import { UtilityChart } from '../utility-chart/utility-chart';
import { ChartPeriod } from '../utility-chart/utility-chart-config';
import { UtilityYearComparison } from '../utility-year-comparison/utility-year-comparison';

/** A table row: an entry or the total of a year; `cells` follow the section's `columns`. */
interface TableRow {
  key: string;
  /** `Q3 2026`, the dates of an irregular period, or `Total 2026`. */
  period: string;
  /** The dates of a quarter, shown below its name. */
  dates: string;
  cells: string[];
  /** `Invoice 2026-0815`; empty without one or on total rows. */
  invoice: string;
  notes: string;
  /** The entry for edit and delete; absent on total rows. */
  entry?: UtilityEntry;
}

interface CommoditySection {
  commodity: Commodity;
  info: CommodityInfo;
  /** Column headers after "Period", with units. */
  columns: string[];
  rows: TableRow[];
  /** Oldest first. */
  chart: ChartPeriod[];
  chartLabel: string;
}

function periodName(entry: UtilityEntry): { period: string; dates: string } {
  const dates = `${formatDate(entry.periodFrom)} – ${formatDate(entry.periodTo)}`;
  const quarter = calendarQuarter(entry.periodFrom, entry.periodTo);
  return quarter ? { period: quarter, dates } : { period: dates, dates: '' };
}

/** Column headers and cell values for a commodity: metered ones with amount, cost and price. */
function columnsFor(info: CommodityInfo): string[] {
  if (info.unit === null) {
    return ['Cost (CHF)'];
  }
  return [
    `Amount (${info.unit})`,
    'Usage cost (CHF)',
    ...(info.hasFixedFee ? ['Fixed fee (CHF)', 'Total (CHF)'] : []),
    `Price (CHF/${info.unit})`,
  ];
}

function cellsFor(
  info: CommodityInfo,
  figures: { amountMilli: number | null; costRappen: number; fixedFeeRappen: number },
): string[] {
  const total = figures.costRappen + figures.fixedFeeRappen;
  if (info.unit === null) {
    return [formatFrancs(total)];
  }
  const price = rappenPerUnit(figures.costRappen, figures.amountMilli);
  return [
    figures.amountMilli === null ? '' : formatAmount(figures.amountMilli),
    formatFrancs(figures.costRappen),
    ...(info.hasFixedFee ? [formatFrancs(figures.fixedFeeRappen), formatFrancs(total)] : []),
    price === undefined ? '' : formatUnitPrice(price),
  ];
}

/** Tooltip lines of an entry: amount, cost and price per unit, and the year before if known. */
function chartDetails(
  info: CommodityInfo,
  entry: UtilityEntry,
  previous: UsageTotal | undefined,
): string[] {
  const cost = `Cost: ${formatChf(totalRappen(entry))}`;
  const earlier = previous && [
    `A year earlier: ${[
      ...(info.unit !== null && previous.amountMilli !== null
        ? [`${formatAmount(previous.amountMilli)} ${info.unit}`]
        : []),
      formatChf(previous.totalRappen),
    ].join(', ')}`,
  ];
  if (info.unit === null || entry.amountMilli === null) {
    return [cost, ...(earlier ?? [])];
  }
  const price = rappenPerUnit(entry.costRappen, entry.amountMilli);
  return [
    `Amount: ${formatAmount(entry.amountMilli)} ${info.unit}`,
    cost,
    ...(price === undefined ? [] : [`Price: CHF ${formatUnitPrice(price)}/${info.unit}`]),
    ...(earlier ?? []),
  ];
}

function toSection(entries: readonly UtilityEntry[], commodity: Commodity): CommoditySection {
  const info = COMMODITY_INFO[commodity];
  const rows = yearTotals(entries, commodity).flatMap((year): TableRow[] => [
    ...year.entries.map((entry) => ({
      key: String(entry.id),
      ...periodName(entry),
      cells: cellsFor(info, entry),
      invoice: entry.invoiceNumber ? `Invoice ${entry.invoiceNumber}` : '',
      notes: entry.notes ?? '',
      entry,
    })),
    {
      key: `total-${year.year}`,
      period: `Total ${year.year}`,
      dates: '',
      cells: cellsFor(info, year),
      invoice: '',
      notes: '',
    },
  ]);
  const chart = entriesOf(entries, commodity)
    .reverse()
    .map((entry): ChartPeriod => {
      const previous = sameQuarterYearBefore(entries, entry);
      return {
        label: periodName(entry).period,
        amount: entry.amountMilli === null ? null : entry.amountMilli / 1000,
        cost: totalRappen(entry) / 100,
        previous: previous
          ? {
              amount: previous.amountMilli === null ? null : previous.amountMilli / 1000,
              cost: previous.totalRappen / 100,
            }
          : null,
        details: chartDetails(info, entry, previous),
      };
    });
  const shown = info.unit === null ? 'Cost' : `Amount (${info.unit}) as bars and cost as a line`;
  return {
    commodity,
    info,
    columns: columnsFor(info),
    rows,
    chart,
    chartLabel: `${info.label}: ${shown} per billing period, oldest first. The table below lists the same figures.`,
  };
}

/**
 * Utility bills per commodity (`/utilities`, ADR 0011): a chart and a table per commodity with a
 * total per calendar year. Users without `finance:write` see no add, edit or delete controls.
 */
@Component({
  selector: 'app-utility-overview',
  imports: [RouterLink, ConfirmDelete, UtilityChart, UtilityYearComparison],
  templateUrl: './utility-overview.html',
})
export class UtilityOverview {
  private readonly api = inject(UtilitiesApi);
  private readonly auth = inject(AuthApi);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  protected readonly list = this.api.list;
  protected readonly canWrite = computed(() => this.auth.can('finance:write'));
  protected readonly entries = computed(() => (this.list.hasValue() ? this.list.value() : []));
  protected readonly sections = computed(() =>
    COMMODITIES.map((commodity) => toSection(this.entries(), commodity)),
  );
  protected readonly isEmpty = computed(() => this.entries().length === 0);

  /** Cost of the last twelve billed months, together and per commodity (R9). */
  protected readonly lastTwelveMonths = computed(() => {
    const entries = this.entries();
    const range = lastTwelveBilledMonths(entries);
    if (!range) {
      return undefined;
    }
    const cost = (list: readonly UtilityEntry[]) =>
      formatChf(paidRappen(list, range.from, range.to));
    return {
      range: `${formatDate(range.from)} – ${formatDate(range.to)}`,
      total: cost(entries),
      commodities: COMMODITIES.filter((c) => entries.some((e) => e.commodity === c)).map((c) => ({
        label: COMMODITY_INFO[c].label,
        cost: cost(entries.filter((e) => e.commodity === c)),
      })),
    };
  });

  protected readonly deleteError = signal('');

  /** Accessible name of an entry, e.g. `Electricity Q3 2026`. */
  protected entryName(section: CommoditySection, row: TableRow): string {
    return `${section.info.label} ${row.period}`;
  }

  protected async delete(section: CommoditySection, row: TableRow): Promise<void> {
    if (!row.entry) {
      return;
    }
    this.deleteError.set('');
    try {
      await this.api.delete(row.entry.id);
      // The row is gone; keep keyboard focus nearby.
      afterNextRender(() => this.document.getElementById(`${section.commodity}-heading`)?.focus(), {
        injector: this.injector,
      });
    } catch {
      this.deleteError.set(
        `“${this.entryName(section, row)}” could not be deleted. Please try again.`,
      );
    }
  }
}
