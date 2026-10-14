# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Domusmea

Latin for "my home": home management software for home owners.

## Layout

The repository root holds tooling only (devcontainer, `.mcp.json`, `.claude/`, Sonar config). The
application is the Angular CLI workspace in `Domusmea/`; run all npm/`ng` commands from there.

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
- `npx ng generate component <name>` etc. for scaffolding.
- No ESLint config or `lint` script yet; formatting is Prettier (`.prettierrc`: single quotes, width
  100, Angular parser for HTML), applied to edited files by a PostToolUse hook in `.claude/settings.json`.

## Architecture

Overview, source layout rules, environment variables and decision records (ADRs):
`docs/architecture/`. Record new architectural decisions there as the next numbered ADR.

- Angular 22, standalone components only (no NgModules), signals, zoneless by default; selector
  prefix `app`. Root component `App` in `src/app/app.ts`, routes in `src/app/app.routes.ts`.
- Styling is Tailwind CSS v4 through PostCSS (`.postcssrc.json`, `@import 'tailwindcss'` in
  `src/styles.css`). Component style budgets: 4kB warning, 8kB error.
- **Backend = the SSR Express server** `src/server.ts` (Express 5). It only wires things up: mounts one
  router per feature under `/api` (before the static and Angular handlers) and starts background jobs.
  Feature code lives in `src/server/<feature>/` (repository with SQL + router with zod validation);
  types shared with the UI in `src/shared/`. `src/app` and `src/server` never import each other.
- Data: SQLite through Node's built-in `node:sqlite` (`src/server/db.ts`, numbered migrations via
  `PRAGMA user_version`). `node:sqlite` is listed in `externalDependencies` in `angular.json` because
  esbuild would otherwise rewrite it to a bare `sqlite` import.
- No login yet: `/api` is guarded by a host allowlist and same-origin-writes check
  (`src/server/security.ts`), and the built server binds `127.0.0.1` (ADR 0005). Keep new routers
  under `/api` so they get the same guards.
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
- Use the `sonarqube` MCP server to:
  - read issues, quality gate status and metrics for `kflue_Domusmea` after a push;
  - check changed files locally before committing (`analyze_file_list` via SonarQube for IDE, or
    `analyze_code_snippet` with project key `kflue_Domusmea`).
- Fix new Sonar issues in code you touch; do not leave a failing quality gate.
- Do not run `sonar` (SonarScanner CLI) against SonarCloud while automatic analysis is enabled: the
  server rejects manual analyses and the run fails. A PreToolUse hook blocks it. `sonar-project.properties`
  is only read by the CLI, not by automatic analysis.
