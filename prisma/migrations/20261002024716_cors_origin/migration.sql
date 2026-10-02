-- CreateTable
CREATE TABLE "cors_origin" (
    "id" SERIAL NOT NULL,
    "origin" VARCHAR(200) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cors_origin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cors_origin_origin_key" ON "cors_origin"("origin");

-- Seed (hand-written): the production web is the only origin allowed by default.
INSERT INTO "cors_origin" ("origin", "enabled") VALUES ('https://marco.figueroa-sanchez.com', true);
