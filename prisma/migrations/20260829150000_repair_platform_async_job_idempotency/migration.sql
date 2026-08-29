-- Some isolated local databases recorded the original async-job migration
-- before this column and index were present. Repair the live schema without
-- rewriting the historical migration.

ALTER TABLE "PlatformAsyncJob"
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformAsyncJob_kind_actorId_idempotencyKey_key"
  ON "PlatformAsyncJob"("kind", "actorId", "idempotencyKey");
