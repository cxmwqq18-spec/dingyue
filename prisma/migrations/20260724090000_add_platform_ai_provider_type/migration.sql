ALTER TABLE "PlatformAiProvider"
  ADD COLUMN "providerType" TEXT NOT NULL DEFAULT 'image';

UPDATE "PlatformAiProvider"
SET "providerType" = CASE
  WHEN lower(COALESCE("modelType", '')) LIKE '%video%' THEN 'video'
  WHEN lower(COALESCE("modelType", '')) LIKE '%grok-imagine-video%' THEN 'video'
  WHEN lower(COALESCE("label", '')) LIKE '%video%' THEN 'video'
  WHEN lower(COALESCE("aiUrl", '')) LIKE '%smartpicklid%' THEN 'video'
  WHEN lower(COALESCE("aiUrl", '')) LIKE '%magic666%' THEN 'video'
  ELSE 'image'
END;

WITH ranked AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "providerType"
      ORDER BY "priority" ASC, "createdAt" ASC, "id" ASC
    ) AS "typePriority"
  FROM "PlatformAiProvider"
)
UPDATE "PlatformAiProvider" provider
SET "priority" = ranked."typePriority"
FROM ranked
WHERE provider."id" = ranked."id";

WITH preferred_rank AS (
  SELECT
    "id",
    "enabled",
    row_number() OVER (
      PARTITION BY "providerType"
      ORDER BY
        CASE WHEN "enabled" THEN 0 ELSE 1 END,
        CASE WHEN "preferred" THEN 0 ELSE 1 END,
        "priority" ASC,
        "createdAt" ASC,
        "id" ASC
    ) AS "rank"
  FROM "PlatformAiProvider"
)
UPDATE "PlatformAiProvider" provider
SET "preferred" = preferred_rank."rank" = 1 AND preferred_rank."enabled" = true
FROM preferred_rank
WHERE provider."id" = preferred_rank."id";

CREATE INDEX "PlatformAiProvider_providerType_preferred_priority_idx"
  ON "PlatformAiProvider"("providerType", "preferred", "priority");

CREATE INDEX "PlatformAiProvider_providerType_enabled_preferred_priority_idx"
  ON "PlatformAiProvider"("providerType", "enabled", "preferred", "priority");

CREATE UNIQUE INDEX "PlatformAiProvider_providerType_enabled_preferred_key"
  ON "PlatformAiProvider"("providerType")
  WHERE "enabled" = true AND "preferred" = true;
