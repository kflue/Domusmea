import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Permission } from '../../shared/auth';
import { AuthApi } from '../auth/auth-api';
import { NavPreferences } from './nav-preferences';
import { provideNavTopic } from './nav-topics';
import { SideNav } from './side-nav';

async function signIn(permissions: Permission[]): Promise<void> {
  const login = TestBed.inject(AuthApi).login({ username: 'anna', password: 'secret' });
  TestBed.inject(HttpTestingController)
    .expectOne('/api/auth/login')
    .flush({ user: { username: 'anna', role: 'Owner', permissions, setupRequired: false } });
  await login;
}

describe('SideNav', () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn() });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNavTopic({
          path: '/finance',
          label: 'Finance',
          icon: 'M0 0',
          permission: 'finance:read',
        }),
        provideNavTopic({
          path: '/items',
          label: 'Items',
          icon: 'M0 0',
          permission: 'items:read',
          group: 'capex',
        }),
        provideNavTopic({
          path: '/journal',
          label: 'Journal',
          icon: 'M0 0',
          permission: 'journal:read',
          group: 'capex',
        }),
        provideNavTopic({
          path: '/utilities',
          label: 'Utilities',
          icon: 'M0 0',
          permission: 'finance:read',
          group: 'opex',
        }),
      ],
    });
  });

  afterEach(() => localStorage.clear());

  async function render(): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(SideNav);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('lists the ungrouped topics first, then each group under its subtitle', async () => {
    await signIn(['finance:read', 'items:read', 'journal:read']);
    const nav = await render();
    const lists = [...nav.querySelectorAll('ul')];
    const labels = (list: Element) =>
      [...list.querySelectorAll('a')].map((a) => a.textContent?.trim());
    expect(lists.map(labels)).toEqual([['Finance'], ['Items', 'Journal'], ['Utilities']]);
    expect(lists[0].getAttribute('aria-labelledby')).toBeNull();
    expect(lists[1].getAttribute('aria-labelledby')).toBe('nav-group-capex');
    expect(nav.querySelector('#nav-group-capex')?.textContent?.trim()).toBe('Capex');
    expect(nav.querySelector('#nav-group-opex')?.textContent?.trim()).toBe('Opex');
    expect(nav.querySelector('a')?.getAttribute('href')).toBe('/finance');
  });

  it('hides topics the user may not read, and groups left without topics', async () => {
    await signIn(['journal:read']);
    const nav = await render();
    expect([...nav.querySelectorAll('a')].map((a) => a.textContent?.trim())).toEqual(['Journal']);
    expect(nav.querySelectorAll('h2')).toHaveLength(1);
    expect(nav.querySelector('#nav-group-opex')).toBeNull();
  });

  it('keeps the labels for screen readers and tooltips when collapsed to icons', async () => {
    await signIn(['items:read']);
    TestBed.inject(NavPreferences).toggle();
    const link = (await render()).querySelector('a')!;
    expect(link.getAttribute('title')).toBe('Items');
    expect(link.querySelector('span')?.classList).toContain('sr-only');
  });

  it('keeps the group subtitles for screen readers when collapsed to icons', async () => {
    await signIn(['items:read']);
    TestBed.inject(NavPreferences).toggle();
    const subtitle = (await render()).querySelector('#nav-group-capex span')!;
    expect(subtitle.textContent?.trim()).toBe('Capex');
    expect(subtitle.classList).toContain('sr-only');
  });
});
