import { createHash, randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import {
  DEFAULT_USERNAME,
  MAX_SIGN_INS,
  Permission,
  PERMISSIONS,
  SessionUser,
  SignIn,
} from '../../shared/auth';

/**
 * scrypt hash of the default password `admin` (from `hashPassword`). The password is public, so a
 * fixed salt costs nothing; the hash is also checked for unknown usernames, so a login takes the same
 * time whether the username exists or not.
 */
export const DEFAULT_PASSWORD_HASH =
  'scrypt$32768$8$1$VW0NBICeYO4xZKDe9TFJWQ==$73R0HdTWAY3TsY3CEMY6C9Nxk6Vx5ZjVrV9mugCtVPI=';

/** Sessions end after this long without a request (ADR 0007). */
export const SESSION_IDLE_MS = 7 * 24 * 60 * 60 * 1000;

/** `last_seen_at` is written at most this often per session. */
const TOUCH_INTERVAL_MS = 60_000;

/** The role seeded by the migration; it holds every permission. */
const OWNER_ROLE_ID = 1;

/** A user account with its role's permissions. */
export interface Account extends SessionUser {
  id: number;
}

interface AccountRow {
  id: number;
  username: string;
  password_hash: string;
  must_change_credentials: number;
  role_id: number;
  role: string;
}

interface SessionRow extends AccountRow {
  token_hash: string;
  last_seen_at: string;
}

const ACCOUNT_COLUMNS = `users.id, users.username, users.password_hash,
  users.must_change_credentials, users.role_id, roles.name AS role`;

/**
 * Persistence of user accounts, roles and sessions (ADR 0007). Session tokens are only stored as
 * SHA-256 hashes, so a copy of the database cannot be used to sign in.
 */
export class AuthRepository {
  constructor(
    private readonly db: DatabaseSync,
    private readonly now: () => string,
  ) {
    this.createDefaultAccountIfNone();
  }

  /** The account for `username` (case-insensitive) with its password hash, to check a login. */
  credentials(username: string): { account: Account; passwordHash: string } | undefined {
    const row = this.db
      .prepare(
        `SELECT ${ACCOUNT_COLUMNS} FROM users JOIN roles ON roles.id = users.role_id
         WHERE users.username = ?`,
      )
      .get(username) as AccountRow | undefined;
    return row && { account: this.toAccount(row), passwordHash: row.password_hash };
  }

  /**
   * Replaces the default credentials of account `id` and ends all its sessions. Returns the updated
   * account, or `undefined` if the account does not need the setup (it can only run once).
   */
  completeSetup(id: number, username: string, passwordHash: string): Account | undefined {
    return this.transaction(() => {
      const { changes } = this.db
        .prepare(
          `UPDATE users SET username = ?, password_hash = ?, must_change_credentials = 0,
             updated_at = ?
           WHERE id = ? AND must_change_credentials = 1`,
        )
        .run(username, passwordHash, this.now(), id);
      if (changes === 0) {
        return undefined;
      }
      this.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
      return this.credentials(username)?.account;
    });
  }

  /**
   * Resets the owner account to the default credentials and ends all sessions, for a forgotten
   * password (`--reset-login`). Household data is not touched.
   */
  resetToDefault(): void {
    this.transaction(() => {
      this.db.exec('DELETE FROM sessions');
      this.db
        .prepare(
          `UPDATE users SET username = ?, password_hash = ?, must_change_credentials = 1,
             updated_at = ?
           WHERE id = (SELECT MIN(id) FROM users WHERE role_id = ?)`,
        )
        .run(DEFAULT_USERNAME, DEFAULT_PASSWORD_HASH, this.now(), OWNER_ROLE_ID);
      this.createDefaultAccountIfNone();
    });
  }

  /** Starts a session for account `id` and returns its token (for the cookie). */
  createSession(id: number): string {
    this.db.prepare('DELETE FROM sessions WHERE last_seen_at < ?').run(this.idleCutoff());
    const token = randomBytes(32).toString('base64url');
    const now = this.now();
    this.db
      .prepare(
        'INSERT INTO sessions (token_hash, user_id, created_at, last_seen_at) VALUES (?, ?, ?, ?)',
      )
      .run(hashToken(token), id, now, now);
    return token;
  }

  /** The account of an unexpired session, which counts as activity; `undefined` otherwise. */
  sessionAccount(token: string): Account | undefined {
    const row = this.db
      .prepare(
        `SELECT ${ACCOUNT_COLUMNS}, sessions.token_hash, sessions.last_seen_at
         FROM sessions
           JOIN users ON users.id = sessions.user_id
           JOIN roles ON roles.id = users.role_id
         WHERE sessions.token_hash = ? AND sessions.last_seen_at >= ?`,
      )
      .get(hashToken(token), this.idleCutoff()) as SessionRow | undefined;
    if (!row) {
      return undefined;
    }
    const now = this.now();
    if (Date.parse(now) - Date.parse(row.last_seen_at) >= TOUCH_INTERVAL_MS) {
      this.db
        .prepare('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?')
        .run(now, row.token_hash);
    }
    return this.toAccount(row);
  }

  deleteSession(token: string): void {
    this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
  }

  /** Ends every session of account `id` (sign out on all devices). */
  deleteSessionsOf(id: number): void {
    this.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
  }

  /** The password hash of account `id`, to check the current password before a change. */
  passwordHash(id: number): string | undefined {
    const row = this.db.prepare('SELECT password_hash FROM users WHERE id = ?').get(id) as
      | { password_hash: string }
      | undefined;
    return row?.password_hash;
  }

  /**
   * Replaces the password of account `id`, ends all its sessions (a stolen token stops working, even
   * the one used for the change) and returns the token of a new session for the caller.
   */
  changePassword(id: number, passwordHash: string): string {
    return this.transaction(() => {
      this.db
        .prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
        .run(passwordHash, this.now(), id);
      this.deleteSessionsOf(id);
      return this.createSession(id);
    });
  }

  /** Records a successful sign-in, keeping the newest {@link MAX_SIGN_INS} per account. */
  recordSignIn(id: number, address: string, forwardedFor: string | null): void {
    this.transaction(() => {
      this.db
        .prepare(
          'INSERT INTO sign_ins (user_id, signed_in_at, address, forwarded_for) VALUES (?, ?, ?, ?)',
        )
        .run(id, this.now(), address, forwardedFor);
      this.db
        .prepare(
          `DELETE FROM sign_ins WHERE user_id = ? AND id NOT IN
             (SELECT id FROM sign_ins WHERE user_id = ? ORDER BY id DESC LIMIT ?)`,
        )
        .run(id, id, MAX_SIGN_INS);
    });
  }

  /** Recent sign-ins of account `id`, newest first. */
  recentSignIns(id: number): SignIn[] {
    return this.db
      .prepare(
        `SELECT signed_in_at AS at, address, forwarded_for AS forwardedFor FROM sign_ins
         WHERE user_id = ? ORDER BY id DESC`,
      )
      .all(id)
      .map((row) => ({ ...(row as unknown as SignIn) }));
  }

  private createDefaultAccountIfNone(): void {
    const now = this.now();
    this.db
      .prepare(
        `INSERT INTO users (username, password_hash, role_id, must_change_credentials, created_at,
           updated_at)
         SELECT ?, ?, ?, 1, ?, ? WHERE NOT EXISTS (SELECT 1 FROM users)`,
      )
      .run(DEFAULT_USERNAME, DEFAULT_PASSWORD_HASH, OWNER_ROLE_ID, now, now);
  }

  private toAccount(row: AccountRow): Account {
    const granted = new Set(
      (
        this.db
          .prepare('SELECT permission FROM role_permissions WHERE role_id = ?')
          .all(row.role_id) as { permission: string }[]
      ).map(({ permission }) => permission),
    );
    return {
      id: row.id,
      username: row.username,
      role: row.role,
      permissions: PERMISSIONS.filter((permission: Permission) => granted.has(permission)),
      setupRequired: row.must_change_credentials === 1,
    };
  }

  private idleCutoff(): string {
    return new Date(Date.parse(this.now()) - SESSION_IDLE_MS).toISOString();
  }

  private transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
