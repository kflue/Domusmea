# Domusmea architecture

Domusmea is a single Angular 22 application with server-side rendering. Its Express server
(`Domusmea/src/server.ts`) is also the REST API and runs the background jobs. Data lives in one SQLite
file.

```
Browser ──HTTP──▶ Express (src/server.ts)
                   ├─ /api guards (host allowlist, same-origin writes: src/server/security.ts)
                   ├─ /api/items          ──▶ src/server/items/ ──▶ SQLite (src/server/db.ts)
                   ├─ /api/settings/email ──▶ src/server/email/ ──▶ SQLite, SMTP (test email)
                   ├─ static files (dist/browser)
                   └─ Angular SSR (AngularNodeAppEngine)
                  warranty notifier (hourly, in-process) ──▶ SQLite, SMTP (src/server/warranty/, email/)
```

## Source layout (`Domusmea/src/`)

| Path        | Runs on       | Contents                                                                         |
| ----------- | ------------- | -------------------------------------------------------------------------------- |
| `app/`      | browser + SSR | Angular application; one folder per feature (`app/items/`)                       |
| `server/`   | Node only     | API routers, repositories, database, background jobs                             |
| `shared/`   | both          | Types and constants used by the API and the frontend; no Node or Angular imports |
| `server.ts` | Node only     | Express app: mounts API routers, starts jobs, serves Angular                     |

Rules:

- `app/` never imports from `server/`, and `server/` never imports from `app/`. Shared contracts go
  in `shared/`.
- Each API feature has a repository (SQL only), a router (HTTP, validation) and nothing else in
  `server.ts` beyond mounting the router.
- Feature routes in Angular are lazy-loaded. Routes showing database data use
  `RenderMode.Client` in `app.routes.server.ts`, because the `'**'` default prerenders at build time.

## Configuration (environment variables)

The SMTP server and the reminder recipients are set on the Settings page (`/settings`, ADR 0006).

| Variable        | Default                                                | Purpose                                                                                     |
| --------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `DB_PATH`       | `data/domusmea.db` (relative to the working directory) | SQLite file                                                                                 |
| `SETTINGS_KEY`  | none                                                   | Encrypts the stored SMTP password: 32 random bytes, base64 (`openssl rand -base64 32`)      |
| `APP_TIMEZONE`  | `Europe/Zurich`                                        | Time zone that defines "today" for warranty expiry; invalid values fall back to the default |
| `PORT`          | `4000`                                                 | Port of the built server                                                                    |
| `HOST`          | `127.0.0.1`                                            | Interface of the built server; see ADR 0005 before exposing it                              |
| `ALLOWED_HOSTS` | none                                                   | Extra host names accepted by `/api` (comma-separated, `*.domain` allowed)                   |

There is no login yet: anyone who can reach the API can change all data. See
[ADR 0005](adr/0005-no-login-network-safeguards.md) for the safeguards and what to do before
exposing the server beyond `localhost`.

## Decisions

| ADR                                               | Decision                                                             |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| [0001](adr/0001-single-app-layered-backend.md)    | Single Angular SSR app; backend layered inside it                    |
| [0002](adr/0002-sqlite-with-node-sqlite.md)       | SQLite through Node's built-in `node:sqlite`                         |
| [0003](adr/0003-warranty-expiry-notifications.md) | In-process hourly warranty check, email via SMTP                     |
| [0004](adr/0004-money-and-dates.md)               | CHF stored as integer Rappen; dates as ISO strings                   |
| [0005](adr/0005-no-login-network-safeguards.md)   | No login yet; host allowlist, local binding and other API safeguards |
| [0006](adr/0006-email-settings-in-database.md)    | SMTP server and recipients set in the UI, password encrypted         |

New decisions get the next number; superseded ADRs stay and are marked as such.
