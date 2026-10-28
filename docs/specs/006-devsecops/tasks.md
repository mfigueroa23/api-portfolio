# Tasks 006 — DevSecOps: CodeQL, Dependabot and SCA

- **Spec:** [spec.md](spec.md) · **Plan:** [plan.md](plan.md)
- **Order:** by dependency. A task starts only when the tasks under "Depends on" are done. Tasks with the same dependencies can run in parallel.
- **Ids:** `D#` = plan decision, `U-*` / `E#` = tests listed in the plan's test strategy.

No Phase 0: every approval in the plan was granted on 2026-10-27 (D3, D13, `AGENTS.md`, `README.md`); the owner's repository settings are tasks of Phase 5.

## Phase 1 — Scripts and adoption baseline

- [x] **T01 — SCA gate script and exceptions file**
  - **RF:** RF-30, RF-31, RF-32, RF-34, RF-35, RF-38, RF-39, RF-40
  - **Depends on:** — (can run in parallel with T02)
  - **Scope:** Copy `../web/scripts/sca-gate.mjs` and `sca-gate.test.mjs` into `scripts/`, changing only the header's spec reference to "Spec 006" (D5, D6). Add `.github/sca-exceptions.json` with `[]`.
  - **Done when:** `node --test scripts/sca-gate.test.mjs` passes U-SG-1–U-SG-11; `diff ../web/scripts/sca-gate.mjs scripts/sca-gate.mjs` shows only the header lines.

- [x] **T02 — Dependabot bump script**
  - **RF:** RF-19, RF-20, RF-21, RF-22, RF-23, RF-24, RF-25, RF-27
  - **Depends on:** — (can run in parallel with T01)
  - **Scope:** Copy `../web/scripts/dependabot-bump.mjs` and `dependabot-bump.test.mjs` into `scripts/`, changing only the header's spec reference; adapt the U-DB-3/U-DB-4 fixture and the version examples to `api`'s `package.json` (D6, D7, D15, D1).
  - **Done when:** `node --test scripts/dependabot-bump.test.mjs` passes U-DB-1–U-DB-15; `diff` against web's script shows only the header lines; `grep -nE "'(git|pnpm|npm)'" scripts/dependabot-bump.mjs` finds no process call to them.

- [x] **T03 — Fix the blocking lockfile findings at adoption**
  - **RF:** RF-30
  - **Depends on:** T01
  - **Scope:** Download Grype `v0.120.1` into the scratchpad (never a project dependency) and scan `pnpm-lock.yaml`; run `node scripts/sca-gate.mjs --title Lockfile --report grype.json`. Fix each blocking finding with in-range updates, adding an `overrides` entry in `pnpm-workspace.yaml` (with a comment naming the advisory and when to remove it) only where a dependency pins the vulnerable version (D14). One `build(deps)` commit.
  - **Done when:** the gate over a fresh lockfile scan exits 0 with no blocking rows; `package.json` dependency ranges are unchanged; `pnpm lint`, `pnpm test`, `pnpm test:e2e` and `pnpm build` pass.

## Phase 2 — Pull request workflows

- [x] **T04 — Script tests in `API Tests`**
  - **RF:** RF-17, RF-41, RF-46
  - **Depends on:** T01, T02
  - **Scope:** `.github/workflows/test.yaml`: step `Script Tests` (`node --test scripts/`) after `E2E Tests`; `# vX.Y.Z` comments on the existing pins (D10). Job name `Lint, Tests & Build`, triggers and install unchanged.
  - **Done when:** `node --test scripts/` passes U-SG-1–U-SG-11 and U-DB-1–U-DB-15 locally; the job name in `test.yaml` is still `Lint, Tests & Build`; every `uses:` line has a SHA and a version comment.

- [x] **T05 — CodeQL advanced setup**
  - **RF:** RF-01, RF-02, RF-03, RF-04, RF-05, RF-08, RF-43
  - **Depends on:** — (can run in parallel with T04)
  - **Scope:** `.github/workflows/codeql.yaml` and `.github/codeql/codeql-config.yaml` as in the plan: matrix `actions` and `javascript-typescript`, `build-mode: none` (D1), `security-extended`, `paths-ignore` `dist`, `node_modules`, `coverage`, `src/generated`; web's pins (D4).
  - **Done when:** the workflow declares `pull_request` and `push` on `main`, `schedule` `0 7 * * *` and `workflow_dispatch`; its job permissions are only `actions: read`, `contents: read`, `security-events: write`; no step runs `pnpm`.

- [x] **T06 — Lockfile SCA workflow**
  - **RF:** RF-28, RF-29, RF-30, RF-31, RF-32, RF-43
  - **Depends on:** T01, T03
  - **Scope:** `.github/workflows/sca.yaml` copied from web: job `Lockfile Scan` (checkout, `download-grype`, scan, `sca-gate.mjs`, `upload-sarif` category `sca-lockfile` under `if: always()`, skipped for fork PRs) (D1, D4, D5).
  - **Done when:** the workflow has `pull_request` into `main`, `schedule` `30 7 * * *` and `workflow_dispatch`; permissions `contents: read`, `security-events: write`; no install step; running its scan and gate commands locally exits 0 after T03.

- [x] **T07 — Dependabot bump workflow**
  - **RF:** RF-19, RF-21, RF-23, RF-24, RF-26, RF-43, RF-44
  - **Depends on:** T02
  - **Scope:** `.github/workflows/dependabot-bump.yaml` copied from web: `request` job (Dependabot-authored PRs, `actions: write` only, dispatches on `main`, D2) and `bump` job (`workflow_dispatch`, `push` to `main` on `package.json`, hourly schedule, App token from `vars.BUMP_APP_ID`/`secrets.BUMP_APP_PRIVATE_KEY`, `concurrency: dependabot-bump`) (D3).
  - **Done when:** the `request` job references no `secrets.` and has no checkout; the `bump` job checks out `main` only and its condition excludes `pull_request` events; `diff` against web's workflow shows only the header comment.

## Phase 3 — Image and release

- [x] **T08 — Pin and harden the base image**
  - **RF:** RF-11, RF-33, RF-34, RF-35
  - **Depends on:** T01
  - **Scope:** `Dockerfile`: `node:26-alpine@sha256:<current digest>` in the three stages (D10); runtime stage runs `apk upgrade --no-cache` and removes `/usr/local/lib/node_modules`, `npm` and `npx` (D13), with a comment citing Spec 006. Fix any blocking finding left in the image as in T03 (D14).
  - **Done when:** every `FROM` has a digest; a local build for `linux/amd64` and `linux/arm64` succeeds; the container started with `.env` answers `GET /` and its `HEALTHCHECK` turns healthy; `docker run --rm --entrypoint sh <image> -c 'command -v npm'` finds nothing; Grype over the image plus `sca-gate.mjs` exits 0 on both platforms.

- [x] **T09 — Scan, gate and SBOM in the release**
  - **RF:** RF-17, RF-33, RF-34, RF-35, RF-36, RF-37, RF-42, RF-43, RF-44
  - **Depends on:** T01, T08
  - **Scope:** `.github/workflows/release.yaml` job `package` as in the plan: `registry:3` service, Buildx on host network, build to `localhost:5000/portfolio-api:${{ github.sha }}`, Grype per platform, `sca-gate.mjs` over both reports, `upload-sarif` per platform, `Publish Image` with `imagetools create` and the digest check, Syft SPDX per platform and artifact `portfolio-api-<version>-sbom` (D8, D9); `# vX.Y.Z` comments on all pins.
  - **Done when:** E11 — Grype and `sca-gate.mjs` against an unhardened or older `node:26-alpine` image exit 1 locally, and in the YAML the gate step comes before `Publish Image`, which is the only step that pushes to Docker Hub; the `digest` output still comes from the build step and `deploy` is unchanged.

- [x] **T10 — Dependabot configuration**
  - **RF:** RF-10, RF-12, RF-13, RF-15, RF-16, RF-18
  - **Depends on:** T08
  - **Scope:** `.github/dependabot.yml` copied from web: `npm`, `github-actions`, `docker` weekly on Monday 06:00 `America/Santiago`, minor/patch groups, literal prefixes (D11), labels; no auto-merge.
  - **Done when:** the file has the three ecosystems with `groups.<eco>-minor-patch` (`applies-to: version-updates`), prefixes `build(deps)`/`ci(deps)` without `include: scope`, labels `dependencies` + ecosystem; `diff` against web's shows only the header comment.

## Phase 4 — Build scripts and documentation

- [ ] **T11 — Build-script approval command**
  - **RF:** RF-45, RF-46, RF-47
  - **Depends on:** T03
  - **Scope:** `package.json` script `"approve-builds": "pnpm approve-builds"`; comment above `allowBuilds` in `pnpm-workspace.yaml`; the three current entries stay `false` (D12).
  - **Done when:** `pnpm install --frozen-lockfile` finishes without build-script errors; `pnpm run approve-builds` starts pnpm's prompt (nothing pending, so it exits without changes).

- [ ] **T12 — README and AGENTS.md**
  - **RF:** RF-14, RF-45
  - **Depends on:** T04–T11
  - **Scope:** `README.md`: Scripts table (`pnpm run approve-builds`, `node --test scripts/`), CI/CD (`CodeQL`, `SCA`, `Dependabot Version Bump`, Dependabot, release scan gate, SBOM artifact, exceptions file) and "Release order for DevSecOps (version 6.2.0)". `AGENTS.md`: Install note, the two commands, closing checklist line for `node --test scripts/`.
  - **Done when:** `README.md` names the four new workflows, the exceptions file and the 6.2.0 release order; `AGENTS.md` lists both commands and the checklist line.

## Phase 5 — Verification and release

- [ ] **T13 — Quality gate**
  - **RF:** RF-41, RF-46
  - **Depends on:** T12
  - **Scope:** The `AGENTS.md` closing checklist plus the script tests and Prettier on the touched YAML and Markdown.
  - **Done when:** `pnpm lint`, `pnpm test`, `pnpm test:e2e`, `pnpm build` and `node --test scripts/` pass; `pnpm exec prettier --check "src/**/*.ts" "test/**/*.ts"` and `pnpm exec prettier --check .github docs/specs/006-devsecops` are clean; `git status` shows nothing under `src/`, `test/` or `prisma/`.

- [ ] **T14 — Version bump**
  - **RF:** —
  - **Depends on:** T13
  - **Scope:** `version` → `6.2.0` in `package.json`.
  - **Done when:** commit `chore(release): Bump version to v6.2.0` changes only that line.

- [ ] **T15 — Owner setup for the bump** (owner)
  - **RF:** RF-16, RF-27
  - **Depends on:** — (can be done any time before T17)
  - **Scope:** Install the `portfolio-version-bump` App (ID 5463156) on `mfigueroa23/api-portfolio`; add the `BUMP_APP_ID` Actions variable and the `BUMP_APP_PRIVATE_KEY` Actions secret; create the labels `dependencies`, `npm`, `github-actions`, `docker` (D3).
  - **Done when:** `gh variable list` shows `BUMP_APP_ID`, `gh secret list` shows `BUMP_APP_PRIVATE_KEY`, and `gh label list` shows the four labels.

- [ ] **T16 — Open the PR and switch CodeQL to advanced setup**
  - **RF:** RF-02, RF-09, RF-28, RF-41
  - **Depends on:** T14
  - **Scope:** `/create-pr`; disable CodeQL default setup (`gh api -X PATCH repos/mfigueroa23/api-portfolio/code-scanning/default-setup -f state=not-configured`); re-run CodeQL if its first upload was rejected.
  - **Done when:** default setup reports `not-configured`; `Analyze (actions)`, `Analyze (javascript-typescript)`, `Lockfile Scan` and `Lint, Tests & Build` (with `Script Tests`) are green on the PR.

- [ ] **T17 — Enable the ruleset on `main`** (owner)
  - **RF:** RF-06, RF-07, RF-30
  - **Depends on:** T16
  - **Scope:** `Production ruleset`: add the required checks `Lockfile Scan`, `Analyze (actions)`, `Analyze (javascript-typescript)` next to `Lint, Tests & Build`, the code scanning rule for CodeQL (security alerts `high_or_higher`, alerts `none`), and enable it. Check `git config commit.gpgsign` first (Risks).
  - **Done when:** `gh api repos/mfigueroa23/api-portfolio/rulesets/24335867` shows `enforcement: active`, the four checks and the `code_scanning` rule.

- [ ] **T18 — Throwaway PR checks**
  - **RF:** RF-01, RF-05, RF-06, RF-07, RF-08, RF-14, RF-26, RF-30, RF-31, RF-32, RF-38, RF-39, RF-40, RF-43, RF-44, RF-47
  - **Depends on:** T17
  - **Scope:** Branches off the feature branch, closed without merging, as described in the plan.
  - **Done when:** E1 (raw SQL alert blocks, removal unblocks, nothing from `dist/`), E2 (below-high alert passes and shows in Security), E3 (vulnerable pin fails `Lockfile Scan` with the summary table), E4 (valid exception passes; expired and incomplete ones fail naming the entry), E12 (unapproved `postinstall` fails until `pnpm run approve-builds`) and E14 (permissions, pins, no secrets in Dependabot-reachable jobs, digests, security updates enabled) are all observed.

- [ ] **T19 — Merge and watch the release**
  - **RF:** RF-03, RF-33, RF-35, RF-36, RF-37, RF-42, RF-46
  - **Depends on:** T15, T18
  - **Scope:** Merge the PR (`chore(release): Version 6.2.0`) and follow `API Release`; revert the merge if the new steps fail.
  - **Done when:** E10 — the release scans both platforms, publishes `latest`, `6.2.0` and `sha-<commit>` with the scanned digest, `deploy` pins that digest, `rollout status` passes, `curl -s https://api.figueroa-sanchez.com/` answers, and the `portfolio-api-6.2.0-sbom` artifact holds two SPDX files; CodeQL runs on the push to `main`.

- [ ] **T20 — Dependabot run, scheduled scans and tag**
  - **RF:** RF-04, RF-10, RF-11, RF-12, RF-13, RF-15, RF-16, RF-17, RF-18, RF-19, RF-20, RF-21, RF-22, RF-23, RF-24, RF-25, RF-27, RF-29
  - **Depends on:** T19
  - **Scope:** "Check for updates" for each ecosystem in the dependency graph; follow the bump; next day, the scheduled runs; then `/tag-release` 6.2.0.
  - **Done when:** E5 (grouped and major PRs with prefixes, labels, SHA pins and a Docker digest PR, each with exactly one `Verified` bump commit and green checks), E6 (re-bump after merging one), E7 (`@dependabot recreate` restores the bump), E8 (a feature PR untouched), E9 (forced conflict: failed `Version bump` status and one comment) and E13 (daily CodeQL and SCA runs, no default-setup run) are observed; the `6.2.0` tag and release exist.

## RF → tasks

| RF | Tasks |
|---|---|
| RF-01 | T05, T18 |
| RF-02 | T05, T16 |
| RF-03 | T05, T19 |
| RF-04 | T05, T20 |
| RF-05 | T05, T18 |
| RF-06, RF-07 | T17, T18 |
| RF-08 | T05, T18 |
| RF-09 | T16 |
| RF-10 | T10, T20 |
| RF-11 | T08, T20 |
| RF-12, RF-13 | T10, T20 |
| RF-14 | T12, T18 |
| RF-15, RF-16 | T10, T15, T20 |
| RF-17 | T04, T09, T20 |
| RF-18 | T10, T20 |
| RF-19 | T02, T07, T20 |
| RF-20 | T02, T20 |
| RF-21 | T02, T07, T20 |
| RF-22 | T02, T20 |
| RF-23, RF-24 | T02, T07, T20 |
| RF-25 | T02, T20 |
| RF-26 | T07, T18 |
| RF-27 | T02, T15, T20 |
| RF-28 | T06, T16 |
| RF-29 | T06, T20 |
| RF-30 | T01, T03, T06, T17, T18 |
| RF-31, RF-32 | T01, T06, T18 |
| RF-33 | T08, T09, T19 |
| RF-34 | T01, T08, T09 |
| RF-35 | T01, T08, T09, T19 |
| RF-36, RF-37 | T09, T19 |
| RF-38, RF-39, RF-40 | T01, T18 |
| RF-41 | T04, T13, T16 |
| RF-42 | T09, T19 |
| RF-43 | T05, T06, T07, T09, T18 |
| RF-44 | T07, T09, T18 |
| RF-45 | T11, T12 |
| RF-46 | T04, T11, T13, T19 |
| RF-47 | T11, T18 |
