ALTER TABLE "PlatformAiProvider"
  ADD COLUMN "imageAspectRatio" TEXT NOT NULL DEFAULT 'auto',
  ADD COLUMN "imageResolution" TEXT NOT NULL DEFAULT '1K',
  ADD COLUMN "imageQuality" TEXT NOT NULL DEFAULT 'low',
  ADD COLUMN "imageOutputFormat" TEXT NOT NULL DEFAULT 'png';
