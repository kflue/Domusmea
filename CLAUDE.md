# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Domusmea

Latin for "my home": home management software for home owners. Angular frontend, Node.js backend
(TypeScript). The application is not scaffolded yet; once it is, add build/lint/test commands (including
how to run a single test) and the frontend/backend layout here.

## Dev environment

- GitHub Codespaces devcontainer (`.devcontainer/`): Node 24, Java 21 (for the SonarQube MCP server),
  Angular CLI installed globally. `post-create.sh` runs `npm install` when a `package.json` exists.
- Ports: Angular dev server `4200`, Node.js API `3000`.
- Formatting is Prettier (+ ESLint, EditorConfig). A PostToolUse hook in `.claude/settings.json` runs
  Prettier on edited files once it is installed in `node_modules`.

## Claude Code tooling (project-scoped)

- MCP servers (`.mcp.json`): `sonarqube`, `angular-cli` (`ng mcp`: use it for current Angular APIs and
  best practices), `playwright` (headless browser for checking UI flows against port 4200).
- Skills: `/ship` (Sonar-check, commit, push, verify quality gate), `new-feature` (vertical slice
  through Angular and the API).
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
