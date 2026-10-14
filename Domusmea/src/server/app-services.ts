import { DatabaseSync } from 'node:sqlite';
import { DEFAULT_TIME_ZONE, todayIn } from '../shared/format';
import { DEFAULT_DB_PATH, openDatabase } from './db';
import { Clock, ItemRepository } from './items/item-repository';
import { createMailer } from './warranty/mailer';
import { startWarrantyNotifier } from './warranty/warranty-notifier';

/**
 * Process-wide services, created on first use from environment variables (see
 * docs/architecture/README.md). Nothing here runs when the build merely loads `server.ts`.
 */
const timeZone = validTimeZone(process.env['APP_TIMEZONE']);

export const clock: Clock = {
  now: () => new Date().toISOString(),
  today: () => todayIn(timeZone),
};

let database: DatabaseSync | undefined;
let items: ItemRepository | undefined;

export function itemRepository(): ItemRepository {
  database ??= openDatabase(process.env['DB_PATH'] ?? DEFAULT_DB_PATH);
  items ??= new ItemRepository(database, clock);
  return items;
}

/** Global flag so a dev-server reload of `server.ts` does not start a second set of jobs. */
const JOBS_STARTED = Symbol.for('domusmea.backgroundJobsStarted');

/** Starts the background jobs once per process. */
export function startBackgroundJobs(): void {
  const global = globalThis as Record<symbol, unknown>;
  if (global[JOBS_STARTED]) {
    return;
  }
  global[JOBS_STARTED] = true;
  startWarrantyNotifier({
    repository: itemRepository,
    mailer: createMailer(),
    recipients: parseRecipients(process.env['WARRANTY_NOTIFY_TO']),
    today: clock.today,
  });
}

/** `APP_TIMEZONE` if it is a valid IANA time zone, otherwise the default (logged). */
export function validTimeZone(value: string | undefined): string {
  if (!value) {
    return DEFAULT_TIME_ZONE;
  }
  try {
    todayIn(value);
    return value;
  } catch {
    console.error(`Invalid APP_TIMEZONE "${value}"; using ${DEFAULT_TIME_ZONE}.`);
    return DEFAULT_TIME_ZONE;
  }
}

export function parseRecipients(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((address) => address.trim())
    .filter(Boolean);
}
