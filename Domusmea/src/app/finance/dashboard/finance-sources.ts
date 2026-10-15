import { InjectionToken, Provider } from '@angular/core';
import { Permission } from '../../../shared/auth';
import { OpexFigures } from '../../../shared/finance-totals';

/** What every cost source of the finance dashboard declares (ADR 0013). */
export interface FinanceSourceBase {
  /** Stable key, e.g. `utilities`, `subscriptions`, `taxes`. */
  id: string;
  /** Name in the legend, the KPI tile and the table. */
  label: string;
  /** Users without it neither load nor see the source. */
  permission: Permission;
  /** The source's own page, usually its nav topic's path. */
  link: string;
  /** Legend and KPI order; colour and point style follow it. */
  order: number;
}

/** A running cost (operating expenditure) such as subscriptions or utilities. */
export interface OpexSource extends FinanceSourceBase {
  kind: 'opex';
  /**
   * Loads the figures as of `today` (`YYYY-MM-DD`). Import the feature's cost code with `import()`
   * here, so registering the source does not grow the initial bundle.
   */
  load: (today: string) => Promise<OpexFigures>;
}

export type FinanceSource = OpexSource;

/** All registered sources, in the order of their `provideFinanceSource` calls. */
export const FINANCE_SOURCES = new InjectionToken<readonly FinanceSource[]>('FINANCE_SOURCES');

/**
 * Adds a feature's cost source to the finance dashboard; called in `app.config.ts`, like
 * `provideNavTopic`. `factory` runs in an injection context when the dashboard first loads, so it
 * can `inject(...)` what `load` needs.
 */
export function provideFinanceSource(factory: () => FinanceSource): Provider {
  return { provide: FINANCE_SOURCES, useFactory: factory, multi: true };
}
