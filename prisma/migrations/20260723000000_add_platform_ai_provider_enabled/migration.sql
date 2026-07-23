ALTER TABLE "PlatformAiProvider"
  ADD COLUMN "enabled" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "PlatformAiProvider_enabled_preferred_priority_idx"
  ON "PlatformAiProvider"("enabled", "preferred", "priority");
