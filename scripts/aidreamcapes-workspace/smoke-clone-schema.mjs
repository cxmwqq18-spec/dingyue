import '../load-runtime-env.mjs';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { assertDatabaseTarget } from '../lib/database-target.mjs';

// Current SQL + synthetic fixtures in an isolated schema, always rolled back.
assertDatabaseTarget({ expectedTarget: 'local' });
const schema = `aidreamcapes_clone_qa_${randomUUID().replaceAll('-', '')}`;
const migrations = ['20261014170000_add_aidreamcapes_clone_consent_jobs','20261015130000_aidreamcapes_clone_taskless_analysis']
  .map(name => fs.readFileSync(`prisma/migrations/${name}/migration.sql`, 'utf8')).join('\n');
const sql = `BEGIN;
CREATE SCHEMA "${schema}";
SET LOCAL search_path TO "${schema}";
CREATE TABLE "Site" ("id" text PRIMARY KEY);
CREATE TABLE "Customer" ("id" text PRIMARY KEY,"siteId" text NOT NULL);
CREATE TABLE "AssetUpload" ("id" text PRIMARY KEY,"siteId" text,"customerId" text,"storageKey" text,"mimeType" text,"role" text,"deletedAt" timestamptz);
CREATE TABLE "AidreamcapesWorkspaceActor" ("id" text PRIMARY KEY,"siteId" text,"customerId" text,"data" jsonb);
CREATE TABLE "AidreamcapesVideoTask" ("id" text PRIMARY KEY,"siteId" text,"customerId" text,"data" jsonb);
${migrations}
INSERT INTO "Site" VALUES ('site_aidreamcapes');
INSERT INTO "Customer" VALUES ('synthetic-owner','site_aidreamcapes'),('synthetic-other','site_aidreamcapes');
INSERT INTO "AssetUpload" VALUES ('synthetic-video','site_aidreamcapes','synthetic-owner','sites/site_aidreamcapes/customers/synthetic-owner/assets/reference.mp4','video/mp4','input',NULL);
INSERT INTO "AidreamcapesCloneConsent" ("id","siteId","customerId","workflow","sourceType","sourceAssetId","scope","rightsConfirmed") VALUES ('synthetic-consent','site_aidreamcapes','synthetic-owner','ad_reference','customer_asset','synthetic-video','ad_reference',true);
INSERT INTO "AidreamcapesCloneJob" ("id","siteId","customerId","workflow","sourceType","sourceAssetId","consentId","consentRevision","idempotencyKey","requestHash") VALUES ('synthetic-job','site_aidreamcapes','synthetic-owner','ad_reference','customer_asset','synthetic-video','synthetic-consent',1,'synthetic-key',repeat('a',64));
DO $$ BEGIN
  BEGIN
    INSERT INTO "AidreamcapesCloneConsent" ("id","siteId","customerId","workflow","sourceType","sourceAssetId","scope","rightsConfirmed") VALUES ('forbidden','site_aidreamcapes','synthetic-other','ad_reference','customer_asset','synthetic-video','ad_reference',true);
    RAISE EXCEPTION 'FAIL cross-owner source accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF; END;
  BEGIN
    UPDATE "AidreamcapesCloneJob" SET "status"='succeeded',"revision"=2 WHERE "id"='synthetic-job';
    RAISE EXCEPTION 'FAIL production success accepted';
  EXCEPTION WHEN raise_exception OR check_violation THEN IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF; END;
END $$;
UPDATE "AidreamcapesCloneJob" SET "status"='mock_complete',"revision"=2,"completedAt"=now(),"result"='{"adapter":"ad_reference_mock_parser","capabilityState":"mock_only","productionReady":false,"sourceAssetId":"synthetic-video","output":null,"mediaRead":false,"remoteFetch":false,"analysis":{"synthetic":true}}'::jsonb WHERE "id"='synthetic-job';
UPDATE "AidreamcapesCloneJob" SET "status"='deleted',"revision"=3,"deletedAt"=now() WHERE "id"='synthetic-job';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM "AidreamcapesCloneJob" WHERE "id"='synthetic-job' AND "result" IS NOT NULL AND "status"='deleted') THEN RAISE EXCEPTION 'FAIL audit lost'; END IF;
  BEGIN
    UPDATE "AidreamcapesCloneJob" SET "result"=NULL,"revision"=4 WHERE "id"='synthetic-job';
    RAISE EXCEPTION 'FAIL deleted audit was overwritten';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF; END;
END $$;
UPDATE "AidreamcapesCloneConsent" SET "status"='revoked',"revision"=2,"revokedAt"=now() WHERE "id"='synthetic-consent';
DO $$ BEGIN
  BEGIN
    INSERT INTO "AidreamcapesCloneJob" ("id","siteId","customerId","workflow","sourceType","sourceAssetId","consentId","consentRevision","idempotencyKey","requestHash") VALUES ('revoked-job','site_aidreamcapes','synthetic-owner','ad_reference','customer_asset','synthetic-video','synthetic-consent',1,'revoked-key',repeat('b',64));
    RAISE EXCEPTION 'FAIL revoked consent accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF; END;
END $$;
ROLLBACK;`;
const url = new URL(process.env.DATABASE_URL);
const run = spawnSync('psql', ['-X','--quiet','-v','ON_ERROR_STOP=1'], {
  input: sql, encoding:'utf8', env: {...process.env,PGHOST:url.hostname,PGPORT:url.port||'5432',PGDATABASE:decodeURIComponent(url.pathname.slice(1)),PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password)}
});
if (run.status !== 0) throw new Error(run.stderr || run.error?.message || 'clone schema smoke failed');
console.log('PASS clone SQL: taskless analysis, owner guards, real-success rejection, mock lifecycle, immutable audit, revocation. Isolated schema transaction rolled back.');
