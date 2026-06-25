CREATE TABLE "PlatformAsyncJob" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "actorId" TEXT,
  "metadata" JSONB NOT NULL,
  "result" JSONB,
  "error" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlatformAsyncJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlatformAsyncJob_actorId_createdAt_idx" ON "PlatformAsyncJob"("actorId", "createdAt");
CREATE INDEX "PlatformAsyncJob_kind_status_idx" ON "PlatformAsyncJob"("kind", "status");
CREATE INDEX "PlatformAsyncJob_expiresAt_idx" ON "PlatformAsyncJob"("expiresAt");
