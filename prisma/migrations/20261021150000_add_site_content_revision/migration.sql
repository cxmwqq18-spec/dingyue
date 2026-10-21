-- Derived per-site content revision for the public SSR cache probe.
-- This table is never a content source, publication record, or rollback source.
CREATE TABLE IF NOT EXISTS "SiteContentRevision" (
  "siteId" TEXT NOT NULL,
  "revision" BIGINT NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SiteContentRevision_pkey" PRIMARY KEY ("siteId")
);

-- Phase 1 keeps the trigger guard scoped to the Aidreamcapes site so writes
-- for MyDreamShoots and Aidreamshoots keep their existing behavior. When the
-- cache is enabled for another site, widen this guard in a new migration.
CREATE OR REPLACE FUNCTION bump_site_content_revision(p_site_id TEXT)
RETURNS void AS $$
BEGIN
  IF p_site_id IS NULL OR p_site_id <> 'site_aidreamcapes' THEN
    RETURN;
  END IF;

  INSERT INTO "SiteContentRevision" ("siteId", "revision", "updatedAt")
  VALUES (p_site_id, 1, CURRENT_TIMESTAMP)
  ON CONFLICT ("siteId") DO UPDATE
  SET "revision" = "SiteContentRevision"."revision" + 1,
      "updatedAt" = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION bump_site_content_revision_row()
RETURNS trigger AS $$
BEGIN
  PERFORM bump_site_content_revision(COALESCE(NEW."siteId", OLD."siteId"));
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION bump_site_content_revision_site()
RETURNS trigger AS $$
BEGIN
  PERFORM bump_site_content_revision(COALESCE(NEW."id", OLD."id"));
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "SiteContentRevision_LivePage" ON "LivePage";
CREATE TRIGGER "SiteContentRevision_LivePage"
AFTER INSERT OR UPDATE OR DELETE ON "LivePage"
FOR EACH ROW EXECUTE PROCEDURE bump_site_content_revision_row();

DROP TRIGGER IF EXISTS "SiteContentRevision_Site" ON "Site";
CREATE TRIGGER "SiteContentRevision_Site"
AFTER INSERT OR UPDATE OR DELETE ON "Site"
FOR EACH ROW EXECUTE PROCEDURE bump_site_content_revision_site();

DROP TRIGGER IF EXISTS "SiteContentRevision_SiteDomain" ON "SiteDomain";
CREATE TRIGGER "SiteContentRevision_SiteDomain"
AFTER INSERT OR UPDATE OR DELETE ON "SiteDomain"
FOR EACH ROW EXECUTE PROCEDURE bump_site_content_revision_row();

DROP TRIGGER IF EXISTS "SiteContentRevision_ThemeSettings" ON "ThemeSettings";
CREATE TRIGGER "SiteContentRevision_ThemeSettings"
AFTER INSERT OR UPDATE OR DELETE ON "ThemeSettings"
FOR EACH ROW EXECUTE PROCEDURE bump_site_content_revision_row();

DROP TRIGGER IF EXISTS "SiteContentRevision_StorefrontProfile" ON "StorefrontProfile";
CREATE TRIGGER "SiteContentRevision_StorefrontProfile"
AFTER INSERT OR UPDATE OR DELETE ON "StorefrontProfile"
FOR EACH ROW EXECUTE PROCEDURE bump_site_content_revision_row();

DROP TRIGGER IF EXISTS "SiteContentRevision_Product" ON "Product";
CREATE TRIGGER "SiteContentRevision_Product"
AFTER INSERT OR UPDATE OR DELETE ON "Product"
FOR EACH ROW EXECUTE PROCEDURE bump_site_content_revision_row();

DROP TRIGGER IF EXISTS "SiteContentRevision_Price" ON "Price";
CREATE TRIGGER "SiteContentRevision_Price"
AFTER INSERT OR UPDATE OR DELETE ON "Price"
FOR EACH ROW EXECUTE PROCEDURE bump_site_content_revision_row();

DROP TRIGGER IF EXISTS "SiteContentRevision_SiteAiApp" ON "SiteAiApp";
CREATE TRIGGER "SiteContentRevision_SiteAiApp"
AFTER INSERT OR UPDATE OR DELETE ON "SiteAiApp"
FOR EACH ROW EXECUTE PROCEDURE bump_site_content_revision_row();

DROP TRIGGER IF EXISTS "SiteContentRevision_CreativePack" ON "CreativePack";
CREATE TRIGGER "SiteContentRevision_CreativePack"
AFTER INSERT OR UPDATE OR DELETE ON "CreativePack"
FOR EACH ROW EXECUTE PROCEDURE bump_site_content_revision_row();

DROP TRIGGER IF EXISTS "SiteContentRevision_CreativePackCategory" ON "CreativePackCategory";
CREATE TRIGGER "SiteContentRevision_CreativePackCategory"
AFTER INSERT OR UPDATE OR DELETE ON "CreativePackCategory"
FOR EACH ROW EXECUTE PROCEDURE bump_site_content_revision_row();

DROP TRIGGER IF EXISTS "SiteContentRevision_MediaAsset" ON "MediaAsset";
CREATE TRIGGER "SiteContentRevision_MediaAsset"
AFTER INSERT OR UPDATE OR DELETE ON "MediaAsset"
FOR EACH ROW EXECUTE PROCEDURE bump_site_content_revision_row();

DROP TRIGGER IF EXISTS "SiteContentRevision_ToolCategory" ON "ToolCategory";
CREATE TRIGGER "SiteContentRevision_ToolCategory"
AFTER INSERT OR UPDATE OR DELETE ON "ToolCategory"
FOR EACH ROW EXECUTE PROCEDURE bump_site_content_revision_row();

DROP TRIGGER IF EXISTS "SiteContentRevision_ToolMenuItem" ON "ToolMenuItem";
CREATE TRIGGER "SiteContentRevision_ToolMenuItem"
AFTER INSERT OR UPDATE OR DELETE ON "ToolMenuItem"
FOR EACH ROW EXECUTE PROCEDURE bump_site_content_revision_row();

DROP TRIGGER IF EXISTS "SiteContentRevision_VideoTheme" ON "VideoTheme";
CREATE TRIGGER "SiteContentRevision_VideoTheme"
AFTER INSERT OR UPDATE OR DELETE ON "VideoTheme"
FOR EACH ROW EXECUTE PROCEDURE bump_site_content_revision_row();

DROP TRIGGER IF EXISTS "SiteContentRevision_VideoThemeCategory" ON "VideoThemeCategory";
CREATE TRIGGER "SiteContentRevision_VideoThemeCategory"
AFTER INSERT OR UPDATE OR DELETE ON "VideoThemeCategory"
FOR EACH ROW EXECUTE PROCEDURE bump_site_content_revision_row();

INSERT INTO "SiteContentRevision" ("siteId", "revision", "updatedAt")
SELECT 'site_aidreamcapes', 0, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "SiteContentRevision" WHERE "siteId" = 'site_aidreamcapes'
);
