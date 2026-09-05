#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const postRoute = read("src/app/api/sites/[siteId]/ai/video-prompt-optimizations/route.ts");
const getRoute = read("src/app/api/sites/[siteId]/ai/video-prompt-optimizations/[jobId]/route.ts");
const asyncJobs = read("src/lib/async-jobs.ts");
const workspace = read("src/components/storefront/customer-video-workspace.tsx");
const client = read("src/lib/video-prompt-optimization-client.ts");
const themeProvider = read("src/lib/video-theme-prompt-provider.ts");

assert.match(postRoute, /requireCustomerMutation/);
assert.match(postRoute, /idempotency-key/);
assert.match(postRoute, /kind:\s*JOB_KIND/);
assert.match(postRoute, /maxJobs:\s*QUOTA_MAX_JOBS/);
assert.match(postRoute, /statuses:\s*\["queued",\s*"running",\s*"succeeded"\]/);
assert.match(postRoute, /siteId,\s*customerId,\s*deletedAt:\s*null/);
assert.match(postRoute, /id:\s*videoThemeId,\s*siteId,\s*status:\s*"active"/);
assert.match(postRoute, /sourceHash:\s*promptHash/);
assert.match(postRoute, /sourceLength:\s*prompt\.length/);
assert.match(postRoute, /requestFingerprint/);
assert.match(postRoute, /idempotency_key_conflict/);
assert.match(postRoute, /getAsyncJobByIdempotency/);
assert.doesNotMatch(postRoute, /ledger|creditCost|submitGenerationJob|createGeneration/i);
assert.match(asyncJobs, /TransactionIsolationLevel\.Serializable/);
assert.match(asyncJobs, /AsyncJobRollingLimitError/);

assert.match(getRoute, /getCurrentCustomerForSite/);
assert.match(getRoute, /metadataSiteId !== siteId/);
assert.match(getRoute, /metadataCustomerId !== current\.customer\.id/);
assert.match(getRoute, /job\.actorId !== current\.customer\.id/);

assert.match(workspace, /VIDEO_PROMPT_PERSONAS\.map/);
assert.match(workspace, /onClick=\{\(\) => setSelectedPromptPersonaId\(persona\.id\)\}/);
assert.match(workspace, /onClick=\{\(\) => void optimizeCurrentVideoPrompt\(\)\}/);
assert.match(workspace, /requestVideoPromptOptimization/);
assert.match(workspace, /window\.localStorage\.setItem/);
assert.match(workspace, /promptOptimizationStorageKey/);
assert.match(workspace, /Improving your description/);
assert.match(workspace, /This window stays open until the update is complete/);
assert.match(client, /pollIntervalMs \?\? 500/);
assert.match(client, /headers\.set\("Idempotency-Key", params\.idempotencyKey\)/);
assert.match(client, /typeof params\.headers === "function"/);
assert.match(client, /postWithNetworkRetry/);
assert.match(workspace, /Apply improved description/);
assert.match(workspace, /Regenerate/);
assert.match(workspace, /Original description/);
assert.match(workspace, /Improved description/);
assert.match(workspace, /undoPromptOptimization/);
assert.match(workspace, /setAppliedPromptOptimization\(null\)/);

assert.match(themeProvider, /generatePlatformText/);
assert.doesNotMatch(themeProvider, /fetch\(/);

console.log(JSON.stringify({ ok: true, routes: 2, workspaceContract: true, sharedTextAdapter: true }, null, 2));
