CREATE TABLE "VideoThemeCategory" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "imageUrl" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VideoThemeCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VideoTheme" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "categoryId" TEXT,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "headline" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "creditCost" INTEGER NOT NULL,
  "durationSeconds" INTEGER NOT NULL DEFAULT 6,
  "maxFrames" INTEGER NOT NULL DEFAULT 4,
  "generationCount" INTEGER NOT NULL DEFAULT 0,
  "imageUrl" TEXT,
  "galleryImages" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VideoTheme_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VideoThemeCategory_siteId_slug_key" ON "VideoThemeCategory"("siteId", "slug");
CREATE INDEX "VideoThemeCategory_siteId_sortOrder_idx" ON "VideoThemeCategory"("siteId", "sortOrder");
CREATE INDEX "VideoThemeCategory_siteId_status_idx" ON "VideoThemeCategory"("siteId", "status");

CREATE UNIQUE INDEX "VideoTheme_siteId_slug_key" ON "VideoTheme"("siteId", "slug");
CREATE INDEX "VideoTheme_siteId_status_idx" ON "VideoTheme"("siteId", "status");
CREATE INDEX "VideoTheme_siteId_categoryId_idx" ON "VideoTheme"("siteId", "categoryId");
CREATE INDEX "VideoTheme_siteId_status_createdAt_idx" ON "VideoTheme"("siteId", "status", "createdAt");

ALTER TABLE "VideoThemeCategory"
  ADD CONSTRAINT "VideoThemeCategory_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VideoTheme"
  ADD CONSTRAINT "VideoTheme_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VideoTheme"
  ADD CONSTRAINT "VideoTheme_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "VideoThemeCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
