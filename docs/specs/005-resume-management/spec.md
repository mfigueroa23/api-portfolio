# Spec 005 — Resume management

- **Status:** Draft
- **Date:** 2026-10-18
- **Scope:** `api` only

## Why

The resume is the document visitors and recruiters ask for most, but today it is just one more PDF in the file library. Every `/files/:id` URL is immutable, so replacing the resume means a new URL and a change to every link that points at the old one. The owner needs a way to say "this PDF is my current resume" per language and to replace it without touching the site. Visitors need one stable link that always serves the current version in their language.

## Decisions

| Topic | Decision |
|---|---|
| Storage | The resume reuses the file library: the PDF is an ordinary file uploaded with `POST /files`, and the resume only records which file is current. No second copy of the bytes, and no base64. |
| Languages | One current resume per language: English (required base) and Spanish (optional, falls back to English), as for bilingual content in Spec 004. |
| Public read | A stable public URL streams the current PDF. It never changes when the PDF is replaced. |
| Owner write | The owner assigns a PDF that is already in the library, or clears an assignment. Uploading stays on `POST /files`. |
| Deleting a file in use | Refused while the file is a current resume. |

## Functional requirements

Wording follows EARS. "The API" is this service. "Owner" means a request carrying a valid admin JWT (`JwtAuthGuard`). `lang` is `en` or `es`.

### Owner reads the assignment

- **RF-01** — When the owner requests the resume assignment, the API shall return, for `en` and `es`, the metadata of the assigned file (`id`, `name`, `size`, `createdAt`, `url`) and when it was assigned, or `null` for a language with no assignment.
- **RF-02** — If a resume management request arrives without a valid admin JWT, then the API shall answer 401 and change nothing.

### Owner assigns a resume

- **RF-03** — When the owner assigns a file to a `lang`, the API shall make it that language's current resume, replacing any previous assignment, and return the updated assignment.
- **RF-04** — When an assignment replaces a previous file, the API shall keep the previous file in the library, unchanged.
- **RF-05** — If the assigned file does not exist, then the API shall answer 404 and keep the current assignment.
- **RF-06** — If the assigned file's detected type is not PDF, then the API shall answer 400 with a field error and keep the current assignment.
- **RF-07** — If `lang` is not `en` or `es`, then the API shall answer 400 with a field error.
- **RF-08** — If the owner assigns a Spanish resume while no English resume is assigned, then the API shall answer 409 and change nothing.
- **RF-09** — When the owner assigns the file that is already current for that language, the API shall answer as for any successful assignment, with no side effects.

### Owner clears a resume

- **RF-10** — When the owner clears a `lang`, the API shall remove that language's assignment, keep the file in the library, and answer 204.
- **RF-11** — When the owner clears a `lang` that has no assignment, the API shall answer 204.
- **RF-12** — If the owner clears English while a Spanish resume is assigned, then the API shall answer 409 and change nothing.

### Visitors download the resume

- **RF-13** — When anyone requests the public resume for a `lang`, the API shall stream that language's current PDF with type `application/pdf` and a `Content-Disposition` that lets browsers open it and save it under the file's library name.
- **RF-14** — When the public resume is requested without `lang`, the API shall serve English.
- **RF-15** — When the Spanish resume is requested and none is assigned, the API shall serve the English one.
- **RF-16** — If no resume is assigned for the requested language or its fallback, then the API shall answer 404 as `{ error }`.
- **RF-17** — If the public request carries a `lang` other than `en` or `es`, then the API shall answer 400 with a field error.
- **RF-18** — The API shall send the public resume with the same protective headers as `GET /files/:id` (`X-Content-Type-Options: nosniff`, sandboxing `Content-Security-Policy`, `Cross-Origin-Resource-Policy: cross-origin`), but never mark it `immutable`. The response shall allow caches to keep it only if they revalidate, so a replacement is served on the next request.
- **RF-19** — The public resume URL shall stay the same across replacements and shall not require the file's id.

### Interaction with the file library

- **RF-20** — If the owner deletes (`DELETE /files/:id`) a file that is currently a resume in any language, then the API shall answer 409 as `{ error }` naming the resume as the reason, and keep the file.
- **RF-21** — When the owner requests the references of a file that is currently a resume (`GET /files/:id/references`), the API shall include one entry per language it is assigned to.
- **RF-22** — The API shall keep serving a resume file at its own `/files/:id` URL as for any other file.

## Out of scope

- Uploading the resume as base64, or any upload path other than the existing `POST /files`. Accepting other formats (DOCX, images).
- Storing a second copy of the PDF or keeping a version history of earlier resumes, beyond the files that stay in the library.
- Languages other than `en` and `es`, and English falling back to Spanish.
- The `panel` screen for managing the resume, and the `web` download link (later specs in those repos).
- Generating the PDF from site content, or editing its contents.
- Download statistics, a dedicated rate limit or access control on the public download.
- Changing the existing file size limits, type detection or `GET /files/:id` behavior, except RF-20 and RF-21.

## Constraints

- Recording the assignment needs a schema change. That requires the owner's approval at planning time and a Prisma migration (constitution §5).
- Errors follow `HttpExceptionFilter` (`{ error, fields? }`, no stack traces). No file bytes or tokens appear in logs.

## Done criteria

- [ ] Every RF has at least one unit test (service and controller) and the endpoints have e2e tests in `test/` using the in-memory Prisma fake, covering the 400, 401, 404 and 409 paths.
- [ ] `pnpm lint`, `pnpm test`, `pnpm test:e2e` and `pnpm build` pass; `pnpm exec prettier --check "src/**/*.ts" "test/**/*.ts"` is clean.
- [ ] The migration is in `prisma/migrations/`, applied locally (`pnpm prisma migrate status` up to date), and its release order is noted in `README.md`.
- [ ] `README.md` documents the new endpoints, the fallback rule and the 409 when deleting a file in use.
- [ ] `package.json` is bumped to the next minor version (`6.1.0`) in `chore(release): Bump version to v6.1.0`.
- [ ] Manual check on a local run: assign an English PDF, download it from the public URL, replace it and see the new one at the same URL, then confirm that deleting the assigned file is refused.
