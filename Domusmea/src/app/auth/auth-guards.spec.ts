import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { firstValueFrom } from 'rxjs';
import { SessionUser } from '../../shared/auth';
import { AuthApi } from './auth-api';
import {
  authInterceptor,
  permissionGuard,
  setupGuard,
  signedInGuard,
  signedOutGuard,
} from './auth-guards';

@Component({ template: 'page' })
class Page {}

const anna: SessionUser = {
  username: 'anna',
  role: 'Owner',
  permissions: [],
  setupRequired: false,
};

describe('auth guards', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'login', canActivate: [signedOutGuard], component: Page },
          { path: 'setup', canActivate: [setupGuard], component: Page },
          { path: 'items', canActivate: [signedInGuard], component: Page },
          {
            path: 'edit',
            canActivate: [signedInGuard, permissionGuard('finance:write')],
            component: Page,
          },
          { path: '', component: Page },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => http.verify());

  /** Navigates while the session request is answered with `user`. */
  async function navigate(url: string, user: SessionUser | null) {
    const navigation = harness.navigateByUrl(url);
    await new Promise((resolve) => setTimeout(resolve));
    http.expectOne('/api/auth/session').flush({ user });
    await navigation;
    return TestBed.inject(Router).url;
  }

  it('sends signed-out visitors to the login, with the page to return to', async () => {
    expect(await navigate('/items?x=1', null)).toBe('/login?returnUrl=%2Fitems%3Fx%3D1');
  });

  it('sends the default account to the setup until it is done', async () => {
    expect(await navigate('/items', { ...anna, setupRequired: true })).toBe('/setup');
    await harness.navigateByUrl('/login');
    expect(TestBed.inject(Router).url).toBe('/setup');
  });

  it('lets set-up users in and keeps them away from login and setup', async () => {
    expect(await navigate('/items', anna)).toBe('/items');
    await harness.navigateByUrl('/setup');
    expect(TestBed.inject(Router).url).toBe('/');
    await harness.navigateByUrl('/login');
    expect(TestBed.inject(Router).url).toBe('/');
  });

  it('keeps users without the permission away from pages behind permissionGuard', async () => {
    expect(await navigate('/edit', { ...anna, permissions: ['finance:read'] })).toBe('/');
    expect(TestBed.inject(AuthApi).can('finance:read')).toBe(true);
  });

  it('lets users with the permission in', async () => {
    expect(await navigate('/edit', { ...anna, permissions: ['finance:write'] })).toBe('/edit');
    expect(TestBed.inject(AuthApi).can('finance:write')).toBe(true);
    expect(TestBed.inject(AuthApi).can('finance:read')).toBe(false);
  });

  it('sends the user to the login when the API reports an ended session', async () => {
    await navigate('/items', anna);
    const request = firstValueFrom(TestBed.inject(HttpClient).get('/api/items'));
    http
      .expectOne('/api/items')
      .flush({ error: 'unauthenticated' }, { status: 401, statusText: 'Unauthorized' });
    await expect(request).rejects.toBeDefined();
    await new Promise((resolve) => setTimeout(resolve));
    expect(TestBed.inject(Router).url).toBe('/login?returnUrl=%2Fitems');
    expect(TestBed.inject(AuthApi).user()).toBeNull();
  });
});
