-- Spec 003: content pages (publication workflow, project details, experience
-- bodies and start dates, certifications, blog posts and uploaded files).
-- Generated with Prisma and edited by hand for the data backfills and the
-- certification CHECK constraint. `position` is dropped in a later migration.

-- CreateEnum
CREATE TYPE "content_status" AS ENUM ('draft', 'published');

-- AlterTable
ALTER TABLE "experience" ADD COLUMN     "body" TEXT,
ADD COLUMN     "start_date" DATE;

-- AlterTable: slug starts nullable so existing rows can be backfilled first.
ALTER TABLE "project" ADD COLUMN     "body" TEXT,
ADD COLUMN     "published_at" TIMESTAMPTZ,
ADD COLUMN     "slug" VARCHAR(100),
ADD COLUMN     "status" "content_status" NOT NULL DEFAULT 'draft',
ALTER COLUMN "description" DROP NOT NULL,
ALTER COLUMN "image" DROP NOT NULL,
ALTER COLUMN "link" DROP NOT NULL,
ALTER COLUMN "github" DROP NOT NULL;

-- Backfill: every existing project was public, so it becomes published. The
-- publication dates are spaced one minute apart following the current manual
-- order, so ordering by published_at desc keeps today's order.
WITH "ranked" AS (
  SELECT "id", row_number() OVER (ORDER BY "position", "id") AS "rank"
  FROM "project"
)
UPDATE "project" AS "p"
SET "status" = 'published',
    "published_at" = now() - ("r"."rank" - 1) * interval '1 minute'
FROM "ranked" AS "r"
WHERE "p"."id" = "r"."id";

-- Backfill: slug from the title (lowercased, accents and ñ transliterated,
-- other characters as single hyphens, cut at 100), `project-<id>` when nothing
-- is left, and `-2`, `-3`… by id for duplicates.
WITH "base" AS (
  SELECT "id",
         trim(BOTH '-' FROM left(trim(BOTH '-' FROM regexp_replace(
           translate(lower("title"), 'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc'),
           '[^a-z0-9]+', '-', 'g')), 100)) AS "slug"
  FROM "project"
), "named" AS (
  SELECT "id", CASE WHEN "slug" = '' THEN 'project-' || "id" ELSE "slug" END AS "slug"
  FROM "base"
), "numbered" AS (
  SELECT "id", "slug", row_number() OVER (PARTITION BY "slug" ORDER BY "id") AS "n"
  FROM "named"
)
UPDATE "project" AS "p"
SET "slug" = CASE
  WHEN "x"."n" = 1 THEN "x"."slug"
  ELSE rtrim(left("x"."slug", 100 - length('-' || "x"."n")), '-') || '-' || "x"."n"
END
FROM "numbered" AS "x"
WHERE "p"."id" = "x"."id";

ALTER TABLE "project" ALTER COLUMN "slug" SET NOT NULL;

-- CreateTable
CREATE TABLE "certification" (
    "id" SERIAL NOT NULL,
    "position" INTEGER NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "issuer" VARCHAR(200) NOT NULL,
    "issue_date" DATE NOT NULL,
    "expiry_date" DATE,
    "credential_id" VARCHAR(100),
    "verification_url" VARCHAR(500),
    "file_url" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certification_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "certification_expiry_not_before_issue" CHECK ("expiry_date" IS NULL OR "expiry_date" >= "issue_date")
);

-- CreateTable
CREATE TABLE "post" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "summary" VARCHAR(300),
    "cover_url" VARCHAR(500),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tag_keys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "body" TEXT,
    "references" JSONB NOT NULL DEFAULT '[]',
    "status" "content_status" NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(200) NOT NULL,
    "mime" VARCHAR(50) NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "certification_position_idx" ON "certification"("position");

-- CreateIndex
CREATE UNIQUE INDEX "post_slug_key" ON "post"("slug");

-- CreateIndex
CREATE INDEX "post_status_published_at_idx" ON "post"("status", "published_at" DESC);

-- CreateIndex
CREATE INDEX "post_tag_keys_idx" ON "post" USING GIN ("tag_keys");

-- CreateIndex
CREATE INDEX "file_created_at_idx" ON "file"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "project_slug_key" ON "project"("slug");

-- CreateIndex
CREATE INDEX "project_status_position_idx" ON "project"("status", "position");
