-- CreateTable
CREATE TABLE "property" (
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "admin_user" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_hit" (
    "id" BIGSERIAL NOT NULL,
    "bucket" VARCHAR(32) NOT NULL,
    "ip" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_limit_hit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experience" (
    "id" SERIAL NOT NULL,
    "position" INTEGER NOT NULL,
    "period" VARCHAR(100) NOT NULL,
    "role" VARCHAR(200) NOT NULL,
    "company" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "technologies" TEXT[] NOT NULL,
    "current" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "experience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project" (
    "id" SERIAL NOT NULL,
    "position" INTEGER NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "image" VARCHAR(500) NOT NULL,
    "tags" TEXT[] NOT NULL,
    "link" VARCHAR(500) NOT NULL,
    "github" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "testimonial" (
    "id" SERIAL NOT NULL,
    "position" INTEGER NOT NULL,
    "quote" TEXT NOT NULL,
    "author" VARCHAR(200) NOT NULL,
    "role" VARCHAR(200) NOT NULL,
    "avatar" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "testimonial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "highlight" (
    "id" SERIAL NOT NULL,
    "position" INTEGER NOT NULL,
    "icon" VARCHAR(100) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "highlight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_link" (
    "id" SERIAL NOT NULL,
    "position" INTEGER NOT NULL,
    "icon" VARCHAR(100) NOT NULL,
    "href" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technology" (
    "id" SERIAL NOT NULL,
    "position" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "technology_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_info" (
    "id" SERIAL NOT NULL,
    "position" INTEGER NOT NULL,
    "icon" VARCHAR(100) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "value" VARCHAR(200) NOT NULL,
    "href" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_info_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_user_username_key" ON "admin_user"("username");

-- CreateIndex
CREATE INDEX "rate_limit_hit_bucket_ip_created_at_idx" ON "rate_limit_hit"("bucket", "ip", "created_at");

-- CreateIndex
CREATE INDEX "experience_position_idx" ON "experience"("position");

-- CreateIndex
CREATE INDEX "project_position_idx" ON "project"("position");

-- CreateIndex
CREATE INDEX "testimonial_position_idx" ON "testimonial"("position");

-- CreateIndex
CREATE INDEX "highlight_position_idx" ON "highlight"("position");

-- CreateIndex
CREATE INDEX "social_link_position_idx" ON "social_link"("position");

-- CreateIndex
CREATE INDEX "technology_position_idx" ON "technology"("position");

-- CreateIndex
CREATE INDEX "contact_info_position_idx" ON "contact_info"("position");

-- CreateIndex (hand-written): a unique index on a constant allows at most one
-- row, so there can only ever be one administrator account.
CREATE UNIQUE INDEX "admin_user_singleton" ON "admin_user" ((true));
