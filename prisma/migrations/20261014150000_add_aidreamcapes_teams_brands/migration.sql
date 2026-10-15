CREATE TABLE "AidreamcapesTeam" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "ownerCustomerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AidreamcapesTeam_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AidreamcapesTeam_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesTeam_ownerCustomerId_fkey" FOREIGN KEY ("ownerCustomerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesTeam_site_scope_check" CHECK ("siteId" = 'site_aidreamcapes'),
  CONSTRAINT "AidreamcapesTeam_name_check" CHECK (length(btrim("name")) BETWEEN 1 AND 100),
  CONSTRAINT "AidreamcapesTeam_revision_check" CHECK ("revision" > 0)
);
CREATE UNIQUE INDEX "AidreamcapesTeam_owner_unique" ON "AidreamcapesTeam" ("id", "siteId", "ownerCustomerId");
CREATE INDEX "AidreamcapesTeam_owner_updated" ON "AidreamcapesTeam" ("siteId", "ownerCustomerId", "updatedAt" DESC);

CREATE TABLE "AidreamcapesTeamMember" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "ownerCustomerId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AidreamcapesTeamMember_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AidreamcapesTeamMember_team_owner_fkey" FOREIGN KEY ("teamId", "siteId", "ownerCustomerId") REFERENCES "AidreamcapesTeam"("id", "siteId", "ownerCustomerId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesTeamMember_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesTeamMember_ownerCustomerId_fkey" FOREIGN KEY ("ownerCustomerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesTeamMember_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesTeamMember_site_scope_check" CHECK ("siteId" = 'site_aidreamcapes'),
  CONSTRAINT "AidreamcapesTeamMember_role_check" CHECK ("role" IN ('owner', 'admin', 'editor', 'viewer')),
  CONSTRAINT "AidreamcapesTeamMember_revision_owner_check" CHECK (("role" = 'owner') = ("customerId" = "ownerCustomerId"))
);
CREATE UNIQUE INDEX "AidreamcapesTeamMember_team_customer_unique" ON "AidreamcapesTeamMember" ("teamId", "customerId");
CREATE UNIQUE INDEX "AidreamcapesTeamMember_single_owner" ON "AidreamcapesTeamMember" ("teamId") WHERE "role" = 'owner';
CREATE INDEX "AidreamcapesTeamMember_team_owner" ON "AidreamcapesTeamMember" ("siteId", "ownerCustomerId", "teamId");
CREATE INDEX "AidreamcapesTeamMember_customer" ON "AidreamcapesTeamMember" ("siteId", "customerId", "createdAt" DESC);

CREATE TABLE "AidreamcapesTeamInvite" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "ownerCustomerId" TEXT NOT NULL,
  "invitedCustomerId" TEXT NOT NULL,
  "invitedByCustomerId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMPTZ(6),
  CONSTRAINT "AidreamcapesTeamInvite_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AidreamcapesTeamInvite_team_owner_fkey" FOREIGN KEY ("teamId", "siteId", "ownerCustomerId") REFERENCES "AidreamcapesTeam"("id", "siteId", "ownerCustomerId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesTeamInvite_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesTeamInvite_ownerCustomerId_fkey" FOREIGN KEY ("ownerCustomerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesTeamInvite_invitedCustomerId_fkey" FOREIGN KEY ("invitedCustomerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesTeamInvite_invitedByCustomerId_fkey" FOREIGN KEY ("invitedByCustomerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesTeamInvite_site_scope_check" CHECK ("siteId" = 'site_aidreamcapes'),
  CONSTRAINT "AidreamcapesTeamInvite_role_check" CHECK ("role" IN ('admin', 'editor', 'viewer')),
  CONSTRAINT "AidreamcapesTeamInvite_status_check" CHECK ("status" IN ('pending', 'accepted', 'revoked'))
);
CREATE UNIQUE INDEX "AidreamcapesTeamInvite_recipient_status_unique" ON "AidreamcapesTeamInvite" ("teamId", "invitedCustomerId", "status");
CREATE INDEX "AidreamcapesTeamInvite_team_status" ON "AidreamcapesTeamInvite" ("siteId", "ownerCustomerId", "teamId", "status");
CREATE INDEX "AidreamcapesTeamInvite_recipient" ON "AidreamcapesTeamInvite" ("siteId", "invitedCustomerId", "status", "createdAt" DESC);

CREATE TABLE "AidreamcapesBrandProfile" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "ownerCustomerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "profile" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AidreamcapesBrandProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AidreamcapesBrandProfile_team_owner_fkey" FOREIGN KEY ("teamId", "siteId", "ownerCustomerId") REFERENCES "AidreamcapesTeam"("id", "siteId", "ownerCustomerId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesBrandProfile_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesBrandProfile_ownerCustomerId_fkey" FOREIGN KEY ("ownerCustomerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesBrandProfile_site_scope_check" CHECK ("siteId" = 'site_aidreamcapes'),
  CONSTRAINT "AidreamcapesBrandProfile_name_check" CHECK (length(btrim("name")) BETWEEN 1 AND 100),
  CONSTRAINT "AidreamcapesBrandProfile_revision_check" CHECK ("revision" > 0),
  CONSTRAINT "AidreamcapesBrandProfile_profile_check" CHECK (jsonb_typeof("profile") = 'object')
);
CREATE UNIQUE INDEX "AidreamcapesBrandProfile_team_key" ON "AidreamcapesBrandProfile" ("teamId");
CREATE UNIQUE INDEX "AidreamcapesBrandProfile_owner_unique" ON "AidreamcapesBrandProfile" ("id", "siteId", "ownerCustomerId");
CREATE UNIQUE INDEX "AidreamcapesBrandProfile_team_owner_unique" ON "AidreamcapesBrandProfile" ("teamId", "siteId", "ownerCustomerId");
CREATE INDEX "AidreamcapesBrandProfile_owner_updated" ON "AidreamcapesBrandProfile" ("siteId", "ownerCustomerId", "updatedAt" DESC);

CREATE TABLE "AidreamcapesBrandFact" (
  "id" TEXT NOT NULL,
  "brandProfileId" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "ownerCustomerId" TEXT NOT NULL,
  "factKey" TEXT NOT NULL,
  "factValue" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL DEFAULT 'manual',
  "sourceUrl" TEXT,
  "sourceLabel" TEXT,
  "confirmed" BOOLEAN NOT NULL DEFAULT FALSE,
  "confirmedByCustomerId" TEXT,
  "confirmedAt" TIMESTAMPTZ(6),
  "revision" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AidreamcapesBrandFact_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AidreamcapesBrandFact_brand_owner_fkey" FOREIGN KEY ("brandProfileId", "siteId", "ownerCustomerId") REFERENCES "AidreamcapesBrandProfile"("id", "siteId", "ownerCustomerId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesBrandFact_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesBrandFact_ownerCustomerId_fkey" FOREIGN KEY ("ownerCustomerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesBrandFact_confirmedByCustomerId_fkey" FOREIGN KEY ("confirmedByCustomerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesBrandFact_site_scope_check" CHECK ("siteId" = 'site_aidreamcapes'),
  CONSTRAINT "AidreamcapesBrandFact_key_check" CHECK ("factKey" ~ '^[a-z][a-z0-9_.-]{0,79}$'),
  CONSTRAINT "AidreamcapesBrandFact_value_check" CHECK (length(btrim("factValue")) BETWEEN 1 AND 4000),
  CONSTRAINT "AidreamcapesBrandFact_source_type_check" CHECK ("sourceType" IN ('manual', 'product_url')),
  CONSTRAINT "AidreamcapesBrandFact_source_url_check" CHECK (("sourceType" = 'manual' AND "sourceUrl" IS NULL) OR ("sourceType" = 'product_url' AND "sourceUrl" LIKE 'https://%')),
  CONSTRAINT "AidreamcapesBrandFact_confirmation_check" CHECK (("confirmed" AND "confirmedByCustomerId" IS NOT NULL AND "confirmedAt" IS NOT NULL) OR (NOT "confirmed" AND "confirmedByCustomerId" IS NULL AND "confirmedAt" IS NULL)),
  CONSTRAINT "AidreamcapesBrandFact_revision_check" CHECK ("revision" > 0)
);
CREATE UNIQUE INDEX "AidreamcapesBrandFact_owner_unique" ON "AidreamcapesBrandFact" ("id", "brandProfileId", "siteId", "ownerCustomerId");
CREATE UNIQUE INDEX "AidreamcapesBrandFact_brand_key_unique" ON "AidreamcapesBrandFact" ("brandProfileId", "factKey");
CREATE INDEX "AidreamcapesBrandFact_brand_key" ON "AidreamcapesBrandFact" ("siteId", "ownerCustomerId", "brandProfileId", "factKey");
CREATE INDEX "AidreamcapesBrandFact_brand_updated" ON "AidreamcapesBrandFact" ("siteId", "ownerCustomerId", "brandProfileId", "updatedAt" DESC);

CREATE TABLE "AidreamcapesBrandFactVersion" (
  "id" TEXT NOT NULL,
  "factId" TEXT NOT NULL,
  "brandProfileId" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "ownerCustomerId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "action" TEXT NOT NULL,
  "factKey" TEXT NOT NULL,
  "factValue" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "sourceLabel" TEXT,
  "confirmed" BOOLEAN NOT NULL,
  "confirmedByCustomerId" TEXT,
  "confirmedAt" TIMESTAMPTZ(6),
  "changedByCustomerId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AidreamcapesBrandFactVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AidreamcapesBrandFactVersion_fact_owner_fkey" FOREIGN KEY ("factId", "brandProfileId", "siteId", "ownerCustomerId") REFERENCES "AidreamcapesBrandFact"("id", "brandProfileId", "siteId", "ownerCustomerId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesBrandFactVersion_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesBrandFactVersion_changedByCustomerId_fkey" FOREIGN KEY ("changedByCustomerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesBrandFactVersion_confirmedByCustomerId_fkey" FOREIGN KEY ("confirmedByCustomerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesBrandFactVersion_site_scope_check" CHECK ("siteId" = 'site_aidreamcapes'),
  CONSTRAINT "AidreamcapesBrandFactVersion_revision_check" CHECK ("revision" > 0),
  CONSTRAINT "AidreamcapesBrandFactVersion_action_check" CHECK ("action" IN ('created', 'updated', 'confirmed', 'unconfirmed')),
  CONSTRAINT "AidreamcapesBrandFactVersion_confirmation_check" CHECK (("confirmed" AND "confirmedByCustomerId" IS NOT NULL AND "confirmedAt" IS NOT NULL) OR (NOT "confirmed" AND "confirmedByCustomerId" IS NULL AND "confirmedAt" IS NULL))
);
CREATE UNIQUE INDEX "AidreamcapesBrandFactVersion_fact_revision_unique" ON "AidreamcapesBrandFactVersion" ("factId", "revision");
CREATE INDEX "AidreamcapesBrandFactVersion_history" ON "AidreamcapesBrandFactVersion" ("siteId", "ownerCustomerId", "factId", "revision" DESC);

CREATE OR REPLACE FUNCTION aidreamcapes_team_brand_owner_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."siteId" <> 'site_aidreamcapes' OR NOT EXISTS (
    SELECT 1 FROM "Customer" WHERE "id" = NEW."ownerCustomerId" AND "siteId" = 'site_aidreamcapes'
  ) THEN
    RAISE EXCEPTION 'aidreamcapes team or brand owner site mismatch';
  END IF;
  IF TG_TABLE_NAME = 'AidreamcapesTeamMember' AND NOT EXISTS (
    SELECT 1 FROM "Customer" WHERE "id" = NEW."customerId" AND "siteId" = 'site_aidreamcapes'
  ) THEN
    RAISE EXCEPTION 'aidreamcapes team member site mismatch';
  END IF;
  IF TG_TABLE_NAME = 'AidreamcapesTeamMember' AND ((NEW."role" = 'owner') <> (NEW."customerId" = NEW."ownerCustomerId")) THEN
    RAISE EXCEPTION 'aidreamcapes team owner membership mismatch';
  END IF;
  IF TG_TABLE_NAME = 'AidreamcapesTeamInvite' AND (
    NEW."role" NOT IN ('admin', 'editor', 'viewer') OR NOT EXISTS (
      SELECT 1 FROM "Customer" WHERE "id" = NEW."invitedCustomerId" AND "siteId" = 'site_aidreamcapes'
    ) OR NOT EXISTS (
      SELECT 1 FROM "Customer" WHERE "id" = NEW."invitedByCustomerId" AND "siteId" = 'site_aidreamcapes'
    )
  ) THEN
    RAISE EXCEPTION 'aidreamcapes team invite target or actor is invalid';
  END IF;
  IF TG_TABLE_NAME = 'AidreamcapesBrandFactVersion' AND NOT EXISTS (
    SELECT 1 FROM "Customer" WHERE "id" = NEW."changedByCustomerId" AND "siteId" = 'site_aidreamcapes'
  ) THEN
    RAISE EXCEPTION 'aidreamcapes brand fact version actor site mismatch';
  END IF;
  IF TG_TABLE_NAME IN ('AidreamcapesBrandFact', 'AidreamcapesBrandFactVersion') AND (
    (NEW."confirmed" AND (NEW."confirmedByCustomerId" IS NULL OR NEW."confirmedAt" IS NULL)) OR
    (NOT NEW."confirmed" AND (NEW."confirmedByCustomerId" IS NOT NULL OR NEW."confirmedAt" IS NOT NULL)) OR
    (NEW."confirmedByCustomerId" IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM "Customer" WHERE "id" = NEW."confirmedByCustomerId" AND "siteId" = 'site_aidreamcapes'
    ))
  ) THEN
    RAISE EXCEPTION 'aidreamcapes brand fact confirmation metadata is invalid';
  END IF;
  IF TG_TABLE_NAME IN ('AidreamcapesTeam', 'AidreamcapesTeamMember', 'AidreamcapesTeamInvite', 'AidreamcapesBrandProfile', 'AidreamcapesBrandFact')
    AND TG_OP = 'UPDATE' AND (OLD."siteId" <> NEW."siteId" OR OLD."ownerCustomerId" <> NEW."ownerCustomerId" OR OLD."id" <> NEW."id") THEN
    RAISE EXCEPTION 'aidreamcapes team and brand ownership is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER aidreamcapes_team_owner_guard BEFORE INSERT OR UPDATE ON "AidreamcapesTeam"
  FOR EACH ROW EXECUTE FUNCTION aidreamcapes_team_brand_owner_guard();
CREATE TRIGGER aidreamcapes_team_member_owner_guard BEFORE INSERT OR UPDATE ON "AidreamcapesTeamMember"
  FOR EACH ROW EXECUTE FUNCTION aidreamcapes_team_brand_owner_guard();
CREATE TRIGGER aidreamcapes_team_invite_owner_guard BEFORE INSERT OR UPDATE ON "AidreamcapesTeamInvite"
  FOR EACH ROW EXECUTE FUNCTION aidreamcapes_team_brand_owner_guard();
CREATE TRIGGER aidreamcapes_brand_profile_owner_guard BEFORE INSERT OR UPDATE ON "AidreamcapesBrandProfile"
  FOR EACH ROW EXECUTE FUNCTION aidreamcapes_team_brand_owner_guard();
CREATE TRIGGER aidreamcapes_brand_fact_owner_guard BEFORE INSERT OR UPDATE ON "AidreamcapesBrandFact"
  FOR EACH ROW EXECUTE FUNCTION aidreamcapes_team_brand_owner_guard();
CREATE TRIGGER aidreamcapes_brand_fact_version_owner_guard BEFORE INSERT OR UPDATE ON "AidreamcapesBrandFactVersion"
  FOR EACH ROW EXECUTE FUNCTION aidreamcapes_team_brand_owner_guard();
