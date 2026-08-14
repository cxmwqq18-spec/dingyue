CREATE TABLE "CustomerProfile" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "avatarAssetId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CustomerProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerAssetDownload" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "jobId" TEXT,
  "albumId" TEXT,
  "source" TEXT NOT NULL DEFAULT 'asset',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CustomerAssetDownload_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerProfile_customerId_key" ON "CustomerProfile"("customerId");
CREATE INDEX "CustomerProfile_siteId_idx" ON "CustomerProfile"("siteId");
CREATE INDEX "CustomerProfile_siteId_avatarAssetId_idx" ON "CustomerProfile"("siteId", "avatarAssetId");

CREATE INDEX "CustomerAssetDownload_siteId_customerId_createdAt_idx" ON "CustomerAssetDownload"("siteId", "customerId", "createdAt");
CREATE INDEX "CustomerAssetDownload_siteId_customerId_assetId_createdAt_idx" ON "CustomerAssetDownload"("siteId", "customerId", "assetId", "createdAt");
CREATE INDEX "CustomerAssetDownload_siteId_assetId_idx" ON "CustomerAssetDownload"("siteId", "assetId");
CREATE INDEX "CustomerAssetDownload_siteId_jobId_idx" ON "CustomerAssetDownload"("siteId", "jobId");
CREATE INDEX "CustomerAssetDownload_siteId_albumId_idx" ON "CustomerAssetDownload"("siteId", "albumId");

ALTER TABLE "CustomerProfile"
  ADD CONSTRAINT "CustomerProfile_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerProfile"
  ADD CONSTRAINT "CustomerProfile_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerProfile"
  ADD CONSTRAINT "CustomerProfile_avatarAssetId_fkey"
  FOREIGN KEY ("avatarAssetId") REFERENCES "AssetUpload"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CustomerAssetDownload"
  ADD CONSTRAINT "CustomerAssetDownload_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerAssetDownload"
  ADD CONSTRAINT "CustomerAssetDownload_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerAssetDownload"
  ADD CONSTRAINT "CustomerAssetDownload_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "AssetUpload"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerAssetDownload"
  ADD CONSTRAINT "CustomerAssetDownload_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "GenerationJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CustomerAssetDownload"
  ADD CONSTRAINT "CustomerAssetDownload_albumId_fkey"
  FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE SET NULL ON UPDATE CASCADE;
