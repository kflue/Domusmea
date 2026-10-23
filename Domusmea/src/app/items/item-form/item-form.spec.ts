import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Item } from '../../../shared/item';
import { JournalEntry } from '../../../shared/journal';
import { AuthApi } from '../../auth/auth-api';
import { ItemForm } from './item-form';

/** Lets pending promise callbacks (async handlers after an HTTP response) run, then syncs Angular. */
async function settle() {
  await new Promise((resolve) => setTimeout(resolve));
  TestBed.tick();
}

describe('ItemForm', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function render() {
    const fixture = TestBed.createComponent(ItemForm);
    // ItemsApi loads the shared list on first use; answer it so whenStable() does not wait for it.
    TestBed.tick();
    http.expectOne('/api/items').flush({ today: '2026-10-11', items: [] });
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const type = async (id: string, value: string) => {
      const input = element.querySelector<HTMLInputElement>(`#${id}`)!;
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

  it('rejects a blank name, a missing purchase date and an invalid amount without calling the API', async () => {
    const { element, type, save } = await render();
    await type('name', '   ');
    await type('cost', '12.345');
    await save();

    expect(element.textContent).toContain('Enter a name.');
    expect(element.textContent).toContain('Enter the purchase date');
    expect(element.textContent).toContain('Enter an amount in CHF');
    expect(element.querySelector('#name')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('posts the converted item and returns to the list', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const { fixture, type, save } = await render();
    await type('name', ' Dishwasher ');
    await type('purchaseDate', '2026-04-01');
    await type('cost', "1'299.50");
    await save();

    const request = http.expectOne({ method: 'POST', url: '/api/items' });
    expect(request.request.body).toMatchObject({
      name: 'Dishwasher',
      purchaseDate: '2026-04-01',
      costRappen: 129950,
      seller: null,
    });
    request.flush({ id: 1 });
    await settle();
    http.expectOne('/api/items').flush({ today: '2026-10-11', items: [] });
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith(['/items']);
  });

  it('explains a server-side validation error', async () => {
    const { fixture, element, type, save } = await render();
    await type('name', 'Oven');
    await type('purchaseDate', '2026-04-01');
    await save();

    http
      .expectOne({ method: 'POST', url: '/api/items' })
      .flush({ error: 'invalid' }, { status: 400, statusText: 'Bad Request' });
    await settle();
    await fixture.whenStable();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('check the entries');
  });

  describe('when editing', () => {
    const boiler: Item = {
      id: 4,
      name: 'Boiler',
      category: 'appliance',
      purchaseDate: '2020-05-01',
      costRappen: 800_000,
      warrantyExpires: null,
      manufacturer: null,
      model: null,
      serialNumber: null,
      seller: null,
      createdAt: '2020-05-01T10:00:00.000Z',
      updatedAt: '2020-05-01T10:00:00.000Z',
    };
    const repair = (itemId: number | null, costRappen: number | null): Partial<JournalEntry> => ({
      itemId,
      costRappen,
    });

    async function renderEdit(canReadJournal: boolean) {
      vi.spyOn(TestBed.inject(AuthApi), 'can').mockReturnValue(canReadJournal);
      const fixture = TestBed.createComponent(ItemForm);
      fixture.componentRef.setInput('id', '4');
      TestBed.tick();
      http.expectOne('/api/items').flush({ today: '2026-10-11', items: [] });
      http.expectOne('/api/items/4').flush(boiler);
      return fixture;
    }

    it("shows the item's repairs and its cost over its life (R7)", async () => {
      const fixture = await renderEdit(true);
      http
        .expectOne('/api/journal')
        .flush([repair(4, 30_000), repair(4, null), repair(9, 99_900), repair(null, 1)]);
      await fixture.whenStable();
      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toMatch(/Repairs: CHF\s300\.00 in 2 entries/);
      expect(text).toMatch(/purchase included: CHF\s8.300\.00/);
    });

    it('does not load the journal without journal:read', async () => {
      const fixture = await renderEdit(false);
      await fixture.whenStable();
      http.expectNone('/api/journal');
      expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Repairs');
    });
  });
});
