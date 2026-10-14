import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { AuthApi } from './auth/auth-api';
import { provideNavTopic } from './layout/nav-topics';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNavTopic({ path: '/items', label: 'Items', icon: 'M0 0', permission: 'items:read' }),
      ],
    }).compileComponents();
  });

  afterEach(() => localStorage.clear());

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the app name in the top bar', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('header')?.textContent).toContain('Domusmea');
  });

  it('shows the navigation and sign-out only to signed-in users', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    const header = () => page.querySelector('header')!;
    expect(header().textContent).not.toContain('Settings');
    expect(page.querySelector('nav[aria-label="Main"]')).toBeNull();

    const login = TestBed.inject(AuthApi).login({ username: 'anna', password: 'secret' });
    TestBed.inject(HttpTestingController)
      .expectOne('/api/auth/login')
      .flush({
        user: {
          username: 'anna',
          role: 'Owner',
          permissions: ['items:read'],
          setupRequired: false,
        },
      });
    await login;
    await fixture.whenStable();
    expect(header().textContent).toContain('Settings');
    expect(header().textContent).toContain('Signed in as anna');
    expect(header().querySelector('nav button')?.textContent).toContain('Sign out');
    expect(page.querySelector('nav[aria-label="Main"]')?.textContent).toContain('Items');
  });

  it('collapses the side navigation from the top bar', async () => {
    const fixture = TestBed.createComponent(App);
    const login = TestBed.inject(AuthApi).login({ username: 'anna', password: 'secret' });
    TestBed.inject(HttpTestingController)
      .expectOne('/api/auth/login')
      .flush({
        user: {
          username: 'anna',
          role: 'Owner',
          permissions: ['items:read'],
          setupRequired: false,
        },
      });
    await login;
    await fixture.whenStable();
    const toggle = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      'button[aria-controls="side-nav"]',
    )!;
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    toggle.click();
    await fixture.whenStable();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });
});
