import { isPlatformBrowser } from '@angular/common';
import { computed, DOCUMENT, inject, PLATFORM_ID, Service, signal } from '@angular/core';

const COLLAPSED_KEY = 'domusmea.sideNavCollapsed';
/** Tailwind's `md` breakpoint: from here on the navigation is a sidebar instead of a drawer. */
const WIDE_QUERY = '(min-width: 48rem)';

/**
 * State of the side navigation (ADR 0008). On wide screens it is a sidebar that collapses to an
 * icon rail; that choice is remembered in this browser. On narrow screens it is a drawer over the
 * page, closed by default and after each navigation.
 */
@Service()
export class NavPreferences {
  private readonly window = isPlatformBrowser(inject(PLATFORM_ID))
    ? inject(DOCUMENT).defaultView
    : null;
  private readonly media = this.window?.matchMedia?.(WIDE_QUERY);

  private readonly wideScreen = signal(this.media?.matches ?? true);
  private readonly collapsedState = signal(this.readCollapsed());
  private readonly drawerState = signal(false);

  readonly wide = this.wideScreen.asReadonly();
  /** The sidebar shows icons only (wide screens). */
  readonly collapsed = this.collapsedState.asReadonly();
  /** The drawer is open (narrow screens). */
  readonly drawerOpen = this.drawerState.asReadonly();
  /** Whether the navigation shows its labels, for the toggle's `aria-expanded`. */
  readonly expanded = computed(() => (this.wide() ? !this.collapsed() : this.drawerOpen()));

  constructor() {
    this.media?.addEventListener('change', (event) => {
      this.wideScreen.set(event.matches);
      this.drawerState.set(false);
    });
  }

  /** Collapses or expands the sidebar on wide screens, opens or closes the drawer otherwise. */
  toggle(): void {
    if (this.wide()) {
      const collapsed = !this.collapsed();
      this.collapsedState.set(collapsed);
      this.storeCollapsed(collapsed);
    } else {
      this.drawerState.update((open) => !open);
    }
  }

  closeDrawer(): void {
    this.drawerState.set(false);
  }

  // Storage may be missing or throw (private windows, blocked site data); the default then applies.
  private readCollapsed(): boolean {
    try {
      return this.window?.localStorage.getItem(COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  }

  private storeCollapsed(collapsed: boolean): void {
    try {
      this.window?.localStorage.setItem(COLLAPSED_KEY, String(collapsed));
    } catch {
      // Not remembered; the choice still applies until the page is reloaded.
    }
  }
}
