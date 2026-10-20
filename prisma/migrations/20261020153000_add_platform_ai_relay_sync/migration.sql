-- 中转平台（relay）连接与供应商模型同步归属
-- 关系数据唯一事实源：relay 负责上游连接与密钥，provider 行负责具体模型的派发配置。
ALTER TABLE "PlatformAiProvider"
  ADD COLUMN "relayId" TEXT,
  ADD COLUMN "upstreamModelId" TEXT,
  ADD COLUMN "syncState" TEXT NOT NULL DEFAULT 'manual';

CREATE TABLE "PlatformAiRelay" (
  "id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "baseUrl" TEXT NOT NULL,
  "apiKey" TEXT,
  "protocol" TEXT NOT NULL DEFAULT 'newapi',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "lastSyncedAt" TIMESTAMP(3),
  "lastSyncStatus" TEXT,
  "lastSyncError" TEXT,
  "lastSyncModelCount" INTEGER NOT NULL DEFAULT 0,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlatformAiRelay_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlatformAiRelay_enabled_idx" ON "PlatformAiRelay"("enabled");

CREATE INDEX "PlatformAiProvider_relayId_upstreamModelId_idx" ON "PlatformAiProvider"("relayId", "upstreamModelId");

CREATE UNIQUE INDEX "PlatformAiProvider_relayId_upstreamModelId_key" ON "PlatformAiProvider"("relayId", "upstreamModelId");

ALTER TABLE "PlatformAiProvider"
  ADD CONSTRAINT "PlatformAiProvider_relayId_fkey"
  FOREIGN KEY ("relayId") REFERENCES "PlatformAiRelay"("id") ON DELETE SET NULL ON UPDATE CASCADE;
