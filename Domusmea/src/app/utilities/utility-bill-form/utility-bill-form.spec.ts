import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { UtilityEntry } from '../../../shared/utility';
import { UtilityBillForm } from './utility-bill-form';

const electricityQ2: UtilityEntry = {
  id: 4,
  billId: 2,
  commodity: 'electricity',
  periodFrom: '2026-04-01',
  periodTo: '2026-06-30',
  amountMilli: 812_500,
  costRappen: 23_319,
  fixedFeeRappen: 1_500,
  invoiceNumber: '2026-0815',
  notes: null,
  createdAt: '2026-07-10T08:00:00.000Z',
  updatedAt: '2026-07-10T08:00:00.000Z',
};

/** Lets pending promise callbacks (async handlers after an HTTP response) run, then syncs Angular. */
async function settle() {
  await new Promise((resolve) => setTimeout(resolve));
  TestBed.tick();
}

describe('UtilityBillForm', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T10:00:00Z'));
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  async function render(entries: UtilityEntry[], id?: number) {
    const fixture = TestBed.createComponent(UtilityBillForm);
    document.body.appendChild(fixture.nativeElement);
    if (id !== undefined) {
      fixture.componentRef.setInput('id', String(id));
    }
    TestBed.tick();
    http.expectOne('/api/utilities').flush(entries);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const field = (selector: string) => element.querySelector<HTMLInputElement>(selector)!;
    const type = async (selector: string, value: string) => {
      field(selector).value = value;
      field(selector).dispatchEvent(new Event('input'));
      await fixture.whenStable();
    };
    const click = async (selector: string) => {
      field(selector).click();
      await fixture.whenStable();
    };
    const save = () => click('button[type="submit"]');
    return { fixture, element, field, type, click, save };
  }

  it('proposes the quarter after the latest entry', async () => {
    const { field } = await render([electricityQ2]);
    expect(field('#periodFrom').value).toBe('2026-07-01');
    expect(field('#periodTo').value).toBe('2026-09-30');
    expect(field('#garbage-amount')).toBeNull();
    expect(field('#wastewater-fixedFee')).toBeNull();
  });

  it('saves only the filled commodities as one bill', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const { fixture, element, type, save } = await render([electricityQ2]);
    await type('#electricity-amount', '901.25');
    await type('#electricity-cost', '258.66');
    await type('#electricity-fixedFee', '15');
    await type('#water-amount', '22');
    await type('#water-cost', '-12.50');
    await type('#invoiceNumber', ' 2026-1107 ');
    const notes = element.querySelector<HTMLTextAreaElement>('#notes')!;
    notes.value = 'Filed under\nEnergy 2026';
    notes.dispatchEvent(new Event('input'));
    await save();

    const request = http.expectOne({ method: 'POST', url: '/api/utilities' });
    expect(request.request.body).toEqual({
      periodFrom: '2026-07-01',
      periodTo: '2026-09-30',
      invoiceNumber: '2026-1107',
      notes: 'Filed under\nEnergy 2026',
      lines: [
        {
          commodity: 'electricity',
          amountMilli: 901_250,
          costRappen: 25_866,
          fixedFeeRappen: 1_500,
        },
        { commodity: 'water', amountMilli: 22_000, costRappen: -1_250, fixedFeeRappen: 0 },
      ],
    });
    request.flush([]);
    await settle();
    http.expectOne('/api/utilities').flush([]);
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith(['/utilities']);
  });

  it('rejects an empty bill, a reversed period and incomplete lines without calling the API', async () => {
    const { element, type, save } = await render([]);
    await save();
    expect(element.textContent).toContain('Fill in at least one commodity from the bill.');

    await type('#periodTo', '2026-06-30');
    await type('#electricity-fixedFee', '15');
    await type('#water-amount', '1.2345');
    await type('#garbage-fixedFee', 'abc');
    await save();
    expect(element.textContent).toContain('The end must not be before the start.');
    expect(element.textContent).toContain('Enter the amount in kWh.');
    expect(element.textContent).toContain('Enter the cost in CHF.');
    expect(element.textContent).toContain('Enter m³ with up to 3 decimals');
    expect(element.textContent).toContain('Enter CHF, e.g. 248.19');
    expect(element.querySelector('#periodTo')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('warns about an overlapping period and saves after confirming', async () => {
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const { element, type, click, save } = await render([electricityQ2]);
    await type('#periodFrom', '2026-06-01');
    await type('#electricity-amount', '100');
    await type('#electricity-cost', '30');
    expect(element.querySelector('[role="status"]')?.textContent).toContain(
      'Electricity 01.04.2026 – 30.06.2026',
    );
    await save();
    expect(element.textContent).toContain('Confirm that this is not a bill entered before.');

    await click('#confirmOverlap');
    await save();
    http.expectOne({ method: 'POST', url: '/api/utilities' }).flush([]);
    await settle();
    http.expectOne('/api/utilities').flush([]);
  });

  it('edits one entry with its own commodity only', async () => {
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const { element, field, type, save } = await render([electricityQ2], 4);
    expect(element.querySelector('h1')?.textContent).toContain('Edit bill entry');
    expect(field('#electricity-amount').value).toBe('812.5');
    expect(field('#invoiceNumber').value).toBe('2026-0815');
    expect(element.querySelector('#notes-hint')?.textContent).toContain('all of its entries');
    expect(field('#water-amount')).toBeNull();
    // The entry does not overlap itself.
    expect(element.querySelector('[role="status"]')).toBeNull();

    await type('#electricity-cost', '230');
    await save();
    const request = http.expectOne({ method: 'PUT', url: '/api/utilities/4' });
    expect(request.request.body).toEqual({
      commodity: 'electricity',
      periodFrom: '2026-04-01',
      periodTo: '2026-06-30',
      amountMilli: 812_500,
      costRappen: 23_000,
      fixedFeeRappen: 1_500,
    });
    request.flush(electricityQ2);
    await settle();
    http.expectOne('/api/utilities').flush([]);
  });

  it('limits the invoice number to one line of 100 characters', async () => {
    const { element, type, save } = await render([]);
    await type('#garbage-fixedFee', '45');
    await type('#invoiceNumber', 'x'.repeat(101));
    await save();
    expect(element.textContent).toContain('Use at most 100 characters.');
  });

  it('reports an entry that no longer exists', async () => {
    const { element } = await render([], 9);
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('could not be found');
  });

  it('explains a server-side validation error', async () => {
    const { fixture, element, type, save } = await render([]);
    await type('#garbage-fixedFee', '45');
    await save();
    http
      .expectOne({ method: 'POST', url: '/api/utilities' })
      .flush({ error: 'invalid' }, { status: 400, statusText: 'Bad Request' });
    await settle();
    await fixture.whenStable();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('check the entries');
  });
});
