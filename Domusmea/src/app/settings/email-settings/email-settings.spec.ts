import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { EmailSettings } from '../../../shared/email-settings';
import { EmailSettingsPage } from './email-settings';

const URL = '/api/settings/email';

const saved: EmailSettings = {
  host: 'smtp.example.ch',
  port: 587,
  security: 'starttls',
  username: 'home@example.ch',
  passwordSet: true,
  from: 'home@example.ch',
  recipients: ['anna@example.ch'],
  canStorePassword: true,
};

/** Lets pending promise callbacks (async handlers after an HTTP response) run, then syncs Angular. */
async function settle() {
  await new Promise((resolve) => setTimeout(resolve));
  TestBed.tick();
}

describe('EmailSettingsPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function render(settings: EmailSettings = saved) {
    const fixture = TestBed.createComponent(EmailSettingsPage);
    TestBed.tick();
    http.expectOne(URL).flush(settings);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const type = async (id: string, value: string) => {
      const input = element.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${id}`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    };
    const click = async (selector: string) => {
      element.querySelector<HTMLButtonElement>(selector)!.click();
      await fixture.whenStable();
    };
    return { fixture, element, type, click };
  }

  it('shows the saved settings without the password', async () => {
    const { element } = await render();
    expect(element.querySelector<HTMLInputElement>('#host')!.value).toBe('smtp.example.ch');
    expect(element.querySelector<HTMLInputElement>('#password')!.value).toBe('');
    expect(element.querySelector<HTMLInputElement>('#password')!.placeholder).toContain('Saved');
  });

  it('validates entries without calling the API', async () => {
    const { element, type, click } = await render();
    await type('port', '99999');
    await type('from', '');
    await type('recipients', 'anna@example.ch\nnot-an-address');
    await click('button[type="submit"]');

    expect(element.textContent).toContain('Enter a port from 1 to 65535.');
    expect(element.textContent).toContain('Enter the sender address.');
    expect(element.textContent).toContain('Not an email address: not-an-address.');
  });

  it('warns that a changed server drops the saved password, then saves', async () => {
    const { fixture, element, type, click } = await render();
    await type('host', 'smtp.other.ch');
    expect(element.textContent).toContain('enter the password again');

    await click('button[type="submit"]');
    const request = http.expectOne({ method: 'PUT', url: URL });
    expect(request.request.body).toEqual({
      host: 'smtp.other.ch',
      port: 587,
      security: 'starttls',
      username: 'home@example.ch',
      password: undefined,
      from: 'home@example.ch',
      recipients: ['anna@example.ch'],
    });
    request.flush({ ...saved, host: 'smtp.other.ch', passwordSet: false });
    await settle();
    await fixture.whenStable();
    expect(element.textContent).toContain('Settings saved.');

    await type('recipients', 'ben@example.ch');
    expect(element.textContent).not.toContain('Settings saved.');
  });

  it('sends a test email only for saved settings and shows the server error', async () => {
    const { fixture, element, type, click } = await render();
    const testButton = () => element.querySelector<HTMLButtonElement>('button[type="button"]')!;

    await type('recipients', 'ben@example.ch');
    expect(testButton().disabled).toBe(true);
    await type('recipients', 'anna@example.ch');
    expect(testButton().disabled).toBe(false);

    await click('button[type="button"]');
    http
      .expectOne({ method: 'POST', url: `${URL}/test` })
      .flush(
        { error: 'send-failed', message: 'Invalid login: 535' },
        { status: 502, statusText: 'Bad Gateway' },
      );
    await settle();
    await fixture.whenStable();
    expect(element.textContent).toContain('The mail server reported: Invalid login: 535');
  });

  it('disables the password without an encryption key on the server', async () => {
    const { element } = await render({ ...saved, passwordSet: false, canStorePassword: false });
    expect(element.querySelector<HTMLInputElement>('#password')!.disabled).toBe(true);
    expect(element.textContent).toContain('SETTINGS_KEY');
  });
});
