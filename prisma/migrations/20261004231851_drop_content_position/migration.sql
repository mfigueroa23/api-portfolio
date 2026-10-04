-- Spec 003: projects are ordered by publication date and experience entries
-- by current / start date, so the manual `position` goes away from both.

-- DropIndex
DROP INDEX "experience_position_idx";

-- DropIndex
DROP INDEX "project_position_idx";

-- DropIndex
DROP INDEX "project_status_position_idx";

-- AlterTable
ALTER TABLE "experience" DROP COLUMN "position";

-- AlterTable
ALTER TABLE "project" DROP COLUMN "position";

-- CreateIndex (edited: entries without a start date go last)
CREATE INDEX "experience_current_start_date_id_idx" ON "experience"("current" DESC, "start_date" DESC NULLS LAST, "id");

-- CreateIndex
CREATE INDEX "project_status_published_at_idx" ON "project"("status", "published_at" DESC);
