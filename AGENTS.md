# AGENTS.md — Portfolio API

## Project
Backend for Marco Figueroa's personal portfolio (`../web`, Angular 22 SSR static). It serves the site content (about, experience, projects, certifications, blog posts, testimonials), renders Markdown bodies, stores uploaded images and PDFs in the database, and handles the contact form and visitor testimonial submissions, whose emails to the owner it sends through Brevo. Production domain: `api.figueroa-sanchez.com`.
NestJS 12 (Express) with ESM, TypeScript 6 strict and PostgreSQL through Prisma 7 (`@prisma/adapter-pg`; schema and migrations in `prisma/`, client generated into the gitignored `src/generated/prisma`). Modular architecture: one module per domain under `src/app/<module>/` (e.g. `contact`, `auth`, `files`, `markdown`, `mail`, `content/<collection>`, with shared slug/publication helpers in `content/common`), with subfolders such as `dto/`, `guards/`, `interceptors/`, `middlewares/`, `clients/`, `templates/` and `interfaces/`, wired into `src/app/app.module.ts`; e2e tests live in `test/` and use the in-memory Prisma fake in `test/fakes/`.

## Commands
- Install: `pnpm install`
- Run: `pnpm start:dev` (watch) · `pnpm build` + `pnpm start:prod` (production)
- Tests: `pnpm test` (unit) · `pnpm test:e2e` · `pnpm test:cov`
- Lint/format: `pnpm lint` (oxlint, type-aware) · `pnpm format` (Prettier)
- Prisma: `pnpm generate` (client; `lint`, `test`, `test:e2e` and `build` run it first) · `pnpm prisma migrate dev --name <change>` (new migration, local) · `pnpm prisma migrate deploy` (apply migrations; run against production before releasing a version that brings one)

## Style and conventions
- TypeScript 6 `strict`, ES2023, ESM (`nodenext`): relative imports use the `.js` suffix.
- Nest naming: `<name>.module.ts`, `<name>.controller.ts`, `<name>.service.ts`, `<name>.spec.ts`, `test/<name>.e2e-spec.ts`; classes `PascalCase` with suffix (`ContentService`), files `kebab-case`.
- Thin controllers, business logic in services, request bodies/queries typed and validated through DTOs.
- No floating promises (oxlint error); Prettier with single quotes and trailing commas.
- Language: code, comments, API messages, docs, commits and agent replies in English.
- Commits follow Conventional Commits.

## Rules
- Read `docs/constitution.md` and the active spec (`docs/specs/NNN-*/spec.md`) before touching code.
- Do not add dependencies, change the ORM, or alter the database schema without asking; schema changes only through Prisma migrations.
- Application secrets (`brevo_api_key`, `jwt_secret`) and the Google sign-in configuration (`google_client_id`, `admin_google_email`) live in the database `property` table and are managed only with SQL (no endpoint reads or writes them); only `DATABASE_URL` lives in an environment variable (`.env` locally, gitignored), plus the non-secret `API_PUBLIC_URL` override for local file URLs. Never commit, return or log them. Allowed CORS origins live in the `cors_origin` table (`enabled` flag), also managed only with SQL and read on every request.
- Administrator sign-in is Google only: `POST /auth/google` exchanges a Google ID token of the account in `admin_google_email` for the API's 1-hour JWT. This supersedes Spec 001 RF-34–RF-37 (password login, administrator created with a password, password hash); there is no password login or `admin_user` table.
- The content DTOs (including posts and certifications) are mirrored in `panel/lib/collections.ts`: a DTO change must update that registry under the same spec.
- Spec 003 (content pages): projects and posts are drafts until published (`status`, `published_at`, unique `slug`); public routes never return drafts and the owner reads them through `…/all`. Projects are ordered by `published_at desc, id desc` and experience by `current desc, start_date desc nulls last, id` (no `position` in either). Markdown bodies are rendered only by `MarkdownService` (`markdown-it` with raw HTML off) and returned as `bodyHtml`; `POST /markdown/render` serves the panel preview. Uploaded files live in the `file` table (`bytea`), are typed by magic bytes, served publicly by `GET /files/:id` with CSP `sandbox` and `nosniff`, and their absolute URLs come from `API_PUBLIC_URL` (not a secret; default `https://api.figueroa-sanchez.com`).
- Emails to the owner go only through `src/app/mail` (Spec 004): `MailService.send({ senderName, replyTo, subject, html, text })` reads `brevo_api_key` (missing → `MailUnavailableError`, which each caller maps) and `BrevoClient` sends it; every email is built with `mail/templates/email-layout.ts` (`renderEmail`/`renderText`) using only `palette.ts` colors, and every text/background pair it draws is listed in `EMAIL_TEXT_PAIRS` and must keep a contrast of at least 4.5:1.
- Spec 004 (testimonials): visitors submit at public `POST /testimonials` (`TestimonialSubmissionsController`, generic-message pipe, shared `HoneypotInterceptor` with `@HoneypotReply(message)`, `testimonial` rate-limit bucket of 3 per IP per rolling 24 h applied before `JsonBodyMiddleware`); submissions are stored `pending` with `email`, `language`, `submittedAt` and `notified` (false when the email could not be sent, never failing the request). Public `GET /content/testimonials` returns only approved items through an allowlist `select` (never `email` or review fields); the owner uses `…/all`, `…/pending-count`, `…/:id/approve` (stores the form values, clears `email`) and `DELETE …/:id` (reject). Approving and creating place the item first by shifting approved positions (`placeFirst`); `update` never changes `status` or `email`. Owner create takes no `position`; `quote` ≤ 500 on writes only; `avatar` optional.
- Do not edit the frontend in `../web` from this repo.
- Do not change `.github/workflows/`, `Dockerfile` or deployment targets without asking; every push to `main` releases to production.
- Do not change personal content (resume, profile image, about, experience, contact data) without explicit instruction.

## When finishing any task
- `pnpm lint`, `pnpm test`, `pnpm test:e2e` and `pnpm build` must all pass.
- Run `pnpm format` on touched files.
