---
name: new-feature
description: Build a feature as a vertical slice across the Angular frontend and the Node.js API (route, component, service, endpoint, tests). Use when adding a new home-management feature end to end.
---

# New feature (vertical slice)

Build `$ARGUMENTS` as one slice through the stack.

## Before writing code

- Find the closest existing feature and copy its layout, naming and test style. Existing code wins over
  this file; if they disagree, tell the user so this skill can be updated.
- If the frontend or backend is not scaffolded yet, stop and ask the user how to scaffold it.
- Use the `angular-cli` MCP server (best practices, docs search, examples) for Angular APIs instead of
  relying on memory.

## Backend (Node.js API)

- One router/module per feature; validate every request body, param and query at the boundary.
- Every endpoint that touches user data must check authentication **and** that the resource belongs to
  the requesting user/household.
- Typed request/response DTOs shared with, or mirrored in, the frontend.
- Tests for the happy path, validation errors and authorization failures.

## Frontend (Angular)

- Standalone components, signals for local state, built-in control flow (`@if`, `@for`), lazy-loaded
  route per feature.
- A feature service wraps `HttpClient`; components never call HTTP directly.
- Accessible markup: labels on form controls, keyboard-reachable actions.
- Component and service specs (`*.spec.ts`).

## Finish

- Run lint, tests and build for both projects.
- Check changed files with SonarQube (`analyze_file_list`) and fix new issues.
- If the dev servers can run, verify the flow in the browser with the `playwright` MCP server
  (app on http://localhost:4200, API on http://localhost:3000).
- Summarize the files added per layer and anything left open.
