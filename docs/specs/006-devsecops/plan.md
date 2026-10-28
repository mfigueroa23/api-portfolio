# Plan 006 — DevSecOps: CodeQL, Dependabot and SCA

- **Spec:** [spec.md](spec.md) (approved 2026-10-27)
- **Status:** Approved
- **Version:** 6.2.0 (feat → minor)

The plan ports `web`'s Plan 009 (`../web/docs/specs/009-devsecops/plan.md`, implemented and running
since web 4.5.0) to `api`. It touches only CI, the `Dockerfile`, repository settings, two Node
scripts under a new `scripts/` folder and their tests; no module in `src/`, no endpoint and no
schema changes (constitution §2, §5), and `API Tests` keeps gating `main` (§9). No dependency is
added to `package.json` (§1): CodeQL, Grype and Syft run as pinned actions or downloaded CLIs inside
CI, and the scripts use only Node's standard library. The release keeps deploying `portfolio-api`
by digest and checking `rollout status`, now scanning the image before it reaches Docker Hub (§10).
No CI step reads the `property` table or adds a secret beyond the bump App's key (§6). Approved by
the spec: `.github/`, `release.yaml`, the `Dockerfile` digests, the `approve-builds` command and the
lockfile fixes. Approved with this plan on 2026-10-27: the runtime-stage hardening of the
`Dockerfile` (D13), the `AGENTS.md` and `README.md` edits, and reusing web's bump App (D3). Still
pending: the owner actions in **Release**.

## Modules

### New: `.github/workflows/codeql.yaml` (`CodeQL`)

| File | Responsibility | RF |
|---|---|---|
| `codeql.yaml` | Same as web: triggers `pull_request` into `main`, `push` to `main`, `schedule` daily (`0 7 * * *` UTC) and `workflow_dispatch`. Job `Analyze (${{ matrix.language }})`, matrix `actions` and `javascript-typescript`, `build-mode: none` (D1), `init` with `config-file: ./.github/codeql/codeql-config.yaml`, then `analyze` with `category: /language:<lang>`. Permissions: `contents: read`, `security-events: write`, `actions: read`. Actions pinned by SHA with `# vX.Y.Z` (web's pins). | RF-01–RF-05, RF-43 |

### New: `.github/codeql/codeql-config.yaml`

| File | Responsibility | RF |
|---|---|---|
| `codeql-config.yaml` | `name: 'API CodeQL'`; `queries: [uses: security-extended]`; `paths-ignore`: `dist`, `node_modules`, `coverage`, `src/generated` (the Prisma client is gitignored, so it never reaches the checkout, but the entry keeps it out if that changes). | RF-01, RF-08 |

### New: `.github/dependabot.yml`

| File | Responsibility | RF |
|---|---|---|
| `dependabot.yml` | Copy of web's: `npm`, `github-actions` and `docker` on `/`, weekly on Monday 06:00 `America/Santiago`; `groups.<eco>-minor-patch` (`applies-to: version-updates`, `update-types: [minor, patch]`), so majors stay one per PR; prefixes `build(deps)` (npm, also `prefix-development`; docker) and `ci(deps)` (actions) written literally (D11); `labels: [dependencies, npm \| github-actions \| docker]`. No auto-merge. Security updates for npm and Actions come from the repository setting, already enabled (spec Decisions). | RF-10, RF-12–RF-16, RF-18 |

### New: `.github/workflows/sca.yaml` (`SCA`)

| File | Responsibility | RF |
|---|---|---|
| `sca.yaml` | Copy of web's: `pull_request` into `main`, `schedule` daily (`30 7 * * *` UTC), `workflow_dispatch`. Job `Lockfile Scan`: checkout (no install, D1), `anchore/scan-action/download-grype` (Grype `v0.120.1`, `cache-db: true`), `grype file:pnpm-lock.yaml -o json=grype.json -o sarif=grype.sarif`, `node scripts/sca-gate.mjs --title Lockfile --report grype.json` (D5), `upload-sarif` with `category: sca-lockfile` under `if: always()`, skipped for fork PRs. Permissions: `contents: read`, `security-events: write`. | RF-28–RF-32, RF-38–RF-40, RF-43 |

### New: `scripts/sca-gate.mjs`

| File | Responsibility | RF |
|---|---|---|
| `sca-gate.mjs` | Web's script, byte-identical except the header reference to this spec (D6). CLI `--report` (repeatable, each after its `--title`), `--exceptions` (default `.github/sca-exceptions.json`). Pure exports `validateExceptions`, `classify` (blocking = Critical/High with `fix.state: fixed` and no valid exception; an exception matches `vulnerability.id` or any `relatedVulnerabilities[].id`) and `summary` (package, installed, fixed in, severity, advisory, status, plus expired and invalid entries). Appends to `$GITHUB_STEP_SUMMARY`; exit 1 on a blocking finding, an invalid entry or an unreadable report. | RF-30–RF-32, RF-34, RF-35, RF-38–RF-40 |
| `sca-gate.test.mjs` | U-SG-1…U-SG-11 (`node:test`, fixtures inline), copied from web. | |

### New: `.github/sca-exceptions.json`

| File | Responsibility | RF |
|---|---|---|
| `sca-exceptions.json` | `[]` to start (the adoption findings are fixed, not excepted, per the spec). Entry shape `{ "id": "GHSA-…", "reason": "…", "expires": "YYYY-MM-DD" }`, shared by the lockfile and image scans. | RF-38–RF-40 |

### New: `.github/workflows/dependabot-bump.yaml` (`Dependabot Version Bump`)

| File | Responsibility | RF |
|---|---|---|
| `dependabot-bump.yaml` | Copy of web's: job `request` on `pull_request` (`opened`, `synchronize`, `reopened`) into `main` when the PR author is `dependabot[bot]` and the actor is Dependabot or a human (the App's own pushes are skipped); no checkout, `actions: write` only, runs `gh workflow run dependabot-bump.yaml --ref main -f pr=<n>` (D2). Job `bump` on `workflow_dispatch` (input `pr`), `push` to `main` with `paths: [package.json]` and `schedule` hourly (`17 * * * *`) (D3): checkout `main`, `actions/create-github-app-token` (`vars.BUMP_APP_ID`, `secrets.BUMP_APP_PRIVATE_KEY`, contents/pull-requests/statuses/workflows write), `node scripts/dependabot-bump.mjs [--pr N]`. `concurrency: dependabot-bump`, not cancelled. | RF-19, RF-21–RF-26, RF-43, RF-44 |

### New: `scripts/dependabot-bump.mjs`

| File | Responsibility | RF |
|---|---|---|
| `dependabot-bump.mjs` | Web's script, byte-identical except the header reference (D6); the repository comes from `GITHUB_REPOSITORY`. Pure exports `nextPatch`, `setVersion` (edits only the top-level `"version"` value, D7), `isBumpCommit`, `decide` (`skip`/`noop`/`rebump`), `trailingBump`; `rebump` through GitHub's API only (move the ref back, `POST /merges` from `main` when behind, `createCommitOnBranch` with `expectedHeadOid`), so every commit is signed by GitHub (D15); on failure it restores the original head unless someone else pushed, sets the `Version bump` status and comments asking for `@dependabot recreate`, once per head. Never runs `git`, `pnpm` or `npm` (D1). | RF-19–RF-25, RF-27 |
| `dependabot-bump.test.mjs` | U-DB-1…U-DB-15 (`node:test`), copied from web; U-DB-3 and U-DB-4 use `api`'s `package.json` text. | |

### Changed: `.github/workflows/release.yaml`

| File | Change | RF |
|---|---|---|
| `release.yaml` | Job `package` renamed `Build, Scan and Publish Image`, `timeout-minutes: 30`, permissions `contents: read`, `security-events: write`; a `registry:3` service (web's digest) on `localhost:5000`; `GRYPE_`/`SYFT_REGISTRY_INSECURE_USE_HTTP=true`. `docker/login-action` stays first, only to pull base images with a quota. Buildx with `driver-opts: network=host` and the inline `localhost:5000` HTTP config; `build-push-action` pushes `localhost:5000/portfolio-api:${{ github.sha }}` instead of the three Docker Hub tags (D8). New steps: download Grype and Syft (web's pins); scan `linux/amd64` and `linux/arm64` into JSON and SARIF; `sca-gate.mjs` over both reports (titles `portfolio-api (linux/<arch>)`), which fails the job before anything is published; `upload-sarif` per platform (`category: sca-image-<arch>`, `if: always()`); `Publish Image` copies the manifest list with `docker buildx imagetools create` to `latest`, the version and `sha-<commit>`, failing if Docker Hub reports a digest other than the scanned one; Syft SPDX JSON per platform (`--source-name <user>/portfolio-api:<version>`), uploaded as artifact `portfolio-api-<version>-sbom` with `if-no-files-found: error` (D9). The `digest` output stays the build digest; `verify` and `deploy` keep their steps. Existing pins get `# vX.Y.Z` comments (D10). | RF-17, RF-33–RF-37, RF-42–RF-44 |

### Changed: other files

| File | Change | RF |
|---|---|---|
| `.github/workflows/test.yaml` | New step `Script Tests` (`node --test scripts/`) after `E2E Tests`; `# vX.Y.Z` comments on pins (D10). Triggers, install and other steps unchanged, so the required check keeps the name `Lint, Tests & Build`. | RF-17, RF-41, RF-46 |
| `Dockerfile` | `node:26-alpine@sha256:…` in the three stages (D10). Approved with the plan: the runtime stage runs `apk upgrade --no-cache` and removes `/usr/local/lib/node_modules`, `npm` and `npx` (D13). | RF-11, RF-33–RF-35 |
| `package.json` | Script `"approve-builds": "pnpm approve-builds"` (D12). Dependency ranges unchanged; `version` → `6.2.0` in the release commit. | RF-45 |
| `pnpm-workspace.yaml` | Comment above `allowBuilds` pointing at `pnpm run approve-builds` and saying that installs fail on unapproved build scripts by design. The three current entries stay denied (D12). `overrides` only if an adoption finding needs one (D14). | RF-45–RF-47 |
| `pnpm-lock.yaml` | In-range updates that fix the blocking findings found at adoption (D14). | RF-30 |
| `AGENTS.md` | Commands: `node --test scripts/` and `pnpm run approve-builds`; Install line notes the build-script failure; closing checklist: `node --test scripts/` passes when `scripts/` changes. | RF-45 |
| `README.md` | Scripts table: `pnpm run approve-builds`, `node --test scripts/`. CI/CD: `CodeQL`, `SCA`, `Dependabot Version Bump`, Dependabot and the release scan gate and SBOM artifact; exceptions file. New "Release order for DevSecOps (version 6.2.0)" with the owner steps of **Release**. | — |

### Infrastructure (owner, outside the repo)

| Item | Change |
|---|---|
| GitHub App | Install web's `portfolio-version-bump` App (ID `5463156`) on `mfigueroa23/api-portfolio` as well (D3); add `BUMP_APP_ID` as an Actions variable and `BUMP_APP_PRIVATE_KEY` as an Actions secret (not a Dependabot secret, D2). |
| Code scanning | Default setup (now `configured`, `default` suite) disabled: `gh api -X PATCH repos/mfigueroa23/api-portfolio/code-scanning/default-setup -f state=not-configured`. |
| Ruleset on `main` | The existing, disabled `Production ruleset` (no deletion, no force push, PR required, signed commits, `Lint, Tests & Build`) gains `Lockfile Scan`, `Analyze (actions)` and `Analyze (javascript-typescript)` and the code scanning rule for CodeQL (security alerts `high_or_higher`, alerts `none`), and is enabled. |
| Labels | `dependencies`, `npm`, `github-actions`, `docker` (none exist today). |
| Dependabot security updates | Already enabled (`automated-security-fixes`); no change. |

## Decisions

| # | Decision | Discarded alternative | Why |
|---|---|---|---|
| D1 | No job that holds a write token or a secret installs dependencies or runs code from a PR: CodeQL uses `build-mode: none`, SCA scans the lockfile file, the bump runs only `main`'s script and `gh`. | `pnpm install` before analysing, or bumping with `npm version` | RF-26 and RF-44: an install runs build scripts and `npm version` runs the PR's lifecycle scripts. JS/TS CodeQL needs no build. Same as web D1. |
| D2 | The Dependabot-triggered run only dispatches `dependabot-bump.yaml` on `main` (`actions: write`, no checkout); the dispatched run holds the App token. | A Dependabot secret with the App key used in the `pull_request` run | RF-44 forbids secrets in Dependabot PR runs; the dispatched run executes `main`'s code (RF-26). Proven in web since 4.5.1. |
| D3 | The bump pushes with a GitHub App token, re-checked on `push` to `main` and hourly; the App is web's `portfolio-version-bump`, installed on both repositories. | `GITHUB_TOKEN`; a second App only for `api` | `GITHUB_TOKEN` commits trigger no workflows, so the bumped head would never get the required checks. One App keeps one key to rotate, with the same permissions; a key leak would reach both repositories, the same blast radius as the owner's own access. Approved by the owner on 2026-10-27. |
| D4 | Grype for vulnerabilities and Syft for SBOMs, as pinned CLIs at web's versions; CodeQL gating by the ruleset's code scanning rule. | Trivy; a script that parses CodeQL SARIF | Trivy's actions were compromised in March 2026 (web D4). The ruleset rule compares the PR with `main`, which is "introduces an alert" (RF-06, RF-07). |
| D5 | Own exceptions file and gate script over Grype's JSON. | Grype `ignore` rules in `.grype.yaml` | Ignore rules have no expiry and drop the finding; RF-38–RF-40 need "excepted", expired and invalid entries reported. |
| D6 | `scripts/sca-gate.mjs` and `scripts/dependabot-bump.mjs` (and tests) are copies of web's, differing only in the header's spec reference, run with `node --test scripts/` in `test.yaml`. | Rewriting them in TypeScript under `src/` and Vitest; a shared reusable workflow or package for both repos | Copies keep a fix portable by diff between the repos and already passed web's E2E; `src/` is the NestJS app (constitution §2) and Vitest only picks up `*.spec.ts`. A shared workflow would couple both repos' releases and need a third repository. |
| D7 | `setVersion` edits only the value of the top-level `"version"` line. | Re-serialising `package.json` (`JSON.stringify`, `jq`) | RF-20: a line edit keeps every other byte, so the file stays Prettier-clean. |
| D8 | The image goes to a job-local `registry:3`, is scanned there and copied to Docker Hub with `imagetools create`. | Pushing a candidate tag to Docker Hub; rebuilding after the scan | RF-34 forbids publishing before the scan; a rebuild may not reproduce the bytes. Copying keeps the scanned digest that `deploy` pins (RF-42). |
| D9 | One SPDX JSON SBOM per platform, in one artifact `portfolio-api-<version>-sbom`. | CycloneDX; one SBOM for the manifest list | Both formats meet RF-36; SPDX matches web and GitHub's export. The amd64 and arm64 images have their own Alpine packages, so each gets its own inventory. |
| D10 | Base images pinned as `node:26-alpine@sha256:…` and every action pin annotated `# vX.Y.Z`. | Bare tags and bare SHAs | RF-11: with a digest Dependabot opens a PR when the tag moves. The comment lets Dependabot and the reviewer see the versions (RF-17). |
| D11 | Prefixes `build(deps)` and `ci(deps)` written literally. | `prefix: build` + `include: scope` | `include: scope` gives `build(deps-dev)` for devDependencies (RF-15). |
| D12 | `pnpm run approve-builds` wraps pnpm's interactive command; the current `allowBuilds` entries (`@prisma/engines`, `esbuild`, `prisma`, all `false`) stay denied. | `pnpm approve-builds --all` or `--ignore-scripts` in CI; approving the Prisma builds | RF-46 holds today: installs pass and Prisma 7 with `@prisma/adapter-pg` needs no engine download (`pnpm build` runs `prisma generate` explicitly). RF-47 needs a new script to fail until the owner decides, which auto-approval would hide. |
| D13 | The runtime stage runs `apk upgrade --no-cache` and drops the bundled npm and npx. | Time-boxed exceptions until the official image is rebuilt | The same base in web's `ssr` image had 4 blocking findings inside npm (`undici`, `brace-expansion`) on 2026-10-25, which would stop the release (RF-34). The runtime runs only `node dist/main.js`, and the health check uses BusyBox `wget`. Builds then depend on the Alpine repository. |
| D14 | Blocking findings found at adoption (first local and PR `Lockfile Scan`, and a local image scan) are fixed in this branch with in-range `build(deps)` updates, adding an `overrides` entry only where a dependency pins a vulnerable version. | Exceptions; leaving them to Dependabot | Approved in the spec: otherwise this PR's own `Lockfile Scan` and its release would fail (RF-30, RF-34). Grype runs locally as a downloaded binary in a temporary folder, never as a project dependency. |
| D15 | The bump rebuilds the branch through GitHub's API (ref move, `POST /merges`, `createCommitOnBranch`), so commits are signed by GitHub. | Rebase in a temporary clone and push with `--force-with-lease` | RF-27: the `Production ruleset` requires signed commits; clone commits made with the App token are unsigned. Web D14, proven in its Dependabot PRs. |

## RF coverage

| RF | Where | Tests |
|---|---|---|
| RF-01 | `codeql.yaml`, `codeql-config.yaml` | E1 |
| RF-02, RF-03, RF-04 | `codeql.yaml` triggers | E1, E13 |
| RF-05 | `analyze` upload | E1, E13 |
| RF-06, RF-07 | Ruleset code scanning rule (D4) | E1, E2 |
| RF-08 | `codeql-config.yaml` `paths-ignore` | E1 |
| RF-09 | Default setup disabled (Release step 2) | E13 |
| RF-10 | `dependabot.yml` | E5 |
| RF-11 | `Dockerfile` digests (D10) | E5, E14 |
| RF-12, RF-13 | `dependabot.yml` `groups` | E5 |
| RF-14 | Repository security updates setting (spec Decisions) | E14 (settings review) |
| RF-15, RF-16 | `commit-message`, `labels` | E5 |
| RF-17 | Dependabot `github-actions` + `# vX.Y.Z` comments | E5 |
| RF-18 | No auto-merge configured | E5 |
| RF-19, RF-20 | `nextPatch`, `setVersion`, `rebump` | U-DB-1–U-DB-4, U-DB-11, U-DB-12, E5 |
| RF-21 | `bump` on `push` to `main` | U-DB-6, E6 |
| RF-22 | `decide` → `noop` | U-DB-5, E5 |
| RF-23 | `request` on `synchronize` after recreate | U-DB-7, E7 |
| RF-24 | `request` condition, `decide` → `skip` | U-DB-8, E8 |
| RF-25 | Conflict path, `Version bump` status, comment | U-DB-13, U-DB-14, E9 |
| RF-26 | D1, D2 | E14 (review) |
| RF-27 | `createCommitOnBranch`, `POST /merges` (D15) | U-DB-10–U-DB-12, U-DB-15, E5 (`Verified` badge) |
| RF-28, RF-29 | `sca.yaml` triggers | E3, E13 |
| RF-30, RF-31 | `classify` | U-SG-1–U-SG-4, E3 |
| RF-32 | `summary`, `upload-sarif` | U-SG-10, E3 |
| RF-33 | `release.yaml` scan steps | E10 |
| RF-34 | Gate before `imagetools create` | U-SG-1, E11 |
| RF-35 | Gate passes, SARIF and summary | U-SG-2, E10 |
| RF-36, RF-37 | Syft step, `upload-artifact` | E10 |
| RF-38 | `validateExceptions`, `classify` → `excepted` | U-SG-5, U-SG-6, E4 |
| RF-39 | Expired entries | U-SG-7, E4 |
| RF-40 | Invalid entries | U-SG-8, U-SG-9, U-SG-11, E4 |
| RF-41 | `test.yaml` unchanged gates + `Script Tests` | E5, E12 |
| RF-42 | `release.yaml` tags, `digest` output, `deploy` unchanged | E10 |
| RF-43 | `permissions` blocks, SHA pins in every workflow | E14 (review) |
| RF-44 | D2; no `secrets.` in a job reachable from a Dependabot `pull_request` run | E14 (review) |
| RF-45 | `approve-builds` script | E12 |
| RF-46 | Current `allowBuilds`, `test.yaml`/`release.yaml`/image installs | E10, E12 |
| RF-47 | pnpm default on unapproved builds (D12) | E12 |

## Test strategy

**Unit** (`node --test scripts/`, no network, new `Script Tests` step in `test.yaml`), copied from
web's suites:

- `sca-gate.test.mjs`
  - U-SG-1 — A `High` match with `fix.state: fixed` is `blocking`; the CLI exits 1.
  - U-SG-2 — A `Critical` match with `fix.state: not-fixed` is `reported`; exit 0.
  - U-SG-3 — A `Medium` match with a fix is `reported`; exit 0.
  - U-SG-4 — An empty `matches` array passes and prints "no findings".
  - U-SG-5 — A valid exception for the match's `vulnerability.id` makes it `excepted`; exit 0.
  - U-SG-6 — A GHSA exception covers the match whose `relatedVulnerabilities` include it.
  - U-SG-7 — An exception expired yesterday is listed as expired and the finding is `blocking`; one expiring today is valid.
  - U-SG-8 — An entry without `reason` (or empty) is invalid, named, exit 1 even with no findings.
  - U-SG-9 — An entry without `id` or with a non-ISO `expires` is invalid.
  - U-SG-10 — The summary has one row per finding with package, installed, fixed in, severity, advisory and status; several `--report` files are merged under their titles.
  - U-SG-11 — A missing or malformed report exits 1 with a one-line error, no stack trace.
- `dependabot-bump.test.mjs`
  - U-DB-1 — `nextPatch('6.1.0')` is `6.1.1`; `nextPatch('6.1.9')` is `6.1.10`.
  - U-DB-2 — `nextPatch` throws on `6.1`, `v6.1.0` or a pre-release.
  - U-DB-3 — `setVersion` on `api`'s `package.json` text changes only the version value; the rest is byte-identical.
  - U-DB-4 — `setVersion` ignores a nested `"version"` key further down.
  - U-DB-5 — `decide` returns `noop` when the PR version is `main` + 1 patch.
  - U-DB-6 — `decide` returns `rebump` when `main` moved.
  - U-DB-7 — `decide` returns `rebump` when the PR has `main`'s version (bump lost on recreate).
  - U-DB-8 — `decide` returns `skip` for any author other than `dependabot[bot]`.
  - U-DB-9 — `isBumpCommit` recognises the bump subject only (`chore(release): Version 6.1.0` is not one).
  - U-DB-10 — `trailingBump` keeps the last non-bump commit, drops only trailing bumps, and refuses a branch with only bumps or with a commit after the bump.
  - U-DB-11 — `rebump` on a branch with a stale bump that is behind `main`: moves back, merges `main`, adds one bump commit expecting the merge as head.
  - U-DB-12 — `rebump` on an up-to-date branch without a bump only adds the bump commit.
  - U-DB-13 — A merge conflict restores the original head and adds no commit.
  - U-DB-14 — A head that moved during the run gets no write, and another push is never overwritten.
  - U-DB-15 — A bump commit followed by another commit is never reset.

No NestJS unit or e2e test changes: no code in `src/` or `test/` is touched, and `pnpm test` and
`pnpm test:e2e` must stay green as they are.

**End to end** (on GitHub during this release; no fake emulates Dependabot, code scanning or the
registry):

- E1 — Throwaway PR adding a route that passes a query parameter into `prisma.$queryRawUnsafe`: CodeQL reports a high `js/sql-injection` alert and the PR is blocked; removing it unblocks. No alert from `dist/`.
- E2 — Throwaway PR whose only alert is below high: checks pass, the alert is visible in Security.
- E3 — Throwaway PR pinning a package to a version with a fixed high advisory: `Lockfile Scan` fails with the table in the summary and the alert in Security.
- E4 — Same PR plus a valid exception: passes and lists it as excepted; with a past `expires`: fails naming it; without `reason`: fails naming it.
- E5 — "Check for updates" for each ecosystem: grouped minor/patch PRs with the right prefix and labels, majors apart, Actions still SHA-pinned, a Docker digest PR; each PR gets exactly one `Verified` bump commit to `main` + 1 patch and green checks; a re-run adds nothing.
- E6 — Merge one Dependabot PR: the other open ones are re-bumped within minutes.
- E7 — `@dependabot recreate`: the bump commit comes back.
- E8 — A feature-branch PR is never touched by the bump workflow.
- E9 — Force a conflict on `package.json`: no push, failed `Version bump` status and one comment.
- E10 — Merge this feature: the release scans both platforms, publishes the three tags with the digest the deploy pins, `rollout status` passes, `GET /` answers, and the `portfolio-api-6.2.0-sbom` artifact holds two SPDX files.
- E11 — Locally, Grype and `sca-gate.mjs` against the current unhardened image (or an older `node:26-alpine`): exit 1 on its fixed highs; in the YAML, `imagetools create` (the only Docker Hub push) comes after the gate. Forcing a blocking finding in the real release would mean deploying on purpose.
- E12 — Throwaway PR adding a package with a `postinstall` script: `Lint, Tests & Build` fails naming it; `pnpm run approve-builds` and a commit make it pass.
- E13 — Next day: scheduled CodeQL and SCA runs in Actions; no default-setup CodeQL run.
- E14 — Review: every workflow has `permissions`, every third-party action is SHA-pinned, no `secrets.` in a job reachable from a Dependabot `pull_request` run, every `FROM` has a digest, Dependabot security updates enabled.

## Implementation order

1. Adoption baseline: Grype (downloaded to a temporary folder) over `pnpm-lock.yaml` and the current image; fix blocking lockfile findings with in-range updates (D14).
2. `scripts/sca-gate.mjs` + tests, `.github/sca-exceptions.json`.
3. `scripts/dependabot-bump.mjs` + tests.
4. `test.yaml`: `Script Tests` and version comments.
5. `codeql.yaml` and `codeql-config.yaml`.
6. `sca.yaml`.
7. `dependabot-bump.yaml`.
8. `release.yaml`: local registry, scan, gate, SARIF, copy to Docker Hub, SBOM; version comments.
9. `Dockerfile` digests and runtime hardening (D13); confirm the image scan passes locally; `dependabot.yml`.
10. `package.json` `approve-builds`, `pnpm-workspace.yaml` comment; `AGENTS.md` and `README.md`.
11. Closing checklist (`pnpm lint`, `pnpm test`, `pnpm test:e2e`, `pnpm build`, `node --test scripts/`, Prettier on touched TS/YAML/Markdown), then `chore(release): Bump version to v6.2.0`.

## Release

1. Install the bump App on `api-portfolio`, store `BUMP_APP_ID` and `BUMP_APP_PRIVATE_KEY`; create the four labels.
2. When the PR is opened, disable CodeQL default setup (advanced uploads are rejected while it is on).
3. Check that `CodeQL`, `SCA` and `API Tests` pass on the PR (E1–E4, E12 on throwaway branches off it).
4. Update and enable the `Production ruleset` with the new checks and the code scanning rule, using the check names the PR shows.
5. Merge; watch the release (E10). If the new steps fail, revert the merge: the previous `release.yaml` publishes as before. No migration is involved, and the web and panel releases are independent of this one.
6. Trigger Dependabot from the dependency graph (E5–E9); next day E13.
7. `/tag-release` 6.2.0.

## Risks

- **Enabling the ruleset changes daily work:** signed commits and PRs become mandatory on `main` (today the ruleset is disabled). Commits already merge through PRs; unsigned local commits would block. Mitigation: check `git config commit.gpgsign` before step 4.
- **Base-image findings after hardening:** if the hardened image (D13) still has blocking findings from Alpine or the production `node_modules`, they are fixed in this branch (D14) or, if no fix is reachable, excepted with an expiry in the same PR.
- **Dispatch treated as Dependabot-triggered:** if secrets are withheld from the dispatched run, the bump arrives with the hourly schedule (D3), as in web.
- **`imagetools create` from an HTTP registry:** proven in web; if it fails here, `crane copy` (downloaded, pinned) keeps the digest.
- **Grype database download fails:** scan and release fail closed; `cache-db: true` and a manual re-run.
- **Shared App key:** a leak affects both repositories (D3); rotate it from the App settings and update both secrets.
- **Drift between web's and api's scripts:** a fix in one must be copied to the other; the identical bodies (D6) make `diff` the check.
- **Release time:** two scans and two SBOMs add an estimated 2–3 minutes to `package`.
