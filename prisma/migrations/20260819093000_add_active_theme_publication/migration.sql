CREATE TABLE "ActiveThemePublication" (
  "siteId" TEXT NOT NULL,
  "publicationId" TEXT NOT NULL,
  "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activatedBy" TEXT NOT NULL,
  CONSTRAINT "ActiveThemePublication_pkey" PRIMARY KEY ("siteId")
);

CREATE UNIQUE INDEX "ActiveThemePublication_publicationId_key"
  ON "ActiveThemePublication"("publicationId");

CREATE INDEX "ActiveThemePublication_publicationId_idx"
  ON "ActiveThemePublication"("publicationId");

ALTER TABLE "ActiveThemePublication"
  ADD CONSTRAINT "ActiveThemePublication_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActiveThemePublication"
  ADD CONSTRAINT "ActiveThemePublication_publicationId_fkey"
  FOREIGN KEY ("publicationId") REFERENCES "ThemePublication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
