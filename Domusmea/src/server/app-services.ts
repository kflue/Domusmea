import { DatabaseSync } from 'node:sqlite';
import { DEFAULT_TIME_ZONE, todayIn } from '../shared/format';
import { DEFAULT_DB_PATH, openDatabase } from './db';
import { EmailSettingsRepository } from './email/email-settings-repository';
import { createMailer } from './email/mailer';
import { secretBoxFromEnv } from './email/secret-box';
import { Clock, ItemRepository } from './items/item-repository';
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
let emailSettings: EmailSettingsRepository | undefined;

function db(): DatabaseSync {
  database ??= openDatabase(process.env['DB_PATH'] ?? DEFAULT_DB_PATH);
  return database;
}

export function itemRepository(): ItemRepository {
  items ??= new ItemRepository(db(), clock);
  return items;
}

export function emailSettingsRepository(): EmailSettingsRepository {
  emailSettings ??= new EmailSettingsRepository(
    db(),
    secretBoxFromEnv(process.env['SETTINGS_KEY']),
    clock.now,
  );
  return emailSettings;
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
    recipients: () => emailSettingsRepository().get().recipients,
    mailer: () => createMailer(emailSettingsRepository().mailConfig().smtp),
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
