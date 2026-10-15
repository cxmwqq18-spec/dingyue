CREATE TABLE "AidreamcapesMusicCatalogTrack" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "artist" TEXT NOT NULL,
  "genre" TEXT NOT NULL,
  "moods" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "durationSeconds" INTEGER NOT NULL,
  "bpm" INTEGER,
  "previewAssetKey" TEXT,
  "demoOnly" BOOLEAN NOT NULL DEFAULT TRUE,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AidreamcapesMusicCatalogTrack_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AidreamcapesMusicCatalogTrack_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesMusicCatalogTrack_site_scope_check" CHECK ("siteId" = 'site_aidreamcapes'),
  CONSTRAINT "AidreamcapesMusicCatalogTrack_title_check" CHECK (length(btrim("title")) BETWEEN 1 AND 160),
  CONSTRAINT "AidreamcapesMusicCatalogTrack_artist_check" CHECK (length(btrim("artist")) BETWEEN 1 AND 160),
  CONSTRAINT "AidreamcapesMusicCatalogTrack_genre_check" CHECK (length(btrim("genre")) BETWEEN 1 AND 80),
  CONSTRAINT "AidreamcapesMusicCatalogTrack_duration_check" CHECK ("durationSeconds" BETWEEN 1 AND 3600),
  CONSTRAINT "AidreamcapesMusicCatalogTrack_bpm_check" CHECK ("bpm" IS NULL OR "bpm" BETWEEN 1 AND 400),
  CONSTRAINT "AidreamcapesMusicCatalogTrack_preview_key_check" CHECK (
    "previewAssetKey" IS NULL OR (
      "previewAssetKey" !~ '(^/|(^|/)\.\.(/|$)|%|[[:cntrl:]])'
      AND position(chr(92) in "previewAssetKey") = 0
    )
  )
);
CREATE UNIQUE INDEX "AidreamcapesMusicCatalogTrack_id_site_unique" ON "AidreamcapesMusicCatalogTrack" ("id", "siteId");
CREATE INDEX "AidreamcapesMusicCatalogTrack_site_active" ON "AidreamcapesMusicCatalogTrack" ("siteId", "active", "genre", "title");

CREATE TABLE "AidreamcapesMusicLicense" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "trackId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'suspended',
  "territories" TEXT[] NOT NULL,
  "usageTypes" TEXT[] NOT NULL,
  "attributionRequired" BOOLEAN NOT NULL DEFAULT FALSE,
  "attributionText" TEXT,
  "startsAt" TIMESTAMPTZ(6),
  "expiresAt" TIMESTAMPTZ(6),
  "revision" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AidreamcapesMusicLicense_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AidreamcapesMusicLicense_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesMusicLicense_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesMusicLicense_track_site_fkey" FOREIGN KEY ("trackId", "siteId") REFERENCES "AidreamcapesMusicCatalogTrack"("id", "siteId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesMusicLicense_site_scope_check" CHECK ("siteId" = 'site_aidreamcapes'),
  CONSTRAINT "AidreamcapesMusicLicense_status_check" CHECK ("status" IN ('active', 'suspended', 'revoked')),
  CONSTRAINT "AidreamcapesMusicLicense_territories_check" CHECK (cardinality("territories") > 0 AND array_position("territories", '') IS NULL),
  CONSTRAINT "AidreamcapesMusicLicense_usage_types_check" CHECK (cardinality("usageTypes") > 0 AND array_position("usageTypes", '') IS NULL),
  CONSTRAINT "AidreamcapesMusicLicense_attribution_check" CHECK (
    NOT "attributionRequired" OR length(btrim(COALESCE("attributionText", ''))) > 0
  ),
  CONSTRAINT "AidreamcapesMusicLicense_revision_check" CHECK ("revision" > 0)
);
CREATE UNIQUE INDEX "AidreamcapesMusicLicense_owner_track_unique" ON "AidreamcapesMusicLicense" ("siteId", "customerId", "trackId");
CREATE INDEX "AidreamcapesMusicLicense_owner_status" ON "AidreamcapesMusicLicense" ("siteId", "customerId", "status", "expiresAt");

CREATE FUNCTION aidreamcapes_music_license_customer_site_check() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "Customer" c WHERE c."id" = NEW."customerId" AND c."siteId" = 'site_aidreamcapes'
  ) THEN
    RAISE EXCEPTION 'Aidreamcapes music license customer must belong to site_aidreamcapes';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AidreamcapesMusicLicense_customer_site_guard"
BEFORE INSERT OR UPDATE OF "siteId", "customerId" ON "AidreamcapesMusicLicense"
FOR EACH ROW EXECUTE FUNCTION aidreamcapes_music_license_customer_site_check();
