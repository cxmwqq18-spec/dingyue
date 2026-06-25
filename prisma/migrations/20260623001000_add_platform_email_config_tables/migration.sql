CREATE TABLE "PlatformEmailConfig" (
  "id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'resend',
  "apiKey" TEXT,
  "fromEmail" TEXT,
  "replyTo" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlatformEmailConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SiteEmailConfigAssignment" (
  "siteId" TEXT NOT NULL,
  "configId" TEXT NOT NULL,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SiteEmailConfigAssignment_pkey" PRIMARY KEY ("siteId")
);

CREATE INDEX "PlatformEmailConfig_isDefault_idx" ON "PlatformEmailConfig"("isDefault");
CREATE INDEX "SiteEmailConfigAssignment_configId_idx" ON "SiteEmailConfigAssignment"("configId");

ALTER TABLE "SiteEmailConfigAssignment"
  ADD CONSTRAINT "SiteEmailConfigAssignment_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SiteEmailConfigAssignment"
  ADD CONSTRAINT "SiteEmailConfigAssignment_configId_fkey"
  FOREIGN KEY ("configId") REFERENCES "PlatformEmailConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
