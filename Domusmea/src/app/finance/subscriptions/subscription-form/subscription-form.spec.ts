import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Subscription } from '../../../../shared/subscription';
import { SubscriptionForm } from './subscription-form';

const carInsurance: Subscription = {
  id: 7,
  name: 'Car insurance',
  interval: 'annual',
  costRappen: 98000,
  startDate: '2024-03-01',
  endDate: null,
  priceChanges: [{ validFrom: '2025-03-01', costRappen: 101000 }],
  noticeMonths: null,
  createdAt: '2024-03-01T10:00:00.000Z',
  updatedAt: '2025-03-01T10:00:00.000Z',
};

/** Lets pending promise callbacks (async handlers after an HTTP response) run, then syncs Angular. */
async function settle() {
  await new Promise((resolve) => setTimeout(resolve));
  TestBed.tick();
}

describe('SubscriptionForm', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    document.body.innerHTML = '';
  });

  async function render(existing?: Subscription) {
    const fixture = TestBed.createComponent(SubscriptionForm);
    // Attached to the document so focus can be checked.
    document.body.appendChild(fixture.nativeElement);
    if (existing) {
      fixture.componentRef.setInput('id', String(existing.id));
    }
    // The shared list loads on first use; answer it so whenStable() does not wait for it.
    TestBed.tick();
    http.expectOne('/api/subscriptions').flush([]);
    if (existing) {
      http.expectOne(`/api/subscriptions/${existing.id}`).flush(existing);
    }
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const type = async (selector: string, value: string) => {
      const input = element.querySelector<HTMLInputElement | HTMLSelectElement>(selector)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    };
    const click = async (selector: string) => {
      element.querySelector<HTMLElement>(selector)!.click();
      await fixture.whenStable();
    };
    const button = (text: string) =>
      [...element.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)!;
    const save = () => click('button[type="submit"]');
    return { fixture, element, type, click, button, save };
  }

  it('rejects a blank name, a missing price and an end before the start without calling the API', async () => {
    const { element, type, save } = await render();
    await type('#name', '   ');
    await type('#cost', "1'000'000.01");
    await type('#startDate', '2026-05-01');
    await type('#endDate', '2026-04-30');
    await save();

    expect(element.textContent).toContain('Enter a name.');
    expect(element.textContent).toMatch(/Enter at most CHF\s1.000.000\.00\./);
    expect(element.textContent).toContain('The end must not be before the first billing.');
    expect(element.querySelector('#name')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('shows the monthly share of an annual price and posts the subscription', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const { fixture, element, type, click, save } = await render();

    await type('#name', ' Car insurance ');
    await click('input[type="radio"][value="annual"]');
    await type('#cost', "1'000");
    expect(element.querySelector('#cost-hint')?.textContent).toMatch(/CHF\s83\.33 per month/);
    await type('#startDate', '2026-03-01');
    await type('#noticeMonths', '3');
    await save();

    const request = http.expectOne({ method: 'POST', url: '/api/subscriptions' });
    expect(request.request.body).toEqual({
      name: 'Car insurance',
      interval: 'annual',
      costRappen: 100000,
      startDate: '2026-03-01',
      endDate: null,
      priceChanges: [],
      noticeMonths: 3,
    });
    request.flush({ id: 1 });
    await settle();
    http.expectOne('/api/subscriptions').flush([]);
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith(['/finance/subscriptions']);
  });

  it('adds, validates and removes price changes, moving focus along', async () => {
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const { fixture, element, type, click, button, save } = await render(carInsurance);
    expect(element.querySelector('h1')?.textContent).toContain('Edit subscription');
    expect(element.querySelector<HTMLInputElement>('#change-cost-0')?.value).toBe('1010.00');

    button('Add price change').click();
    await fixture.whenStable();
    expect(document.activeElement).toBe(element.querySelector('#change-date-1'));

    await type('#change-date-1', '2024-01-01');
    await type('#change-cost-1', '1050');
    await save();
    expect(element.textContent).toContain('Must be after the first billing.');

    await type('#change-date-1', '2025-03-01');
    await save();
    expect(element.textContent).toContain('Only one price change per day.');

    await type('#change-date-1', '2026-03-01');
    await click('[aria-label="Remove price change 1"]');
    expect(document.activeElement).toBe(button('Add price change'));
    await save();

    const request = http.expectOne({ method: 'PUT', url: '/api/subscriptions/7' });
    expect(request.request.body.priceChanges).toEqual([
      { validFrom: '2026-03-01', costRappen: 105000 },
    ]);
    request.flush(carInsurance);
    await settle();
    http.expectOne('/api/subscriptions').flush([]);
  });

  it('explains a server-side validation error', async () => {
    const { fixture, element, type, save } = await render();
    await type('#name', 'Netflix');
    await type('#cost', '18.90');
    await save();

    http
      .expectOne({ method: 'POST', url: '/api/subscriptions' })
      .flush({ error: 'invalid' }, { status: 400, statusText: 'Bad Request' });
    await settle();
    await fixture.whenStable();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('check the entries');
  });
});
