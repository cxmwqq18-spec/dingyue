ALTER TABLE "VideoTheme"
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "VideoThemeCategory"
ADD COLUMN "icon" TEXT,
ADD COLUMN "accentColor" TEXT;

CREATE TABLE "VideoThemeSlugRedirect" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "themeId" TEXT,
  "oldSlug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "VideoThemeSlugRedirect_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VideoThemeSlugRedirect_siteId_oldSlug_key"
ON "VideoThemeSlugRedirect"("siteId", "oldSlug");

CREATE INDEX "VideoThemeSlugRedirect_siteId_themeId_idx"
ON "VideoThemeSlugRedirect"("siteId", "themeId");

ALTER TABLE "VideoThemeSlugRedirect"
ADD CONSTRAINT "VideoThemeSlugRedirect_siteId_fkey"
FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VideoThemeSlugRedirect"
ADD CONSTRAINT "VideoThemeSlugRedirect_themeId_fkey"
FOREIGN KEY ("themeId") REFERENCES "VideoTheme"("id") ON DELETE SET NULL ON UPDATE CASCADE;
