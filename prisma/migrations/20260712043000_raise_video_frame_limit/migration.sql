ALTER TABLE "VideoTheme" ALTER COLUMN "maxFrames" SET DEFAULT 30;

UPDATE "VideoTheme"
SET "maxFrames" = 30
WHERE "maxFrames" < 30;
