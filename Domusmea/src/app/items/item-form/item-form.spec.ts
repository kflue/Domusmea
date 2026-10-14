import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
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

  it('rejects a blank name and an invalid amount without calling the API', async () => {
    const { element, type, save } = await render();
    await type('name', '   ');
    await type('cost', '12.345');
    await save();

    expect(element.textContent).toContain('Enter a name.');
    expect(element.textContent).toContain('Enter an amount in CHF');
    expect(element.querySelector('#name')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('posts the converted item and returns to the list', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const { fixture, type, save } = await render();
    await type('name', ' Dishwasher ');
    await type('cost', "1'299.50");
    await save();

    const request = http.expectOne({ method: 'POST', url: '/api/items' });
    expect(request.request.body).toMatchObject({
      name: 'Dishwasher',
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
    await save();

    http
      .expectOne({ method: 'POST', url: '/api/items' })
      .flush({ error: 'invalid' }, { status: 400, statusText: 'Bad Request' });
    await settle();
    await fixture.whenStable();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('check the entries');
  });
});
