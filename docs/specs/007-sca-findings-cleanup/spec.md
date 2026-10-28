# Spec 007 — Clear the open SCA findings

- **Status:** Approved
- **Date:** 2026-10-28
- **Scope:** `api` repository: `pnpm-lock.yaml`, `.github/sca-exceptions.json` and the state of the
  repository's code scanning alerts; no change to the API's endpoints, runtime behaviour, workflows
  or `Dockerfile`

## Why

The release of v6.2.6 left 20 open alerts in the repository's Security tab, all reported by the
software composition analysis added in Spec 006 (lockfile scan and the scan of both image
platforms). They come from three causes: `fast-uri` 3.1.8 (four advisories, in the lockfile and in
the published image), `@vitest/mocker` 4.1.11 (two advisories, development only) and
CVE-2025-60876 in Alpine's `busybox`, `busybox-binsh` and `ssl_client` (both image platforms), for
which Alpine publishes no fixed version yet.

None of them is critical or high, so the Spec 006 gate correctly let them through, but an open list
of known vulnerabilities hides any new one and leaves fixable issues in the production image. The
owner wants the Security tab back to zero open SCA alerts, fixing what has a fix and recording an
explicit, expiring decision for what has none.

## Decisions

| Topic                           | Decision                                                                                                                                                                                                              |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fast-uri` and `@vitest/mocker` | Fixed with in-range lockfile updates (`fast-uri` 3.1.9, `vitest` family 4.1.12); no override and no change to `package.json` ranges.                                                                                  |
| CVE-2025-60876 (busybox)        | Dismissed in code scanning as "won't fix" with a justification, plus an expiring exception; the `Dockerfile` and its `wget` HEALTHCHECK stay as they are. Removing busybox from the image was discarded by the owner. |
| Justification                   | The runtime only uses busybox `wget` for the HEALTHCHECK against `127.0.0.1`, with no user-controlled input; no fix exists in Alpine.                                                                                 |
| Exception expiry                | 90 days (2027-01-26); `apk upgrade` in the image picks up a fixed busybox as soon as Alpine publishes it.                                                                                                             |
| Gating policy                   | Unchanged: Spec 006 keeps blocking only critical/high findings with a fix. Blocking medium findings was discarded by the owner.                                                                                       |
| Reporting of no-fix findings    | Unchanged: they keep being uploaded to code scanning (uploading only fixable findings was discarded).                                                                                                                 |
| Version                         | Patch bump (fix).                                                                                                                                                                                                     |

## Functional requirements

"The lockfile scan" and "the image scan" are the Spec 006 SCA scans (`sca-lockfile`,
`sca-image-amd64`, `sca-image-arm64`). "Open alert" is a code scanning alert in state `open`.
"The image" is `portfolio-api` for `linux/amd64` and `linux/arm64`.

### Fixable findings

- **RF-01** — The lockfile shall resolve `fast-uri` to a version not affected by GHSA-w74x-v6f9-j3xg, GHSA-wjr9-j795-jxcr, GHSA-333x-w4r6-6crp or GHSA-xhq7-xmqj-769h.
- **RF-02** — The lockfile shall resolve `@vitest/mocker` to a version not affected by GHSA-qxg6-89mg-rqv8 or GHSA-xp26-3454-mjgp.
- **RF-03** — When the lockfile scan runs on this spec's PR, it shall report no finding for `fast-uri` or `@vitest/mocker`.
- **RF-04** — When the image built from `main` after the merge is scanned, the image scan shall report no finding for `fast-uri` on either platform.
- **RF-05** — The updates of RF-01 and RF-02 shall keep every direct dependency within its current `package.json` range.

### Findings without a fix

- **RF-06** — The exceptions file shall hold one entry for CVE-2025-60876 with the justification of the Decisions and an expiry date of 2027-01-26.
- **RF-07** — When the image scan finds CVE-2025-60876, the SCA gate shall report it as excepted in the job summary.
- **RF-08** — The six open CVE-2025-60876 alerts (`busybox`, `busybox-binsh`, `ssl_client` on both platforms) shall be dismissed as "won't fix" with a comment naming this spec and the justification.
- **RF-09** — If a later image scan reports CVE-2025-60876 for the same packages, then code scanning shall keep those alerts dismissed and shall not open new ones.
- **RF-10** — If Alpine publishes a fixed busybox and the image no longer contains the vulnerable version, then the image scan shall stop reporting CVE-2025-60876.

### Integration with the existing pipeline

- **RF-11** — After the merge and the next lockfile and image scans of `main`, the repository shall have zero open SCA alerts.
- **RF-12** — `test.yaml`, `codeql.yaml`, `sca.yaml` and `release.yaml` shall pass on this spec's PR and its release as they do today, with no change to their files.
- **RF-13** — The API's endpoints, responses and runtime configuration shall behave exactly as before.

## Out of scope

- Removing busybox or `wget` from the runtime image, changing the HEALTHCHECK or the base image (discarded by the owner).
- Changing the SCA gate threshold (for example, blocking medium findings with a fix) or uploading only fixable findings (discarded by the owner).
- Dependency `overrides`, `package.json` range changes or major upgrades (`vitest` 5).
- CodeQL query alerts (none are open) and the `web` and `panel` repositories.

## Constraints

- **Dependencies (AGENTS.md):** approving this spec approves the in-range lockfile updates of RF-01 and RF-02; no new dependency.
- **CI files (AGENTS.md):** `.github/sca-exceptions.json` gets one entry (RF-06); no workflow changes.
- **Dismissing alerts (RF-08):** an action on the GitHub repository; it is done by the owner, or with `gh` once the owner approves it at plan time.
- Constitution §9: patch bump in `chore(release): Bump version to vX.Y.Z`; `API Tests` keeps gating `main`.
- Constitution §10: the release keeps deploying by digest and passing `rollout status`.

## Done criteria

- [ ] `pnpm why fast-uri` and `pnpm why @vitest/mocker` show only the fixed versions.
- [ ] The PR's `Lockfile Scan` lists no `fast-uri` or `@vitest/mocker` finding.
- [ ] `node --test scripts/` passes and the gate accepts the new exception (not invalid, not expired).
- [ ] `pnpm lint`, `pnpm test`, `pnpm test:e2e` and `pnpm build` pass; `pnpm exec prettier --check "src/**/*.ts" "test/**/*.ts"` is clean and the touched JSON is Prettier-clean.
- [ ] The six CVE-2025-60876 alerts are dismissed as "won't fix" with their comment.
- [ ] After the merge, the release run shows CVE-2025-60876 as excepted, no `fast-uri` finding, publishes and passes `rollout status`; a manual run of `SCA` on `main` closes the lockfile alerts and the Security tab shows zero open SCA alerts.
- [ ] `version` in `package.json` bumped as a patch (6.2.7) in `chore(release): Bump version to v6.2.7`; no migration or README change.
