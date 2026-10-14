import { formatChf, formatDate } from '../../shared/format';
import { Item, ITEM_CATEGORY_LABELS } from '../../shared/item';
import { ItemRepository } from '../items/item-repository';
import { Mail, Mailer } from './mailer';

export interface WarrantyNotifierDeps {
  repository: () => ItemRepository;
  mailer: Mailer;
  /** Email recipients; with none, nothing is sent and items stay unannounced. */
  recipients: readonly string[];
  /** Today's date in the app time zone as `YYYY-MM-DD`. */
  today: () => string;
}

/**
 * Sends one email listing all items whose warranty expired and that were not announced yet, then
 * marks them. If sending fails, nothing is marked and the next check retries (ADR 0003).
 * Returns the number of announced items.
 */
export async function notifyExpiredWarranties(deps: WarrantyNotifierDeps): Promise<number> {
  if (deps.recipients.length === 0) {
    return 0;
  }
  const today = deps.today();
  const repository = deps.repository();
  const items = repository.findWarrantyExpiredUnnotified(today);
  if (items.length === 0) {
    return 0;
  }
  await deps.mailer.send(warrantyMail(items, deps.recipients, today));
  repository.markWarrantyNotified(
    items.map((item) => item.id),
    today,
  );
  return items.length;
}

/**
 * The email is normally sent on the expiry day ("ends today"); items found later, e.g. after the
 * server was down, are described as ended (ADR 0003).
 */
export function warrantyMail(items: readonly Item[], to: readonly string[], today: string): Mail {
  const allToday = items.every((item) => item.warrantyExpires === today);
  if (items.length === 1) {
    const [item] = items;
    return {
      to,
      subject: allToday ? `Warranty ends today: ${item.name}` : `Warranty ended: ${item.name}`,
      text: mailText(
        allToday
          ? 'The warranty of the following item ends today:'
          : 'The warranty of the following item has ended:',
        items,
      ),
    };
  }
  return {
    to,
    subject: allToday
      ? `Warranty ends today for ${items.length} items`
      : `Warranty ended for ${items.length} items`,
    text: mailText(
      allToday
        ? 'The warranties of the following items end today:'
        : 'The warranties of the following items end today or have ended:',
      items,
    ),
  };
}

function mailText(intro: string, items: readonly Item[]): string {
  return [intro, ...items.map(describe), 'Domusmea'].join('\n\n');
}

function describe(item: Item): string {
  const details: [string, string | null][] = [
    ['Warranty until', item.warrantyExpires && formatDate(item.warrantyExpires)],
    ['Category', item.category && ITEM_CATEGORY_LABELS[item.category]],
    ['Manufacturer', item.manufacturer],
    ['Model', item.model],
    ['Serial number', item.serialNumber],
    ['Bought from', item.seller],
    ['Purchased', item.purchaseDate && formatDate(item.purchaseDate)],
    ['Cost', item.costRappen === null ? null : formatChf(item.costRappen)],
  ];
  return [
    `- ${item.name}`,
    ...details.filter(([, value]) => value).map(([label, value]) => `  ${label}: ${value}`),
  ].join('\n');
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * Runs the check now and then every `intervalMs`, never overlapping. Returns a function that stops
 * the timer. The timer does not keep the process alive.
 */
export function startWarrantyNotifier(
  deps: WarrantyNotifierDeps,
  intervalMs = HOUR_MS,
): () => void {
  if (deps.recipients.length === 0) {
    console.warn('Warranty emails disabled: WARRANTY_NOTIFY_TO is not set.');
  }
  let running = false;
  const run = async () => {
    if (running) {
      return;
    }
    running = true;
    try {
      const count = await notifyExpiredWarranties(deps);
      if (count > 0) {
        console.log(`Warranty email sent for ${count} item(s).`);
      }
    } catch (error) {
      console.error('Warranty check failed; retrying at the next check.', error);
    } finally {
      running = false;
    }
  };
  void run();
  const timer = setInterval(() => void run(), intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
