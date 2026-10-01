# AGENTS.md — Portfolio API

## Project
Backend for Marco Figueroa's personal portfolio (`../portfolio`, Angular 22 SSR static). It serves the site content (about, experience, projects, testimonials), the resume and the profile image, and handles the contact form (replacing the serverless `portfolio/api/contact.ts`, which sends email via Brevo). Production domain: `api.figueroa-sanchez.com`.
NestJS 12 (Express) with ESM, TypeScript 6 strict and PostgreSQL. Modular architecture: one feature module per domain under `src/<feature>/` (e.g. `content`, `assets`, `contact`), wired into `src/app.module.ts`; e2e tests live in `test/`.

## Commands
- Install: `pnpm install`
- Run: `pnpm start:dev` (watch) · `pnpm build` + `pnpm start:prod` (production)
- Tests: `pnpm test` (unit) · `pnpm test:e2e` · `pnpm test:cov`
- Lint/format: `pnpm lint` (oxlint, type-aware) · `pnpm format` (Prettier)

## Style and conventions
- TypeScript 6 `strict`, ES2023, ESM (`nodenext`): relative imports use the `.js` suffix.
- Nest naming: `<name>.module.ts`, `<name>.controller.ts`, `<name>.service.ts`, `<name>.spec.ts`, `test/<name>.e2e-spec.ts`; classes `PascalCase` with suffix (`ContentService`), files `kebab-case`.
- Thin controllers, business logic in services, request bodies/queries typed and validated through DTOs.
- No floating promises (oxlint error); Prettier with single quotes and trailing commas.
- Language: code, comments, API messages, docs, commits and agent replies in English.
- Commits follow Conventional Commits.

## Rules
- Read `docs/constitution.md` and the active spec (`docs/specs/NNN-*/spec.md`) before touching code.
- Do not add dependencies, pick/change the ORM, or alter the database schema without asking.
- Secrets (`BREVO_API_KEY`, database URL, etc.) only via environment variables; never committed.
- Do not edit the frontend in `../portfolio` from this repo.
- Do not change `.github/workflows/`, `Dockerfile` or deployment targets without asking; every push to `main` releases to production.
- Do not change personal content (resume, profile image, about, experience, contact data) without explicit instruction.

## When finishing any task
- `pnpm lint`, `pnpm test`, `pnpm test:e2e` and `pnpm build` must all pass.
- Run `pnpm format` on touched files.
