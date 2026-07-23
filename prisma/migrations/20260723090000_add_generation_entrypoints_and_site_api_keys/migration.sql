ALTER TABLE "GenerationJob"
  ADD COLUMN "entryPoint" TEXT NOT NULL DEFAULT 'customer_workspace',
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "requestHash" TEXT;

CREATE TABLE "SiteApiKey" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL,
  "keyPreview" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SiteApiKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SiteApiKey_keyHash_key" ON "SiteApiKey"("keyHash");
CREATE INDEX "SiteApiKey_siteId_enabled_idx" ON "SiteApiKey"("siteId", "enabled");
CREATE INDEX "SiteApiKey_siteId_createdAt_idx" ON "SiteApiKey"("siteId", "createdAt");

CREATE INDEX "GenerationJob_siteId_entryPoint_createdAt_idx" ON "GenerationJob"("siteId", "entryPoint", "createdAt");
CREATE INDEX "GenerationJob_siteId_idempotencyKey_idx" ON "GenerationJob"("siteId", "idempotencyKey");
CREATE UNIQUE INDEX "GenerationJob_siteId_customerId_idempotencyKey_key"
  ON "GenerationJob"("siteId", "customerId", "idempotencyKey");

ALTER TABLE "SiteApiKey"
  ADD CONSTRAINT "SiteApiKey_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
