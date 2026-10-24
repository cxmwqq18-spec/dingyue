-- 平台 AI 网关：视频通道可维护参考素材上限与分辨率档位
-- 新增列均有默认值，现有供应商行为不变；参考计数上限 0 表示不支持该模态。

ALTER TABLE "PlatformAiProvider"
  ADD COLUMN "maxVideoInputs" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "maxAudioInputs" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "videoResolutions" TEXT[] NOT NULL DEFAULT ARRAY['480p', '720p', '1080p']::TEXT[];
