CREATE TABLE "AidreamcapesPublishingJob" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "renderId" TEXT NOT NULL,
  "target" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "scheduledAt" TIMESTAMPTZ(6),
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "capabilityState" TEXT NOT NULL DEFAULT 'not_configured',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "queuedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMPTZ(6),
  "cancelledAt" TIMESTAMPTZ(6),
  "retriedAt" TIMESTAMPTZ(6),
  CONSTRAINT "AidreamcapesPublishingJob_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AidreamcapesPublishingJob_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesPublishingJob_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesPublishingJob_site_scope_check" CHECK ("siteId" = 'site_aidreamcapes'),
  CONSTRAINT "AidreamcapesPublishingJob_target_check" CHECK ("target" IN ('tiktok', 'instagram', 'youtube')),
  CONSTRAINT "AidreamcapesPublishingJob_status_check" CHECK ("status" IN ('queued', 'scheduled', 'publishing', 'published', 'failed', 'cancelled')),
  CONSTRAINT "AidreamcapesPublishingJob_capability_check" CHECK ("capabilityState" IN ('not_configured', 'mock')),
  CONSTRAINT "AidreamcapesPublishingJob_schedule_check" CHECK ("status" <> 'scheduled' OR "scheduledAt" IS NOT NULL),
  CONSTRAINT "AidreamcapesPublishingJob_published_at_check" CHECK ("status" <> 'published' OR "publishedAt" IS NOT NULL),
  CONSTRAINT "AidreamcapesPublishingJob_cancelled_at_check" CHECK ("status" <> 'cancelled' OR "cancelledAt" IS NOT NULL),
  CONSTRAINT "AidreamcapesPublishingJob_attempt_check" CHECK ("attemptCount" >= 0),
  CONSTRAINT "AidreamcapesPublishingJob_idempotency_key_check" CHECK (length("idempotencyKey") BETWEEN 1 AND 128),
  CONSTRAINT "AidreamcapesPublishingJob_request_hash_check" CHECK ("requestHash" ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX "AidreamcapesPublishingJob_owner_idempotency_unique"
  ON "AidreamcapesPublishingJob" ("siteId", "customerId", "idempotencyKey");
CREATE INDEX "AidreamcapesPublishingJob_owner_created"
  ON "AidreamcapesPublishingJob" ("siteId", "customerId", "createdAt" DESC);
CREATE INDEX "AidreamcapesPublishingJob_due"
  ON "AidreamcapesPublishingJob" ("siteId", "status", "scheduledAt");
CREATE INDEX "AidreamcapesPublishingJob_task_render"
  ON "AidreamcapesPublishingJob" ("siteId", "customerId", "taskId", "renderId");

CREATE OR REPLACE FUNCTION aidreamcapes_publishing_job_owner_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."siteId" <> 'site_aidreamcapes' OR NOT EXISTS (
    SELECT 1 FROM "Customer" c WHERE c."id" = NEW."customerId" AND c."siteId" = 'site_aidreamcapes'
  ) THEN
    RAISE EXCEPTION 'aidreamcapes publishing job customer site mismatch';
  END IF;

  IF TG_OP = 'INSERT' AND NOT EXISTS (
    SELECT 1 FROM "AidreamcapesVideoTask" t
    WHERE t."id" = NEW."taskId" AND t."siteId" = 'site_aidreamcapes' AND t."customerId" = NEW."customerId"
      AND t."data"->>'status' = 'completed'
      AND t."data"->'video'->>'status' = 'done'
      AND t."data"->'video'->>'renderId' = NEW."renderId"
      AND t."data"->'video'->>'stale' = 'false'
      AND t."data"->>'storyboardStale' = 'false'
      AND COALESCE(t."data"->'video'->>'finalUrl', '') <> ''
  ) THEN
    RAISE EXCEPTION 'aidreamcapes publishing job requires the current completed customer output';
  END IF;

  IF TG_OP = 'UPDATE' AND (
    OLD."id" IS DISTINCT FROM NEW."id" OR OLD."siteId" IS DISTINCT FROM NEW."siteId" OR
    OLD."customerId" IS DISTINCT FROM NEW."customerId" OR OLD."taskId" IS DISTINCT FROM NEW."taskId" OR
    OLD."renderId" IS DISTINCT FROM NEW."renderId" OR OLD."target" IS DISTINCT FROM NEW."target" OR
    OLD."idempotencyKey" IS DISTINCT FROM NEW."idempotencyKey" OR OLD."requestHash" IS DISTINCT FROM NEW."requestHash"
  ) THEN
    RAISE EXCEPTION 'aidreamcapes publishing job owner and source are immutable';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."status" IS DISTINCT FROM NEW."status" AND NOT (
    (OLD."status" = 'queued' AND NEW."status" IN ('publishing', 'cancelled', 'failed')) OR
    (OLD."status" = 'scheduled' AND NEW."status" IN ('queued', 'cancelled', 'failed')) OR
    (OLD."status" = 'publishing' AND NEW."status" IN ('published', 'failed')) OR
    (OLD."status" = 'failed' AND NEW."status" IN ('queued', 'scheduled', 'cancelled'))
  ) THEN
    RAISE EXCEPTION 'aidreamcapes publishing job status transition is invalid';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER aidreamcapes_publishing_job_owner_guard
  BEFORE INSERT OR UPDATE ON "AidreamcapesPublishingJob"
  FOR EACH ROW EXECUTE FUNCTION aidreamcapes_publishing_job_owner_guard();
