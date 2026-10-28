# Plan 007 — Clear the open SCA findings

- **Spec:** [spec.md](spec.md) (approved 2026-10-28)
- **Status:** Approved
- **Version:** 6.2.7 (fix → patch)

The plan touches only `pnpm-lock.yaml`, one entry of `.github/sca-exceptions.json`, the `version` of
`package.json` and the state of six code scanning alerts. No module in `src/`, no endpoint, no schema
and no migration change (constitution §2, §5, RF-13); no dependency is added and no `package.json`
range moves (§1, RF-05). Workflows, `scripts/` and the `Dockerfile` stay byte-identical (RF-12), so
`API Tests` keeps gating `main` (§9) and the release keeps deploying by digest and checking
`rollout status` (§10). Approved by the spec: the in-range lockfile updates and the exceptions entry.
**Pending approval:** dismissing the six alerts with `gh` from this session (D5); otherwise the owner
dismisses them from the Security tab with the same reason and comment.

## Modules

### Changed: repository root

| File             | Change                                                                                                                                                                                                                                                 | RF          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| `pnpm-lock.yaml` | `fast-uri` 3.1.8 → 3.1.9 (one entry, shared by `ajv@8.20.0`'s `^3.0.1`); `vitest`, `@vitest/coverage-v8` and the `@vitest/*` family (`expect`, `mocker`, `pretty-format`, `runner`, `snapshot`, `spy`, `utils`) 4.1.11 → 4.1.12. Nothing else (D1–D3). | RF-01–RF-05 |
| `package.json`   | Only `version` 6.2.6 → 6.2.7, in its own `chore(release)` commit (D8).                                                                                                                                                                                 | —           |

### Changed: `.github/`

| File                  | Change                                                                                                                                                                                                                                                                             | RF           |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `sca-exceptions.json` | `[]` → one entry `{ "id": "CVE-2025-60876", "reason": "…", "expires": "2027-01-26" }`. The reason states that busybox `wget` only runs in the image HEALTHCHECK against `127.0.0.1` with no user input, that Alpine has no fixed version, and names Spec 007 (D4). Prettier-clean. | RF-06, RF-07 |

### Infrastructure

| File / setting                       | Change                                                                                                                                 |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Code scanning alerts 13–15, 20–22    | `state: dismissed`, `dismissed_reason: won't fix`, `dismissed_comment` with the exception's reason and the expiry (D5).                |
| `SCA` workflow on `main`             | One `workflow_dispatch` run after the merge, so the `sca-lockfile` alerts 7–12 close without waiting for the daily schedule (D6).      |
| `README.md`, `AGENTS.md`, migrations | No change: the exceptions file is already documented in `README.md` (CI section) and no endpoint, variable or deployment step changes. |

## Decisions

| #   | Decision                                                                                                                                                                                                  | Discarded alternative                                                          | Why                                                                                                                                                                                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Refresh the lockfile with `pnpm update --no-save vitest @vitest/coverage-v8 fast-uri`, then `pnpm install --frozen-lockfile` to prove it is consistent.                                                   | `overrides` in `pnpm-workspace.yaml` (`ajv>fast-uri`, `vitest>@vitest/mocker`) | Every parent's range already admits the fixed versions; overrides are reserved for parents that pin a vulnerable version (Plan 006 D14, comment in `pnpm-workspace.yaml`) and each one is debt to remove later. Spec Decisions: no override.                     |
| D2  | `vitest` and `@vitest/coverage-v8` move together to 4.1.12, which brings `@vitest/mocker` 4.1.12.                                                                                                         | Updating only the transitive `@vitest/mocker`                                  | `vitest@4.1.11` depends on `@vitest/mocker` 4.1.11 exactly (lockfile), and `@vitest/coverage-v8@4.1.12` peers `vitest` 4.1.12 exactly; moving one alone does not resolve. Both are in `^4.1.2` (RF-05).                                                          |
| D3  | `package.json` ranges stay as they are (`--no-save`); `git diff package.json` must be empty after the update.                                                                                             | Raising the floors to `^4.1.12`                                                | RF-05 and the spec's Decisions. CI and the image install with `--frozen-lockfile`, so the lockfile alone fixes the resolved versions, and the lockfile scan would flag a regression.                                                                             |
| D4  | One exception entry with id `CVE-2025-60876` covers `busybox`, `busybox-binsh` and `ssl_client`.                                                                                                          | One entry per package, or keyed by a GHSA id                                   | `classify` in `scripts/sca-gate.mjs` matches `vulnerability.id` or a related id, not the package; Grype reports these apk matches under the CVE itself (`nvd:cpe` namespace, alerts 13–15 and 20–22), and there is no GHSA for an apk package.                   |
| D5  | Dismiss the six alerts with `gh api -X PATCH repos/{owner}/{repo}/code-scanning/alerts/{n}` (`state=dismissed`, `dismissed_reason="won't fix"`, the same comment on all six).                             | Relying on the exception alone; dismissing by hand in the Security tab         | The exception only changes the gate's classification; `upload-sarif` still uploads the finding, so the alert stays open (RF-08). A scripted call gives the six alerts an identical, auditable reason. It is an outward action, so it needs the owner's go-ahead. |
| D6  | Close the lockfile alerts with a manual `SCA` run on `main` right after the merge; the image alerts close with the release of the merge.                                                                  | Waiting for the daily scheduled run (07:30 UTC)                                | RF-11 is checked in the same session as the release; `sca.yaml` already accepts `workflow_dispatch`. PR uploads do not close `main`'s alerts, since code scanning tracks each branch separately.                                                                 |
| D7  | No change to `scripts/sca-gate.mjs` or its tests. The entry is validated by the PR's `Lockfile Scan` (an invalid entry fails it, Spec 006 RF-40) and by a local CLI run against a synthetic Grype report. | A new test that validates the committed exceptions file                        | The scripts are copies of web's and must stay diffable against them (Plan 006 D6); the gate already validates the file on every lockfile and image scan.                                                                                                         |
| D8  | Patch release 6.2.7, with the lockfile in a `build(deps)` commit, the exception in a `ci` commit and the bump in `chore(release): Bump version to v6.2.7`.                                                | Folding the fix into the next feature release                                  | The image published today ships the `fast-uri` advisories (RF-04); AGENTS.md: fix → patch.                                                                                                                                                                       |

## RF coverage

| RF           | Where                                                            | Tests      |
| ------------ | ---------------------------------------------------------------- | ---------- |
| RF-01, RF-02 | `pnpm-lock.yaml` (D1, D2)                                        | E1         |
| RF-03        | PR's `Lockfile Scan`                                             | E3         |
| RF-04        | Release of the merge, image scan on both platforms               | E6         |
| RF-05        | `package.json` untouched except `version` (D3)                   | E1, E2     |
| RF-06        | `.github/sca-exceptions.json` (D4)                               | E3, E4     |
| RF-07        | Gate summary of the image scan                                   | E4, E6     |
| RF-08        | Alerts 13–15, 20–22 dismissed (D5)                               | E5         |
| RF-09        | Code scanning keeps the dismissal on re-upload                   | E6         |
| RF-10        | `apk upgrade` in the runtime stage (no change); exception expiry | E8         |
| RF-11        | Manual `SCA` run on `main` and the release (D6)                  | E7         |
| RF-12        | No workflow, script or `Dockerfile` change                       | E2, E3, E6 |
| RF-13        | No change under `src/`                                           | E2         |

## Test strategy

There is no new unit or e2e test: the change is dependency resolution, data in the exceptions file
and alert state. The existing suites act as regression, and the pipeline checks below verify the RFs.

**Regression (local and in `API Tests`)**

- **U-ALL:** `pnpm test` (every `src/**/*.spec.ts`) passes on Vitest 4.1.12.
- **E-ALL:** `pnpm test:e2e` (every `test/*.e2e-spec.ts`, in-memory Prisma fake) passes.
- **U-SG:** `node --test scripts/` (U-SG-1…U-SG-11 and the bump tests) passes unchanged.

**Pipeline checks**

- **E1:** `pnpm why fast-uri` shows only 3.1.9 and `pnpm why @vitest/mocker` only 4.1.12; `git diff --stat` touches only `pnpm-lock.yaml` among the dependency files, and the lockfile diff names only the packages of D1–D2.
- **E2:** `pnpm lint`, `pnpm test`, `pnpm test:e2e`, `pnpm build` and `pnpm exec prettier --check "src/**/*.ts" "test/**/*.ts" .github/sca-exceptions.json` pass; `git diff main --stat` shows nothing under `src/`, `test/`, `scripts/`, `.github/workflows/` or `Dockerfile`.
- **E3:** the PR's `Lockfile Scan` passes and its summary lists no `fast-uri` or `@vitest/mocker` row and no invalid exception.
- **E4:** `node scripts/sca-gate.mjs --title Image --report <scratchpad>/busybox.json`, with a minimal Grype report holding one Medium `CVE-2025-60876` match for `busybox` `1.37.0-r31` without a fix, prints the row as `excepted` and exits 0.
- **E5:** `gh api repos/{owner}/{repo}/code-scanning/alerts/{13,14,15,20,21,22}` returns `state: dismissed`, `dismissed_reason: won't fix` and the comment.
- **E6:** the release run of the merge shows, for both platforms, CVE-2025-60876 as `excepted` and no `fast-uri` row, publishes the three tags, deploys by digest and passes `rollout status`; alerts 13–15 and 20–22 are still dismissed and no new busybox alert is open.
- **E7:** after the manual `SCA` run on `main`, `gh api "repos/{owner}/{repo}/code-scanning/alerts?state=open&tool_name=Grype"` returns an empty list.
- **E8 (not automatable now):** RF-10 depends on Alpine publishing a fix. Covered by the weekly Dependabot digest PRs plus `apk upgrade`; the 2027-01-26 expiry makes the gate list the entry as expired if nobody has revisited it.

**Not covered automatically:** RF-07 and RF-09 on the real image scan run only in the release (images are not scanned on PRs, Spec 006 Out of scope); E4 checks the gate's side before the merge.

## Implementation order

1. Branch `fix/sca-findings` (already created, holds the spec and this plan).
2. Lockfile update (D1–D3); E1; `pnpm install --frozen-lockfile`; U-ALL, E-ALL, lint and build. Commit `build(deps): …`.
3. Exception entry (D4); Prettier on the file; E4; U-SG. Commit `ci: …`.
4. `chore(release): Bump version to v6.2.7`.
5. Open the PR (`/create-pr`); E2, E3.
6. Dismiss the six alerts (D5), with the owner's approval; E5.

## Release

1. Before merging: `Lockfile Scan`, `CodeQL` and `API Tests` green on the PR; alerts 13–15 and 20–22 dismissed.
2. Merge to `main`; watch `API Release` (E6). If the image scan blocks unexpectedly, nothing is published and the cluster keeps v6.2.6; fix forward on this branch.
3. Run `SCA` manually on `main` (`gh workflow run sca.yaml --ref main`) and check E7.
4. `/tag-release` 6.2.7. No migration; the web and panel releases are independent.

## Risks

- **Lockfile update drags more than planned** (for example `vite` or `esbuild` moving inside their ranges): a larger diff to review and a chance of test changes. Mitigation: E1 limits the diff to D1–D2's packages; anything else is reverted, or updated only if tests pass and the owner agrees.
- **pnpm supply-chain policy rejects a fresh version:** both fixes were published on 2026-10-15 (`vitest` 4.1.12) and 2026-10-19 (`fast-uri` 3.1.9), so they are past any minimum release age; if the install still refuses, report it and stop.
- **The dismissal does not stick on re-upload:** if Grype changes its rule id or location for busybox (for example a new Alpine revision that is still vulnerable), code scanning opens new alerts. Mitigation: E6 checks it; the same `gh` call dismisses the new ones.
- **New advisories appear before the merge:** the PR's lockfile scan or the release would show them; they are out of this spec and go to a new spec or a Dependabot PR, unless they block, in which case they are fixed here following D1.
- **Exception left to expire unnoticed:** after 2027-01-26 the finding counts as unexcepted; at Medium it still does not block, but the summary names the expired entry so it gets reviewed.
