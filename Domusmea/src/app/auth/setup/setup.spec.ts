import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { SetupPage } from './setup';

/** Lets pending promise callbacks (async handlers after an HTTP response) run, then syncs Angular. */
async function settle() {
  await new Promise((resolve) => setTimeout(resolve));
  TestBed.tick();
}

describe('SetupPage', () => {
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

  async function render() {
    const fixture = TestBed.createComponent(SetupPage);
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

  it('validates the new credentials without calling the API', async () => {
    const { element, type, submit } = await render();
    await type('username', 'a b');
    await type('password', 'short');
    await type('confirmation', 'other');
    await submit();
    expect(element.textContent).toContain('Use 3 to 32 letters');
    expect(element.textContent).toContain('Use 12 to 256 characters.');
    expect(element.textContent).toContain('The passwords do not match.');

    await type('username', 'anna.meier.home');
    await type('password', 'Anna.Meier.Home');
    await submit();
    expect(element.textContent).toContain('differs from the username');
  });

  it('saves the credentials and opens the app', async () => {
    const { type, submit } = await render();
    await type('username', 'anna');
    await type('password', 'a long kitchen password');
    await type('confirmation', 'a long kitchen password');
    await submit();

    const request = http.expectOne({ method: 'POST', url: '/api/auth/setup' });
    expect(request.request.body).toEqual({
      username: 'anna',
      password: 'a long kitchen password',
    });
    request.flush({
      user: { username: 'anna', role: 'Owner', permissions: [], setupRequired: false },
    });
    await settle();
    expect(navigateByUrl).toHaveBeenCalledWith('/');
  });

  it('explains that the setup only works on the server machine', async () => {
    const { fixture, element, type, submit } = await render();
    await type('username', 'anna');
    await type('password', 'a long kitchen password');
    await type('confirmation', 'a long kitchen password');
    await submit();
    http
      .expectOne('/api/auth/setup')
      .flush({ error: 'setup-local-only' }, { status: 403, statusText: 'Forbidden' });
    await settle();
    await fixture.whenStable();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('ALLOW_REMOTE_SETUP');
  });
});
