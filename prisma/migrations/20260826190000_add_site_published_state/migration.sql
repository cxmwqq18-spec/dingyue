-- Staged only. Do not apply to local, remote, or production until every
-- tenant has a verified external pre-change backup and an approved current
-- payload/readback record.
CREATE TABLE "SitePublishedState" (
  "siteId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "contentHash" TEXT NOT NULL,
  "revision" TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL,
  "publishedBy" TEXT NOT NULL,
  CONSTRAINT "SitePublishedState_pkey" PRIMARY KEY ("siteId"),
  CONSTRAINT "SitePublishedState_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "SitePublishedState_contentHash_idx"
  ON "SitePublishedState"("contentHash");

ALTER TABLE "ThemePublishApproval"
  ADD COLUMN "requestedBy" TEXT,
  ALTER COLUMN "approvedBy" DROP NOT NULL,
  ALTER COLUMN "approvedAt" DROP NOT NULL,
  ALTER COLUMN "status" SET DEFAULT 'pending';
