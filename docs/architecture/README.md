# Domusmea architecture

Domusmea is a single Angular 22 application with server-side rendering. Its Express server
(`Domusmea/src/server.ts`) is also the REST API and runs the background jobs. Data lives in one SQLite
file.

```
Browser ──HTTP──▶ Express (src/server.ts)
                   ├─ /api guards (host allowlist, same-origin writes: src/server/security.ts)
                   ├─ /api router (src/server/api-router.ts)
                   │   ├─ /auth           ──▶ src/server/auth/  ──▶ SQLite (users, roles, sessions)
                   │   ├─ session + permission check (src/server/auth/access-control.ts)
                   │   ├─ /account        ──▶ src/server/auth/  (sign-ins, password, sign out)
                   │   ├─ /items          ──▶ src/server/items/ ──▶ SQLite (src/server/db.ts)
                   │   ├─ /journal        ──▶ src/server/journal/ ──▶ SQLite (repairs, investments)
                   │   └─ /settings/email ──▶ src/server/email/ ──▶ SQLite, SMTP (test email)
                   ├─ static files (dist/browser)
                   └─ Angular SSR (AngularNodeAppEngine)
                  warranty notifier (hourly, in-process) ──▶ SQLite, SMTP (src/server/warranty/, email/)
```

## Source layout (`Domusmea/src/`)

| Path        | Runs on       | Contents                                                                                 |
| ----------- | ------------- | ---------------------------------------------------------------------------------------- |
| `app/`      | browser + SSR | Angular application; one folder per feature (`app/items/`), page layout in `app/layout/` |
| `server/`   | Node only     | API routers, repositories, database, background jobs                                     |
| `shared/`   | both          | Types and constants used by the API and the frontend; no Node or Angular imports         |
| `server.ts` | Node only     | Express app: mounts API routers, starts jobs, serves Angular                             |

Rules:

- `app/` never imports from `server/`, and `server/` never imports from `app/`. Shared contracts go
  in `shared/`.
- Each API feature has a repository (SQL only) and a router (HTTP, validation). Routers are mounted
  in `server/api-router.ts`, after the session check and with the permissions they need (ADR 0007).
  `server.ts` only mounts that router.
- Each Angular feature with a page of its own registers a side-navigation topic: a `NavTopic` in
  `app/<feature>/<feature>.nav.ts`, added with `provideNavTopic(...)` in `app.config.ts` (ADR 0008).
- Feature routes in Angular are lazy-loaded. Routes showing database data use
  `RenderMode.Client` in `app.routes.server.ts`, because the `'**'` default prerenders at build time.

## Configuration (environment variables)

The SMTP server and the reminder recipients are set on the Settings page (`/settings`, ADR 0006).

| Variable             | Default                                                | Purpose                                                                                     |
| -------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `DB_PATH`            | `data/domusmea.db` (relative to the working directory) | SQLite file                                                                                 |
| `SETTINGS_KEY`       | none                                                   | Encrypts the stored SMTP password: 32 random bytes, base64 (`openssl rand -base64 32`)      |
| `APP_TIMEZONE`       | `Europe/Zurich`                                        | Time zone that defines "today" for warranty expiry; invalid values fall back to the default |
| `PORT`               | `4000`                                                 | Port of the built server                                                                    |
| `HOST`               | `127.0.0.1`                                            | Interface of the built server; see ADR 0005 before exposing it                              |
| `ALLOWED_HOSTS`      | none                                                   | Extra host names accepted by `/api` (comma-separated, `*.domain` allowed)                   |
| `ALLOW_REMOTE_SETUP` | `false`                                                | `true` accepts the first-run setup from other machines (ADR 0007)                           |
| `SECURE_COOKIES`     | `false`                                                | `true` always marks the session cookie `Secure` (TLS proxy without `X-Forwarded-Proto`)     |

Everything except `/api/auth` requires a login (ADR 0007). The first sign-in is `admin` / `admin` on
the server machine, followed by choosing your own username and password. A forgotten password is
reset with `npm run reset-login` (after `npm run build`), which brings back `admin` / `admin`.

## Decisions

| ADR                                               | Decision                                                             |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| [0001](adr/0001-single-app-layered-backend.md)    | Single Angular SSR app; backend layered inside it                    |
| [0002](adr/0002-sqlite-with-node-sqlite.md)       | SQLite through Node's built-in `node:sqlite`                         |
| [0003](adr/0003-warranty-expiry-notifications.md) | In-process hourly warranty check, email via SMTP                     |
| [0004](adr/0004-money-and-dates.md)               | CHF stored as integer Rappen; dates as ISO strings                   |
| [0005](adr/0005-no-login-network-safeguards.md)   | No login yet; host allowlist, local binding and other API safeguards |
| [0006](adr/0006-email-settings-in-database.md)    | SMTP server and recipients set in the UI, password encrypted         |
| [0007](adr/0007-login-and-roles.md)               | Login with one owner account, roles as permission sets               |
| [0008](adr/0008-side-navigation.md)               | Collapsible side navigation, topics registered per feature           |

New decisions get the next number; superseded ADRs stay and are marked as such.
