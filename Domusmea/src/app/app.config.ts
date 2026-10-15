import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './auth/auth-guards';
import { financeNavTopic } from './finance/finance.nav';
import { itemsNavTopic } from './items/items.nav';
import { journalNavTopic } from './journal/journal.nav';
import { provideNavTopic } from './layout/nav-topics';
import { utilitiesNavTopic } from './utilities/utilities.nav';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideClientHydration(),
    provideHttpClient(withInterceptors([authInterceptor])),
    // Side navigation, in this order (ADR 0008).
    provideNavTopic(itemsNavTopic),
    provideNavTopic(journalNavTopic),
    provideNavTopic(financeNavTopic),
    provideNavTopic(utilitiesNavTopic),
  ],
};
