CREATE OR REPLACE FUNCTION aidreamcapes_team_brand_owner_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."siteId" <> 'site_aidreamcapes' OR NOT EXISTS (
    SELECT 1 FROM "Customer" WHERE "id" = NEW."ownerCustomerId" AND "siteId" = 'site_aidreamcapes'
  ) THEN
    RAISE EXCEPTION 'aidreamcapes team or brand owner site mismatch';
  END IF;

  IF TG_TABLE_NAME = 'AidreamcapesTeamMember' THEN
    IF NOT EXISTS (
      SELECT 1 FROM "Customer" WHERE "id" = NEW."customerId" AND "siteId" = 'site_aidreamcapes'
    ) THEN
      RAISE EXCEPTION 'aidreamcapes team member site mismatch';
    END IF;
    IF (NEW."role" = 'owner') <> (NEW."customerId" = NEW."ownerCustomerId") THEN
      RAISE EXCEPTION 'aidreamcapes team owner membership mismatch';
    END IF;
  ELSIF TG_TABLE_NAME = 'AidreamcapesTeamInvite' THEN
    IF NEW."role" NOT IN ('admin', 'editor', 'viewer') OR NOT EXISTS (
      SELECT 1 FROM "Customer" WHERE "id" = NEW."invitedCustomerId" AND "siteId" = 'site_aidreamcapes'
    ) OR NOT EXISTS (
      SELECT 1 FROM "Customer" WHERE "id" = NEW."invitedByCustomerId" AND "siteId" = 'site_aidreamcapes'
    ) THEN
      RAISE EXCEPTION 'aidreamcapes team invite target or actor is invalid';
    END IF;
  ELSIF TG_TABLE_NAME = 'AidreamcapesBrandFactVersion' THEN
    IF NOT EXISTS (
      SELECT 1 FROM "Customer" WHERE "id" = NEW."changedByCustomerId" AND "siteId" = 'site_aidreamcapes'
    ) THEN
      RAISE EXCEPTION 'aidreamcapes brand fact version actor site mismatch';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'AidreamcapesBrandFact' THEN
    IF (NEW."confirmed" AND (NEW."confirmedByCustomerId" IS NULL OR NEW."confirmedAt" IS NULL)) OR
       (NOT NEW."confirmed" AND (NEW."confirmedByCustomerId" IS NOT NULL OR NEW."confirmedAt" IS NOT NULL)) OR
       (NEW."confirmedByCustomerId" IS NOT NULL AND NOT EXISTS (
         SELECT 1 FROM "Customer" WHERE "id" = NEW."confirmedByCustomerId" AND "siteId" = 'site_aidreamcapes'
       )) THEN
      RAISE EXCEPTION 'aidreamcapes brand fact confirmation metadata is invalid';
    END IF;
  ELSIF TG_TABLE_NAME = 'AidreamcapesBrandFactVersion' THEN
    IF (NEW."confirmed" AND (NEW."confirmedByCustomerId" IS NULL OR NEW."confirmedAt" IS NULL)) OR
       (NOT NEW."confirmed" AND (NEW."confirmedByCustomerId" IS NOT NULL OR NEW."confirmedAt" IS NOT NULL)) OR
       (NEW."confirmedByCustomerId" IS NOT NULL AND NOT EXISTS (
         SELECT 1 FROM "Customer" WHERE "id" = NEW."confirmedByCustomerId" AND "siteId" = 'site_aidreamcapes'
       )) THEN
      RAISE EXCEPTION 'aidreamcapes brand fact confirmation metadata is invalid';
    END IF;
  END IF;

  IF TG_TABLE_NAME IN ('AidreamcapesTeam', 'AidreamcapesTeamMember', 'AidreamcapesTeamInvite', 'AidreamcapesBrandProfile', 'AidreamcapesBrandFact')
    AND TG_OP = 'UPDATE' AND (OLD."siteId" <> NEW."siteId" OR OLD."ownerCustomerId" <> NEW."ownerCustomerId" OR OLD."id" <> NEW."id") THEN
    RAISE EXCEPTION 'aidreamcapes team and brand ownership is immutable';
  END IF;
  RETURN NEW;
END;
$$;
