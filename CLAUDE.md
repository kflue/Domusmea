# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Domusmea

Latin for "my home": home management software for home owners.

## Layout

The repository root holds tooling only (devcontainer, `.mcp.json`, `.claude/`, Sonar config). The
application is the Angular CLI workspace in `Domusmea/`; run all npm/`ng` commands from there.

## Workflow rules

- **Never commit to `main` directly.** Start every feature and bugfix on a new branch created from an
  up-to-date `main` (`git switch main && git pull && git switch -c feature/<name>` or `fix/<name>`),
  and merge it through a pull request.
- **Always document architectural decisions** as the next numbered ADR in `docs/architecture/adr/`.
  Add it to the decisions table in `docs/architecture/README.md` and update the README and this file
  where the decision changes what they describe.

## Commands (from `Domusmea/`)

- `npm start`: dev server on http://localhost:4200, with SSR (it runs `src/server.ts`, so `/api`
  routes defined there work in dev too).
- `npm run build`: production build with SSR and prerendering, output in `dist/Domusmea/`.
- `npm run serve:ssr:Domusmea`: run the built Express server (port `PORT` or 4000).
- `npm test -- --watch=false`: Angular unit tests in `src/app` (Vitest via `@angular/build:unit-test`,
  jsdom). Single test: `npm test -- --watch=false --include src/app/app.spec.ts`, and
  `--filter '<regex>'` to match suite or test names.
- `npm run test:server`: backend and shared-code tests (`src/server`, `src/shared`) with plain Vitest in
  Node (`vitest.server.config.ts`). Single file: `npm run test:server -- src/server/db.spec.ts`.
- `npm run reset-login`: forgotten password; resets the account to `admin` / `admin` (needs a build).
- `npx ng generate component <name>` etc. for scaffolding.
- No ESLint config or `lint` script yet; formatting is Prettier (`.prettierrc`: single quotes, width
  100, Angular parser for HTML), applied to edited files by a PostToolUse hook in `.claude/settings.json`.

## Architecture

Overview, source layout rules, environment variables and decision records (ADRs):
`docs/architecture/`. Record every new architectural decision there as the next numbered ADR (see
Workflow rules).

- Angular 22, standalone components only (no NgModules), signals, zoneless by default; selector
  prefix `app`. Root component `App` in `src/app/app.ts`, routes in `src/app/app.routes.ts`.
- Layout in `src/app/layout/` (ADR 0008): top bar (Settings, user, sign-out) and a collapsible side
  navigation. Features add their topic with `provideNavTopic(...)` in `src/app/app.config.ts`; cost
  features set `group: 'capex' | 'opex'` to appear under that subtitle (ADR 0015).
- Styling is Tailwind CSS v4 through PostCSS (`.postcssrc.json`, `@import 'tailwindcss'` in
  `src/styles.css`). Component style budgets: 4kB warning, 8kB error.
- **Backend = the SSR Express server** `src/server.ts` (Express 5). It only wires things up: mounts the
  API router `src/server/api-router.ts` under `/api` (before the static and Angular handlers) and
  starts background jobs. `api-router.ts` mounts one router per feature with its permissions.
  Feature code lives in `src/server/<feature>/` (repository with SQL + router with zod validation);
  types shared with the UI in `src/shared/`. `src/app` and `src/server` never import each other.
- Data: SQLite through Node's built-in `node:sqlite` (`src/server/db.ts`, numbered migrations via
  `PRAGMA user_version`, run with foreign keys off and checked before commit so tables can be
  rebuilt; schema in `docs/architecture/data-model.md`, keep it in sync). `node:sqlite` is listed in `externalDependencies` in `angular.json` because
  esbuild would otherwise rewrite it to a bare `sqlite` import.
- Login (ADR 0007): everything under `/api` except `/api/auth` needs a session; mount new routers in
  `api-router.ts` after `requireSession` with `requirePermissions(...)`, and add them to the route list
  in `api-router.spec.ts`. Roles are permission sets in the database; permissions live in
  `src/shared/auth.ts`. The host allowlist and same-origin-writes check (`src/server/security.ts`,
  ADR 0005) still apply. First sign-in `admin` / `admin` only from the server machine (or
  `ALLOW_REMOTE_SETUP=true`, needed behind Codespaces port forwarding).
- The build loads `server.ts` (in worker threads, without requests) to extract routes, so nothing may
  open the database or start jobs at import time; `src/server/app-services.ts` creates them lazily.
- Browser config `src/app/app.config.ts` (router, client hydration) is merged with
  `src/app/app.config.server.ts` for SSR. `src/app/app.routes.server.ts` sets the render mode per route;
  currently `'**'` is `RenderMode.Prerender`, so routes that depend on per-user data or route params
  need an explicit `RenderMode.Server` or `RenderMode.Client` entry.
- Code runs on the server too: guard browser-only APIs (`window`, `localStorage`) with
  `isPlatformBrowser` or `afterNextRender`.
- TypeScript 6 with strict Angular compiler options; Node APIs only in `server.ts` and `src/server/`.
- Email (SMTP server, recipients) is configured on the Settings page and stored in the database; the
  SMTP password is encrypted with `SETTINGS_KEY` and never returned by the API (ADR 0006).
- Money is integer Rappen (CHF), calendar dates `YYYY-MM-DD` strings (ADR 0004); format with
  `src/shared/format.ts`.
- Subscriptions `/subscriptions` (ADR 0009, 0016; old `/finance/subscriptions` URLs redirect), API
  `/api/subscriptions` (`finance:*` permissions). Billings, price history and cost totals are
  computed by `src/shared/subscription-costs.ts`. Cancellation
  deadlines and the hourly reminder email: `src/shared/cancellation.ts`, ADR 0010. Background jobs use
  `startPeriodicCheck` (`src/server/periodic-check.ts`).
- Energy & utilities `/utilities` (ADR 0011): quarterly bills, one entry per commodity, API
  `/api/utilities` (`finance:*` permissions). Commodities and units in `src/shared/utility.ts`, totals
  in `src/shared/utility-costs.ts`; the finance dashboard gets the utility cost per month only from
  its `paidRappen` (ADR 0012). Charts use Chart.js, imported only through `CHART_FACTORY`
  (`utility-chart/`) so it stays a lazy, browser-only chunk. Hide write controls with
  `AuthApi.can(...)` and guard form routes with `permissionGuard(...)`.
- Finance dashboard `/finance` (ADR 0013, 0014, 0017): it only combines _finance sources_, opex
  (running costs per month; subscriptions, utilities, repairs from the journal) or capex (investments
  per year; item purchases only, planned = purchase date after today). To
  add a cost category, write a pure function returning `OpexFigures` or `CapexFigures`
  (`src/shared/finance-totals.ts`) in
  `src/shared/`, a `<feature>.finance.ts` whose `load` uses `import()` for everything but types, and
  one `provideFinanceSource(...)` line in `app.config.ts`. Chart.js is registered only in
  `app/shared/chart-js.ts`; charts load it through a factory token (`CHART_FACTORY`,
  `COST_CHART_FACTORY`).

## Dev environment

- GitHub Codespaces devcontainer (`.devcontainer/`): Node 24, Java 21 (for the SonarQube MCP server),
  Angular CLI installed globally. Forwarded ports: 4200 (dev server), 4000 (SSR server).

## Claude Code tooling (project-scoped)

- MCP servers (`.mcp.json`): `sonarqube`, `angular-cli` (`ng mcp`: Angular docs search, best
  practices, `run_target`, dev-server tools), `playwright` (headless browser for UI checks on port 4200).
- Angular conventions: `.claude/rules/angular.md` (verbatim copy of Angular's official best-practices
  prompt, loaded for files under `Domusmea/`) and the `angular-developer` skill (official, from
  github.com/angular/skills at commit 0dfaf19; re-copy it rather than editing it). Both come from
  https://angular.dev/ai/develop-with-ai; refresh them on Angular major upgrades.
- Skills: `/ship` (Sonar-check, commit, push, verify quality gate), `new-feature` (route, component,
  service, API endpoint, tests).
- Agent: `security-reviewer`: run before merging changes to API endpoints, auth or data access.

## Code quality: SonarQube Cloud

- Organization `kflue`, project key `kflue_Domusmea`. SonarCloud **automatic analysis** is enabled: the
  `main` branch and pull requests are analyzed on push, there is no CI scan.
- **Feature branches are only analyzed once they have a pull request.** Pushing a branch without a PR
  gives no Sonar result; open the PR first, then check the gate with `pullRequest` (key from
  `list_pull_requests`), never with `branch`.
- Use the `sonarqube` MCP server to:
  - read issues, quality gate status and metrics for `kflue_Domusmea` after a push to `main` or a PR;
  - check changed files locally before committing (`analyze_file_list` via SonarQube for IDE, or
    `analyze_code_snippet` with project key `kflue_Domusmea`).
- Fix new Sonar issues in code you touch; do not leave a failing quality gate.
- Do not run `sonar` (SonarScanner CLI) against SonarCloud while automatic analysis is enabled: the
  server rejects manual analyses and the run fails. A PreToolUse hook blocks it. `sonar-project.properties`
  is only read by the CLI; automatic analysis reads `.sonarcloud.properties` (sources, exclusions,
  tests). Keep both in sync.
