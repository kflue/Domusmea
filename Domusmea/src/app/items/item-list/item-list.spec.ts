import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Item, ItemList as ItemListResponse } from '../../../shared/item';
import { ItemList } from './item-list';

const baseItem: Item = {
  id: 1,
  name: 'Dishwasher',
  category: 'appliance',
  purchaseDate: '2024-03-01',
  costRappen: 129950,
  warrantyExpires: '2026-10-11',
  manufacturer: 'V-Zug',
  model: null,
  serialNumber: null,
  seller: null,
  createdAt: '2024-03-01T10:00:00.000Z',
  updatedAt: '2024-03-01T10:00:00.000Z',
};

/** Lets pending promise callbacks (async handlers after an HTTP response) run, then syncs Angular. */
async function settle() {
  await new Promise((resolve) => setTimeout(resolve));
  TestBed.tick();
}

describe('ItemList', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  async function render(response: ItemListResponse) {
    const fixture = TestBed.createComponent(ItemList);
    // Attached to the document so focus can be checked.
    document.body.appendChild(fixture.nativeElement);
    // whenStable() waits for open requests, so start and answer the list request first.
    TestBed.tick();
    http.expectOne('/api/items').flush(response);
    await fixture.whenStable();
    return fixture;
  }

  afterEach(() => {
    http.verify();
    document.body.innerHTML = '';
  });

  it('shows formatted values, warranty status based on the server date, and a total', async () => {
    const fixture = await render({
      today: '2026-10-11',
      items: [
        baseItem,
        { ...baseItem, id: 2, name: 'Oven', costRappen: 50, warrantyExpires: '2026-10-10' },
      ],
    });
    const element = fixture.nativeElement as HTMLElement;
    const rows = [...element.querySelectorAll('tbody tr')].map((row) => row.textContent ?? '');

    expect(rows[0]).toContain('Dishwasher');
    expect(rows[0]).toContain('01.03.2024');
    expect(rows[0]).toMatch(/CHF\s1.299\.50/);
    expect(rows[0]).toContain('Ends today');
    expect(rows[1]).toContain('Expired');
    expect(element.querySelector('tfoot')?.textContent).toMatch(/CHF\s1.300\.00/);
  });

  it('confirms before deleting and keeps keyboard focus on the actions', async () => {
    const fixture = await render({ today: '2026-10-01', items: [baseItem] });
    const element = fixture.nativeElement as HTMLElement;

    const button = (label: string) =>
      element.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`);

    button('Delete Dishwasher')!.click();
    await fixture.whenStable();
    expect(document.activeElement).toBe(button('Confirm: delete Dishwasher'));

    button('Keep Dishwasher')!.click();
    await fixture.whenStable();
    expect(document.activeElement).toBe(button('Delete Dishwasher'));

    button('Delete Dishwasher')!.click();
    await fixture.whenStable();
    button('Confirm: delete Dishwasher')!.click();
    http.expectOne({ method: 'DELETE', url: '/api/items/1' }).flush(null);
    await settle();
    http.expectOne('/api/items').flush({ today: '2026-10-01', items: [] });
    await fixture.whenStable();
    expect(document.activeElement).toBe(element.querySelector('#items-heading'));
  });
});
