import { HttpClient, httpResource } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Subscription, SubscriptionInput } from '../../../shared/subscription';

export const SUBSCRIPTIONS_URL = '/api/subscriptions';

/** Access to `/api/subscriptions`. `list` is the shared list by name; mutations reload it. */
@Service()
export class SubscriptionsApi {
  private readonly http = inject(HttpClient);

  readonly list = httpResource<Subscription[]>(() => SUBSCRIPTIONS_URL);

  async create(input: SubscriptionInput): Promise<Subscription> {
    const subscription = await firstValueFrom(
      this.http.post<Subscription>(SUBSCRIPTIONS_URL, input),
    );
    this.list.reload();
    return subscription;
  }

  async update(id: number, input: SubscriptionInput): Promise<Subscription> {
    const subscription = await firstValueFrom(
      this.http.put<Subscription>(`${SUBSCRIPTIONS_URL}/${id}`, input),
    );
    this.list.reload();
    return subscription;
  }

  async delete(id: number): Promise<void> {
    await firstValueFrom(this.http.delete<void>(`${SUBSCRIPTIONS_URL}/${id}`));
    this.list.reload();
  }
}
