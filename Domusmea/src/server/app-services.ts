import { DatabaseSync } from 'node:sqlite';
import { DEFAULT_TIME_ZONE, todayIn } from '../shared/format';
import { AuthRepository } from './auth/auth-repository';
import { DEFAULT_DB_PATH, openDatabase } from './db';
import { EmailSettingsRepository } from './email/email-settings-repository';
import { createMailer } from './email/mailer';
import { secretBoxFromEnv } from './email/secret-box';
import { Clock, ItemRepository } from './items/item-repository';
import { JournalRepository } from './journal/journal-repository';
import { startCancellationReminder } from './subscriptions/cancellation-reminder';
import { SubscriptionRepository } from './subscriptions/subscription-repository';
import { UtilityRepository } from './utilities/utility-repository';
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

/** `ALLOW_REMOTE_SETUP=true` accepts the first-run setup from other machines (ADR 0007). */
export const allowRemoteSetup = process.env['ALLOW_REMOTE_SETUP'] === 'true';

/** `SECURE_COOKIES=true` always marks the session cookie `Secure`, for TLS proxies (ADR 0007). */
export const secureCookies = process.env['SECURE_COOKIES'] === 'true';

let database: DatabaseSync | undefined;
let auth: AuthRepository | undefined;
let items: ItemRepository | undefined;
let journal: JournalRepository | undefined;
let subscriptions: SubscriptionRepository | undefined;
let utilities: UtilityRepository | undefined;
let emailSettings: EmailSettingsRepository | undefined;

function db(): DatabaseSync {
  database ??= openDatabase(process.env['DB_PATH'] ?? DEFAULT_DB_PATH);
  return database;
}

export function authRepository(): AuthRepository {
  auth ??= new AuthRepository(db(), clock.now);
  return auth;
}

export function itemRepository(): ItemRepository {
  items ??= new ItemRepository(db(), clock);
  return items;
}

export function journalRepository(): JournalRepository {
  journal ??= new JournalRepository(db(), clock.now);
  return journal;
}

export function subscriptionRepository(): SubscriptionRepository {
  subscriptions ??= new SubscriptionRepository(db(), clock.now);
  return subscriptions;
}

export function utilityRepository(): UtilityRepository {
  utilities ??= new UtilityRepository(db(), clock.now);
  return utilities;
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
  const email = {
    recipients: () => emailSettingsRepository().get().recipients,
    mailer: () => createMailer(emailSettingsRepository().mailConfig().smtp),
    today: clock.today,
  };
  startWarrantyNotifier({ ...email, repository: itemRepository });
  startCancellationReminder({ ...email, repository: subscriptionRepository });
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
