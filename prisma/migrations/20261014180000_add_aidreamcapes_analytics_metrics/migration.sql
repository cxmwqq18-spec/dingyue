CREATE TABLE "AidreamcapesCreativeMetric" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "ownerCustomerId" TEXT NOT NULL,
  "createdByCustomerId" TEXT NOT NULL,
  "teamId" TEXT,
  "provider" TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "providerRecordId" TEXT NOT NULL,
  "creativeId" TEXT NOT NULL,
  "creativeName" TEXT,
  "metricDate" DATE NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "spendMinorUnits" BIGINT NOT NULL,
  "impressions" BIGINT NOT NULL,
  "clicks" BIGINT NOT NULL,
  "conversions" BIGINT NOT NULL,
  "importedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AidreamcapesCreativeMetric_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AidreamcapesCreativeMetric_site_fkey"
    FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesCreativeMetric_owner_fkey"
    FOREIGN KEY ("ownerCustomerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesCreativeMetric_importer_fkey"
    FOREIGN KEY ("createdByCustomerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesCreativeMetric_team_fkey"
    FOREIGN KEY ("teamId") REFERENCES "AidreamcapesTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesCreativeMetric_team_owner_fkey"
    FOREIGN KEY ("teamId", "siteId", "ownerCustomerId")
    REFERENCES "AidreamcapesTeam"("id", "siteId", "ownerCustomerId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesCreativeMetric_site_scope_check" CHECK ("siteId" = 'site_aidreamcapes'),
  CONSTRAINT "AidreamcapesCreativeMetric_provider_check"
    CHECK ("provider" IN ('meta_ads', 'tiktok_ads', 'google_ads', 'youtube_ads', 'pinterest_ads', 'snapchat_ads')),
  CONSTRAINT "AidreamcapesCreativeMetric_account_check"
    CHECK ("providerAccountId" ~ '^[A-Za-z0-9:._-]{1,128}$'),
  CONSTRAINT "AidreamcapesCreativeMetric_record_check"
    CHECK ("providerRecordId" ~ '^[A-Za-z0-9:._-]{1,160}$'),
  CONSTRAINT "AidreamcapesCreativeMetric_creative_check"
    CHECK ("creativeId" ~ '^[A-Za-z0-9:._-]{1,160}$'),
  CONSTRAINT "AidreamcapesCreativeMetric_creative_name_check"
    CHECK ("creativeName" IS NULL OR length(btrim("creativeName")) BETWEEN 1 AND 160),
  CONSTRAINT "AidreamcapesCreativeMetric_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "AidreamcapesCreativeMetric_nonnegative_check"
    CHECK ("spendMinorUnits" >= 0 AND "impressions" >= 0 AND "clicks" >= 0 AND "conversions" >= 0),
  CONSTRAINT "AidreamcapesCreativeMetric_spend_bound_check" CHECK ("spendMinorUnits" <= 9000000000000000000),
  CONSTRAINT "AidreamcapesCreativeMetric_clicks_check" CHECK ("clicks" <= "impressions")
);

CREATE UNIQUE INDEX "AidreamcapesCreativeMetric_event_unique"
  ON "AidreamcapesCreativeMetric" (
    "siteId",
    "ownerCustomerId",
    COALESCE("teamId", ''),
    "provider",
    "providerAccountId",
    "providerRecordId"
  );
CREATE INDEX "AidreamcapesCreativeMetric_scope_date"
  ON "AidreamcapesCreativeMetric" ("siteId", "ownerCustomerId", "teamId", "metricDate", "currency");
CREATE INDEX "AidreamcapesCreativeMetric_provider_date"
  ON "AidreamcapesCreativeMetric" ("siteId", "ownerCustomerId", "provider", "providerAccountId", "metricDate");
CREATE INDEX "AidreamcapesCreativeMetric_freshness"
  ON "AidreamcapesCreativeMetric" ("siteId", "ownerCustomerId", "importedAt" DESC);

CREATE OR REPLACE FUNCTION aidreamcapes_creative_metric_scope_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."siteId" <> 'site_aidreamcapes'
    OR NOT EXISTS (SELECT 1 FROM "Customer" WHERE "id" = NEW."ownerCustomerId" AND "siteId" = 'site_aidreamcapes')
    OR NOT EXISTS (SELECT 1 FROM "Customer" WHERE "id" = NEW."createdByCustomerId" AND "siteId" = 'site_aidreamcapes') THEN
    RAISE EXCEPTION 'aidreamcapes analytics customer site mismatch';
  END IF;
  IF NEW."teamId" IS NULL THEN
    IF NEW."ownerCustomerId" <> NEW."createdByCustomerId" THEN
      RAISE EXCEPTION 'personal analytics owner must be the importing customer';
    END IF;
  ELSIF NOT EXISTS (
    SELECT 1
    FROM "AidreamcapesTeamMember" member
    WHERE member."teamId" = NEW."teamId"
      AND member."siteId" = 'site_aidreamcapes'
      AND member."ownerCustomerId" = NEW."ownerCustomerId"
      AND member."customerId" = NEW."createdByCustomerId"
      AND member."role" IN ('owner', 'admin', 'editor')
  ) THEN
    RAISE EXCEPTION 'aidreamcapes analytics importer is not an editable team member';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "AidreamcapesCreativeMetric_scope_guard"
  BEFORE INSERT OR UPDATE ON "AidreamcapesCreativeMetric"
  FOR EACH ROW EXECUTE FUNCTION aidreamcapes_creative_metric_scope_guard();
