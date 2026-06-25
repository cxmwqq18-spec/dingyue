CREATE TABLE "CreativePackCategory" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "parentId" TEXT,
  "slug" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "heroTitle" TEXT,
  "heroSubtitle" TEXT,
  "imageUrl" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CreativePackCategory_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CreativePack" ADD COLUMN "categoryId" TEXT;
ALTER TABLE "CreativePack" ADD COLUMN "galleryImages" JSONB;

CREATE UNIQUE INDEX "CreativePackCategory_siteId_slug_key" ON "CreativePackCategory"("siteId", "slug");
CREATE INDEX "CreativePackCategory_siteId_parentId_sortOrder_idx" ON "CreativePackCategory"("siteId", "parentId", "sortOrder");
CREATE INDEX "CreativePackCategory_siteId_status_idx" ON "CreativePackCategory"("siteId", "status");
CREATE INDEX "CreativePack_siteId_categoryId_idx" ON "CreativePack"("siteId", "categoryId");

ALTER TABLE "CreativePackCategory" ADD CONSTRAINT "CreativePackCategory_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativePackCategory" ADD CONSTRAINT "CreativePackCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CreativePackCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativePack" ADD CONSTRAINT "CreativePack_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CreativePackCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
