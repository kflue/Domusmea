import { HttpClient, httpResource } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Item, ItemInput, ItemList } from '../../shared/item';

export const ITEMS_URL = '/api/items';

/** Access to `/api/items`. `list` is the shared item list; mutations reload it. */
@Service()
export class ItemsApi {
  private readonly http = inject(HttpClient);

  readonly list = httpResource<ItemList>(() => ITEMS_URL);

  async create(input: ItemInput): Promise<Item> {
    const item = await firstValueFrom(this.http.post<Item>(ITEMS_URL, input));
    this.list.reload();
    return item;
  }

  async update(id: number, input: ItemInput): Promise<Item> {
    const item = await firstValueFrom(this.http.put<Item>(`${ITEMS_URL}/${id}`, input));
    this.list.reload();
    return item;
  }

  async delete(id: number): Promise<void> {
    await firstValueFrom(this.http.delete<void>(`${ITEMS_URL}/${id}`));
    this.list.reload();
  }
}
