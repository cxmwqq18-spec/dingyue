CREATE TABLE "ContentSyncBaseline" (
  "id" TEXT NOT NULL,
  "target" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityKey" TEXT NOT NULL,
  "fieldPath" TEXT NOT NULL,
  "valueHash" TEXT NOT NULL,
  "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContentSyncBaseline_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ContentSyncBaseline_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ContentSyncBaseline_target_siteId_entityType_entityKey_fieldPath_key"
  ON "ContentSyncBaseline"("target", "siteId", "entityType", "entityKey", "fieldPath");
CREATE INDEX "ContentSyncBaseline_target_siteId_entityType_idx"
  ON "ContentSyncBaseline"("target", "siteId", "entityType");
