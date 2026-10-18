# Plan 005 — Resume management

- **Spec:** [spec.md](spec.md) (approved 2026-10-18)
- **Status:** Draft
- **Version:** 6.1.0 (feature, minor)

This is the HOW for Spec 005. It respects `docs/constitution.md`: controller → service → `PrismaService`, a class-validator DTO for every body, query and path parameter, errors through `HttpExceptionFilter`, and tests that run without a database. It needs no new dependencies.

## Endpoints

| Method and path | Auth | Answer | RF |
|---|---|---|---|
| `GET /resume?lang=en\|es` | — | PDF bytes (200, or 304 when the cached copy is still current), 404, 400 | RF-13 – RF-19 |
| `GET /resume/assignments` | Bearer | `{ en: Assignment \| null, es: Assignment \| null }` | RF-01, RF-02 |
| `PUT /resume/assignments/:lang` body `{ fileId }` | Bearer | The full assignment, as for `GET` (200) | RF-02 – RF-09 |
| `DELETE /resume/assignments/:lang` | Bearer | 204 | RF-02, RF-10 – RF-12 |
| `DELETE /files/:id` (existing) | Bearer | 409 if the file is a current resume | RF-20 |
| `GET /files/:id/references` (existing) | Bearer | Adds `{ collection: 'resume', id: <lang>, title }` | RF-21 |

`Assignment` = `{ file: FileMeta, assignedAt }`. `FileMeta` is the existing `{ id, name, mime, size, createdAt, url }`.

## Modules

### New: `src/app/resume/` (`ResumeModule`)

Registered in `app.module.ts`. Imports `AuthModule` (for `JwtAuthGuard`) and `FilesModule`.

| File | Responsibility | RF |
|---|---|---|
| `resume.controller.ts` | Four thin routes. The public read writes the bytes with `res.set(resumeHeaders(file)).send(data)`, the same way as `FilesController.read`. | RF-01 – RF-19 |
| `resume.service.ts` | Reads the assignment, assigns, clears, and resolves the public PDF with the Spanish → English fallback. It checks the "Spanish needs English" rule and does nothing when the same file is assigned again. | RF-01, RF-03 – RF-06, RF-08 – RF-12, RF-14 – RF-16 |
| `dto/resume-lang.dto.ts` | `ResumeLangParamDto` (`:lang`, required, `@IsIn(['en','es'])`) and `ResumeQueryDto` (`?lang`, optional, same check, no lenient transform). | RF-07, RF-17 |
| `dto/assign-resume.dto.ts` | `AssignResumeDto { fileId }`, checked with `@IsUUID()`. | RF-05, RF-06 |
| `resume.controller.spec.ts`, `resume.service.spec.ts` | Unit tests (see Tests). | all |

### Changed: `src/app/files/`

| File | Change | RF |
|---|---|---|
| `files.module.ts` | Exports `FilesService`. | — |
| `files.service.ts` | New `meta(id)`, which returns `FileMeta` or 404 without loading the bytes; `urlOf` builds on it. `remove(id)` refuses with `ConflictException('File is the current resume.')` when a resume points at the file, and turns a foreign-key error (P2003) into the same 409. | RF-05, RF-06, RF-20 |
| `files-response.ts` | New `resumeHeaders(file)`: `fileHeaders` with `Cache-Control: no-cache` in place of `immutable`. | RF-13, RF-18 |
| `file-references.service.ts` | `find` also takes the file id and adds one `resume` entry per language assigned to it. `FileReference.collection` gains `'resume'`, and `id` widens to `number \| string`. | RF-21 |
| `files.controller.ts` | `references` passes the id together with the URL. | RF-21 |

`GET /files/:id` does not change (RF-22).

### Infrastructure

| File | Change |
|---|---|
| `prisma/schema.prisma` + migration `resume` | New `Resume` model (see below). |
| `test/fakes/prisma.fake.ts` | `resume` model (key `lang`) and a generic `upsert` on `FakeModel`, tested in `prisma.fake.e2e-spec.ts`. |
| `README.md` | Endpoints, fallback, cache behavior, 409 on `DELETE /files/:id`, release order. |
| `package.json` | `6.1.0`. |

## Data model

```prisma
// Current resume per language (Spec 005). `lang IN ('en','es')` is a CHECK
// constraint added by hand in the resume migration. A file cannot be deleted
// while a resume points at it (Restrict).
model Resume {
  lang       String   @id @db.VarChar(2)
  fileId     String   @map("file_id") @db.Uuid
  file       File     @relation(fields: [fileId], references: [id], onDelete: Restrict)
  assignedAt DateTime @default(now()) @map("assigned_at") @db.Timestamptz

  @@index([fileId])
  @@map("resume")
}

model File {
  // … existing fields
  resumes Resume[]
}
```

- At most two rows. A missing row means no resume in that language (RF-01, RF-10).
- The migration only adds things: it creates a table and touches no existing rows. It can be applied before the image ships (old code ignores the table) and rolled back by dropping the table.

## Decisions

| # | Decision | Discarded alternative | Why |
|---|---|---|---|
| D1 | A `resume` table that points at `file` | A `resume_en_file_id` / `resume_es_file_id` pair in `property` | `property` holds secrets and config managed only with SQL (AGENTS.md). A foreign key with `Restrict` gives the database-level guarantee that RF-20 needs, which a text value cannot. |
| D2 | `lang` as the primary key (`varchar(2)` + CHECK) | A Prisma `enum` or an autoincrement `id` | It matches `testimonial.language` (varchar + CHECK, Spec 004). Using `lang` as the key makes "one current resume per language" a database rule and turns assignment into an upsert. |
| D3 | `onDelete: Restrict`, plus a check in `FilesService.remove` | Only the service check, or `onDelete: Cascade`/`SetNull` | The service check gives a clear 409 and is what the database-free tests can exercise. The foreign key closes the race between the check and the delete. Cascade or SetNull would delete the resume silently, which contradicts RF-20. |
| D4 | The "Spanish needs English" rule is checked in `ResumeService` inside `$transaction` | A database trigger | A single owner makes concurrent edits unrealistic. A trigger would put business rules in SQL that the fake cannot reproduce, so RF-08 and RF-12 would go untested in CI. |
| D5 | `ResumeModule` depends on `FilesModule`, and the files code reads `prisma.resume` directly | `FilesService` calls `ResumeService` | It avoids a circular import between the modules. `FileReferencesService` already reads the content tables directly (an earlier plan's D13), so reading `resume` the same way follows the existing pattern. |
| D6 | The PDF check uses the stored `mime`, which was detected from content at upload | Re-reading the bytes on assignment | `POST /files` already detects the type from the bytes, and `mime` never changes afterwards. Loading up to 10 MiB to confirm it again adds nothing (RF-06). |
| D7 | `Cache-Control: no-cache` with Express's automatic ETag (304 on revalidation) | `no-store`, or a short `max-age` | `no-cache` lets caches keep the PDF but makes them revalidate, so a replacement is served on the next request (RF-18) and an unchanged one costs only a 304. `no-store` downloads up to 10 MiB every time, and `max-age` serves a stale resume for that long. |
| D8 | Strict `?lang`: anything but `en`/`es` → 400 | Reuse `LangQueryDto` (anything that isn't `es` means English) | Required by RF-17 as approved. Note: this diverges from the public content reads, which never fail on `lang`. |
| D9 | The assignment is changed with `PUT /resume/assignments/:lang` and the public read lives at `GET /resume` | `POST /resume`, or `GET /resume/:lang` | `PUT` gives the same result when repeated (RF-09). A query string for the public URL leaves `/resume/assignments` free for the owner's routes and lets `?lang` be left out (RF-14). |
| D10 | A resume reference has `id: <lang>` (string) | A synthetic numeric id | The resume has no numeric id. The panel already shows unknown collections by their key and builds React keys as `collection-id`, so `resume-en` works without touching the panel. Only its TypeScript type changes, in the later panel spec. |
| D11 | Reassigning the current file writes nothing (`assignedAt` is kept) | Always upsert | RF-09 requires no side effects, and the assignment date should record a real change. |
| D12 | Owner errors are in English only | Translating them through `common/i18n/messages.ts` | Those messages are only for the visitor forms (AGENTS.md). The owner's panel is English. |

## RF coverage

| RF | Where | Tests |
|---|---|---|
| RF-01 | `ResumeService.assignments` | U-S1, E1 |
| RF-02 | `JwtAuthGuard` on the 3 owner routes | E2 |
| RF-03, RF-04 | `ResumeService.assign` (upsert in a transaction) | U-S2, E3 |
| RF-05 | `FilesService.meta` → 404; `AssignResumeDto` → 400 | U-S3, E4 |
| RF-06 | `ResumeService.assign` (`mime` check) | U-S3, E4 |
| RF-07 | `ResumeLangParamDto` | E4 |
| RF-08 | `ResumeService.assign` (Spanish needs English) | U-S4, E5 |
| RF-09 | `ResumeService.assign` (no write) | U-S2, E3 |
| RF-10, RF-11 | `ResumeService.clear` | U-S5, E6 |
| RF-12 | `ResumeService.clear` (English kept while Spanish exists) | U-S5, E6 |
| RF-13 | `ResumeController.download` + `resumeHeaders` | U-C1, U-R1, E7 |
| RF-14, RF-15 | `ResumeService.publicFile` (default and fallback) | U-S6, E7 |
| RF-16 | `ResumeService.publicFile` → 404 | U-S6, E8 |
| RF-17 | `ResumeQueryDto` | E8 |
| RF-18 | `resumeHeaders` + ETag | U-R1, E9 |
| RF-19 | Fixed route with no id | E9 |
| RF-20 | `FilesService.remove` + FK `Restrict` | U-F1, E10 |
| RF-21 | `FileReferencesService.find` | U-F2, E10 |
| RF-22 | `GET /files/:id` unchanged | E10 (existing suite) |

## Test strategy

Constitution §4: every controller and service has its `*.spec.ts`, every endpoint has an e2e test, and nothing needs a database.

**Unit tests** (`pnpm test`; services on top of `PrismaFake`, controllers with mocked services, as in `files.*.spec.ts`):

- **U-S1** `assignments` with nothing, English only, and both, with `FileMeta` and absolute URLs (stubbed `API_PUBLIC_URL`).
- **U-S2** `assign` creates, replaces (the previous file is still in `file`, and `assignedAt` changes), and reassigning the same file keeps `assignedAt`.
- **U-S3** `assign` with a missing file → `NotFoundException`, and with an image → `BadRequestException` with `fields.fileId`. In both cases the assignment is unchanged.
- **U-S4** `assign('es')` without English → `ConflictException`, and no row is created.
- **U-S5** `clear` removes the row and keeps the file. Clearing a language with no resume is a no-op. Clearing English while Spanish exists → `ConflictException`.
- **U-S6** `publicFile`: `en`, `es`, `es` → `en` fallback, missing `lang` → `en`, nothing assigned → `NotFoundException`, and `es` assigned without `en` (data made directly with SQL) → only `es` is served.
- **U-C1** `ResumeController`: each route delegates with the right arguments, and `download` sets the `resumeHeaders` and sends the buffer.
- **U-R1** `resumeHeaders`: same headers as `fileHeaders` except `Cache-Control: no-cache`, and no `immutable`.
- **U-F1** `FilesService.remove`: 409 when a resume points at the file, 204 when it no longer does, and a P2003 from Prisma → 409.
- **U-F2** `FileReferencesService.find`: a file assigned to `en` and `es` gives two `resume` entries, and an unassigned PDF gives none.

**E2E tests** (`pnpm test:e2e`, new `test/resume.e2e-spec.ts` plus cases in `test/files.e2e-spec.ts`). The sample PDF comes from `test/fixtures/file-samples.ts`, uploaded with `POST /files`, and the token from `ownerToken`:

- **E1** `GET /resume/assignments` empty → `{ en: null, es: null }`, then after assigning.
- **E2** All 3 owner routes without a token or with a bad token → 401, and `prisma.resume.rows` unchanged.
- **E3** `PUT` English → 200, `PUT` with another PDF replaces it and the old one is still in `GET /files`, and `PUT` with the same file again → 200 and the same `assignedAt`.
- **E4** `PUT` with a random UUID → 404, with `fileId: "x"` → 400 `fields.fileId`, with a PNG → 400, with `:lang = fr` → 400 `fields.lang`.
- **E5** `PUT /es` with no English → 409 `{ error }`.
- **E6** `DELETE /es` → 204, again → 204, and `DELETE /en` while Spanish exists → 409.
- **E7** `GET /resume`, `?lang=en` and `?lang=es` (own file and fallback): status 200, the exact bytes, `Content-Type: application/pdf`, and `Content-Disposition` with the library name.
- **E8** `GET /resume` with nothing assigned → 404 `{ error }`, and `?lang=fr` → 400 `fields.lang`.
- **E9** Headers: `nosniff`, CSP with `sandbox`, `Cross-Origin-Resource-Policy: cross-origin`, `Cache-Control: no-cache`, and an `ETag`. Repeating with `If-None-Match` → 304. After a replacement, the same URL serves the new bytes with a different `ETag`.
- **E10** `DELETE /files/:id` of the assigned PDF → 409 and the file is still there. `GET /files/:id/references` includes `resume`. `GET /files/:id` still has `immutable`. After clearing, `DELETE /files/:id` → 204.

**Fake:** `prisma.fake.e2e-spec.ts` covers the new `upsert` (create and update). The fake does not enforce foreign keys, so the database-side `Restrict` (D3) is checked by hand in the local manual test from the spec's done criteria.

## Implementation order

1. Schema + migration `resume` (with the hand-added CHECK) → `pnpm prisma migrate dev --name resume`; `migrate status` up to date.
2. Fake: `resume` model + `upsert`, with its test.
3. `FilesService.meta`, `resumeHeaders`, `FilesModule` export (U-R1).
4. `ResumeModule`: DTOs, service, controller, unit tests (U-S*, U-C1).
5. Integration with files: `remove` 409 and references (U-F*).
6. E2E (E1–E10), README (endpoints + release order), `pnpm format`, lint, tests, build.
7. `chore(release): Bump version to v6.1.0`.

## Release

1. `pnpm prisma migrate deploy` against production **before** merging. The `resume` migration only adds a table.
2. Merge into `main` → `release.yaml` deploys. Check `GET /resume` → 404 (nothing assigned yet).
3. Assign the resumes (`PUT /resume/assignments/en`, then `/es`) with a PDF already in the library.

## Risks

- **10 MiB through Node:** each `GET /resume` without a valid ETag loads the full PDF from Postgres, as `GET /files/:id` does today. D7 makes repeat visits cost a 304. A dedicated rate limit is out of scope in the spec.
- **Panel type:** `FileReference.id` becomes `number | string` (D10). It works at runtime. The type is updated in the panel's spec.
