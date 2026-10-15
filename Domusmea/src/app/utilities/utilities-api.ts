import { HttpClient, httpResource } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { UtilityBillInput, UtilityEntry, UtilityEntryInput } from '../../shared/utility';

const UTILITIES_URL = '/api/utilities';

/** Access to `/api/utilities`. `list` is the shared list of all entries; mutations reload it. */
@Service()
export class UtilitiesApi {
  private readonly http = inject(HttpClient);

  readonly list = httpResource<UtilityEntry[]>(() => UTILITIES_URL);

  /** Stores one entry per line of the bill. */
  async createBill(bill: UtilityBillInput): Promise<UtilityEntry[]> {
    const entries = await firstValueFrom(this.http.post<UtilityEntry[]>(UTILITIES_URL, bill));
    this.list.reload();
    return entries;
  }

  async update(id: number, input: UtilityEntryInput): Promise<UtilityEntry> {
    const entry = await firstValueFrom(
      this.http.put<UtilityEntry>(`${UTILITIES_URL}/${id}`, input),
    );
    this.list.reload();
    return entry;
  }

  async delete(id: number): Promise<void> {
    await firstValueFrom(this.http.delete<void>(`${UTILITIES_URL}/${id}`));
    this.list.reload();
  }
}
