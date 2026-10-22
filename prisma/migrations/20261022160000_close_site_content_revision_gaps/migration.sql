-- Close public SSR cache invalidation gaps discovered by the P0-1 audit.
--
-- The public runtime projection reads:
--   Site.connect (StripeConnectAccount)
--   SiteAiApp.aiApp (global AiApp name/description/appType)
--   VideoThemeExample (non-Aidreamcapes runtime; future cache widening)
--
-- Those rows were not covered by the original SiteContentRevision triggers.

-- Stripe Connect readiness is projected into the public site shell and
-- checkout affordances. A change must invalidate the site cache.
DROP TRIGGER IF EXISTS "SiteContentRevision_StripeConnectAccount" ON "StripeConnectAccount";
CREATE TRIGGER "SiteContentRevision_StripeConnectAccount"
AFTER INSERT OR UPDATE OR DELETE ON "StripeConnectAccount"
FOR EACH ROW EXECUTE PROCEDURE bump_site_content_revision_row();

-- AiApp is a global table, so the trigger must bump every site that references
-- the changed app through SiteAiApp. bump_site_content_revision() remains
-- scoped to site_aidreamcapes in this phase.
CREATE OR REPLACE FUNCTION bump_site_content_revision_ai_app()
RETURNS trigger AS $$
DECLARE
  v_ai_app_id TEXT;
  v_site_id TEXT;
BEGIN
  v_ai_app_id := COALESCE(NEW."id", OLD."id");

  FOR v_site_id IN
    SELECT "siteId"
    FROM "SiteAiApp"
    WHERE "aiAppId" = v_ai_app_id
  LOOP
    PERFORM bump_site_content_revision(v_site_id);
  END LOOP;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "SiteContentRevision_AiApp" ON "AiApp";
CREATE TRIGGER "SiteContentRevision_AiApp"
AFTER INSERT OR UPDATE OR DELETE ON "AiApp"
FOR EACH ROW EXECUTE PROCEDURE bump_site_content_revision_ai_app();

-- VideoThemeExample is not part of the Aidreamcapes runtime today, but it is
-- read by the non-Aidreamcapes public projection. Add the row trigger now so a
-- future cache widening cannot silently serve stale examples.
DROP TRIGGER IF EXISTS "SiteContentRevision_VideoThemeExample" ON "VideoThemeExample";
CREATE TRIGGER "SiteContentRevision_VideoThemeExample"
AFTER INSERT OR UPDATE OR DELETE ON "VideoThemeExample"
FOR EACH ROW EXECUTE PROCEDURE bump_site_content_revision_row();
