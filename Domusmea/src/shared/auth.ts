/**
 * Permissions checked by the API (ADR 0007). Roles are stored in the database as sets of these; a new
 * permission is granted to existing roles by the migration that introduces it.
 */
export const PERMISSIONS = [
  'items:read',
  'items:write',
  'settings:read',
  'settings:write',
  'account:manage',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** Credentials of a fresh installation; they only lead to the first-run setup. */
export const DEFAULT_USERNAME = 'admin';
export const DEFAULT_PASSWORD = 'admin';

/** Usernames: 3 to 32 letters, digits, `.`, `_` or `-`. */
export const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,32}$/;
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 256;

/** The signed-in user, as returned by the auth endpoints. */
export interface SessionUser {
  username: string;
  role: string;
  permissions: Permission[];
  /** The default credentials are still in use; only the first-run setup is allowed. */
  setupRequired: boolean;
}

/** Body of `GET /api/auth/session`, `POST /api/auth/login` and `POST /api/auth/setup`. */
export interface SessionResponse {
  /** `null` when not signed in. */
  user: SessionUser | null;
}

/** Request body of `POST /api/auth/login`. */
export interface LoginInput {
  username: string;
  password: string;
}

/** Request body of `POST /api/auth/setup`: the credentials replacing the default ones. */
export interface SetupInput {
  username: string;
  password: string;
}

/** Error codes of the API's authentication and authorization checks. */
export type AuthError =
  /** Wrong username or password; never says which. */
  | 'invalid-credentials'
  /** Too many failed logins; try again later. */
  | 'too-many-attempts'
  /** The first-run setup is only accepted from the server machine (ADR 0007). */
  | 'setup-local-only'
  /** No valid session. */
  | 'unauthenticated'
  /** Signed in with the default credentials; only the setup is allowed. */
  | 'setup-required'
  /** The user's role lacks the permission. */
  | 'forbidden';

/** A successful sign-in, as listed in Settings so the owner can spot one they did not make. */
export interface SignIn {
  /** ISO timestamp. */
  at: string;
  /** Address the server saw: the client's, or the proxy's when the request came through one. */
  address: string;
  /** Client address reported by the proxy (`X-Forwarded-For`); unverified, for display only. */
  forwardedFor: string | null;
}

/** Number of sign-ins kept per account (newest first in {@link AccountInfo}). */
export const MAX_SIGN_INS = 10;

/** Body of `GET /api/account`. */
export interface AccountInfo {
  username: string;
  /** Newest first; the first entry is usually the current sign-in. */
  recentSignIns: SignIn[];
}

/** Request body of `PUT /api/account/password`. */
export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

/**
 * Why `password` cannot be a new password for `username`, as shown in the UI; `undefined` if it can.
 * The API checks the same rules.
 */
export function newPasswordProblem(password: string, username: string): string | undefined {
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return `Use ${MIN_PASSWORD_LENGTH} to ${MAX_PASSWORD_LENGTH} characters.`;
  }
  const lower = password.toLowerCase();
  return lower === DEFAULT_PASSWORD || lower === username.trim().toLowerCase()
    ? 'Choose a password that differs from the username.'
    : undefined;
}
