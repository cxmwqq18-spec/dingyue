CREATE INDEX IF NOT EXISTS "Subscription_siteId_customerId_createdAt_idx"
  ON "Subscription"("siteId", "customerId", "createdAt");

CREATE INDEX IF NOT EXISTS "Album_siteId_customerId_updatedAt_idx"
  ON "Album"("siteId", "customerId", "updatedAt");

CREATE INDEX IF NOT EXISTS "GenerationJob_siteId_customerId_updatedAt_idx"
  ON "GenerationJob"("siteId", "customerId", "updatedAt");

WITH ranked_orders AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY "siteId", "customerId", "sourceId"
      ORDER BY "createdAt" ASC, id ASC
    ) AS duplicate_rank
  FROM "Order"
)
DELETE FROM "Order"
WHERE id IN (
  SELECT id FROM ranked_orders WHERE duplicate_rank > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS "Order_siteId_customerId_sourceId_key"
  ON "Order"("siteId", "customerId", "sourceId");

WITH ranked_ledger AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY "siteId", "customerId", "type", "sourceId"
      ORDER BY "createdAt" ASC, id ASC
    ) AS duplicate_rank
  FROM "CreditLedger"
)
DELETE FROM "CreditLedger"
WHERE id IN (
  SELECT id FROM ranked_ledger WHERE duplicate_rank > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS "CreditLedger_siteId_customerId_type_sourceId_key"
  ON "CreditLedger"("siteId", "customerId", "type", "sourceId");
