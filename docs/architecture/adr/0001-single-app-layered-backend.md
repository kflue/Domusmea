# 0001: Single Angular SSR app with a layered backend inside it

- Status: accepted
- Date: 2026-10-10

## Context

Domusmea needs a REST API and background jobs next to the Angular UI. The Angular CLI already
generated an Express server (`src/server.ts`) for SSR. The app serves one household on one server.

Options considered:

1. **Minimal**: SQL, routes and jobs directly in `server.ts`.
2. **Layered inside the app**: `src/server/` (API, data, jobs), `src/shared/` (contracts),
   `src/app/` (UI), all built and deployed as one unit.
3. **Separate backend project** with its own `package.json`, port 3000, and a dev proxy.

## Decision

Option 2. `server.ts` only wires things together: it mounts one Express router per feature under
`/api`, starts background jobs, and then hands over to static files and Angular SSR. Feature code
lives in `src/server/<feature>/` (repository + router), types shared with the UI in `src/shared/`.

## Consequences

- One build, one process, one dependency set; `npm start` serves UI and API on port 4200 in dev.
- Server code is bundled by the Angular build (esbuild); Node built-ins and npm packages work as usual.
- `server.ts` stays small, which keeps Sonar complexity findings away from it.
- Server code is also loaded by the dev server; background jobs must guard against starting twice
  (see ADR 0003).
- Backend unit tests run with a separate Vitest config in a Node environment (`npm run test:server`),
  because `ng test` runs specs in jsdom.
- If the API ever needs to scale or deploy separately, `src/server/` can be moved to its own project
  with little change, since it does not import from `src/app/`.
