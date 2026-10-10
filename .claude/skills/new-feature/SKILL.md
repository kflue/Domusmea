---
name: new-feature
description: Build a feature as a vertical slice across the Angular frontend and the Node.js API (route, component, service, endpoint, tests). Use when adding a new home-management feature end to end.
---

# New feature (vertical slice)

Build `$ARGUMENTS` as one slice through the stack.

## Before writing code

- Find the closest existing feature and copy its layout, naming and test style. Existing code wins over
  this file; if they disagree, tell the user so this skill can be updated.
- Use the `angular-cli` MCP server (`search_documentation`, `get_best_practices`) for Angular APIs
  instead of relying on memory; scaffold with `ng generate` from `Domusmea/`.

## Backend (Node.js API)

- Endpoints live in the SSR Express server (`Domusmea/src/server.ts`), registered before the static and
  Angular handlers. Once there is more than one feature, mount a per-feature `express.Router` from its
  own file instead of growing `server.ts`.
- One router/module per feature; validate every request body, param and query at the boundary.
- Every endpoint that touches user data must check authentication **and** that the resource belongs to
  the requesting user/household.
- Typed request/response DTOs shared with, or mirrored in, the frontend.
- Tests for the happy path, validation errors and authorization failures.

## Frontend (Angular)

- Follow `.claude/rules/angular.md` (Angular's official best practices) and the `angular-developer`
  skill references for the APIs involved: lazy-loaded route per feature, Signal Forms for new forms,
  `@Service` for new singleton services, `httpResource`/`resource` for reads.
- A feature service wraps `HttpClient`; components never call HTTP directly.
- Add a `RenderMode.Server` or `RenderMode.Client` entry in `app.routes.server.ts` for routes showing
  per-user data (the `'**'` default prerenders at build time).
- Accessible markup: labels on form controls, keyboard-reachable actions.
- Component and service specs (`*.spec.ts`).

## Finish

- Run `npm test -- --watch=false` and `npm run build` in `Domusmea/` (plus `lint` once it exists).
- Check changed files with SonarQube (`analyze_file_list`) and fix new issues.
- If the dev servers can run, verify the flow in the browser with the `playwright` MCP server
  (`npm start` in `Domusmea/` serves app and `/api` on http://localhost:4200).
- Summarize the files added per layer and anything left open.
