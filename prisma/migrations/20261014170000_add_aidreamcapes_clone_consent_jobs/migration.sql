CREATE TABLE "AidreamcapesCloneConsent" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "workflow" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceAssetId" TEXT NOT NULL,
  "actorId" TEXT,
  "taskId" TEXT,
  "scope" TEXT NOT NULL,
  "rightsConfirmed" BOOLEAN NOT NULL DEFAULT FALSE,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'granted',
  "grantedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ(6),
  "revokedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AidreamcapesCloneConsent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AidreamcapesCloneConsent_site_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesCloneConsent_customer_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesCloneConsent_site_scope_check" CHECK ("siteId" = 'site_aidreamcapes'),
  CONSTRAINT "AidreamcapesCloneConsent_workflow_check" CHECK ("workflow" IN ('voice_twin', 'ad_reference') AND "scope" = "workflow"),
  CONSTRAINT "AidreamcapesCloneConsent_source_type_check" CHECK ("sourceType" IN ('customer_asset', 'custom_actor')),
  CONSTRAINT "AidreamcapesCloneConsent_revision_check" CHECK ("revision" > 0),
  CONSTRAINT "AidreamcapesCloneConsent_status_check" CHECK ("status" IN ('granted', 'revoked')),
  CONSTRAINT "AidreamcapesCloneConsent_rights_check" CHECK ("rightsConfirmed" = TRUE),
  CONSTRAINT "AidreamcapesCloneConsent_revocation_check" CHECK (("status" = 'granted' AND "revokedAt" IS NULL) OR ("status" = 'revoked' AND "revokedAt" IS NOT NULL)),
  CONSTRAINT "AidreamcapesCloneConsent_expiry_check" CHECK ("expiresAt" IS NULL OR "expiresAt" > "grantedAt"),
  CONSTRAINT "AidreamcapesCloneConsent_actor_check" CHECK (("sourceType" = 'custom_actor' AND "workflow" = 'voice_twin' AND "actorId" LIKE 'custom-%') OR ("sourceType" = 'customer_asset' AND "actorId" IS NULL)),
  CONSTRAINT "AidreamcapesCloneConsent_ad_task_check" CHECK ("workflow" <> 'ad_reference' OR "taskId" IS NOT NULL)
);

CREATE INDEX "AidreamcapesCloneConsent_owner_status"
  ON "AidreamcapesCloneConsent" ("siteId", "customerId", "status", "createdAt" DESC);
CREATE INDEX "AidreamcapesCloneConsent_owner_source"
  ON "AidreamcapesCloneConsent" ("siteId", "customerId", "sourceAssetId", "scope");

CREATE TABLE "AidreamcapesCloneJob" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "workflow" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceAssetId" TEXT NOT NULL,
  "actorId" TEXT,
  "taskId" TEXT,
  "consentId" TEXT NOT NULL,
  "consentRevision" INTEGER NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "revision" INTEGER NOT NULL DEFAULT 1,
  "capabilityState" TEXT NOT NULL DEFAULT 'mock_only',
  "result" JSONB,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "queuedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMPTZ(6),
  "cancelledAt" TIMESTAMPTZ(6),
  "deletedAt" TIMESTAMPTZ(6),
  CONSTRAINT "AidreamcapesCloneJob_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AidreamcapesCloneJob_site_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesCloneJob_customer_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesCloneJob_consent_fkey" FOREIGN KEY ("consentId") REFERENCES "AidreamcapesCloneConsent"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesCloneJob_site_scope_check" CHECK ("siteId" = 'site_aidreamcapes'),
  CONSTRAINT "AidreamcapesCloneJob_workflow_check" CHECK ("workflow" IN ('voice_twin', 'ad_reference')),
  CONSTRAINT "AidreamcapesCloneJob_source_type_check" CHECK ("sourceType" IN ('customer_asset', 'custom_actor')),
  CONSTRAINT "AidreamcapesCloneJob_status_check" CHECK ("status" IN ('queued', 'mock_complete', 'cancelled', 'deleted')),
  CONSTRAINT "AidreamcapesCloneJob_revision_check" CHECK ("revision" > 0 AND "consentRevision" > 0),
  CONSTRAINT "AidreamcapesCloneJob_capability_check" CHECK ("capabilityState" = 'mock_only'),
  CONSTRAINT "AidreamcapesCloneJob_idempotency_check" CHECK (length("idempotencyKey") BETWEEN 1 AND 128),
  CONSTRAINT "AidreamcapesCloneJob_request_hash_check" CHECK ("requestHash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "AidreamcapesCloneJob_timestamps_check" CHECK (
    ("status" <> 'mock_complete' OR "completedAt" IS NOT NULL) AND
    ("status" <> 'cancelled' OR "cancelledAt" IS NOT NULL) AND
    ("status" <> 'deleted' OR "deletedAt" IS NOT NULL) AND
    ("status" = 'deleted' OR "deletedAt" IS NULL)
  )
);

CREATE UNIQUE INDEX "AidreamcapesCloneJob_owner_idempotency"
  ON "AidreamcapesCloneJob" ("siteId", "customerId", "idempotencyKey");
CREATE INDEX "AidreamcapesCloneJob_owner_created"
  ON "AidreamcapesCloneJob" ("siteId", "customerId", "createdAt" DESC);
CREATE INDEX "AidreamcapesCloneJob_owner_status"
  ON "AidreamcapesCloneJob" ("siteId", "customerId", "status", "updatedAt" DESC);
CREATE INDEX "AidreamcapesCloneJob_owner_source"
  ON "AidreamcapesCloneJob" ("siteId", "customerId", "sourceAssetId");
CREATE INDEX "AidreamcapesCloneJob_owner_task"
  ON "AidreamcapesCloneJob" ("siteId", "customerId", "taskId");

CREATE OR REPLACE FUNCTION aidreamcapes_clone_consent_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  asset_row "AssetUpload"%ROWTYPE;
BEGIN
  IF NEW."siteId" <> 'site_aidreamcapes' OR NOT EXISTS (
    SELECT 1 FROM "Customer" c WHERE c."id" = NEW."customerId" AND c."siteId" = 'site_aidreamcapes'
  ) THEN
    RAISE EXCEPTION 'aidreamcapes clone consent customer site mismatch';
  END IF;
  IF NEW."rightsConfirmed" IS DISTINCT FROM TRUE OR NEW."scope" IS DISTINCT FROM NEW."workflow" THEN
    RAISE EXCEPTION 'aidreamcapes clone consent requires scoped rights confirmation';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW."status" <> 'granted' OR NEW."revision" <> 1 OR NEW."revokedAt" IS NOT NULL THEN
      RAISE EXCEPTION 'aidreamcapes clone consent must begin as a fresh grant';
    END IF;
    SELECT * INTO asset_row FROM "AssetUpload" a
      WHERE a."id" = NEW."sourceAssetId" AND a."siteId" = 'site_aidreamcapes'
        AND a."customerId" = NEW."customerId" AND a."deletedAt" IS NULL;
    IF NOT FOUND OR asset_row."storageKey" NOT LIKE ('sites/site_aidreamcapes/customers/' || NEW."customerId" || '/assets/%') THEN
      RAISE EXCEPTION 'aidreamcapes clone source asset is not owned';
    END IF;
    IF NEW."workflow" = 'voice_twin' AND (
      asset_row."role" NOT IN ('input', 'training_input') OR NOT (
        (lower(asset_row."mimeType") = 'audio/mpeg' AND lower(asset_row."storageKey") LIKE '%.mp3') OR
        (lower(asset_row."mimeType") = 'audio/mp4' AND (lower(asset_row."storageKey") LIKE '%.m4a' OR lower(asset_row."storageKey") LIKE '%.mp4')) OR
        (lower(asset_row."mimeType") IN ('audio/wav', 'audio/x-wav') AND lower(asset_row."storageKey") LIKE '%.wav') OR
        (lower(asset_row."mimeType") = 'audio/ogg' AND lower(asset_row."storageKey") LIKE '%.ogg') OR
        (lower(asset_row."mimeType") = 'audio/webm' AND lower(asset_row."storageKey") LIKE '%.webm') OR
        (lower(asset_row."mimeType") = 'audio/aac' AND lower(asset_row."storageKey") LIKE '%.aac') OR
        (lower(asset_row."mimeType") = 'audio/flac' AND lower(asset_row."storageKey") LIKE '%.flac')
      )
    ) THEN
      RAISE EXCEPTION 'aidreamcapes voice twin requires owned audio source media';
    END IF;
    IF NEW."workflow" = 'ad_reference' AND (NEW."sourceType" <> 'customer_asset' OR asset_row."role" NOT IN ('input', 'output') OR asset_row."mimeType" <> 'video/mp4' OR lower(asset_row."storageKey") NOT LIKE '%.mp4') THEN
      RAISE EXCEPTION 'aidreamcapes ad reference requires an owned video asset';
    END IF;
    IF NEW."sourceType" = 'custom_actor' AND NOT EXISTS (
      SELECT 1 FROM "AidreamcapesWorkspaceActor" a WHERE a."id" = NEW."actorId"
        AND a."siteId" = 'site_aidreamcapes' AND a."customerId" = NEW."customerId"
    ) THEN
      RAISE EXCEPTION 'aidreamcapes clone actor must be customer-owned custom actor';
    END IF;
    IF NEW."taskId" IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM "AidreamcapesVideoTask" t WHERE t."id" = NEW."taskId"
        AND t."siteId" = 'site_aidreamcapes' AND t."customerId" = NEW."customerId"
    ) THEN
      RAISE EXCEPTION 'aidreamcapes clone task link is not customer-owned';
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND (
    OLD."id" IS DISTINCT FROM NEW."id" OR OLD."siteId" IS DISTINCT FROM NEW."siteId" OR
    OLD."customerId" IS DISTINCT FROM NEW."customerId" OR OLD."workflow" IS DISTINCT FROM NEW."workflow" OR
    OLD."sourceType" IS DISTINCT FROM NEW."sourceType" OR OLD."sourceAssetId" IS DISTINCT FROM NEW."sourceAssetId" OR
    OLD."actorId" IS DISTINCT FROM NEW."actorId" OR OLD."taskId" IS DISTINCT FROM NEW."taskId" OR
    OLD."scope" IS DISTINCT FROM NEW."scope" OR OLD."rightsConfirmed" IS DISTINCT FROM NEW."rightsConfirmed" OR OLD."createdAt" IS DISTINCT FROM NEW."createdAt" OR
    OLD."grantedAt" IS DISTINCT FROM NEW."grantedAt" OR OLD."expiresAt" IS DISTINCT FROM NEW."expiresAt" OR
    NEW."revision" <> OLD."revision" + 1 OR OLD."status" <> 'granted' OR NEW."status" <> 'revoked' OR NEW."revokedAt" IS NULL
  ) THEN
    RAISE EXCEPTION 'aidreamcapes clone consent revocation must preserve grant audit';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER aidreamcapes_clone_consent_guard
  BEFORE INSERT OR UPDATE ON "AidreamcapesCloneConsent"
  FOR EACH ROW EXECUTE FUNCTION aidreamcapes_clone_consent_guard();

CREATE OR REPLACE FUNCTION aidreamcapes_clone_job_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  consent_row "AidreamcapesCloneConsent"%ROWTYPE;
BEGIN
  IF NEW."siteId" <> 'site_aidreamcapes' OR NOT EXISTS (
    SELECT 1 FROM "Customer" c WHERE c."id" = NEW."customerId" AND c."siteId" = 'site_aidreamcapes'
  ) THEN
    RAISE EXCEPTION 'aidreamcapes clone job customer site mismatch';
  END IF;
  IF TG_OP = 'INSERT' OR NEW."status" = 'mock_complete' THEN
    IF TG_OP = 'INSERT' AND (NEW."status" <> 'queued' OR NEW."revision" <> 1) THEN
      RAISE EXCEPTION 'aidreamcapes clone jobs must begin queued at revision one';
    END IF;
    IF TG_OP = 'INSERT' AND (NEW."result" IS NOT NULL OR NEW."completedAt" IS NOT NULL OR NEW."cancelledAt" IS NOT NULL OR NEW."deletedAt" IS NOT NULL) THEN
      RAISE EXCEPTION 'aidreamcapes clone jobs cannot start with terminal audit state';
    END IF;
    SELECT * INTO consent_row FROM "AidreamcapesCloneConsent" c
      WHERE c."id" = NEW."consentId" AND c."siteId" = 'site_aidreamcapes'
        AND c."customerId" = NEW."customerId" AND c."workflow" = NEW."workflow"
        AND c."sourceType" = NEW."sourceType" AND c."sourceAssetId" = NEW."sourceAssetId"
        AND c."actorId" IS NOT DISTINCT FROM NEW."actorId" AND c."taskId" IS NOT DISTINCT FROM NEW."taskId"
        AND c."scope" = NEW."workflow" AND c."rightsConfirmed" = TRUE
        AND c."revision" = NEW."consentRevision" AND c."status" = 'granted'
        AND (c."expiresAt" IS NULL OR c."expiresAt" > now());
    IF NOT FOUND THEN
      RAISE EXCEPTION 'aidreamcapes clone job requires current owner consent';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM "AssetUpload" a WHERE a."id" = NEW."sourceAssetId"
        AND a."siteId" = 'site_aidreamcapes' AND a."customerId" = NEW."customerId"
        AND a."deletedAt" IS NULL
        AND a."storageKey" LIKE ('sites/site_aidreamcapes/customers/' || NEW."customerId" || '/assets/%')
        AND ((NEW."workflow" = 'voice_twin' AND a."role" IN ('input', 'training_input') AND (
               (lower(a."mimeType") = 'audio/mpeg' AND lower(a."storageKey") LIKE '%.mp3') OR
               (lower(a."mimeType") = 'audio/mp4' AND (lower(a."storageKey") LIKE '%.m4a' OR lower(a."storageKey") LIKE '%.mp4')) OR
               (lower(a."mimeType") IN ('audio/wav', 'audio/x-wav') AND lower(a."storageKey") LIKE '%.wav') OR
               (lower(a."mimeType") = 'audio/ogg' AND lower(a."storageKey") LIKE '%.ogg') OR
               (lower(a."mimeType") = 'audio/webm' AND lower(a."storageKey") LIKE '%.webm') OR
               (lower(a."mimeType") = 'audio/aac' AND lower(a."storageKey") LIKE '%.aac') OR
               (lower(a."mimeType") = 'audio/flac' AND lower(a."storageKey") LIKE '%.flac')) OR
             (NEW."workflow" = 'ad_reference' AND a."role" IN ('input', 'output') AND a."mimeType" = 'video/mp4' AND lower(a."storageKey") LIKE '%.mp4')))
    ) THEN
      RAISE EXCEPTION 'aidreamcapes clone job source asset is not currently owned';
    END IF;
    IF NEW."sourceType" = 'custom_actor' AND NOT EXISTS (
      SELECT 1 FROM "AidreamcapesWorkspaceActor" a WHERE a."id" = NEW."actorId"
        AND a."siteId" = 'site_aidreamcapes' AND a."customerId" = NEW."customerId"
    ) THEN
      RAISE EXCEPTION 'aidreamcapes clone job actor is no longer customer-owned';
    END IF;
    IF NEW."taskId" IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM "AidreamcapesVideoTask" t WHERE t."id" = NEW."taskId"
        AND t."siteId" = 'site_aidreamcapes' AND t."customerId" = NEW."customerId"
    ) THEN
      RAISE EXCEPTION 'aidreamcapes clone job task link is not customer-owned';
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND (
    OLD."id" IS DISTINCT FROM NEW."id" OR OLD."siteId" IS DISTINCT FROM NEW."siteId" OR
    OLD."customerId" IS DISTINCT FROM NEW."customerId" OR OLD."workflow" IS DISTINCT FROM NEW."workflow" OR
    OLD."sourceType" IS DISTINCT FROM NEW."sourceType" OR OLD."sourceAssetId" IS DISTINCT FROM NEW."sourceAssetId" OR
    OLD."actorId" IS DISTINCT FROM NEW."actorId" OR OLD."taskId" IS DISTINCT FROM NEW."taskId" OR
    OLD."consentId" IS DISTINCT FROM NEW."consentId" OR OLD."consentRevision" IS DISTINCT FROM NEW."consentRevision" OR
    OLD."idempotencyKey" IS DISTINCT FROM NEW."idempotencyKey" OR OLD."requestHash" IS DISTINCT FROM NEW."requestHash" OR
    OLD."createdAt" IS DISTINCT FROM NEW."createdAt" OR OLD."queuedAt" IS DISTINCT FROM NEW."queuedAt" OR
    NEW."revision" <> OLD."revision" + 1 OR OLD."capabilityState" IS DISTINCT FROM 'mock_only' OR NEW."capabilityState" IS DISTINCT FROM 'mock_only' OR
    NOT ((OLD."status" = 'queued' AND NEW."status" IN ('mock_complete', 'cancelled', 'deleted')) OR
         (OLD."status" IN ('mock_complete', 'cancelled') AND NEW."status" = 'deleted'))
  ) THEN
    RAISE EXCEPTION 'aidreamcapes clone job transition is invalid';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW."status" IN ('cancelled', 'deleted') AND (
    OLD."result" IS DISTINCT FROM NEW."result" OR OLD."completedAt" IS DISTINCT FROM NEW."completedAt" OR
    (NEW."status" = 'cancelled' AND (NEW."cancelledAt" IS NULL OR NEW."deletedAt" IS NOT NULL)) OR
    (NEW."status" = 'deleted' AND (NEW."deletedAt" IS NULL OR OLD."deletedAt" IS NOT NULL OR OLD."cancelledAt" IS DISTINCT FROM NEW."cancelledAt"))
  ) THEN
    RAISE EXCEPTION 'aidreamcapes clone deletion and cancellation must retain audit state';
  END IF;
  IF NEW."status" = 'mock_complete' AND (
    NEW."result" IS NULL OR NEW."result"->>'capabilityState' IS DISTINCT FROM 'mock_only' OR
    NEW."result"->>'productionReady' IS DISTINCT FROM 'false' OR
    NEW."result"->>'sourceAssetId' IS DISTINCT FROM NEW."sourceAssetId" OR NEW."result"->>'output' IS DISTINCT FROM 'null' OR
    NEW."result"->>'mediaRead' IS DISTINCT FROM 'false' OR
    (NEW."workflow" = 'voice_twin' AND NEW."result"->>'adapter' IS DISTINCT FROM 'voice_twin_mock_trainer') OR
    (NEW."workflow" = 'ad_reference' AND (NEW."result"->>'adapter' IS DISTINCT FROM 'ad_reference_mock_parser' OR NEW."result"->>'remoteFetch' IS DISTINCT FROM 'false'))
  ) THEN
    RAISE EXCEPTION 'aidreamcapes clone job mock result is invalid';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER aidreamcapes_clone_job_guard
  BEFORE INSERT OR UPDATE ON "AidreamcapesCloneJob"
  FOR EACH ROW EXECUTE FUNCTION aidreamcapes_clone_job_guard();
