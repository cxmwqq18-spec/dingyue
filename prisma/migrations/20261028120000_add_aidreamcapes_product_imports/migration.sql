-- Aidreamcapes product link import history: one row per confirmed product
-- page import (site + customer + source URL). Soft delete keeps audit trail.
CREATE TABLE "AidreamcapesProductImport" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "fetchedPageUrl" TEXT,
    "title" TEXT,
    "brief" JSONB NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "AidreamcapesProductImport_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AidreamcapesProductImport" ADD CONSTRAINT "AidreamcapesProductImport_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AidreamcapesProductImport" ADD CONSTRAINT "AidreamcapesProductImport_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "AidreamcapesProductImport_owner_source_unique" ON "AidreamcapesProductImport"("siteId", "customerId", "sourceUrl");
CREATE INDEX "AidreamcapesProductImport_owner_updated" ON "AidreamcapesProductImport"("siteId", "customerId", "updatedAt" DESC);
