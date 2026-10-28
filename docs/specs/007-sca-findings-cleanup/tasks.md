# Tasks 007 — Clear the open SCA findings

- **Spec:** [spec.md](spec.md) · **Plan:** [plan.md](plan.md)
- **Order:** by dependency. A task starts only when the tasks under "Depends on" are done. Tasks with the same dependencies can run in parallel.
- **Ids:** `D#` = plan decision, `U-*` / `E#` = tests listed in the plan's test strategy.

## Phase 0 — Gate

- [ ] **T01 — Decide who dismisses the busybox alerts**
  - **RF:** RF-08
  - **Depends on:** — (can run in parallel with T02, T03)
  - **Scope:** The owner chooses between dismissing alerts 13–15 and 20–22 with `gh api` from the agent session (D5) or from the Security tab with the same reason and comment. Only T07 waits on it.
  - **Done when:** the owner's answer is recorded in the opening paragraph of `plan.md`, replacing "Pending approval".

## Phase 1 — Fixable findings

- [x] **T02 — Refresh the lockfile with the fixed versions**
  - **RF:** RF-01, RF-02, RF-05, RF-13
  - **Depends on:** — (can run in parallel with T01, T03)
  - **Scope:** `pnpm update --no-save vitest @vitest/coverage-v8 fast-uri` (D1–D3), then `pnpm install --frozen-lockfile`. Only `pnpm-lock.yaml` changes; revert any package outside D1–D2 (plan Risks). One `build(deps)` commit.
  - **Done when:** E1 holds (`pnpm why fast-uri` → only 3.1.9, `pnpm why @vitest/mocker` → only 4.1.12, `git diff package.json` empty, lockfile diff limited to `fast-uri`, `vitest`, `@vitest/coverage-v8` and the `@vitest/*` family); U-ALL (`pnpm test`) and E-ALL (`pnpm test:e2e`) pass; `pnpm lint` and `pnpm build` finish with 0 errors.

## Phase 2 — Findings without a fix

- [x] **T03 — Add the CVE-2025-60876 exception**
  - **RF:** RF-06, RF-07
  - **Depends on:** — (can run in parallel with T01, T02)
  - **Scope:** One entry in `.github/sca-exceptions.json`: `id` `CVE-2025-60876`, the reason of D4 (busybox `wget` only in the HEALTHCHECK against `127.0.0.1`, no Alpine fix, Spec 007) and `expires` `2027-01-26`. A minimal Grype report for E4 lives in the scratchpad, not in the repo. One `ci` commit.
  - **Done when:** E4 prints the `busybox` row as `excepted` and exits 0; U-SG (`node --test scripts/`) passes; `pnpm exec prettier --check .github/sca-exceptions.json` is clean.

## Phase 3 — Verification and release

- [ ] **T04 — Local quality gate**
  - **RF:** RF-12, RF-13
  - **Depends on:** T02, T03
  - **Scope:** Run the `AGENTS.md` closing checklist on the branch and confirm the untouched areas (plan Infrastructure: no README, AGENTS.md or migration change).
  - **Done when:** E2 holds: `pnpm lint`, `pnpm test`, `pnpm test:e2e`, `pnpm build` and `pnpm exec prettier --check "src/**/*.ts" "test/**/*.ts" .github/sca-exceptions.json` pass, and `git diff main --stat` shows nothing under `src/`, `test/`, `scripts/`, `.github/workflows/`, `prisma/` or `Dockerfile`.

- [ ] **T05 — Bump the version to 6.2.7**
  - **RF:** —
  - **Depends on:** T04
  - **Scope:** `version` in `package.json` 6.2.6 → 6.2.7 (D8), nothing else in the file.
  - **Done when:** the commit `chore(release): Bump version to v6.2.7` changes only the `version` line of `package.json`.

- [ ] **T06 — Open the pull request**
  - **RF:** RF-03, RF-06, RF-12
  - **Depends on:** T05
  - **Scope:** `/create-pr` from `fix/sca-findings` into `main`.
  - **Done when:** E3 holds: the PR's `Lockfile Scan` passes and its summary has no `fast-uri` or `@vitest/mocker` row and no invalid exception; `CodeQL` and `API Tests` are green.

- [ ] **T07 — Dismiss the six busybox alerts**
  - **RF:** RF-08
  - **Depends on:** T01, T06
  - **Scope:** Alerts 13, 14, 15, 20, 21 and 22 → `dismissed`, reason `won't fix`, the same comment as the exception's reason plus the expiry (D5), done the way T01 decided.
  - **Done when:** E5 holds: `gh api repos/{owner}/{repo}/code-scanning/alerts/<n>` returns `state: dismissed`, `dismissed_reason: won't fix` and the comment for all six.

- [ ] **T08 — Merge and watch the release**
  - **RF:** RF-04, RF-07, RF-09, RF-12
  - **Depends on:** T07
  - **Scope:** Merge the PR as `chore(release): Version 6.2.7` and follow `API Release` (plan Release, steps 1–2).
  - **Done when:** E6 holds: both platforms' summaries show CVE-2025-60876 as `excepted` and no `fast-uri` row; the three tags are published, the deployment is pinned by digest and `rollout status` succeeds; alerts 13–15 and 20–22 are still dismissed and no new Grype alert for busybox is open.

- [ ] **T09 — Close the lockfile alerts on `main`**
  - **RF:** RF-10, RF-11
  - **Depends on:** T08
  - **Scope:** `gh workflow run sca.yaml --ref main` and wait for it (D6). Confirm the path for a future Alpine fix stays in place (E8).
  - **Done when:** E7 holds: `gh api "repos/{owner}/{repo}/code-scanning/alerts?state=open&tool_name=Grype"` returns `[]`; E8: the runtime stage of the `Dockerfile` still runs `apk upgrade` and `.github/dependabot.yml` still has the weekly `docker` update (`git diff v6.2.6 -- Dockerfile .github/dependabot.yml` empty).

- [ ] **T10 — Tag the release**
  - **RF:** —
  - **Depends on:** T09
  - **Scope:** `/tag-release` 6.2.7 on the merge commit; mark this spec's checkboxes and the spec's done criteria.
  - **Done when:** the signed tag `6.2.7` and its GitHub release exist, and every box in this file and in the spec's **Done criteria** is checked.

## RF → tasks

| RF    | Tasks         |
| ----- | ------------- |
| RF-01 | T02           |
| RF-02 | T02           |
| RF-03 | T06           |
| RF-04 | T08           |
| RF-05 | T02           |
| RF-06 | T03, T06      |
| RF-07 | T03, T08      |
| RF-08 | T01, T07      |
| RF-09 | T08           |
| RF-10 | T09           |
| RF-11 | T09           |
| RF-12 | T04, T06, T08 |
| RF-13 | T02, T04      |
