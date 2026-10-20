-- 平台 AI 网关：模型通道级价格维护
-- 模型成为价格事实源；priceEnabled 默认关闭，现有站点计价链路逐字节不变。
ALTER TABLE "PlatformAiProvider"
  ADD COLUMN "priceEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "priceCredits" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "priceVideoDurations" JSONB,
  ADD COLUMN "priceVideoResolutions" JSONB,
  ADD COLUMN "priceImageQualities" JSONB,
  ADD COLUMN "priceImageResolutions" JSONB,
  ADD COLUMN "priceImageInput" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "priceVideoInput" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "priceVideoInputPerSecond" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "priceAudioInput" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "priceAudioInputPerSecond" INTEGER NOT NULL DEFAULT 0;
