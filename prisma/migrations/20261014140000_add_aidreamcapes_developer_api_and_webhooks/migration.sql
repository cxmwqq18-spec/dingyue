CREATE TABLE "AidreamcapesDeveloperApiKey" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "secretHash" TEXT NOT NULL,
  "scopes" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ(6),
  "revokedAt" TIMESTAMPTZ(6),
  "lastUsedAt" TIMESTAMPTZ(6),
  "rateLimitWindowAt" TIMESTAMPTZ(6),
  "rateLimitCount" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "AidreamcapesDeveloperApiKey_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AidreamcapesDeveloperApiKey_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesDeveloperApiKey_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesDeveloperApiKey_site_scope_check" CHECK ("siteId" = 'site_aidreamcapes'),
  CONSTRAINT "AidreamcapesDeveloperApiKey_name_check" CHECK (length(btrim("name")) BETWEEN 1 AND 80),
  CONSTRAINT "AidreamcapesDeveloperApiKey_hash_check" CHECK ("secretHash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "AidreamcapesDeveloperApiKey_rate_limit_check" CHECK ("rateLimitCount" >= 0),
  CONSTRAINT "AidreamcapesDeveloperApiKey_scopes_check" CHECK (
    jsonb_typeof("scopes") = 'array' AND "scopes" <> '[]'::jsonb AND "scopes" <@ '["read","write"]'::jsonb
  )
);
CREATE UNIQUE INDEX "AidreamcapesDeveloperApiKey_secretHash_key" ON "AidreamcapesDeveloperApiKey" ("secretHash");
CREATE INDEX "AidreamcapesDeveloperApiKey_owner" ON "AidreamcapesDeveloperApiKey" ("siteId", "customerId", "createdAt" DESC);

CREATE TABLE "AidreamcapesWebhookSubscription" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "endpointUrl" TEXT NOT NULL,
  "events" JSONB NOT NULL,
  "secretCiphertext" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "disabledAt" TIMESTAMPTZ(6),
  CONSTRAINT "AidreamcapesWebhookSubscription_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AidreamcapesWebhookSubscription_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesWebhookSubscription_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesWebhookSubscription_site_scope_check" CHECK ("siteId" = 'site_aidreamcapes'),
  CONSTRAINT "AidreamcapesWebhookSubscription_endpoint_check" CHECK ("endpointUrl" LIKE 'https://%'),
  CONSTRAINT "AidreamcapesWebhookSubscription_events_check" CHECK (
    jsonb_typeof("events") = 'array' AND "events" <> '[]'::jsonb AND "events" <@ '["task.created"]'::jsonb
  ),
  CONSTRAINT "AidreamcapesWebhookSubscription_ciphertext_check" CHECK (length("secretCiphertext") BETWEEN 40 AND 512)
);
CREATE UNIQUE INDEX "AidreamcapesWebhookSubscription_owner_unique" ON "AidreamcapesWebhookSubscription" ("id", "siteId", "customerId");
CREATE INDEX "AidreamcapesWebhookSubscription_owner" ON "AidreamcapesWebhookSubscription" ("siteId", "customerId", "createdAt" DESC);

CREATE TABLE "AidreamcapesWebhookDelivery" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "eventKey" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastStatusCode" INTEGER,
  "lastError" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deliveredAt" TIMESTAMPTZ(6),
  CONSTRAINT "AidreamcapesWebhookDelivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AidreamcapesWebhookDelivery_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesWebhookDelivery_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesWebhookDelivery_subscription_owner_fkey" FOREIGN KEY ("subscriptionId", "siteId", "customerId") REFERENCES "AidreamcapesWebhookSubscription"("id", "siteId", "customerId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AidreamcapesWebhookDelivery_site_scope_check" CHECK ("siteId" = 'site_aidreamcapes'),
  CONSTRAINT "AidreamcapesWebhookDelivery_event_check" CHECK ("eventType" = 'task.created'),
  CONSTRAINT "AidreamcapesWebhookDelivery_status_check" CHECK ("status" IN ('pending', 'delivered', 'failed')),
  CONSTRAINT "AidreamcapesWebhookDelivery_attempt_check" CHECK ("attemptCount" BETWEEN 0 AND 5),
  CONSTRAINT "AidreamcapesWebhookDelivery_payload_check" CHECK (jsonb_typeof("payload") = 'object')
);
CREATE UNIQUE INDEX "AidreamcapesWebhookDelivery_event_unique" ON "AidreamcapesWebhookDelivery" ("subscriptionId", "eventKey");
CREATE INDEX "AidreamcapesWebhookDelivery_due" ON "AidreamcapesWebhookDelivery" ("siteId", "status", "nextAttemptAt");
CREATE INDEX "AidreamcapesWebhookDelivery_owner" ON "AidreamcapesWebhookDelivery" ("siteId", "customerId", "createdAt" DESC);

CREATE OR REPLACE FUNCTION aidreamcapes_api_owner_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."siteId" <> 'site_aidreamcapes' OR NOT EXISTS (
    SELECT 1 FROM "Customer" WHERE "id" = NEW."customerId" AND "siteId" = 'site_aidreamcapes'
  ) THEN
    RAISE EXCEPTION 'aidreamcapes API customer site mismatch';
  END IF;
  IF TG_OP = 'UPDATE' AND (OLD."siteId" <> NEW."siteId" OR OLD."customerId" <> NEW."customerId" OR OLD."id" <> NEW."id") THEN
    RAISE EXCEPTION 'aidreamcapes API ownership is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER aidreamcapes_developer_key_owner BEFORE INSERT OR UPDATE ON "AidreamcapesDeveloperApiKey"
  FOR EACH ROW EXECUTE FUNCTION aidreamcapes_api_owner_guard();
CREATE TRIGGER aidreamcapes_webhook_subscription_owner BEFORE INSERT OR UPDATE ON "AidreamcapesWebhookSubscription"
  FOR EACH ROW EXECUTE FUNCTION aidreamcapes_api_owner_guard();
CREATE TRIGGER aidreamcapes_webhook_delivery_owner BEFORE INSERT OR UPDATE ON "AidreamcapesWebhookDelivery"
  FOR EACH ROW EXECUTE FUNCTION aidreamcapes_api_owner_guard();
