ALTER TABLE "VideoThemeCategory" ADD COLUMN "parentId" TEXT;

ALTER TABLE "VideoThemeCategory"
ADD CONSTRAINT "VideoThemeCategory_parentId_fkey"
FOREIGN KEY ("parentId") REFERENCES "VideoThemeCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "VideoThemeCategory_siteId_parentId_sortOrder_idx"
ON "VideoThemeCategory"("siteId", "parentId", "sortOrder");
