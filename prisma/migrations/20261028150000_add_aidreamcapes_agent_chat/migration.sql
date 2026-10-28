-- Aidreamcapes workspace agent chat: per-customer conversations and messages.
CREATE TABLE IF NOT EXISTS "AiChatConversation" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "AiChatConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AiChatMessage" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "providerId" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "AiChatMessage_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "AiChatConversation" ADD CONSTRAINT "AiChatConversation_site_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AiChatConversation" ADD CONSTRAINT "AiChatConversation_customer_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AiChatMessage" ADD CONSTRAINT "AiChatMessage_conversation_fkey" FOREIGN KEY ("conversationId") REFERENCES "AiChatConversation"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AiChatMessage" ADD CONSTRAINT "AiChatMessage_site_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AiChatMessage" ADD CONSTRAINT "AiChatMessage_customer_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "AiChatConversation_owner" ON "AiChatConversation"("siteId", "customerId", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "AiChatMessage_thread" ON "AiChatMessage"("conversationId", "createdAt");
CREATE INDEX IF NOT EXISTS "AiChatMessage_owner" ON "AiChatMessage"("siteId", "customerId");

DO $$ BEGIN
  ALTER TABLE "AiChatConversation" ADD CONSTRAINT "AiChatConversation_site_scope_check" CHECK ("siteId" = 'site_aidreamcapes');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AiChatMessage" ADD CONSTRAINT "AiChatMessage_site_scope_check" CHECK ("siteId" = 'site_aidreamcapes');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AiChatMessage" ADD CONSTRAINT "AiChatMessage_role_check" CHECK ("role" IN ('user', 'assistant'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- Conversation/message ownership is enforced by customerId+siteId filters in
-- every read and write (Postgres CHECK constraints cannot contain subqueries).
