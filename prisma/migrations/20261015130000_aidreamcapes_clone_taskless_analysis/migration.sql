-- Ad references may be analyzed before a destination video draft exists.
-- Existing task associations and all consent, owner and audit guards stay intact.
ALTER TABLE "AidreamcapesCloneConsent"
  DROP CONSTRAINT IF EXISTS "AidreamcapesCloneConsent_ad_task_check";

-- JSON null must be compared as jsonb. ->> returns SQL NULL and would reject
-- every valid mock result with output:null. Preserve all other audit guards.
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
    NEW."result"->>'sourceAssetId' IS DISTINCT FROM NEW."sourceAssetId" OR NEW."result"->'output' IS DISTINCT FROM 'null'::jsonb OR
    NEW."result"->>'mediaRead' IS DISTINCT FROM 'false' OR
    (NEW."workflow" = 'voice_twin' AND NEW."result"->>'adapter' IS DISTINCT FROM 'voice_twin_mock_trainer') OR
    (NEW."workflow" = 'ad_reference' AND (NEW."result"->>'adapter' IS DISTINCT FROM 'ad_reference_mock_parser' OR NEW."result"->>'remoteFetch' IS DISTINCT FROM 'false'))
  ) THEN
    RAISE EXCEPTION 'aidreamcapes clone job mock result is invalid';
  END IF;
  RETURN NEW;
END;
$$;
