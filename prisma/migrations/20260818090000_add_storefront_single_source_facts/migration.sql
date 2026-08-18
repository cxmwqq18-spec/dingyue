ALTER TABLE "Product"
  ADD COLUMN "metadata" JSONB;

ALTER TABLE "Price"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN "effectiveFrom" TIMESTAMP(3),
  ADD COLUMN "effectiveTo" TIMESTAMP(3),
  ADD COLUMN "replacesPriceId" TEXT,
  ADD COLUMN "providerVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "providerFingerprint" TEXT;

CREATE INDEX "Price_siteId_status_effectiveFrom_effectiveTo_idx"
  ON "Price"("siteId", "status", "effectiveFrom", "effectiveTo");

CREATE UNIQUE INDEX "Price_one_active_product_interval_key"
  ON "Price"("siteId", "productId", "interval")
  WHERE "status" = 'active';

ALTER TABLE "Order"
  ADD COLUMN "priceId" TEXT;

CREATE INDEX "Order_siteId_priceId_idx"
  ON "Order"("siteId", "priceId");

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_priceId_fkey"
  FOREIGN KEY ("priceId") REFERENCES "Price"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Preserve immutability for historical one-time purchases when the legacy order
-- matches exactly one price on its recorded commercial facts. Ambiguous rows stay
-- NULL and are reported by the data migration for manual review.
WITH "OrderPriceCandidates" AS (
  SELECT
    o."id" AS "orderId",
    MIN(p."id") AS "priceId",
    COUNT(*) AS "candidateCount"
  FROM "Order" o
  JOIN "Price" p
    ON p."siteId" = o."siteId"
   AND p."amountCents" = o."amountCents"
   AND LOWER(p."currency") = LOWER(o."currency")
   AND p."creditsGranted" = o."credits"
   AND p."interval" = 'one_time'
  WHERE o."priceId" IS NULL
  GROUP BY o."id"
)
UPDATE "Order" o
SET "priceId" = c."priceId"
FROM "OrderPriceCandidates" c
WHERE o."id" = c."orderId"
  AND c."candidateCount" = 1;

CREATE TABLE "StorefrontProfile" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "draftJson" JSONB NOT NULL,
  "publishedJson" JSONB NOT NULL,
  "draftMeta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StorefrontProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StorefrontProfile_siteId_key"
  ON "StorefrontProfile"("siteId");

ALTER TABLE "StorefrontProfile"
  ADD CONSTRAINT "StorefrontProfile_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ThemePublication"
  ADD COLUMN "scope" JSONB,
  ADD COLUMN "manifestHash" TEXT,
  ADD COLUMN "factsRevision" TEXT;

CREATE INDEX "ThemePublication_siteId_factsRevision_idx"
  ON "ThemePublication"("siteId", "factsRevision");
