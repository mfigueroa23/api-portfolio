# AGENTS.md — Portfolio API

## Project
Backend for Marco Figueroa's personal portfolio (`../web`, Angular 22 SSR static). It serves the site content (about, experience, projects, testimonials), the resume and the profile image, and handles the contact form, which it sends by email through Brevo. Production domain: `api.figueroa-sanchez.com`.
NestJS 12 (Express) with ESM, TypeScript 6 strict and PostgreSQL through Prisma 7 (`@prisma/adapter-pg`; schema and migrations in `prisma/`, client generated into the gitignored `src/generated/prisma`). Modular architecture: one module per domain under `src/app/<module>/` (e.g. `contact`, `auth`, `content/<collection>`), with subfolders such as `dto/`, `guards/`, `interceptors/`, `middlewares/`, `clients/`, `templates/` and `interfaces/`, wired into `src/app/app.module.ts`; e2e tests live in `test/` and use the in-memory Prisma fake in `test/fakes/`.

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
- Application secrets (`brevo_api_key`, `jwt_secret`) live in the database `property` table and are managed only with SQL (no endpoint reads or writes them); only `DATABASE_URL` lives in an environment variable (`.env` locally, gitignored). Never commit, return or log them. Allowed CORS origins live in the `cors_origin` table (`enabled` flag), also managed only with SQL and read on every request.
- Do not edit the frontend in `../web` from this repo.
- Do not change `.github/workflows/`, `Dockerfile` or deployment targets without asking; every push to `main` releases to production.
- Do not change personal content (resume, profile image, about, experience, contact data) without explicit instruction.

## When finishing any task
- `pnpm lint`, `pnpm test`, `pnpm test:e2e` and `pnpm build` must all pass.
- Run `pnpm format` on touched files.
