-- Spec 004 phase 3: Spanish versions of the content. Every new column is NULL,
-- so existing content is English with no Spanish version. Generated with Prisma
-- and edited by hand for the Spanish URL slug indexes and the testimonial CHECK.

-- AlterTable
ALTER TABLE "certification" ADD COLUMN     "name_es" VARCHAR(200);

-- AlterTable
ALTER TABLE "contact_info" ADD COLUMN     "label_es" VARCHAR(100);

-- AlterTable
ALTER TABLE "experience" ADD COLUMN     "body_es" TEXT,
ADD COLUMN     "description_es" TEXT,
ADD COLUMN     "period_es" VARCHAR(100),
ADD COLUMN     "role_es" VARCHAR(200);

-- AlterTable
ALTER TABLE "highlight" ADD COLUMN     "description_es" TEXT,
ADD COLUMN     "title_es" VARCHAR(200);

-- AlterTable
ALTER TABLE "post" ADD COLUMN     "body_es" TEXT,
ADD COLUMN     "slug_es" VARCHAR(100),
ADD COLUMN     "summary_es" VARCHAR(300),
ADD COLUMN     "title_es" VARCHAR(200);

-- AlterTable
ALTER TABLE "project" ADD COLUMN     "body_es" TEXT,
ADD COLUMN     "description_es" TEXT,
ADD COLUMN     "slug_es" VARCHAR(100),
ADD COLUMN     "title_es" VARCHAR(200);

-- AlterTable
ALTER TABLE "testimonial" ADD COLUMN     "quote_es" TEXT,
ADD COLUMN     "role_es" VARCHAR(200),
ALTER COLUMN "quote" DROP NOT NULL,
ALTER COLUMN "role" DROP NOT NULL;

-- Hand-written: the Spanish URL slug of a project or post is
-- coalesce(slug_es, slug) and must be unique per collection (RF-170). Prisma
-- cannot declare expression indexes; schema.prisma documents them.
CREATE UNIQUE INDEX "project_url_slug_es_key" ON "project" ((coalesce("slug_es", "slug")));
CREATE UNIQUE INDEX "post_url_slug_es_key" ON "post" ((coalesce("slug_es", "slug")));

-- Hand-written: only a pending (Spanish) submission may lack the English quote
-- and role, so every approved testimonial has English text (RF-67).
ALTER TABLE "testimonial" ADD CONSTRAINT "testimonial_english_when_approved" CHECK ("status" = 'pending' OR ("quote" IS NOT NULL AND "role" IS NOT NULL));
