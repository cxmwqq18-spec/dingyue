CREATE TABLE "ThemePublishApproval" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "manifestHash" TEXT NOT NULL,
  "approvedBy" TEXT NOT NULL,
  "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'approved',
  "consumedAt" TIMESTAMP(3),
  "consumedPublicationId" TEXT,
  CONSTRAINT "ThemePublishApproval_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ThemePublishApprovalItem" (
  "id" TEXT NOT NULL,
  "approvalId" TEXT NOT NULL,
  "objectType" TEXT NOT NULL,
  "objectId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "revision" TEXT NOT NULL,
  "etag" TEXT,
  "valueHash" TEXT NOT NULL,
  CONSTRAINT "ThemePublishApprovalItem_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ThemePublication" ADD COLUMN "approvalId" TEXT;

CREATE UNIQUE INDEX "ThemePublishApproval_consumedPublicationId_key"
  ON "ThemePublishApproval"("consumedPublicationId");
CREATE INDEX "ThemePublishApproval_siteId_status_approvedAt_idx"
  ON "ThemePublishApproval"("siteId", "status", "approvedAt");
CREATE INDEX "ThemePublishApproval_siteId_manifestHash_idx"
  ON "ThemePublishApproval"("siteId", "manifestHash");
CREATE UNIQUE INDEX "ThemePublishApprovalItem_approvalId_objectType_objectId_key"
  ON "ThemePublishApprovalItem"("approvalId", "objectType", "objectId");
CREATE INDEX "ThemePublishApprovalItem_approvalId_objectType_idx"
  ON "ThemePublishApprovalItem"("approvalId", "objectType");
CREATE UNIQUE INDEX "ThemePublication_approvalId_key"
  ON "ThemePublication"("approvalId");

ALTER TABLE "ThemePublishApproval"
  ADD CONSTRAINT "ThemePublishApproval_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ThemePublishApprovalItem"
  ADD CONSTRAINT "ThemePublishApprovalItem_approvalId_fkey"
  FOREIGN KEY ("approvalId") REFERENCES "ThemePublishApproval"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ThemePublication"
  ADD CONSTRAINT "ThemePublication_approvalId_fkey"
  FOREIGN KEY ("approvalId") REFERENCES "ThemePublishApproval"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
