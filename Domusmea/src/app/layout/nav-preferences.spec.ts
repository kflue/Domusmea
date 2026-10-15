import { TestBed } from '@angular/core/testing';
import { NavPreferences } from './nav-preferences';

const COLLAPSED_KEY = 'domusmea.sideNavCollapsed';

/** Makes `matchMedia` report a wide or narrow screen; returns a function that changes it. */
function screen(wide: boolean): (wide: boolean) => void {
  let listener: ((event: { matches: boolean }) => void) | undefined;
  window.matchMedia = vi.fn().mockReturnValue({
    matches: wide,
    addEventListener: (_type: string, fn: typeof listener) => (listener = fn),
  });
  return (matches) => listener?.({ matches });
}

describe('NavPreferences', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('on a wide screen', () => {
    beforeEach(() => screen(true));

    it('starts expanded', () => {
      const prefs = TestBed.inject(NavPreferences);
      expect(prefs.wide()).toBe(true);
      expect(prefs.collapsed()).toBe(false);
      expect(prefs.expanded()).toBe(true);
    });

    it('collapses to icons and remembers it in this browser', () => {
      TestBed.inject(NavPreferences).toggle();
      expect(TestBed.inject(NavPreferences).collapsed()).toBe(true);
      expect(localStorage.getItem(COLLAPSED_KEY)).toBe('true');
    });

    it('starts collapsed when that was the last choice', () => {
      localStorage.setItem(COLLAPSED_KEY, 'true');
      const prefs = TestBed.inject(NavPreferences);
      expect(prefs.collapsed()).toBe(true);
      expect(prefs.expanded()).toBe(false);
    });

    it('still toggles when the storage is blocked', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError');
      });
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError');
      });
      const prefs = TestBed.inject(NavPreferences);
      expect(prefs.collapsed()).toBe(false);
      prefs.toggle();
      expect(prefs.collapsed()).toBe(true);
    });
  });

  describe('on a narrow screen', () => {
    it('opens and closes the drawer without touching the stored choice', () => {
      screen(false);
      const prefs = TestBed.inject(NavPreferences);
      expect(prefs.expanded()).toBe(false);

      prefs.toggle();
      expect(prefs.drawerOpen()).toBe(true);
      expect(prefs.expanded()).toBe(true);
      expect(localStorage.getItem(COLLAPSED_KEY)).toBeNull();

      prefs.closeDrawer();
      expect(prefs.drawerOpen()).toBe(false);
    });

    it('closes the drawer when the screen becomes wide', () => {
      const resize = screen(false);
      const prefs = TestBed.inject(NavPreferences);
      prefs.toggle();

      resize(true);
      expect(prefs.wide()).toBe(true);
      expect(prefs.drawerOpen()).toBe(false);
    });
  });
});
