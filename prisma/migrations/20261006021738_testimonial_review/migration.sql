-- Spec 004 phase 2: testimonial review (visitor submissions pending until
-- approved, optional photo). Generated with Prisma and edited by hand for the
-- language CHECK constraint.

-- CreateEnum
CREATE TYPE "testimonial_status" AS ENUM ('pending', 'approved');

-- DropIndex
DROP INDEX "testimonial_position_idx";

-- AlterTable: existing rows become approved through the column default (RF-76).
ALTER TABLE "testimonial" ADD COLUMN     "email" VARCHAR(200),
ADD COLUMN     "language" VARCHAR(2),
ADD COLUMN     "notified" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "status" "testimonial_status" NOT NULL DEFAULT 'approved',
ADD COLUMN     "submitted_at" TIMESTAMPTZ,
ALTER COLUMN "position" DROP NOT NULL,
ALTER COLUMN "avatar" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "testimonial_status_position_idx" ON "testimonial"("status", "position");

-- CreateIndex
CREATE INDEX "testimonial_status_submitted_at_idx" ON "testimonial"("status", "submitted_at" DESC);

-- Hand-written: the submission language is 'en' or 'es' (NULL for testimonials
-- created by the owner or before Spec 004).
ALTER TABLE "testimonial" ADD CONSTRAINT "testimonial_language_check" CHECK ("language" IN ('en', 'es'));
