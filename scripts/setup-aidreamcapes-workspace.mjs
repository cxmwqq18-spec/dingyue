#!/usr/bin/env node
import './load-runtime-env.mjs';
import { PrismaClient } from '@prisma/client';
import { assertDatabaseTarget } from './lib/database-target.mjs';

// This setup never touches shared models or accepts a remote target.
assertDatabaseTarget({ expectedTarget: 'local' });
const db = new PrismaClient();
try {
  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "AidreamcapesVideoTask" (
      "id" text PRIMARY KEY,
      "siteId" text NOT NULL REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "customerId" text NOT NULL REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "revision" integer NOT NULL DEFAULT 1,
      "data" jsonb NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "AidreamcapesVideoTask_site_scope_check" CHECK ("siteId" = 'site_aidreamcapes'),
      CONSTRAINT "AidreamcapesVideoTask_data_owner_check" CHECK (COALESCE("data"->>'siteId', '') = "siteId" AND COALESCE("data"->>'customerId', '') = "customerId" AND COALESCE("data"->>'taskId', '') = "id"),
      CONSTRAINT "AidreamcapesVideoTask_revision_check" CHECK ("revision" > 0),
      CONSTRAINT "AidreamcapesVideoTask_revision_payload_check" CHECK (CASE WHEN jsonb_typeof("data"->'revision') = 'number' THEN ("data"->>'revision')::integer = "revision" ELSE FALSE END),
      CONSTRAINT "AidreamcapesVideoTask_status_check" CHECK (COALESCE("data"->>'status', '') IN ('draft', 'storyboard_ready', 'rendering', 'completed', 'failed'))
    )`);
    await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AidreamcapesVideoTask_owner_updated" ON "AidreamcapesVideoTask" ("siteId", "customerId", "updatedAt" DESC)`);
    await tx.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION aidreamcapes_video_task_owner_guard() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW."siteId" <> 'site_aidreamcapes' OR NOT EXISTS (SELECT 1 FROM "Customer" WHERE "id" = NEW."customerId" AND "siteId" = 'site_aidreamcapes') THEN
          RAISE EXCEPTION 'aivideosugc customer site mismatch';
        END IF;
        IF TG_OP = 'UPDATE' AND (OLD."siteId" <> NEW."siteId" OR OLD."customerId" <> NEW."customerId" OR OLD."id" <> NEW."id") THEN
          RAISE EXCEPTION 'aivideosugc task ownership is immutable';
        END IF;
        RETURN NEW;
      END;
    $$`);
    await tx.$executeRawUnsafe(`DROP TRIGGER IF EXISTS aidreamcapes_video_task_owner ON "AidreamcapesVideoTask"`);
    await tx.$executeRawUnsafe(`CREATE TRIGGER aidreamcapes_video_task_owner BEFORE INSERT OR UPDATE ON "AidreamcapesVideoTask" FOR EACH ROW EXECUTE FUNCTION aidreamcapes_video_task_owner_guard()`);
    await tx.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "AidreamcapesWorkspaceActor" (
      "id" text PRIMARY KEY,
      "siteId" text NOT NULL REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "customerId" text NOT NULL REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "data" jsonb NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "AidreamcapesWorkspaceActor_site_scope_check" CHECK ("siteId" = 'site_aidreamcapes'),
      CONSTRAINT "AidreamcapesWorkspaceActor_data_id_check" CHECK (COALESCE("data"->>'actorId', '') = "id")
    )`);
    await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AidreamcapesWorkspaceActor_owner" ON "AidreamcapesWorkspaceActor" ("siteId", "customerId", "createdAt" DESC)`);
    await tx.$executeRawUnsafe(`DROP TRIGGER IF EXISTS aidreamcapes_workspace_actor_owner ON "AidreamcapesWorkspaceActor"`);
    await tx.$executeRawUnsafe(`CREATE TRIGGER aidreamcapes_workspace_actor_owner BEFORE INSERT OR UPDATE ON "AidreamcapesWorkspaceActor" FOR EACH ROW EXECUTE FUNCTION aidreamcapes_video_task_owner_guard()`);
  });
  console.log('AIVideosUGC local task table ready; site_aidreamcapes only.');
} finally {
  await db.$disconnect();
}
