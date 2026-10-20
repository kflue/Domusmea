import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { JournalEntry } from '../../../shared/journal';
import { JournalList } from './journal-list';

const baseEntry: JournalEntry = {
  id: 1,
  date: '2026-09-01',
  title: 'Boiler serviced',
  costRappen: 45000,
  contractor: 'Heizung Meier AG',
  notes: null,
  itemId: 4,
  itemName: 'Boiler',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
};

const entries: JournalEntry[] = [
  baseEntry,
  {
    ...baseEntry,
    id: 2,
    date: '2026-03-15',
    title: 'Roof tiles replaced',
    costRappen: 2000000,
    contractor: null,
    itemId: null,
    itemName: null,
  },
  { ...baseEntry, id: 3, date: '2025-11-20', title: 'Roof gutter cleaned', costRappen: 30000 },
];

/** Lets pending promise callbacks (async handlers after an HTTP response) run, then syncs Angular. */
async function settle() {
  await new Promise((resolve) => setTimeout(resolve));
  TestBed.tick();
}

describe('JournalList', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  async function render(response: JournalEntry[]) {
    const fixture = TestBed.createComponent(JournalList);
    // Attached to the document so focus can be checked.
    document.body.appendChild(fixture.nativeElement);
    TestBed.tick();
    http.expectOne('/api/journal').flush(response);
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  afterEach(() => {
    http.verify();
    document.body.innerHTML = '';
  });

  const rowTexts = (element: HTMLElement) =>
    [...element.querySelectorAll('tbody tr')].map((row) => row.textContent ?? '');

  it('shows repairs with item, contractor and their total', async () => {
    const { element } = await render(entries);
    const rows = rowTexts(element);

    expect(rows).toHaveLength(3);
    expect(rows[0]).toContain('01.09.2026');
    expect(rows[0]).toContain('Boiler · Heizung Meier AG');
    expect(rows[0]).toMatch(/CHF\s450\.00/);
    const totals = element.querySelector('dl')?.textContent ?? '';
    expect(totals).toMatch(/Total\s*CHF\s20.750\.00/);
  });

  it('filters by year, which also changes the totals', async () => {
    const { fixture, element } = await render(entries);
    const year = element.querySelector<HTMLSelectElement>('#year')!;
    expect([...year.options].map((option) => option.value)).toEqual(['', '2026', '2025']);

    year.value = '2025';
    year.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(rowTexts(element)).toEqual([expect.stringContaining('Roof gutter cleaned')]);
    expect(element.querySelector('dl')?.textContent).toMatch(/Total\s*CHF\s300\.00/);
  });

  it('invites to add the first entry when the journal is empty', async () => {
    const { element } = await render([]);
    expect(element.textContent).toContain('No repairs yet.');
    expect(element.querySelector('table')).toBeNull();
  });

  it('confirms before deleting and keeps keyboard focus on the actions', async () => {
    const { fixture, element } = await render([baseEntry]);
    const button = (label: string) =>
      element.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`);

    button('Delete Boiler serviced')!.click();
    await fixture.whenStable();
    expect(document.activeElement).toBe(button('Confirm: delete Boiler serviced'));

    button('Keep Boiler serviced')!.click();
    await fixture.whenStable();
    expect(document.activeElement).toBe(button('Delete Boiler serviced'));

    button('Delete Boiler serviced')!.click();
    await fixture.whenStable();
    button('Confirm: delete Boiler serviced')!.click();
    http.expectOne({ method: 'DELETE', url: '/api/journal/1' }).flush(null);
    await settle();
    http.expectOne('/api/journal').flush([]);
    await fixture.whenStable();
    expect(document.activeElement).toBe(element.querySelector('#journal-heading'));
  });

  it('reports a failed delete', async () => {
    const { fixture, element } = await render([baseEntry]);
    element.querySelector<HTMLButtonElement>('[aria-label="Delete Boiler serviced"]')!.click();
    await fixture.whenStable();
    element
      .querySelector<HTMLButtonElement>('[aria-label="Confirm: delete Boiler serviced"]')!
      .click();
    http
      .expectOne({ method: 'DELETE', url: '/api/journal/1' })
      .flush(null, { status: 500, statusText: 'Server Error' });
    await settle();
    await fixture.whenStable();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('could not be deleted');
  });
});
