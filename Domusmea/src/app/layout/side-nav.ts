import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthApi } from '../auth/auth-api';
import { NavPreferences } from './nav-preferences';
import { NAV_TOPICS } from './nav-topics';

/**
 * The main navigation: the topics registered with `provideNavTopic` that the user may see. A
 * sidebar (or icon rail) on wide screens, a drawer on narrow ones; see `NavPreferences`.
 */
@Component({
  selector: 'app-side-nav',
  imports: [RouterLink, RouterLinkActive],
  host: { '(document:keydown.escape)': 'prefs.closeDrawer()' },
  template: `
    @if (prefs.wide() || prefs.drawerOpen()) {
      @if (!prefs.wide()) {
        <button
          type="button"
          tabindex="-1"
          class="fixed inset-0 top-14 z-20 bg-black/30"
          aria-label="Close navigation"
          (click)="prefs.closeDrawer()"
        ></button>
      }
      <nav
        id="side-nav"
        aria-label="Main"
        class="overflow-y-auto border-r border-gray-200 bg-white p-2"
        [class]="placement()"
      >
        <ul class="flex flex-col gap-1">
          @for (topic of topics(); track topic.path) {
            <li>
              <a
                [routerLink]="topic.path"
                routerLinkActive="bg-gray-100 font-semibold"
                ariaCurrentWhenActive="page"
                class="flex items-center gap-3 rounded px-3 py-2 hover:bg-gray-100"
                [attr.title]="showLabels() ? null : topic.label"
                (click)="prefs.closeDrawer()"
              >
                <svg
                  aria-hidden="true"
                  class="size-6 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="topic.icon" />
                </svg>
                <span [class.sr-only]="!showLabels()">{{ topic.label }}</span>
              </a>
            </li>
          }
        </ul>
      </nav>
    }
  `,
})
export class SideNav {
  private readonly auth = inject(AuthApi);
  private readonly allTopics = inject(NAV_TOPICS, { optional: true }) ?? [];
  protected readonly prefs = inject(NavPreferences);

  protected readonly topics = computed(() => {
    const permissions = this.auth.activeUser()?.permissions ?? [];
    return this.allTopics.filter((topic) => permissions.includes(topic.permission));
  });

  /** Sidebar beside the page (below the sticky top bar), or drawer over it. */
  protected readonly placement = computed(() => {
    if (!this.prefs.wide()) {
      return 'fixed bottom-0 left-0 top-14 z-30 w-64 shadow-lg';
    }
    const width = this.prefs.collapsed() ? 'w-16' : 'w-60';
    return `sticky top-14 h-[calc(100dvh-3.5rem)] shrink-0 ${width}`;
  });

  /** The drawer always shows labels; the sidebar unless collapsed to icons. */
  protected readonly showLabels = computed(() => !this.prefs.wide() || !this.prefs.collapsed());
}
