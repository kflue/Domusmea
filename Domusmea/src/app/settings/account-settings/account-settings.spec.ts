import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AccountInfo } from '../../../shared/auth';
import { AuthApi } from '../../auth/auth-api';
import { AccountSettings } from './account-settings';

const account: AccountInfo = {
  username: 'anna',
  recentSignIns: [
    { at: '2026-10-14T20:45:00.000Z', address: '::ffff:127.0.0.1', forwardedFor: '198.51.100.7' },
    { at: '2026-10-13T06:05:00.000Z', address: '192.0.2.4', forwardedFor: null },
  ],
};

/** Lets pending promise callbacks (async handlers after an HTTP response) run, then syncs Angular. */
async function settle() {
  await new Promise((resolve) => setTimeout(resolve));
  TestBed.tick();
}

describe('AccountSettings', () => {
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
    const fixture = TestBed.createComponent(AccountSettings);
    TestBed.tick();
    http.expectOne('/api/account').flush(account);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const type = async (id: string, value: string) => {
      const input = element.querySelector<HTMLInputElement>(`#${id}`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    };
    const click = async (text: string) => {
      [...element.querySelectorAll('button')].find((b) => b.textContent?.includes(text))!.click();
      await fixture.whenStable();
    };
    const fillPasswords = async (current: string, next: string, confirmation = next) => {
      await type('current-password', current);
      await type('new-password', next);
      await type('password-confirmation', confirmation);
    };
    return { fixture, element, type, click, fillPasswords };
  }

  it('lists the recent sign-ins in local time', async () => {
    const { element } = await render();
    const rows = [...element.querySelectorAll('tbody tr')].map((row) => row.textContent?.trim());
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('14.10.2026, 22:45');
    expect(rows[0]).toContain('198.51.100.7 (reported by the proxy at 127.0.0.1)');
    expect(rows[1]).toContain('13.10.2026, 08:05');
    expect(rows[1]).toContain('192.0.2.4');
    expect(element.textContent).toContain('Signed in as anna');
  });

  it('validates the new password without calling the API', async () => {
    const { element, click, fillPasswords } = await render();
    await fillPasswords('', 'short', 'other');
    await click('Change password');
    expect(element.textContent).toContain('Enter your current password.');
    expect(element.textContent).toContain('Use 12 to 256 characters.');
    expect(element.textContent).toContain('The passwords do not match.');

    await fillPasswords('a long kitchen password', 'a long kitchen password');
    await click('Change password');
    expect(element.textContent).toContain('differs from the current one');
  });

  it('changes the password and clears the form', async () => {
    const { fixture, element, click, fillPasswords } = await render();
    await fillPasswords('a long kitchen password', 'another long password');
    await click('Change password');

    const request = http.expectOne({ method: 'PUT', url: '/api/account/password' });
    expect(request.request.body).toEqual({
      currentPassword: 'a long kitchen password',
      newPassword: 'another long password',
    });
    request.flush(null, { status: 204, statusText: 'No Content' });
    await settle();
    await fixture.whenStable();

    expect(element.querySelector('[role="status"]')?.textContent).toContain('Password changed.');
    expect(element.querySelector<HTMLInputElement>('#new-password')!.value).toBe('');
    expect(element.textContent).not.toContain('Enter your current password.');
  });

  it('reports a wrong current password', async () => {
    const { fixture, element, click, fillPasswords } = await render();
    await fillPasswords('not my password', 'another long password');
    await click('Change password');
    http
      .expectOne('/api/account/password')
      .flush(
        { error: 'invalid', fields: { currentPassword: ['Wrong password'] } },
        { status: 400, statusText: 'Bad Request' },
      );
    await settle();
    await fixture.whenStable();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'The current password is wrong.',
    );
  });

  it('signs out on all devices after confirmation', async () => {
    const { click } = await render();
    const auth = TestBed.inject(AuthApi);
    const sessionEnded = vi.spyOn(auth, 'sessionEnded');

    await click('Sign out on all devices');
    await click('Cancel');
    http.expectNone('/api/account/sign-out-everywhere');

    await click('Sign out on all devices');
    await click('Sign out everywhere');
    http
      .expectOne({ method: 'POST', url: '/api/account/sign-out-everywhere' })
      .flush(null, { status: 204, statusText: 'No Content' });
    await settle();
    expect(sessionEnded).toHaveBeenCalled();
    expect(navigateByUrl).toHaveBeenCalledWith('/login');
  });
});
