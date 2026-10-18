# Tasks 005 — Resume management

- **Spec:** [spec.md](spec.md) · **Plan:** [plan.md](plan.md)
- **Order:** by dependency. A task starts only when the tasks under "Depends on" are done. Tasks with the same dependencies can run in parallel.
- **Ids:** `D#` = plan decision, `U-*` / `E#` = tests listed in the plan's test strategy.

## Phase 0 — Gate

- [x] **T01 — Approvals before any code**
  - **RF:** RF-17 (and the persistence behind RF-01, RF-03, RF-10, RF-20)
  - **Depends on:** —
  - **Scope:** the owner approves the `prisma/schema.prisma` change (plan, Data model) and confirms D8: strict `?lang` returning 400, or amend RF-17 to the lenient rule of the content reads.
  - **Done when:** the approval is recorded in this file, and `spec.md` (RF-17) and `plan.md` (D8) agree with the chosen rule.
  - **Approval (2026-10-18, owner):** the `prisma/schema.prisma` change is approved as described in the plan (Data model, D1–D3): the `Resume` model and the `File.resumes` back-relation, through the `resume` migration. D8 is confirmed strict: a `?lang` other than `en` or `es` answers 400 with a `lang` field error. RF-17 and D8 already state this rule and stay unchanged.

## Phase 1 — Foundations

- [x] **T02 — `resume` model and migration**
  - **RF:** RF-01, RF-03, RF-10, RF-20
  - **Depends on:** T01
  - **Scope:** `Resume` model + `File.resumes` back-relation (plan, Data model, D1–D3). Migration `resume` with the hand-added `CHECK (lang IN ('en','es'))`.
  - **Done when:** `pnpm prisma migrate status` reports the database is up to date, `psql -c '\d resume'` shows PK `lang`, the CHECK and an FK to `file(id)` with `ON DELETE RESTRICT`, and `pnpm build` passes.

- [x] **T03 — Fake: `resume` model and `upsert`**
  - **RF:** — (test infrastructure for RF-01 – RF-21)
  - **Depends on:** T02
  - **Scope:** `PrismaFake.resume` keyed by `lang` with an `assignedAt` default, and a generic `FakeModel.upsert`.
  - **Done when:** `pnpm test:e2e test/fakes/prisma.fake.e2e-spec.ts` passes with new `upsert` cases: it creates when the row is missing and updates when it exists.

- [x] **T04 — `FilesService.meta` and `FilesModule` export**
  - **RF:** RF-05, RF-06
  - **Depends on:** T02
  - **Scope:** `meta(id)` returns `FileMeta` without loading the bytes and throws 404 for a missing or malformed id. `urlOf` builds on it, and `FilesModule` exports `FilesService`.
  - **Done when:** `files.service.spec.ts` has passing cases for `meta` (existing file, unknown UUID, non-UUID), and the existing `files` unit and e2e suites pass unchanged.

- [x] **T05 — `resumeHeaders`**
  - **RF:** RF-13, RF-18
  - **Depends on:** — (can run in parallel with T02–T04)
  - **Scope:** `files-response.ts` gains `resumeHeaders(file)`: `fileHeaders` with `Cache-Control: no-cache` (D7).
  - **Done when:** U-R1 passes in `files-response.spec.ts`. It asserts the same headers as `fileHeaders` except `Cache-Control: no-cache`, with no `immutable`.

## Phase 2 — Resume module

- [x] **T06 — Resume DTOs**
  - **RF:** RF-05, RF-06, RF-07, RF-17
  - **Depends on:** T01
  - **Scope:** `ResumeLangParamDto`, `ResumeQueryDto` (D8) and `AssignResumeDto` (`@IsUUID()` `fileId`) in `src/app/resume/dto/`.
  - **Done when:** `dto/*.spec.ts` passes. `validate()` accepts `en`/`es`, rejects `fr`, `""` and a repeated `lang` with a `lang` error, allows `lang` to be missing only in `ResumeQueryDto`, and rejects a missing or non-UUID `fileId`.

- [x] **T07 — `ResumeService`: read, assign, clear**
  - **RF:** RF-01, RF-03, RF-04, RF-05, RF-06, RF-08, RF-09, RF-10, RF-11, RF-12
  - **Depends on:** T03, T04
  - **Scope:** `assignments()`, `assign(lang, fileId)` (in a transaction, D4, D6, D11) and `clear(lang)`.
  - **Done when:** U-S1 to U-S5 pass in `resume.service.spec.ts`.

- [x] **T08 — `ResumeService.publicFile`**
  - **RF:** RF-14, RF-15, RF-16
  - **Depends on:** T07
  - **Scope:** resolves the requested language with the Spanish → English fallback and returns the bytes, `mime` and name.
  - **Done when:** U-S6 passes. It covers `en`, `es`, `es` falling back to `en`, `lang` missing, nothing assigned (404), and Spanish assigned without English.

- [x] **T09 — `ResumeController` and `ResumeModule` wiring**
  - **RF:** RF-01 – RF-19
  - **Depends on:** T05, T06, T08
  - **Scope:** the four routes from the plan (D9), `JwtAuthGuard` on the three owner routes, `ResumeModule` imports `AuthModule` and `FilesModule`, registered in `app.module.ts`.
  - **Done when:** U-C1 passes in `resume.controller.spec.ts`, `pnpm build` passes, and `pnpm start:dev` logs the routes `GET /resume`, `GET /resume/assignments`, `PUT /resume/assignments/:lang` and `DELETE /resume/assignments/:lang`.

## Phase 3 — File library integration

- [x] **T10 — Refuse deleting a file in use**
  - **RF:** RF-20
  - **Depends on:** T03, T04
  - **Scope:** `FilesService.remove` answers `ConflictException('File is the current resume.')` when a resume points at the file, and turns a P2003 into the same 409 (D3).
  - **Done when:** U-F1 passes. It covers 409 while assigned, deletion once cleared, and a mocked P2003 → 409.

- [x] **T11 — Resume entries in file references**
  - **RF:** RF-21
  - **Depends on:** T03, T04
  - **Scope:** `FileReferencesService.find` takes the id and adds `{ collection: 'resume', id: <lang>, title }` per assigned language. `FileReference` widens (D10), and `FilesController.references` passes the id.
  - **Done when:** U-F2 passes, and `files.controller.spec.ts` checks the new `find` arguments.

## Phase 4 — End to end

- [x] **T12 — `test/resume.e2e-spec.ts`**
  - **RF:** RF-01 – RF-19
  - **Depends on:** T09
  - **Scope:** E1 to E9 from the plan, with the sample PDF and PNG from `test/fixtures/file-samples.ts` uploaded through `POST /files`.
  - **Done when:** `pnpm test:e2e test/resume.e2e-spec.ts` passes with E1–E9, including the 304 on `If-None-Match` and the new bytes and `ETag` at the same URL after a replacement.

- [x] **T13 — File library e2e cases**
  - **RF:** RF-20, RF-21, RF-22
  - **Depends on:** T09, T10, T11
  - **Scope:** E10 in `test/files.e2e-spec.ts`.
  - **Done when:** `pnpm test:e2e test/files.e2e-spec.ts` passes, including: 409 deleting the assigned PDF, the `resume` entry in references, `immutable` still on `GET /files/:id`, and 204 once cleared.

## Phase 5 — Docs, verification and release

- [x] **T14 — README**
  - **RF:** RF-13 – RF-21 (documentation)
  - **Depends on:** T12, T13
  - **Scope:** the endpoints table (4 new routes and the 409 on `DELETE /files/:id`), the fallback and caching rules, and a "Release order for resume management (version 6.1.0)" section (plan, Release).
  - **Done when:** `README.md` lists every route in the plan's endpoints table with its auth and answer, and the release-order section says to run `pnpm prisma migrate deploy` before merging.

- [x] **T15 — Quality gate**
  - **RF:** all
  - **Depends on:** T12, T13, T14
  - **Scope:** `pnpm format` on touched files, then the full checks from AGENTS.md and the constitution (§3, §4).
  - **Done when:** `pnpm lint`, `pnpm test`, `pnpm test:e2e` and `pnpm build` exit 0, and `pnpm exec prettier --check "src/**/*.ts" "test/**/*.ts"` is clean.

- [x] **T16 — Manual check against a local database**
  - **RF:** RF-13, RF-15, RF-18, RF-19, RF-20
  - **Depends on:** T15
  - **Scope:** the spec's manual done criterion, plus the database-level `Restrict` that the fake cannot check (D3).
  - **Done when:** on `pnpm start:dev`:
    - an English PDF is assigned and `curl -I localhost:3000/resume` shows 200 with `no-cache`;
    - after a replacement, the same URL serves the new file;
    - `?lang=es` falls back to English;
    - `DELETE /files/:id` of the assigned PDF answers 409;
    - `DELETE FROM file WHERE id = '<assigned id>'` in `psql` fails with a foreign key violation.

- [x] **T17 — Version bump**
  - **RF:** —
  - **Depends on:** T16
  - **Scope:** `package.json` → `6.1.0`.
  - **Done when:** `package.json` says `"version": "6.1.0"` in a commit titled `chore(release): Bump version to v6.1.0`, and every checkbox above is ticked.

## RF → tasks

| RF | Tasks |
|---|---|
| RF-01 | T02, T07, T09, T12 |
| RF-02 | T09, T12 |
| RF-03, RF-04 | T02, T07, T12 |
| RF-05, RF-06 | T04, T06, T07, T12 |
| RF-07 | T06, T12 |
| RF-08, RF-09 | T07, T12 |
| RF-10, RF-11, RF-12 | T02, T07, T12 |
| RF-13 | T05, T09, T12, T16 |
| RF-14, RF-15, RF-16 | T08, T12 |
| RF-17 | T01, T06, T12 |
| RF-18 | T05, T12, T16 |
| RF-19 | T09, T12, T16 |
| RF-20 | T02, T10, T13, T16 |
| RF-21 | T11, T13 |
| RF-22 | T13 |
