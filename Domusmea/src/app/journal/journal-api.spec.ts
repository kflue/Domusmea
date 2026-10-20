import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { JournalEntryInput } from '../../shared/journal';
import { JournalApi } from './journal-api';

const input: JournalEntryInput = {
  date: '2026-10-01',
  title: 'Tap fixed',
  costRappen: null,
  contractor: null,
  notes: null,
  itemId: null,
};

/** Lets pending promise callbacks run, then syncs Angular so the reloaded list is requested. */
async function settle() {
  await new Promise((resolve) => setTimeout(resolve));
  TestBed.tick();
}

describe('JournalApi', () => {
  let http: HttpTestingController;
  let api: JournalApi;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(JournalApi);
    TestBed.tick();
    http.expectOne('/api/journal').flush([]);
  });

  afterEach(() => http.verify());

  it('creates, updates and deletes entries, reloading the list after each', async () => {
    const created = api.create(input);
    const post = http.expectOne({ method: 'POST', url: '/api/journal' });
    expect(post.request.body).toEqual(input);
    post.flush({ id: 1 });
    expect(await created).toEqual({ id: 1 });
    await settle();
    http.expectOne('/api/journal').flush([]);

    const updated = api.update(1, input);
    http.expectOne({ method: 'PUT', url: '/api/journal/1' }).flush({ id: 1 });
    await updated;
    await settle();
    http.expectOne('/api/journal').flush([]);

    const deleted = api.delete(1);
    http.expectOne({ method: 'DELETE', url: '/api/journal/1' }).flush(null);
    await deleted;
    await settle();
    http.expectOne('/api/journal').flush([]);
  });
});
