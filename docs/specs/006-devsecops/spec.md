# Spec 006 — DevSecOps: CodeQL, Dependabot and SCA

- **Status:** Approved
- **Date:** 2026-10-27
- **Scope:** `api` repository CI and image build only (GitHub Actions, Dependabot, `Dockerfile` base images, repository security settings); no change to the API's endpoints or runtime behaviour

## Why

Static analysis and dependency updates in `api` are driven by GitHub's defaults: nothing versioned
in the repository decides what is analysed, how often, or what blocks a merge. Every merge into
`main` deploys `portfolio-api` to the cluster through `release.yaml`, so a vulnerable dependency or
base image can reach production without any check stopping it. The `Dockerfile` names its base
image only by tag, so its contents change between builds without review.

Dependency PRs also break the repository's delivery rule (constitution §9 and the closing
checklist of `AGENTS.md`): every change into `main` bumps `version` in `package.json`, but
Dependabot PRs never do. There is no software composition analysis of the lockfile or of the
published image, and no inventory (SBOM) of what each published image contains. The `web`
repository solved the same problems in its Spec 009; `api` should follow the same model so both
repositories are governed alike.

## Decisions

| Topic                    | Decision                                                                                                                                                                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope                    | Full parity with `web` Spec 009, adapted to the single `portfolio-api` image.                                                                                                                                                          |
| CodeQL setup             | Versioned advanced setup replaces the default setup; languages `actions` and `javascript-typescript`; `security-extended` suite.                                                                                                       |
| CodeQL triggers          | Every PR into `main`, every push to `main` and a daily scheduled scan (default, as in web).                                                                                                                                            |
| CodeQL gating            | A new alert of high or critical security severity blocks the merge (default, as in web).                                                                                                                                               |
| Dependabot ecosystems    | npm (pnpm), GitHub Actions and Docker base images; weekly version updates, minor and patch grouped per ecosystem, each major in its own PR; security updates for npm and Actions open immediately.                                     |
| Base images              | Every `Dockerfile` stage pins `node:26-alpine` by tag and digest, so Dependabot proposes digest updates weekly and builds are reproducible. Approved by the owner on 2026-10-27.                                                       |
| Docker security updates  | Not available (GitHub has no advisories for container images); covered by the weekly digest updates and the release image scan (as in web).                                                                                            |
| Version bump             | Every Dependabot PR carries one `chore(release): Bump version to vX.Y.Z` commit with `main`'s version plus one patch, recomputed when `main`'s version changes (as in web).                                                            |
| Auto-merge               | None: every merge deploys, so the owner reviews each Dependabot PR.                                                                                                                                                                    |
| SCA scope                | `pnpm-lock.yaml` on every PR into `main` and daily; the `portfolio-api` image (both platforms) in the release before it is published; an SBOM per published image.                                                                     |
| SCA gating               | Critical or high findings with a fixed version block; findings without a fix are reported only.                                                                                                                                        |
| Exceptions               | A versioned exceptions file; each entry needs the advisory id, a reason and an expiry date (as in web).                                                                                                                                |
| Findings at adoption     | Blocking findings present when this spec lands are fixed in its branch with in-range updates (`build(deps)` commits), using a dependency override only where a package pins a vulnerable version. Approved by the owner on 2026-10-27. |
| Reporting                | Findings appear in the repository's Security tab (code scanning) and in the job summary.                                                                                                                                               |
| Dependency build scripts | One project command records the approval or denial of build scripts in `allowBuilds` of `pnpm-workspace.yaml`; an unapproved new build script still fails the install (as in web).                                                     |
| This spec's version      | Minor bump (new CI capability).                                                                                                                                                                                                        |

## Functional requirements

"The pipeline" is the set of GitHub Actions workflows and the Dependabot configuration versioned in
this repository. "Owner" is the repository owner. "Dependabot PR" is a pull request opened by
Dependabot against `main`. "Blocking finding" is a vulnerability of critical or high severity that
has a fixed version and is not covered by a valid exception. "The image" is `portfolio-api`, built
from the `Dockerfile` for `linux/amd64` and `linux/arm64`.

### SAST (CodeQL)

- **RF-01** — The pipeline shall analyse the repository with CodeQL for the `actions` and `javascript-typescript` languages using the `security-extended` query suite.
- **RF-02** — When a pull request into `main` is opened or updated, the pipeline shall run the CodeQL analysis and report it as a check on the PR.
- **RF-03** — When a commit is pushed to `main`, the pipeline shall run the CodeQL analysis.
- **RF-04** — The pipeline shall run the CodeQL analysis on `main` once a day on a schedule.
- **RF-05** — When a CodeQL analysis finishes, the pipeline shall publish its alerts in the repository's code scanning (Security tab).
- **RF-06** — If a pull request introduces a CodeQL alert of high or critical security severity, then the CodeQL check shall fail and the PR shall not be mergeable.
- **RF-07** — If a pull request introduces only alerts below high severity, then the CodeQL check shall pass and the alerts shall still be published.
- **RF-08** — The pipeline shall exclude build output, coverage reports, installed dependencies and the generated Prisma client from the CodeQL analysis.
- **RF-09** — While the advanced CodeQL setup is active, the repository shall not run the CodeQL default setup.

### Dependency updates (Dependabot)

- **RF-10** — The pipeline shall check npm, GitHub Actions and `Dockerfile` base-image dependencies for version updates once a week.
- **RF-11** — The `Dockerfile` shall reference every base image by tag and digest.
- **RF-12** — The pipeline shall group the minor and patch version updates of each ecosystem into a single Dependabot PR.
- **RF-13** — The pipeline shall open each major version update in its own Dependabot PR.
- **RF-14** — When a security advisory affects an npm or GitHub Actions dependency, the pipeline shall open a security-update Dependabot PR without waiting for the weekly check.
- **RF-15** — The pipeline shall title Dependabot commits and PRs with Conventional Commits: `build(deps)` for npm and Docker, `ci(deps)` for GitHub Actions.
- **RF-16** — The pipeline shall label every Dependabot PR with `dependencies` and its ecosystem.
- **RF-17** — The pipeline shall keep GitHub Actions pinned by full commit SHA when it updates them.
- **RF-18** — The pipeline shall not merge any Dependabot PR automatically.

### Version bump in Dependabot PRs

- **RF-19** — When a Dependabot PR is opened, the pipeline shall add to it one commit `chore(release): Bump version to vX.Y.Z` that sets `version` in `package.json` to `main`'s version with the patch number increased by one.
- **RF-20** — The bump commit shall change only the `version` field of `package.json`, keeping the file Prettier-clean.
- **RF-21** — When `main`'s version changes while a Dependabot PR is open, the pipeline shall update the PR's bump so its version is the new `main` version plus one patch, still as a single bump commit.
- **RF-22** — When a Dependabot PR is updated and its `version` already equals `main`'s version plus one patch, the pipeline shall not add another commit.
- **RF-23** — When Dependabot rebases or recreates its PR and the bump commit is lost, the pipeline shall add it again as in RF-19.
- **RF-24** — If a pull request is not authored by Dependabot, then the pipeline shall not change its version or push to its branch.
- **RF-25** — If the bump commit cannot be pushed to the Dependabot PR, then the pipeline shall fail a visible check on that PR and leave the branch unchanged.
- **RF-26** — The bump step shall not install or execute code from the Dependabot PR while it holds a token with write permission.
- **RF-27** — The bump commits shall satisfy the commit-signature rule of `main`, so a Dependabot PR stays mergeable.

### SCA — dependencies

- **RF-28** — When a pull request into `main` is opened or updated, the pipeline shall scan `pnpm-lock.yaml` for known vulnerabilities and report it as a check on the PR.
- **RF-29** — The pipeline shall scan `main`'s `pnpm-lock.yaml` once a day on a schedule.
- **RF-30** — If the lockfile scan finds a blocking finding, then the SCA check shall fail and the PR shall not be mergeable.
- **RF-31** — If the lockfile scan finds only findings without a fixed version or below high severity, then the SCA check shall pass and report them.
- **RF-32** — When a lockfile scan finishes, the pipeline shall publish its findings in the repository's code scanning and list them (package, installed version, fixed version, severity, advisory id) in the job summary.

### SCA — image and SBOM

- **RF-33** — When `release.yaml` builds the image, the pipeline shall scan it on both platforms for known vulnerabilities of its OS packages and Node dependencies before publishing it.
- **RF-34** — If the image scan finds a blocking finding, then the release shall not publish any tag to Docker Hub and shall not deploy, and the cluster shall keep the running version.
- **RF-35** — If the image scan finds only non-blocking findings, then the release shall publish and deploy as today and report the findings in the job summary and in code scanning.
- **RF-36** — When the image is published, the pipeline shall generate an SBOM of it in a standard format (SPDX or CycloneDX) naming the image, its version and its digest.
- **RF-37** — The pipeline shall keep each SBOM as a downloadable artifact of the release run, named with the image and the version.

### Exceptions

- **RF-38** — Where a finding is listed in the versioned exceptions file with its advisory id, a reason and an expiry date in the future, the SCA checks shall report it as excepted and not count it as blocking.
- **RF-39** — If an exception has expired, then the SCA checks shall treat the finding as if it had no exception and name the expired entry in the job summary.
- **RF-40** — If an exception lacks the advisory id, the reason or the expiry date, then the SCA checks shall fail and name the invalid entry.

### Integration with the existing pipeline

- **RF-41** — `test.yaml` (lint, format check, unit and e2e tests, build) shall keep running and gating PRs into `main` as today, including Dependabot PRs.
- **RF-42** — When no blocking finding exists, `release.yaml` shall keep running its `verify` job, publishing `portfolio-api` with the `latest`, version and `sha-<commit>` tags, deploying it pinned by digest and checking `rollout status` (constitution §10).
- **RF-43** — Every workflow of the pipeline shall declare the minimum token permissions it needs and pin third-party actions by full commit SHA, as the existing workflows do.
- **RF-44** — The pipeline shall not expose `DOCKERHUB_TOKEN`, `KUBE_CONFIG`, `LOCAL_NETWORK` or any other secret to Dependabot PR runs or to SCA/CodeQL reports.

### Dependency build scripts

- **RF-45** — The repository shall provide one command that records the owner's approval or denial of the dependencies' build scripts in `allowBuilds` of `pnpm-workspace.yaml`.
- **RF-46** — When the pipeline installs dependencies (`test.yaml`, `release.yaml`, the image build and Dependabot's lockfile updates), the install shall finish without errors about build scripts pending approval.
- **RF-47** — If a dependency update introduces a package with a build script that is not in `allowBuilds`, then the install shall fail naming the package, and the PR shall stay unmergeable until the owner records a decision with the command of RF-45.

## Out of scope

- Automatic merge of Dependabot PRs (every merge deploys to production).
- A bump other than patch for dependency PRs.
- CodeQL `security-and-quality` suite or custom queries.
- Accepting the blocking findings found at adoption as exceptions instead of fixing them (discarded by the owner).
- Licence compliance checks of dependencies.
- DAST against the running API, secret scanning changes and IaC scanning of the Kubernetes manifests.
- Image signing or SBOM attestations pushed to the registry.
- Scanning the image on pull requests; it is scanned only in the release.
- Major upgrades of dependencies or of the Node base image beyond what fixing a blocking finding needs.
- The `web` and `panel` repositories, and any change to the API's code, endpoints or runtime configuration (`property`, `cors_origin`).

## Constraints

- **Infra/CI approval (AGENTS.md):** approving this spec grants the new and changed files under `.github/` (CodeQL, SCA and bump workflows, `dependabot.yml`, exceptions file), the changes to `release.yaml`, the digest pinning of the `Dockerfile` (approved 2026-10-27) and the command of RF-45. Any other `Dockerfile` change the plan needs (for example to reduce findings in the runtime image) needs its own approval in the plan.
- **Dependencies:** lockfile updates and `overrides` that fix blocking findings at adoption are approved (Decisions); no new dependency in `package.json` is expected. SCA and SBOM tools run inside CI only; adding one to `package.json` is a dependency approval.
- **Repository settings (manual, owner):** disable CodeQL default setup (RF-09); require the CodeQL, SCA and `API Tests` checks on `main` through a ruleset with the code scanning rule (RF-06, RF-30); create the Dependabot labels; give the bump workflow a way to push signed commits to Dependabot branches (as web does).
- **Security of the bump (RF-26, RF-27):** workflows triggered by Dependabot PRs with write permissions are a known attack surface; the plan must justify the trigger and token used, reusing web's approach where it applies.
- **Docs:** `README.md` (CI and release) and the `AGENTS.md` commands change with this spec; both need the owner's go-ahead at plan time.
- Constitution §6: secrets stay in the `property` table and in GitHub secrets; none reaches Dependabot runs or reports.
- Constitution §9 and §10: SemVer and Conventional Commits; `API Tests` keeps gating `main`; `release.yaml` keeps deploying by digest and checking `rollout status`.

## Done criteria

- [ ] A throwaway PR with a deliberately vulnerable pattern (for example user input concatenated into a raw SQL query) fails the CodeQL check; removing it makes the check pass.
- [ ] A throwaway PR that pins a dependency to a version with a known critical/high advisory with a fix fails the SCA check; a valid exception makes it pass; an expired or incomplete exception makes it fail again.
- [ ] A Dependabot PR (or one recreated with `@dependabot recreate`) receives exactly one signed `chore(release): Bump version to vX.Y.Z` commit with `main`'s version plus one patch; after bumping `main`, the PR's bump is updated; a PR not authored by Dependabot is left untouched.
- [ ] The scheduled CodeQL and SCA runs appear daily in the Actions tab and their alerts in the Security tab.
- [ ] A release run scans the image on both platforms, uploads its SBOM as an artifact, and still publishes, pins by digest and passes `rollout status`; the gate runs before anything is pushed to Docker Hub.
- [ ] The `Dockerfile` pins every base image by digest and Dependabot opens its weekly Docker PR.
- [ ] `pnpm lint`, `pnpm test`, `pnpm test:e2e` and `pnpm build` pass; `pnpm exec prettier --check "src/**/*.ts" "test/**/*.ts"` is clean, and the touched YAML and Markdown are Prettier-clean.
- [ ] Installs in `test.yaml` and `release.yaml` show no build-script approval errors; a throwaway PR adding a package with an unapproved build script fails until the RF-45 command records a decision.
- [ ] CodeQL default setup is disabled and the required checks are configured on `main`.
- [ ] `README.md` documents the new checks and the release gate; no migration is involved.
- [ ] `version` in `package.json` bumped as a minor in `chore(release): Bump version to vX.Y.Z`.
