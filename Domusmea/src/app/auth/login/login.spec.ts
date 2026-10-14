import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { SessionUser } from '../../../shared/auth';
import { LoginPage } from './login';

const anna: SessionUser = {
  username: 'anna',
  role: 'Owner',
  permissions: [],
  setupRequired: false,
};

/** Lets pending promise callbacks (async handlers after an HTTP response) run, then syncs Angular. */
async function settle() {
  await new Promise((resolve) => setTimeout(resolve));
  TestBed.tick();
}

describe('LoginPage', () => {
  let http: HttpTestingController;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => http.verify());

  async function render(returnUrl?: string) {
    const fixture = TestBed.createComponent(LoginPage);
    fixture.componentRef.setInput('returnUrl', returnUrl);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const type = async (id: string, value: string) => {
      const input = element.querySelector<HTMLInputElement>(`#${id}`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    };
    const submit = async () => {
      element.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
      await fixture.whenStable();
    };
    return { fixture, element, type, submit };
  }

  it('asks for both fields without calling the API', async () => {
    const { element, submit } = await render();
    await submit();
    expect(element.textContent).toContain('Enter your username.');
    expect(element.textContent).toContain('Enter your password.');
  });

  it('signs in and returns to the requested page', async () => {
    const { type, submit } = await render('/settings');
    await type('username', ' anna ');
    await type('password', 'a long kitchen password');
    await submit();

    const request = http.expectOne({ method: 'POST', url: '/api/auth/login' });
    expect(request.request.body).toEqual({ username: 'anna', password: 'a long kitchen password' });
    request.flush({ user: anna });
    await settle();
    expect(navigateByUrl).toHaveBeenCalledWith('/settings');
  });

  it('goes to the setup after the default login', async () => {
    const { type, submit } = await render('/settings');
    await type('username', 'admin');
    await type('password', 'admin');
    await submit();
    http.expectOne('/api/auth/login').flush({ user: { ...anna, setupRequired: true } });
    await settle();
    expect(navigateByUrl).toHaveBeenCalledWith('/setup');
  });

  it('shows why the login failed and clears the password', async () => {
    const { fixture, element, type, submit } = await render();
    await type('username', 'anna');
    await type('password', 'wrong');
    await submit();
    http
      .expectOne('/api/auth/login')
      .flush({ error: 'invalid-credentials' }, { status: 401, statusText: 'Unauthorized' });
    await settle();
    await fixture.whenStable();

    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'The username or password is wrong.',
    );
    expect(element.querySelector<HTMLInputElement>('#password')!.value).toBe('');
    expect(navigateByUrl).not.toHaveBeenCalled();
  });
});
