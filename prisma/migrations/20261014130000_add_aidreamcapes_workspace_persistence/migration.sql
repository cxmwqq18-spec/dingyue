CREATE TABLE IF NOT EXISTS "AidreamcapesVideoTask" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "data" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AidreamcapesVideoTask_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AidreamcapesVideoTask_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesVideoTask_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesVideoTask_site_scope_check" CHECK ("siteId" = 'site_aidreamcapes'),
  CONSTRAINT "AidreamcapesVideoTask_data_owner_check" CHECK (
    COALESCE("data"->>'siteId', '') = "siteId" AND
    COALESCE("data"->>'customerId', '') = "customerId" AND
    COALESCE("data"->>'taskId', '') = "id"
  ),
  CONSTRAINT "AidreamcapesVideoTask_revision_check" CHECK ("revision" > 0),
  CONSTRAINT "AidreamcapesVideoTask_revision_payload_check" CHECK (
    CASE
      WHEN jsonb_typeof("data"->'revision') = 'number'
        THEN ("data"->>'revision')::INTEGER = "revision"
      ELSE FALSE
    END
  ),
  CONSTRAINT "AidreamcapesVideoTask_status_check" CHECK (
    COALESCE("data"->>'status', '') IN ('draft', 'storyboard_ready', 'rendering', 'completed', 'failed')
  )
);

CREATE INDEX IF NOT EXISTS "AidreamcapesVideoTask_owner_updated"
  ON "AidreamcapesVideoTask" ("siteId", "customerId", "updatedAt" DESC);

CREATE TABLE IF NOT EXISTS "AidreamcapesWorkspaceActor" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AidreamcapesWorkspaceActor_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AidreamcapesWorkspaceActor_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesWorkspaceActor_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesWorkspaceActor_site_scope_check" CHECK ("siteId" = 'site_aidreamcapes'),
  CONSTRAINT "AidreamcapesWorkspaceActor_data_id_check" CHECK (COALESCE("data"->>'actorId', '') = "id")
);

-- Also make the constraints explicit when this migration follows the guarded
-- local setup script, which may have created these tables before migrations.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"AidreamcapesVideoTask"'::regclass AND conname = 'AidreamcapesVideoTask_site_scope_check') THEN
    ALTER TABLE "AidreamcapesVideoTask" ADD CONSTRAINT "AidreamcapesVideoTask_site_scope_check" CHECK ("siteId" = 'site_aidreamcapes');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"AidreamcapesVideoTask"'::regclass AND conname = 'AidreamcapesVideoTask_data_owner_check') THEN
    ALTER TABLE "AidreamcapesVideoTask" ADD CONSTRAINT "AidreamcapesVideoTask_data_owner_check" CHECK (
      COALESCE("data"->>'siteId', '') = "siteId" AND
      COALESCE("data"->>'customerId', '') = "customerId" AND
      COALESCE("data"->>'taskId', '') = "id"
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"AidreamcapesVideoTask"'::regclass AND conname = 'AidreamcapesVideoTask_revision_check') THEN
    ALTER TABLE "AidreamcapesVideoTask" ADD CONSTRAINT "AidreamcapesVideoTask_revision_check" CHECK ("revision" > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"AidreamcapesVideoTask"'::regclass AND conname = 'AidreamcapesVideoTask_revision_payload_check') THEN
    ALTER TABLE "AidreamcapesVideoTask" ADD CONSTRAINT "AidreamcapesVideoTask_revision_payload_check" CHECK (
      CASE
        WHEN jsonb_typeof("data"->'revision') = 'number'
          THEN ("data"->>'revision')::INTEGER = "revision"
        ELSE FALSE
      END
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"AidreamcapesVideoTask"'::regclass AND conname = 'AidreamcapesVideoTask_status_check') THEN
    ALTER TABLE "AidreamcapesVideoTask" ADD CONSTRAINT "AidreamcapesVideoTask_status_check" CHECK (
      COALESCE("data"->>'status', '') IN ('draft', 'storyboard_ready', 'rendering', 'completed', 'failed')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"AidreamcapesWorkspaceActor"'::regclass AND conname = 'AidreamcapesWorkspaceActor_site_scope_check') THEN
    ALTER TABLE "AidreamcapesWorkspaceActor" ADD CONSTRAINT "AidreamcapesWorkspaceActor_site_scope_check" CHECK ("siteId" = 'site_aidreamcapes');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"AidreamcapesWorkspaceActor"'::regclass AND conname = 'AidreamcapesWorkspaceActor_data_id_check') THEN
    ALTER TABLE "AidreamcapesWorkspaceActor" ADD CONSTRAINT "AidreamcapesWorkspaceActor_data_id_check" CHECK (COALESCE("data"->>'actorId', '') = "id");
  END IF;
END;
$$;

DROP INDEX IF EXISTS "AidreamcapesWorkspaceActor_owner";
CREATE INDEX "AidreamcapesWorkspaceActor_owner"
  ON "AidreamcapesWorkspaceActor" ("siteId", "customerId", "createdAt" DESC);

CREATE OR REPLACE FUNCTION aidreamcapes_video_task_owner_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."siteId" <> 'site_aidreamcapes' OR NOT EXISTS (
    SELECT 1 FROM "Customer"
    WHERE "id" = NEW."customerId" AND "siteId" = 'site_aidreamcapes'
  ) THEN
    RAISE EXCEPTION 'aivideosugc customer site mismatch';
  END IF;

  IF TG_OP = 'UPDATE' AND (
    OLD."siteId" <> NEW."siteId" OR
    OLD."customerId" <> NEW."customerId" OR
    OLD."id" <> NEW."id"
  ) THEN
    RAISE EXCEPTION 'aivideosugc task ownership is immutable';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aidreamcapes_video_task_owner ON "AidreamcapesVideoTask";
CREATE TRIGGER aidreamcapes_video_task_owner
  BEFORE INSERT OR UPDATE ON "AidreamcapesVideoTask"
  FOR EACH ROW EXECUTE FUNCTION aidreamcapes_video_task_owner_guard();

DROP TRIGGER IF EXISTS aidreamcapes_workspace_actor_owner ON "AidreamcapesWorkspaceActor";
CREATE TRIGGER aidreamcapes_workspace_actor_owner
  BEFORE INSERT OR UPDATE ON "AidreamcapesWorkspaceActor"
  FOR EACH ROW EXECUTE FUNCTION aidreamcapes_video_task_owner_guard();

COMMENT ON COLUMN "AidreamcapesVideoTask"."data" IS
  'WorkspaceTask JSON, including task status and its image, audio, and output asset references.';
COMMENT ON COLUMN "AidreamcapesWorkspaceActor"."data" IS
  'ActorAsset JSON, including customer-owned or catalog image and voice-reference URLs.';
