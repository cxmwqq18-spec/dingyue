CREATE TABLE "ToolCategory" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "parentId" TEXT,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ToolCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ToolMenuItem" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "categoryId" TEXT,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "badge" TEXT,
    "icon" TEXT,
    "imageUrl" TEXT,
    "href" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ToolMenuItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ToolCategory_siteId_slug_key" ON "ToolCategory"("siteId", "slug");
CREATE INDEX "ToolCategory_siteId_parentId_sortOrder_idx" ON "ToolCategory"("siteId", "parentId", "sortOrder");
CREATE INDEX "ToolCategory_siteId_status_idx" ON "ToolCategory"("siteId", "status");

CREATE UNIQUE INDEX "ToolMenuItem_siteId_slug_key" ON "ToolMenuItem"("siteId", "slug");
CREATE INDEX "ToolMenuItem_siteId_categoryId_sortOrder_idx" ON "ToolMenuItem"("siteId", "categoryId", "sortOrder");
CREATE INDEX "ToolMenuItem_siteId_status_idx" ON "ToolMenuItem"("siteId", "status");

ALTER TABLE "ToolCategory" ADD CONSTRAINT "ToolCategory_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ToolCategory" ADD CONSTRAINT "ToolCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ToolCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ToolMenuItem" ADD CONSTRAINT "ToolMenuItem_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ToolMenuItem" ADD CONSTRAINT "ToolMenuItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ToolCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
