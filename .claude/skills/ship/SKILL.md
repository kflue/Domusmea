---
name: ship
description: Sonar-check changed files, commit, push, then verify the SonarCloud quality gate for kflue_Domusmea
disable-model-invocation: true
---

# Ship

Commit and push the current changes, keeping the SonarCloud quality gate green. `$ARGUMENTS`, if given,
is the commit message or a hint for it.

1. **Collect changes.** Run `git status` and `git diff --name-only HEAD` (plus untracked files). If there
   is nothing to commit, stop and say so. Never commit to `main`: if on `main`, create a `feature/<name>`
   or `fix/<name>` branch from an up-to-date `main` first (the changes carry over).
2. **Local Sonar check.** Run `analyze_file_list` (SonarQube for IDE) on the changed source files. If it
   is unavailable, use `analyze_code_snippet` with project key `kflue_Domusmea` per file. Fix new issues
   in the touched code; list any you deliberately leave, with the reason.
3. **Verify.** If `package.json` defines `lint`, `test` or `build` scripts, run the relevant ones and fix
   failures. Never run the `sonar` CLI: SonarCloud automatic analysis rejects manual scans.
4. **Commit.** Stage only the files belonging to this change (no secrets, `.env`, build output). Write a
   concise imperative commit message ending with the attribution line required by the session.
5. **Push.** `git push` (with `-u origin <branch>` for a new branch).
6. **Pull request.** Sonar analyzes feature branches only through a pull request. If the branch has no
   open PR, open one against `main` (`gh pr create`) with a short summary and the session's PR
   attribution line.
7. **Quality gate.** Automatic analysis runs after the push and takes a minute or two. Then check
   `get_project_quality_gate_status` for `kflue_Domusmea` with `pullRequest` (key from
   `list_pull_requests`), never with `branch`. If the analysis has not appeared yet, wait and retry a
   few times rather than reporting a stale result.
8. **Report.** Commit hash, push target, PR link, quality gate status. If the gate fails, list the failing
   conditions and new issues (`search_sonar_issues_in_projects`) and offer to fix them.
