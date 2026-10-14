import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SessionUser } from '../../shared/auth';
import { AuthApi, safeReturnUrl } from './auth-api';

const anna: SessionUser = {
  username: 'anna',
  role: 'Owner',
  permissions: ['items:read'],
  setupRequired: false,
};

describe('AuthApi', () => {
  let http: HttpTestingController;
  let api: AuthApi;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(AuthApi);
  });

  afterEach(() => http.verify());

  it('loads the session once', async () => {
    const first = api.currentUser();
    const second = api.currentUser();
    http.expectOne('/api/auth/session').flush({ user: anna });
    expect(await first).toEqual(anna);
    expect(await second).toEqual(anna);
    expect(await api.currentUser()).toEqual(anna);
    expect(api.user()).toEqual(anna);
  });

  it('remembers the user after login and forgets it after logout', async () => {
    const login = api.login({ username: 'anna', password: 'secret' });
    const request = http.expectOne({ method: 'POST', url: '/api/auth/login' });
    expect(request.request.body).toEqual({ username: 'anna', password: 'secret' });
    request.flush({ user: anna });
    expect(await login).toEqual(anna);
    expect(api.user()).toEqual(anna);

    const logout = api.logout();
    http.expectOne({ method: 'POST', url: '/api/auth/logout' }).flush(null);
    await logout;
    expect(api.user()).toBeNull();
  });
});

describe('safeReturnUrl', () => {
  it('accepts paths inside the app only', () => {
    expect(safeReturnUrl('/items/3?tab=a')).toBe('/items/3?tab=a');
    for (const url of [undefined, '', 'items', '//evil.example', '/\\evil.example', 'https://x']) {
      expect(safeReturnUrl(url), String(url)).toBe('/');
    }
  });
});
