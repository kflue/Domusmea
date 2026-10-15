import { Component, computed, inject } from '@angular/core';
import { DEFAULT_TIME_ZONE, todayIn } from '../../../shared/format';
import { AuthApi } from '../../auth/auth-api';
import { CapexSource, FINANCE_SOURCES, OpexSource } from './finance-sources';
import { Investments } from './investments/investments';
import { RunningCosts } from './running-costs/running-costs';

/**
 * The finance dashboard at `/finance` (ADR 0013): running costs per month and investments per
 * year. Categories come from the sources registered with `provideFinanceSource(...)`; sources the
 * role may not read are skipped, and a section without sources is hidden (R8).
 */
@Component({
  selector: 'app-finance-dashboard',
  imports: [RunningCosts, Investments],
  template: `
    <section>
      <h1 class="mb-6 text-2xl font-semibold">Finance</h1>
      @if (opexSources().length) {
        <app-running-costs [sources]="opexSources()" [today]="today" />
      }
      @if (capexSources().length) {
        <app-investments [sources]="capexSources()" [today]="today" />
      }
    </section>
  `,
})
export class FinanceDashboard {
  private readonly auth = inject(AuthApi);
  private readonly sources = [...inject(FINANCE_SOURCES)].sort((a, b) => a.order - b.order);
  protected readonly today = todayIn(DEFAULT_TIME_ZONE);

  private readonly readable = computed(() =>
    this.sources.filter((source) => this.auth.can(source.permission)),
  );
  protected readonly opexSources = computed(() =>
    this.readable().filter((source): source is OpexSource => source.kind === 'opex'),
  );
  protected readonly capexSources = computed(() =>
    this.readable().filter((source): source is CapexSource => source.kind === 'capex'),
  );
}
