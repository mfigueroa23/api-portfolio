# Constitution — Portfolio API

Non-negotiable principles. Every spec, plan and task must meet them.

1. **Fixed stack:** NestJS 12 (Express, ESM), TypeScript 6 strict, Prisma 7 on PostgreSQL, pnpm 12 on Node 26; new dependencies require approval.
2. **Layers:** controller → service → `PrismaService`; no `*.controller.ts` imports `PrismaService`, and every request body and query is a class-validator DTO.
3. **Quality:** `pnpm lint` (type-aware, `no-floating-promises` included) and `pnpm build` finish with 0 errors; `pnpm exec prettier --check "src/**/*.ts" "test/**/*.ts"` is clean.
4. **Tests:** every controller and service has a `*.spec.ts` next to it and every endpoint an e2e test in `test/`; `pnpm test` and `pnpm test:e2e` pass without a database (`test/fakes/prisma.fake.ts`).
5. **Schema:** `prisma/schema.prisma` changes only with approval and a migration in `prisma/migrations/`; `pnpm prisma migrate status` reports nothing pending.
6. **Configuration:** the environment holds only `DATABASE_URL`, `PORT` and `API_PUBLIC_URL`; secrets live in the `property` table, never in the repo, responses or logs; `.env` is never committed.
7. **Errors:** `HttpExceptionFilter` answers every error as `{ error, fields? }` with the right status and never a stack trace; CORS allows only origins enabled in `cors_origin`.
8. **Language:** code, docs and commits in English (Conventional Commits); visitor form messages in English and Spanish through `common/i18n/messages.ts`.
9. **Delivery:** new features start from a spec in `docs/specs/NNN-*/`; SemVer in `package.json`; `API Tests` (`test.yaml`) passes before merging into `main`.
10. **Deployment:** the `release.yaml` image starts unattended, answers the `GET /` health check, and `rollout status` succeeds.
