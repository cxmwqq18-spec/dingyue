ALTER TABLE "PlatformAiProvider"
  ADD COLUMN "apiProtocol" TEXT NOT NULL DEFAULT 'auto',
  ADD COLUMN "videoModelFamily" TEXT NOT NULL DEFAULT 'auto',
  ADD COLUMN "videoDurations" INTEGER[] NOT NULL DEFAULT ARRAY[6, 10, 15],
  ADD COLUMN "videoAspectRatios" TEXT[] NOT NULL DEFAULT ARRAY['9:16', '1:1', '16:9'],
  ADD COLUMN "videoNativeSpeech" BOOLEAN;
