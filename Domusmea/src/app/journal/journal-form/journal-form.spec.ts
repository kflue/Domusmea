import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { JournalEntry } from '../../../shared/journal';
import { Item } from '../../../shared/item';
import { JournalForm } from './journal-form';

const boiler = { id: 4, name: 'Boiler' } as Item;
const roof = { id: 5, name: 'Roof' } as Item;

/** Lets pending promise callbacks (async handlers after an HTTP response) run, then syncs Angular. */
async function settle() {
  await new Promise((resolve) => setTimeout(resolve));
  TestBed.tick();
}

describe('JournalForm', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function render(existing?: JournalEntry) {
    const fixture = TestBed.createComponent(JournalForm);
    if (existing) {
      fixture.componentRef.setInput('id', String(existing.id));
    }
    // The shared lists load on first use; answer them so whenStable() does not wait for them.
    TestBed.tick();
    http.expectOne('/api/journal').flush([]);
    http.expectOne('/api/items').flush({ today: '2026-10-14', items: [roof, boiler] });
    if (existing) {
      http.expectOne(`/api/journal/${existing.id}`).flush(existing);
    }
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const type = async (selector: string, value: string) => {
      const input = element.querySelector<HTMLInputElement | HTMLSelectElement>(selector)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    };
    const save = async () => {
      element.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
      await fixture.whenStable();
    };
    return { fixture, element, type, save };
  }

  it('rejects a blank title, a missing date and an invalid amount without calling the API', async () => {
    const { element, type, save } = await render();
    await type('#title', '   ');
    await type('#date', '');
    await type('#cost', '12.345');
    await save();

    expect(element.textContent).toContain('Describe the work.');
    expect(element.textContent).toContain('Enter the date of the work.');
    expect(element.textContent).toContain('Enter an amount in CHF');
    expect(element.querySelector('#title')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('offers the items by name and posts the converted entry', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const { fixture, element, type, save } = await render();
    const options = [...element.querySelectorAll<HTMLOptionElement>('#itemId option')];
    expect(options.map((option) => option.textContent?.trim())).toEqual(['None', 'Boiler', 'Roof']);

    await type('#date', '2026-10-01');
    await type('#title', ' Heat pump serviced ');
    await type('#cost', "24'500");
    await type('#itemId', '4');
    await type('#notes', 'Filter replaced.\nNext service in 2027.');
    await save();

    const request = http.expectOne({ method: 'POST', url: '/api/journal' });
    expect(request.request.body).toEqual({
      date: '2026-10-01',
      title: 'Heat pump serviced',
      costRappen: 2450000,
      contractor: null,
      notes: 'Filter replaced.\nNext service in 2027.',
      itemId: 4,
    });
    request.flush({ id: 1 });
    await settle();
    http.expectOne('/api/journal').flush([]);
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith(['/journal']);
  });

  it('edits an existing entry', async () => {
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const { element, type, save } = await render({
      id: 7,
      date: '2025-06-01',
      title: 'Gutter cleaned',
      costRappen: 30000,
      contractor: null,
      notes: null,
      itemId: 5,
      itemName: 'Roof',
      createdAt: '2025-06-01T10:00:00.000Z',
      updatedAt: '2025-06-01T10:00:00.000Z',
    });
    expect(element.querySelector('h1')?.textContent).toContain('Edit repair');
    expect(element.querySelector<HTMLSelectElement>('#itemId')?.value).toBe('5');
    expect(element.querySelector<HTMLInputElement>('#cost')?.value).toBe('300.00');

    await type('#contractor', 'Dach AG');
    await save();

    const request = http.expectOne({ method: 'PUT', url: '/api/journal/7' });
    expect(request.request.body).toMatchObject({ contractor: 'Dach AG', itemId: 5 });
    request.flush({ id: 7 });
    await settle();
    http.expectOne('/api/journal').flush([]);
  });

  it('explains a server-side validation error', async () => {
    const { fixture, element, type, save } = await render();
    await type('#title', 'Tap fixed');
    await save();

    http
      .expectOne({ method: 'POST', url: '/api/journal' })
      .flush({ error: 'invalid' }, { status: 400, statusText: 'Bad Request' });
    await settle();
    await fixture.whenStable();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('check the entries');
  });
});
