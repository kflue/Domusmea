import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { AuthApi } from './auth/auth-api';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the app name in the navigation', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('nav')?.textContent).toContain('Domusmea');
  });

  it('shows the navigation and sign-out only to signed-in users', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const nav = () => (fixture.nativeElement as HTMLElement).querySelector('nav')!;
    expect(nav().textContent).not.toContain('Settings');

    const login = TestBed.inject(AuthApi).login({ username: 'anna', password: 'secret' });
    TestBed.inject(HttpTestingController)
      .expectOne('/api/auth/login')
      .flush({ user: { username: 'anna', role: 'Owner', permissions: [], setupRequired: false } });
    await login;
    await fixture.whenStable();
    expect(nav().textContent).toContain('Settings');
    expect(nav().textContent).toContain('Signed in as anna');
    expect(nav().querySelector('button')?.textContent).toContain('Sign out');
  });
});
