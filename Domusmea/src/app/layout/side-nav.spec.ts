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
        provideNavTopic({ path: '/items', label: 'Items', icon: 'M0 0', permission: 'items:read' }),
        provideNavTopic({
          path: '/journal',
          label: 'Journal',
          icon: 'M0 0',
          permission: 'journal:read',
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

  it('lists the registered topics in order', async () => {
    await signIn(['items:read', 'journal:read']);
    const links = [...(await render()).querySelectorAll('a')];
    expect(links.map((link) => link.textContent?.trim())).toEqual(['Items', 'Journal']);
    expect(links[0].getAttribute('href')).toBe('/items');
  });

  it('hides topics the user may not read', async () => {
    await signIn(['journal:read']);
    expect((await render()).querySelector('nav')?.textContent?.trim()).toBe('Journal');
  });

  it('keeps the labels for screen readers and tooltips when collapsed to icons', async () => {
    await signIn(['items:read']);
    TestBed.inject(NavPreferences).toggle();
    const link = (await render()).querySelector('a')!;
    expect(link.getAttribute('title')).toBe('Items');
    expect(link.querySelector('span')?.classList).toContain('sr-only');
  });
});
