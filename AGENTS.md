# AGENTS.md — Portfolio API

## Project
Backend for Marco Figueroa's portfolio (`api.figueroa-sanchez.com`): serves the site content in English and Spanish, renders Markdown, stores uploaded images and PDFs in the database, and handles the contact form and visitor testimonials (owner emails via Brevo). Consumed by the sibling `web` and `panel` repos.
NestJS 12 (Express, ESM), TypeScript 6 strict, PostgreSQL through Prisma 7 (`@prisma/adapter-pg`, client generated into the gitignored `src/generated/prisma`). Shipped as a Docker image; every push to `main` deploys to Kubernetes (`release.yaml`).

## Commands
- Install: `pnpm install` (then `cp .env.example .env` and set the database password)
- Run: `pnpm start:dev` (watch, port 3000) · `pnpm build` + `pnpm start:prod`
- Tests: `pnpm test` (unit, `src/**/*.spec.ts`) · `pnpm test:e2e` (`test/*.e2e-spec.ts`, in-memory Prisma fake, no database) · `pnpm test:cov`
- Lint: `pnpm lint` (oxlint, type-aware); types are checked by `pnpm build`
- Format: `pnpm format` · check: `pnpm exec prettier --check "src/**/*.ts" "test/**/*.ts"`
- New migration (after editing `prisma/schema.prisma`): `pnpm prisma migrate dev --name <change>`
- Check migrations: `pnpm prisma migrate status`
- Apply migrations: `pnpm prisma migrate deploy` (against production before releasing a version that brings one)

## Style and conventions
- TypeScript 6 `strict`, ES2023, ESM (`nodenext`): relative imports end in `.js`.
- One module per domain in `src/app/<module>/` (`content/<collection>`; shared helpers in `content/common/` and `common/`), wired into `src/app/app.module.ts`; subfolders `dto/`, `guards/`, `middlewares/`, `clients/`, `templates/`, `interfaces/`.
- Files `kebab-case` (`<name>.controller.ts`, `.service.ts`, `.module.ts`, `.spec.ts`); classes `PascalCase` with suffix (`PostsService`).
- Thin controllers; logic and Prisma access in services; every body and query is a validated DTO.
- Prettier with single quotes and trailing commas; no floating promises (oxlint error).
- Code, comments, docs, commits and agent replies in English; commits follow Conventional Commits.

## Rules
- Read `docs/constitution.md` and the active spec (`docs/specs/NNN-*/spec.md`) before touching code.
- Ask before adding or upgrading dependencies, changing the ORM or editing `prisma/schema.prisma`; schema changes only through Prisma migrations.
- Ask before changing `.github/workflows/`, the `Dockerfile`, deployment targets or files in `docs/`.
- Secrets (`brevo_api_key`, `jwt_secret`) and the Google sign-in config live in the `property` table, CORS origins in `cors_origin`; both are managed only with SQL. Never commit, return or log them.
- Admin sign-in is Google only (`POST /auth/google` → 1-hour JWT); there is no password login.
- Owner emails go only through `src/app/mail` (`MailService` + `renderEmail`); colors come from `palette.ts` and every pair in `EMAIL_TEXT_PAIRS` keeps ≥ 4.5:1 contrast.
- Bilingual fields are declared in `content/common/translation.ts` (`BILINGUAL_FIELDS`); form messages are translated only in `common/i18n/messages.ts`.
- A content DTO change also updates `../panel/lib/collections.ts` under the same spec. Do not edit `../web` from this repo.
- Do not change personal content (resume, profile, about, experience, contact data) without explicit instruction.

## When finishing any task
- `pnpm lint`, `pnpm test`, `pnpm test:e2e` and `pnpm build` pass; run `pnpm format` on touched files.
- New migrations are applied locally (`pnpm prisma migrate status` is up to date) and their release order is in `README.md`.
- Update `README.md` when endpoints, environment variables or deployment change.
- Releases: bump `version` in `package.json` (SemVer: fix → patch, feat → minor, breaking → major) in `chore(release): Bump version to vX.Y.Z`; the PR merges as `chore(release): Version X.Y.Z`.
