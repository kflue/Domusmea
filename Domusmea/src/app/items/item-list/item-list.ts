import { DOCUMENT } from '@angular/common';
import { afterNextRender, Component, computed, inject, Injector, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatChf, formatDate } from '../../../shared/format';
import { Item, ITEM_CATEGORY_LABELS } from '../../../shared/item';
import { ConfirmDelete } from '../../shared/confirm-delete';
import { ItemsApi } from '../items-api';

type WarrantyStatus = 'expired' | 'expires-today' | 'active' | 'none';

interface ItemRow {
  item: Item;
  category: string;
  purchased: string;
  cost: string;
  warranty: string;
  warrantyStatus: WarrantyStatus;
}

/** Appliances and building parts with cost and warranty status (`/items`). */
@Component({
  selector: 'app-item-list',
  imports: [RouterLink, ConfirmDelete],
  templateUrl: './item-list.html',
  host: {
    // Refresh when the tab becomes visible again so "today" and the list are not stale.
    '(document:visibilitychange)': 'refreshIfVisible()',
  },
})
export class ItemList {
  private readonly api = inject(ItemsApi);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  protected readonly list = this.api.list;

  protected readonly rows = computed<ItemRow[]>(() => {
    if (!this.list.hasValue()) {
      return [];
    }
    // "Today" comes from the server, so badges match the warranty emails (APP_TIMEZONE).
    const { today, items } = this.list.value();
    return items.map((item) => toRow(item, today));
  });

  protected readonly totalCost = computed(() =>
    formatChf(this.rows().reduce((sum, row) => sum + (row.item.costRappen ?? 0), 0)),
  );

  protected readonly deleteError = signal('');

  protected async delete(item: Item): Promise<void> {
    this.deleteError.set('');
    try {
      await this.api.delete(item.id);
      // The row is gone; keep keyboard focus nearby.
      afterNextRender(() => this.document.getElementById('items-heading')?.focus(), {
        injector: this.injector,
      });
    } catch {
      this.deleteError.set(`“${item.name}” could not be deleted. Please try again.`);
    }
  }

  protected refreshIfVisible(): void {
    if (this.document.visibilityState === 'visible') {
      this.list.reload();
    }
  }
}

function toRow(item: Item, today: string): ItemRow {
  return {
    item,
    category: item.category ? ITEM_CATEGORY_LABELS[item.category] : '–',
    purchased: item.purchaseDate ? formatDate(item.purchaseDate) : '–',
    cost: item.costRappen === null ? '–' : formatChf(item.costRappen),
    warranty: item.warrantyExpires ? formatDate(item.warrantyExpires) : '–',
    warrantyStatus: warrantyStatus(item.warrantyExpires, today),
  };
}

function warrantyStatus(expires: string | null, today: string): WarrantyStatus {
  if (!expires) {
    return 'none';
  }
  if (expires === today) {
    return 'expires-today';
  }
  return expires < today ? 'expired' : 'active';
}
