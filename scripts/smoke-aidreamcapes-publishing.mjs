import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const root = process.cwd();
const source = path.join(root, "src/lib/aidreamcapes-workspace");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "aidreamcapes-publishing-"));

try {
  for (const name of ["types", "publishing-core"]) {
    const result = ts.transpileModule(fs.readFileSync(path.join(source, `${name}.ts`), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
    });
    fs.writeFileSync(path.join(temp, `${name}.js`), result.outputText);
  }
  const require = createRequire(path.join(temp, "entry.cjs"));
  const { WorkspaceError } = require("./types.js");
  const core = require("./publishing-core.js");
  const denied = (fn, code) => assert.throws(fn, error => error instanceof WorkspaceError && (!code || error.code === code));
  const now = new Date("2026-10-14T00:00:00.000Z");
  const task = {
    siteId: "site_aidreamcapes", customerId: "customer-a", taskId: "task-a", status: "completed",
    storyboardStale: false,
    video: { status: "done", renderId: "render-1", finalUrl: "/api/sites/site_aidreamcapes/aivideosugc/tasks/task-a/output?kind=video", stale: false }
  };

  assert.deepEqual(core.assertPublishableTask(task, "customer-a"), { taskId: "task-a", renderId: "render-1", outputUrl: task.video.finalUrl });
  denied(() => core.assertPublishingOwner("site_dreamshoot", "site_dreamshoot"), "workspace_site_not_found");
  denied(() => core.assertPublishableTask({ ...task, customerId: "customer-b" }, "customer-a"), "publishing_task_not_found");
  denied(() => core.assertPublishableTask({ ...task, status: "draft" }, "customer-a"), "publishing_output_not_ready");
  denied(() => core.assertPublishableTask({ ...task, video: { ...task.video, status: "run" } }, "customer-a"), "publishing_output_not_ready");
  denied(() => core.assertPublishableTask({ ...task, video: { ...task.video, stale: true } }, "customer-a"), "publishing_output_stale");
  denied(() => core.assertPublishableTask({ ...task, siteId: "site_dreamshoot" }, "customer-a"), "publishing_task_not_found");

  assert.equal(core.normalizePublishingTarget("tiktok"), "tiktok");
  for (const target of ["instagram", "youtube"]) assert.equal(core.normalizePublishingTarget(target), target);
  denied(() => core.normalizePublishingTarget("facebook"), "publishing_target_invalid");
  assert.equal(core.parsePublishingSchedule(undefined, now.getTime()), null);
  assert.equal(core.parsePublishingSchedule("2026-10-14T01:00:00Z", now.getTime()).toISOString(), "2026-10-14T01:00:00.000Z");
  denied(() => core.parsePublishingSchedule("2026-10-13T23:59:59Z", now.getTime()), "publishing_schedule_invalid");
  denied(() => core.parsePublishingSchedule("2026-02-30T12:00:00Z", now.getTime()), "publishing_schedule_invalid");

  const immediate = { taskId: "task-a", target: "youtube", scheduledAt: null };
  const future = { taskId: "task-a", target: "youtube", scheduledAt: new Date("2026-10-14T01:00:00.000Z") };
  const immediateHash = core.hashQueueRequest(immediate);
  assert.equal(core.decideIdempotentQueue(null, immediateHash), "create");
  assert.equal(core.decideIdempotentQueue({ requestHash: immediateHash }, immediateHash), "return_existing");
  denied(() => core.decideIdempotentQueue({ requestHash: immediateHash }, core.hashQueueRequest(future)), "idempotency_conflict");
  assert.equal(core.queuedStatus(null), "queued");
  assert.equal(core.queuedStatus(future.scheduledAt), "scheduled");

  const baseJob = {
    id: "job-a", siteId: "site_aidreamcapes", customerId: "customer-a", taskId: "task-a", renderId: "render-1",
    target: "youtube", status: "queued", scheduledAt: null, idempotencyKey: "key-a", requestHash: immediateHash,
    capabilityState: "not_configured", attemptCount: 0, lastError: null, createdAt: now, updatedAt: now, queuedAt: now,
    publishedAt: null, cancelledAt: null, retriedAt: null
  };
  const mock = core.createDeterministicMockAdapter();
  const published = await core.runPublishingJobWithAdapter(baseJob, mock, now);
  assert.equal(published.job.status, "published");
  assert.equal(published.platformPostId, "mock_youtube_job-a");
  assert.deepEqual(mock.calls, ["job-a"]);

  const notConfigured = { capability: target => ({ target, connection: "not_configured", posting: "disabled", reason: "platform_oauth_and_review_required" }), publish: async () => assert.fail("disabled adapter must not publish") };
  assert.equal(core.publishingCapabilities().every(item => item.connection === "not_configured" && item.posting === "disabled"), true);
  denied(() => core.assertAdapterConfigured(notConfigured, "youtube"), "platform_not_configured");
  const scheduledJob = { ...baseJob, status: "scheduled", scheduledAt: future.scheduledAt };
  const notDue = await core.runPublishingJobWithAdapter(scheduledJob, mock, now);
  assert.equal(notDue.job.status, "scheduled");
  assert.equal(mock.calls.length, 1);
  const due = await core.runPublishingJobWithAdapter(scheduledJob, mock, new Date("2026-10-14T01:00:00.000Z"));
  assert.equal(due.job.status, "published");
  assert.equal(mock.calls.length, 2);

  const failing = { capability: target => ({ target, connection: "connected", posting: "enabled", reason: null }), publish: async () => { throw new Error("fixture failure"); } };
  const failed = await core.runPublishingJobWithAdapter(baseJob, failing, now);
  assert.equal(failed.job.status, "failed");
  assert.equal(failed.job.lastError, "platform_publish_failed");
  const retried = core.retryPublishingJob(failed.job, new Date("2026-10-14T00:05:00.000Z"));
  assert.equal(retried.status, "queued");
  assert.equal(retried.attemptCount, 1);
  assert.equal(retried.lastError, null);
  const successfulRetry = await core.runPublishingJobWithAdapter(retried, mock, new Date("2026-10-14T00:05:01.000Z"));
  assert.equal(successfulRetry.job.status, "published");
  assert.equal(successfulRetry.job.attemptCount, 2);
  const cancelled = core.cancelPublishingJob(retried, new Date("2026-10-14T00:06:00.000Z"));
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.cancelledAt.toISOString(), "2026-10-14T00:06:00.000Z");
  denied(() => core.retryPublishingJob(cancelled, now), "publishing_job_not_retryable");

  const service = fs.readFileSync(path.join(source, "publishing.ts"), "utf8");
  const coreSource = fs.readFileSync(path.join(source, "publishing-core.ts"), "utf8");
  const migration = fs.readFileSync(path.join(root, "prisma/migrations/20261014160000_add_aidreamcapes_social_publishing_jobs/migration.sql"), "utf8");
  assert.match(service, /SELECT "data" FROM "AidreamcapesVideoTask"[\s\S]*"customerId" = \$\{customerId\}/);
  assert.match(service, /constants\.O_NOFOLLOW/);
  assert.match(service, /WHERE c\."id" = \$\{customerId\} AND c\."siteId" = \$\{AIVIDEOSUGC_SITE_ID\}/);
  assert.match(service, /WHERE "id" = \$\{jobId\} AND "siteId" = \$\{AIVIDEOSUGC_SITE_ID\} AND "customerId" = \$\{customerId\}/);
  assert.match(migration, /AidreamcapesPublishingJob_owner_idempotency_unique/);
  assert.match(migration, /AidreamcapesPublishingJob_site_scope_check/);
  assert.match(migration, /current completed customer output/);
  assert.match(migration, /publishing job status transition is invalid/);
  for (const match of service.matchAll(/\$queryRaw(?:<[^`]*>)?`([\s\S]*?)`/g)) {
    assert.match(match[1], /AIVIDEOSUGC_SITE_ID/);
    assert.match(match[1], /customerId|Customer/);
  }
  assert.doesNotMatch(service, /fetch\s*\(|https?:\/\//i);
  assert.doesNotMatch(service, /provider|credit|charge|ledger/i);
  assert.doesNotMatch(service, /process\.env\.(?:\w*(?:TOKEN|SECRET|OAUTH|API_KEY))/i);
  assert.doesNotMatch(coreSource, /fetch\s*\(|https?:\/\//i);
  assert.doesNotMatch(coreSource, /provider|credit|charge|ledger|process\.env/i);

  const routeFiles = [
    "src/app/api/sites/[siteId]/aivideosugc/publishing/capabilities/route.ts",
    "src/app/api/sites/[siteId]/aivideosugc/publishing/preview/route.ts",
    "src/app/api/sites/[siteId]/aivideosugc/publishing/queue/route.ts",
    "src/app/api/sites/[siteId]/aivideosugc/publishing/jobs/[jobId]/route.ts",
    "src/app/api/sites/[siteId]/aivideosugc/publishing/jobs/[jobId]/cancel/route.ts",
    "src/app/api/sites/[siteId]/aivideosugc/publishing/jobs/[jobId]/retry/route.ts"
  ];
  for (const relative of routeFiles) {
    const content = fs.readFileSync(path.join(root, relative), "utf8");
    assert.match(content, /workspaceAuth/);
    assert.doesNotMatch(content, /fetch\s*\(|provider|charge|ledger/i);
  }
  console.log("Aidreamcapes publishing smoke checks passed; ownership, output readiness, idempotency, schedule, cancellation/retry, and disabled real adapters verified with no network or charge calls.");
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
