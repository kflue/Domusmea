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
- `npm test -- --watch=false`: all unit tests (Vitest via `@angular/build:unit-test`, jsdom).
- Single test: `npm test -- --watch=false --include src/app/app.spec.ts`, and `--filter '<regex>'` to
  match suite or test names.
- `npx ng generate component <name>` etc. for scaffolding.
- No ESLint config or `lint` script yet; formatting is Prettier (`.prettierrc`: single quotes, width
  100, Angular parser for HTML), applied to edited files by a PostToolUse hook in `.claude/settings.json`.

## Architecture

- Angular 22, standalone components only (no NgModules), signals, zoneless by default; selector
  prefix `app`. Root component `App` in `src/app/app.ts`, routes in `src/app/app.routes.ts`.
- Styling is Tailwind CSS v4 through PostCSS (`.postcssrc.json`, `@import 'tailwindcss'` in
  `src/styles.css`). Component style budgets: 4kB warning, 8kB error.
- **Backend = the SSR Express server** `src/server.ts` (Express 5). It serves static files, renders
  Angular through `AngularNodeAppEngine`, and is where REST endpoints go: register `app.get('/api/...')`
  etc. **before** the static and Angular handlers. There is no separate backend project.
- Browser config `src/app/app.config.ts` (router, client hydration) is merged with
  `src/app/app.config.server.ts` for SSR. `src/app/app.routes.server.ts` sets the render mode per route;
  currently `'**'` is `RenderMode.Prerender`, so routes that depend on per-user data or route params
  need an explicit `RenderMode.Server` or `RenderMode.Client` entry.
- Code runs on the server too: guard browser-only APIs (`window`, `localStorage`) with
  `isPlatformBrowser` or `afterNextRender`.
- TypeScript 6 with strict Angular compiler options; Node APIs only in `server.ts`.

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
