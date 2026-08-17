CREATE TABLE "DeploymentRelease" (
  "id" TEXT NOT NULL,
  "releaseId" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "codeCommit" TEXT NOT NULL,
  "manifestHash" TEXT NOT NULL,
  "schemaMigrations" JSONB NOT NULL,
  "contentMigrations" JSONB NOT NULL,
  "scope" JSONB NOT NULL,
  "status" TEXT NOT NULL,
  "details" JSONB,
  "appliedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DeploymentRelease_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeploymentRelease_environment_siteId_releaseId_key"
  ON "DeploymentRelease"("environment", "siteId", "releaseId");

CREATE INDEX "DeploymentRelease_environment_siteId_appliedAt_idx"
  ON "DeploymentRelease"("environment", "siteId", "appliedAt");

CREATE INDEX "DeploymentRelease_manifestHash_idx"
  ON "DeploymentRelease"("manifestHash");
