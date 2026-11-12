-- Free-credit program (creator applications) + one-time $1 first-video offer.
-- Adds customer risk columns used by application anti-abuse checks.

ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "signupIp" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "signupUa" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "lastLoginIp" TEXT;

CREATE TABLE IF NOT EXISTS "CreditApplication" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "canonicalEmail" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "profileUrl" TEXT NOT NULL,
  "followerTier" TEXT NOT NULL,
  "evidencePosts" JSONB NOT NULL,
  "audience" TEXT,
  "message" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "grantCredits" INTEGER,
  "riskFlags" JSONB,
  "submitIp" TEXT,
  "submitUa" TEXT,
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMPTZ(6),
  "reviewNote" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "CreditApplication_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "CreditApplication" ADD CONSTRAINT "CreditApplication_site_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CreditApplication" ADD CONSTRAINT "CreditApplication_customer_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "CreditApplication_site_status_idx" ON "CreditApplication"("siteId", "status");
CREATE INDEX IF NOT EXISTS "CreditApplication_site_customerId_idx" ON "CreditApplication"("siteId", "customerId");
CREATE INDEX IF NOT EXISTS "CreditApplication_site_status_createdAt_idx" ON "CreditApplication"("siteId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "CreditApplication_site_canonicalEmail_idx" ON "CreditApplication"("siteId", "canonicalEmail");

DO $$ BEGIN
  ALTER TABLE "CreditApplication" ADD CONSTRAINT "CreditApplication_site_scope_check" CHECK ("siteId" = 'site_aidreamcapes');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "CreditApplication" ADD CONSTRAINT "CreditApplication_status_check" CHECK ("status" IN ('pending', 'approved', 'rejected', 'archived'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "FirstVideoOffer" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'purchased',
  "orderId" TEXT,
  "purchasedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "consumedAt" TIMESTAMPTZ(6),
  CONSTRAINT "FirstVideoOffer_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "FirstVideoOffer" ADD CONSTRAINT "FirstVideoOffer_site_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FirstVideoOffer" ADD CONSTRAINT "FirstVideoOffer_customer_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "FirstVideoOffer_customerId_key" ON "FirstVideoOffer"("customerId");
CREATE INDEX IF NOT EXISTS "FirstVideoOffer_site_status_idx" ON "FirstVideoOffer"("siteId", "status");

DO $$ BEGIN
  ALTER TABLE "FirstVideoOffer" ADD CONSTRAINT "FirstVideoOffer_site_scope_check" CHECK ("siteId" = 'site_aidreamcapes');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "FirstVideoOffer" ADD CONSTRAINT "FirstVideoOffer_status_check" CHECK ("status" IN ('purchased', 'consumed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
