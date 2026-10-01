# Constitution — Portfolio API

1. Fixed stack: NestJS 12, TypeScript strict (ESM), PostgreSQL, pnpm. New dependencies require approval.
2. One feature module per domain; controllers stay thin and logic lives in services.
3. Every external input is validated through DTOs before reaching a service.
4. Every controller and service has a `*.spec.ts`; every endpoint has an e2e test in `test/`.
5. `pnpm lint`, `pnpm test`, `pnpm test:e2e` and `pnpm build` pass before each commit.
6. Code is Prettier-formatted with no oxlint errors (including floating promises).
7. Secrets only in environment variables; never in the repo or in responses/logs.
8. CORS allows only the portfolio's origins; errors never leak stack traces to clients.
9. Database schema changes only through versioned migrations.
10. Code, docs and commits in English; commits follow Conventional Commits.
11. New features start from a spec in `docs/specs/NNN-*/spec.md`.
