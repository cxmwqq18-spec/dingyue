CREATE TABLE "AidreamcapesMusicGenerationJob" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "taskRevision" INTEGER NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "durationSeconds" INTEGER NOT NULL,
  "tempoBpm" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "revision" INTEGER NOT NULL DEFAULT 1,
  "capabilityState" TEXT NOT NULL DEFAULT 'mock_only',
  "rightsStatus" TEXT NOT NULL DEFAULT 'unlicensed',
  "testOnly" BOOLEAN NOT NULL DEFAULT TRUE,
  "fixtureKey" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "queuedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMPTZ(6),
  "cancelledAt" TIMESTAMPTZ(6),
  CONSTRAINT "AidreamcapesMusicGenerationJob_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AidreamcapesMusicGenerationJob_site_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesMusicGenerationJob_customer_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesMusicGenerationJob_task_fkey" FOREIGN KEY ("taskId") REFERENCES "AidreamcapesVideoTask"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesMusicGenerationJob_site_scope_check" CHECK ("siteId" = 'site_aidreamcapes'),
  CONSTRAINT "AidreamcapesMusicGenerationJob_status_check" CHECK ("status" IN ('queued', 'mock_complete', 'cancelled')),
  CONSTRAINT "AidreamcapesMusicGenerationJob_revision_check" CHECK ("revision" > 0 AND "taskRevision" > 0),
  CONSTRAINT "AidreamcapesMusicGenerationJob_capability_check" CHECK ("capabilityState" = 'mock_only'),
  CONSTRAINT "AidreamcapesMusicGenerationJob_rights_check" CHECK ("rightsStatus" = 'unlicensed' AND "testOnly" = TRUE),
  CONSTRAINT "AidreamcapesMusicGenerationJob_idempotency_check" CHECK (length("idempotencyKey") BETWEEN 1 AND 128),
  CONSTRAINT "AidreamcapesMusicGenerationJob_request_hash_check" CHECK ("requestHash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "AidreamcapesMusicGenerationJob_prompt_check" CHECK (length(btrim("prompt")) BETWEEN 1 AND 500 AND "prompt" !~ '[[:cntrl:]]'),
  CONSTRAINT "AidreamcapesMusicGenerationJob_bounds_check" CHECK ("durationSeconds" BETWEEN 5 AND 30 AND "tempoBpm" BETWEEN 40 AND 200),
  CONSTRAINT "AidreamcapesMusicGenerationJob_state_check" CHECK (
    ("status" = 'queued' AND "fixtureKey" IS NULL AND "completedAt" IS NULL AND "cancelledAt" IS NULL) OR
    ("status" = 'mock_complete' AND "fixtureKey" IS NOT NULL AND "completedAt" IS NOT NULL AND "cancelledAt" IS NULL) OR
    ("status" = 'cancelled' AND "fixtureKey" IS NULL AND "completedAt" IS NULL AND "cancelledAt" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "AidreamcapesMusicGenerationJob_owner_idempotency"
  ON "AidreamcapesMusicGenerationJob" ("siteId", "customerId", "idempotencyKey");
CREATE INDEX "AidreamcapesMusicGenerationJob_owner_created"
  ON "AidreamcapesMusicGenerationJob" ("siteId", "customerId", "createdAt" DESC);
CREATE INDEX "AidreamcapesMusicGenerationJob_owner_status"
  ON "AidreamcapesMusicGenerationJob" ("siteId", "customerId", "status", "updatedAt" DESC);
CREATE INDEX "AidreamcapesMusicGenerationJob_owner_task"
  ON "AidreamcapesMusicGenerationJob" ("siteId", "customerId", "taskId", "createdAt" DESC);

CREATE FUNCTION aidreamcapes_music_generation_job_guard() RETURNS trigger AS $$
BEGIN
  IF NEW."siteId" <> 'site_aidreamcapes' OR NOT EXISTS (
    SELECT 1 FROM "Customer" c WHERE c."id" = NEW."customerId" AND c."siteId" = 'site_aidreamcapes'
  ) OR NOT EXISTS (
    SELECT 1 FROM "AidreamcapesVideoTask" t WHERE t."id" = NEW."taskId"
      AND t."siteId" = 'site_aidreamcapes' AND t."customerId" = NEW."customerId"
  ) THEN
    RAISE EXCEPTION 'Aidreamcapes music generation job owner or task mismatch';
  END IF;

  IF NEW."capabilityState" <> 'mock_only' OR NEW."rightsStatus" <> 'unlicensed' OR NEW."testOnly" IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Aidreamcapes generated music must remain unlicensed and mock-only';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW."status" <> 'queued' OR NEW."revision" <> 1 OR NEW."fixtureKey" IS NOT NULL OR
      NEW."completedAt" IS NOT NULL OR NEW."cancelledAt" IS NOT NULL OR
      NOT EXISTS (
        SELECT 1 FROM "AidreamcapesVideoTask" t WHERE t."id" = NEW."taskId"
          AND t."siteId" = 'site_aidreamcapes' AND t."customerId" = NEW."customerId"
          AND t."revision" = NEW."taskRevision"
      ) THEN
      RAISE EXCEPTION 'Aidreamcapes music generation jobs must start queued against the current task revision';
    END IF;
  ELSE
    IF OLD."id" IS DISTINCT FROM NEW."id" OR OLD."siteId" IS DISTINCT FROM NEW."siteId" OR
      OLD."customerId" IS DISTINCT FROM NEW."customerId" OR OLD."taskId" IS DISTINCT FROM NEW."taskId" OR
      OLD."taskRevision" IS DISTINCT FROM NEW."taskRevision" OR OLD."idempotencyKey" IS DISTINCT FROM NEW."idempotencyKey" OR
      OLD."requestHash" IS DISTINCT FROM NEW."requestHash" OR OLD."prompt" IS DISTINCT FROM NEW."prompt" OR
      OLD."durationSeconds" IS DISTINCT FROM NEW."durationSeconds" OR OLD."tempoBpm" IS DISTINCT FROM NEW."tempoBpm" OR
      OLD."createdAt" IS DISTINCT FROM NEW."createdAt" OR OLD."queuedAt" IS DISTINCT FROM NEW."queuedAt" OR
      NEW."revision" <> OLD."revision" + 1 OR NOT (OLD."status" = 'queued' AND NEW."status" IN ('mock_complete', 'cancelled')) THEN
      RAISE EXCEPTION 'Aidreamcapes music generation job transition is invalid';
    END IF;
    IF NEW."status" = 'mock_complete' AND (
      NEW."fixtureKey" IS DISTINCT FROM ('mock-music/' || NEW."customerId" || '/' || NEW."taskId" || '/' || NEW."id" || '.wav') OR
      NEW."completedAt" IS NULL OR NEW."cancelledAt" IS NOT NULL OR NOT EXISTS (
        SELECT 1 FROM "AidreamcapesVideoTask" t WHERE t."id" = NEW."taskId"
          AND t."siteId" = 'site_aidreamcapes' AND t."customerId" = NEW."customerId"
          AND t."revision" = NEW."taskRevision"
      )
    ) THEN
      RAISE EXCEPTION 'Aidreamcapes mock music completion must retain its task revision and local fixture key';
    END IF;
    IF NEW."status" = 'cancelled' AND (NEW."fixtureKey" IS NOT NULL OR NEW."completedAt" IS NOT NULL OR NEW."cancelledAt" IS NULL) THEN
      RAISE EXCEPTION 'Aidreamcapes music cancellation cannot create or retain generated media';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AidreamcapesMusicGenerationJob_guard"
BEFORE INSERT OR UPDATE ON "AidreamcapesMusicGenerationJob"
FOR EACH ROW EXECUTE FUNCTION aidreamcapes_music_generation_job_guard();
