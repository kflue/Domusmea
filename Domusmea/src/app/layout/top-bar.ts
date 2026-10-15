import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthApi } from '../auth/auth-api';
import { NavPreferences } from './nav-preferences';

/** The bar above every page: navigation toggle, app name, settings and the signed-in user. */
@Component({
  selector: 'app-top-bar',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <header class="sticky top-0 z-40 h-14 border-b border-gray-200 bg-white">
      <div class="flex h-full items-center gap-4 px-4">
        @if (user()) {
          <button
            type="button"
            class="rounded p-2 hover:bg-gray-100"
            aria-label="Navigation"
            aria-controls="side-nav"
            [attr.aria-expanded]="prefs.expanded()"
            (click)="prefs.toggle()"
          >
            <svg
              aria-hidden="true"
              class="size-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
            >
              <path stroke-linecap="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
        }
        <a routerLink="/" class="text-xl font-semibold">{{ title }}</a>
        @if (user(); as user) {
          <nav aria-label="Account" class="ml-auto flex items-center gap-4">
            <a
              routerLink="/settings"
              routerLinkActive="font-semibold underline"
              ariaCurrentWhenActive="page"
            >
              Settings
            </a>
            <span class="hidden text-sm text-gray-700 sm:inline">
              Signed in as <span class="font-medium">{{ user.username }}</span>
            </span>
            <button type="button" class="btn-secondary" (click)="signOut()">Sign out</button>
          </nav>
        }
      </div>
    </header>
  `,
})
export class TopBar {
  private readonly auth = inject(AuthApi);
  private readonly router = inject(Router);
  protected readonly prefs = inject(NavPreferences);

  protected readonly title = 'Domusmea';
  protected readonly user = this.auth.activeUser;

  protected async signOut(): Promise<void> {
    try {
      await this.auth.logout();
    } finally {
      await this.router.navigateByUrl('/login');
    }
  }
}
