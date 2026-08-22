CREATE TABLE "VideoThemeExample" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "galleryImages" JSONB,
    "prompt" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VideoThemeExample_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "VideoThemeExample" ADD CONSTRAINT "VideoThemeExample_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VideoThemeExample" ADD CONSTRAINT "VideoThemeExample_themeId_fkey"
  FOREIGN KEY ("themeId") REFERENCES "VideoTheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "VideoThemeExample_siteId_themeId_status_sortOrder_idx"
  ON "VideoThemeExample"("siteId", "themeId", "status", "sortOrder");
CREATE INDEX "VideoThemeExample_siteId_status_createdAt_idx"
  ON "VideoThemeExample"("siteId", "status", "createdAt");

ALTER TABLE "PlatformAsyncJob" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "PlatformAsyncJob_kind_actorId_idempotencyKey_key"
  ON "PlatformAsyncJob"("kind", "actorId", "idempotencyKey");

INSERT INTO "VideoThemeExample" (
  "id", "siteId", "themeId", "name", "description", "imageUrl", "galleryImages", "prompt", "status", "sortOrder", "createdAt", "updatedAt"
)
SELECT
  'video_example_' || "id",
  "siteId",
  "id",
  "name",
  "description",
  "imageUrl",
  "galleryImages",
  'Subject / Character: The primary subject described by the ' || "name" || ' theme, with stable identity, wardrobe, and proportions.' || E'\n\n' ||
  'Action / Motion: The subject turns toward the key light, raises one hand, and begins the theme action. Existing direction: ' || "prompt" || E'\n\n' ||
  'Scene / Environment: A grounded location with moving air, surface reflections, and subtle environmental pressure that supports the theme.' || E'\n\n' ||
  'Camera / Shot / Lens: A controlled dolly push-in with a gentle pan, medium shot on a 35mm lens, stable horizon and natural depth of field.' || E'\n\n' ||
  'Lighting / Atmosphere: Motivated key light with soft practical fill, realistic shadow continuity, and restrained atmosphere.' || E'\n\n' ||
  'Style / Mood / Palette: Naturalistic cinematic realism, coherent color palette, and a focused mood appropriate to the theme.' || E'\n\n' ||
  'Sound / Audio: Subtle room hum, fabric rustle, measured breath, and one recurring visual reflection as an anchor.' || E'\n\n' ||
  'Duration / Aspect Ratio / Resolution: ' || "durationSeconds" || ' seconds, 16:9 aspect ratio, 720p resolution.' || E'\n\n' ||
  'Continuity: Keep subject, wardrobe, props, geography, and light direction consistent; final frame ends on the subject holding the completed action in a clean composition.' || E'\n\n' ||
  'Negative Constraints: No text, logos, watermarks, extra limbs, face drift, abrupt cuts, unsupported details, or unrelated subjects.',
  "status",
  0,
  "createdAt",
  "updatedAt"
FROM "VideoTheme" theme
WHERE NOT EXISTS (
  SELECT 1 FROM "VideoThemeExample" example WHERE example."themeId" = theme."id"
);
