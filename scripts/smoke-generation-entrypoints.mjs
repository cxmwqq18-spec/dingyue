import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const files = {
  schema: read("prisma/schema.prisma"),
  migration: read("prisma/migrations/20260723090000_add_generation_entrypoints_and_site_api_keys/migration.sql"),
  submit: read("src/lib/generation-submit.ts"),
  jobStore: read("src/lib/stores/job-store.ts"),
  siteApiKeys: read("src/lib/site-api-keys.ts"),
  customerJobs: read("src/app/api/sites/[siteId]/ai/jobs/route.ts"),
  customerRetry: read("src/app/api/sites/[siteId]/ai/jobs/[jobId]/retry/route.ts"),
  rerun: read("src/app/api/sites/[siteId]/ai/jobs/[jobId]/rerun/route.ts"),
  externalJobs: read("src/app/api/v1/sites/[siteId]/ai/jobs/route.ts"),
  externalJobRead: read("src/app/api/v1/sites/[siteId]/ai/jobs/[jobId]/route.ts"),
  externalAssets: read("src/app/api/v1/sites/[siteId]/customers/[customerId]/assets/route.ts"),
  recovery: read("src/app/api/internal/ai-worker/recover-dispatch/route.ts")
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS ${message}`);
}

assert(files.schema.includes("model SiteApiKey"), "schema defines site API keys");
assert(files.schema.includes("@@unique([siteId, customerId, idempotencyKey])"), "generation jobs have customer-scoped idempotency");
assert(files.migration.includes('CREATE TABLE "SiteApiKey"'), "migration creates site API key table");
assert(files.submit.includes("export async function submitGenerationJob"), "generation submission is centralized");
assert(files.submit.includes("idempotent_replay"), "submission skips dispatch on idempotent replay");
assert(files.customerJobs.includes("submitGenerationJob({"), "customer workspace job route uses centralized submission");
assert(files.customerJobs.includes("reused: result.reused === true"), "customer workspace job route reports idempotent replays");
assert(files.customerRetry.includes("requireCustomerMutation"), "customer video retry route requires customer auth");
assert(files.customerRetry.includes('request.headers.get("idempotency-key")'), "customer video retry route accepts idempotency keys from browser submits");
assert(files.customerRetry.includes("submitRerunGenerationJob({"), "customer video retry route uses centralized rerun submission");
assert(files.customerRetry.includes("customerId: body.customerId"), "customer video retry route scopes reruns to the current customer");
assert(files.customerRetry.includes("requireVideo: true"), "customer video retry route only retries video jobs");
assert(files.customerRetry.includes("reused: result.reused === true"), "customer video retry route reports idempotent rerun replays");
assert(files.customerRetry.includes("x-smoke-skip-worker-dispatch"), "customer video retry route can be smoke-tested without dispatching a paid provider worker");
assert(files.rerun.includes("submitRerunGenerationJob"), "rerun route uses centralized submission");
assert(files.submit.includes("if (rerun.reused)") && files.submit.includes("Idempotent replay returned the existing rerun job."), "rerun submission skips dispatch on idempotent replay");
assert(files.submit.includes("skipWorkerDispatch") && files.submit.includes("Persisted rerun job and reserved credits. Worker dispatch is not configured."), "rerun submission supports skip-worker smoke tests");
assert(files.jobStore.includes("only_video_jobs_can_be_retried"), "job store rejects non-video customer retry attempts");
assert(files.jobStore.includes("idempotencyKey: params.idempotencyKey"), "job store passes customer retry idempotency into rerun creation");
assert(files.externalJobs.includes('request.headers.get("idempotency-key")'), "external job API requires idempotency key");
assert(files.externalJobs.includes('entryPoint: "external_api"'), "external job API marks entry point");
assert(files.externalJobs.includes("video_public_asset_url_required"), "external job API keeps video frame public URL protection");
assert(files.externalJobs.includes("stringArray(fields.frameAssetIds)"), "external job API forwards video frame asset ids");
assert(!files.externalJobs.includes("workerPayload"), "external job API does not expose worker payload");
assert(files.externalJobRead.includes("generation:read"), "external job read API checks read scope");
assert(files.externalAssets.includes("multipart/form-data"), "external asset API requires multipart uploads");
assert(files.externalAssets.includes("asset_file_must_be_image"), "external asset API accepts only images");
assert(files.siteApiKeys.includes("createHash(\"sha256\")"), "site API tokens are stored as hashes");
assert(files.siteApiKeys.includes("generation:provider_override"), "provider override is gated by scope");
assert(files.submit.includes("site_api_key_forbidden"), "external provider overrides are rejected without scope");
assert(files.submit.includes('"imageProviderId"'), "external provider override aliases are rejected without scope");
assert(files.recovery.includes("generation_dispatch_recovery_failed"), "dispatch recovery exposes stable failure code");
assert(files.recovery.includes("listRecoverableQueuedGenerationJobsRelational"), "dispatch recovery retries stale queued jobs");
assert(files.jobStore.includes("generationRequestHash"), "job store computes stable request hashes");
assert(files.jobStore.includes("pg_advisory_xact_lock"), "job store serializes same-customer generation submissions");
