import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './auth/auth-guards';
import { provideFinanceSource } from './finance/dashboard/finance-sources';
import { financeNavTopic } from './finance/finance.nav';
import { itemsFinanceSource } from './items/items.finance';
import { itemsNavTopic } from './items/items.nav';
import { journalFinanceSource } from './journal/journal.finance';
import { journalNavTopic } from './journal/journal.nav';
import { provideNavTopic } from './layout/nav-topics';
import { subscriptionsFinanceSource } from './subscriptions/subscriptions.finance';
import { subscriptionsNavTopic } from './subscriptions/subscriptions.nav';
import { utilitiesFinanceSource } from './utilities/utilities.finance';
import { utilitiesNavTopic } from './utilities/utilities.nav';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideClientHydration(),
    provideHttpClient(withInterceptors([authInterceptor])),
    // Side navigation, in this order: ungrouped first, then each group (ADR 0008, 0015).
    provideNavTopic(financeNavTopic),
    provideNavTopic(itemsNavTopic),
    provideNavTopic(utilitiesNavTopic),
    provideNavTopic(subscriptionsNavTopic),
    provideNavTopic(journalNavTopic),
    // Cost categories of the finance dashboard (ADR 0013, 0017).
    provideFinanceSource(subscriptionsFinanceSource),
    provideFinanceSource(utilitiesFinanceSource),
    provideFinanceSource(journalFinanceSource),
    provideFinanceSource(itemsFinanceSource),
  ],
};
