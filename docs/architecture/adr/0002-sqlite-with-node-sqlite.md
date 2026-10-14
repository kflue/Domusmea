# 0002: SQLite through Node's built-in `node:sqlite`

- Status: accepted
- Date: 2026-10-10

## Context

The app stores a household's data (items, later more). The user chose SQLite. Node 24 ships a
synchronous SQLite driver (`node:sqlite`, `DatabaseSync`); the common alternative, `better-sqlite3`,
is a native addon that must be compiled for each Node version.

## Decision

- Use `node:sqlite` (`DatabaseSync`), no ORM. Each feature has a repository with prepared statements
  and maps rows (snake_case) to shared types (camelCase).
- One database file, path from `DB_PATH` (default `data/domusmea.db`); the `data/` folder is
  git-ignored. Tests use `:memory:`.
- Schema changes are numbered migrations in `src/server/db.ts`, tracked with `PRAGMA user_version`
  and applied at startup inside a transaction.
- `PRAGMA foreign_keys = ON` and `journal_mode = WAL` are set on open.

## Consequences

- No native build step and no extra dependency.
- Queries are synchronous; fine for a single household's data volume and simpler than async drivers.
- `node:sqlite` is marked "release candidate" in Node 24; API changes on Node upgrades are possible
  but contained in `db.ts` and the repositories.
- Backups are a file copy (with the server stopped, or via `VACUUM INTO`).
