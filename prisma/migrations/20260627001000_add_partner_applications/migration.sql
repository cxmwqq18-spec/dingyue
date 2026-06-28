CREATE TABLE "PartnerApplication" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "company" TEXT,
  "website" TEXT,
  "socialLinks" JSONB,
  "audience" TEXT,
  "cadence" TEXT,
  "campaignIdeas" TEXT,
  "message" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "source" TEXT,
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PartnerApplication_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PartnerApplication_siteId_status_idx" ON "PartnerApplication"("siteId", "status");
CREATE INDEX "PartnerApplication_siteId_createdAt_idx" ON "PartnerApplication"("siteId", "createdAt");
CREATE INDEX "PartnerApplication_siteId_status_createdAt_idx" ON "PartnerApplication"("siteId", "status", "createdAt");
CREATE INDEX "PartnerApplication_siteId_email_idx" ON "PartnerApplication"("siteId", "email");

ALTER TABLE "PartnerApplication"
  ADD CONSTRAINT "PartnerApplication_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
