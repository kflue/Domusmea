import { HttpClient, httpResource } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { JournalEntry, JournalEntryInput } from '../../shared/journal';

const JOURNAL_URL = '/api/journal';

/** Access to `/api/journal`. `list` is the shared journal, newest first; mutations reload it. */
@Service()
export class JournalApi {
  private readonly http = inject(HttpClient);

  readonly list = httpResource<JournalEntry[]>(() => JOURNAL_URL);

  async create(input: JournalEntryInput): Promise<JournalEntry> {
    const entry = await firstValueFrom(this.http.post<JournalEntry>(JOURNAL_URL, input));
    this.list.reload();
    return entry;
  }

  async update(id: number, input: JournalEntryInput): Promise<JournalEntry> {
    const entry = await firstValueFrom(this.http.put<JournalEntry>(`${JOURNAL_URL}/${id}`, input));
    this.list.reload();
    return entry;
  }

  async delete(id: number): Promise<void> {
    await firstValueFrom(this.http.delete<void>(`${JOURNAL_URL}/${id}`));
    this.list.reload();
  }
}
