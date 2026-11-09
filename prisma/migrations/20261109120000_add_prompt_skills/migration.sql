-- Aidreamcapes prompt-optimization skills: admin-curated skill files the
-- "Optimize" agent reads before rewriting a user's prompt.
CREATE TABLE IF NOT EXISTS "PromptSkill" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "skillMd" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "PromptSkill_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "PromptSkill" ADD CONSTRAINT "PromptSkill_site_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "PromptSkill_site_slug_key" ON "PromptSkill"("siteId", "slug");

-- Only one default skill per site; partial unique index keeps that invariant
-- without touching unrelated sites.
CREATE UNIQUE INDEX IF NOT EXISTS "PromptSkill_default_per_site" ON "PromptSkill"("siteId") WHERE "isDefault";

DO $$ BEGIN
  ALTER TABLE "PromptSkill" ADD CONSTRAINT "PromptSkill_site_scope_check" CHECK ("siteId" = 'site_aidreamcapes');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PromptSkill" ADD CONSTRAINT "PromptSkill_status_check" CHECK ("status" IN ('active', 'retired'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
