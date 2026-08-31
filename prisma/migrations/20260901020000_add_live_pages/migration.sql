-- LivePage is the sole page-content source for public SSR. The backfill is a
-- one-time migration of the current relational value; runtime code never
-- falls back to ThemePage after this table exists.
CREATE TABLE "LivePage" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "pageType" TEXT NOT NULL,
  "templateKey" TEXT,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "contentJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LivePage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LivePage_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "LivePage" ("id", "siteId", "pageType", "templateKey", "slug", "title", "contentJson", "createdAt", "updatedAt")
SELECT "id", "siteId", "pageType", "templateKey", "slug", "title", "draftJson", "createdAt", "updatedAt"
FROM "ThemePage";

CREATE UNIQUE INDEX "LivePage_siteId_slug_key" ON "LivePage"("siteId", "slug");
CREATE INDEX "LivePage_siteId_pageType_idx" ON "LivePage"("siteId", "pageType");
CREATE INDEX "LivePage_siteId_templateKey_idx" ON "LivePage"("siteId", "templateKey");
CREATE INDEX "LivePage_siteId_updatedAt_idx" ON "LivePage"("siteId", "updatedAt");
