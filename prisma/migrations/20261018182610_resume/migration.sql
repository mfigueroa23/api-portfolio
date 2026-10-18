-- Spec 005: current resume per language, pointing at a file of the library.
-- Generated with Prisma and edited by hand for the lang CHECK constraint.

-- CreateTable
CREATE TABLE "resume" (
    "lang" VARCHAR(2) NOT NULL,
    "file_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resume_pkey" PRIMARY KEY ("lang")
);

-- CreateIndex
CREATE INDEX "resume_file_id_idx" ON "resume"("file_id");

-- AddForeignKey
ALTER TABLE "resume" ADD CONSTRAINT "resume_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "file"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Hand-written: one row per language, 'en' or 'es' only.
ALTER TABLE "resume" ADD CONSTRAINT "resume_lang_check" CHECK ("lang" IN ('en', 'es'));
