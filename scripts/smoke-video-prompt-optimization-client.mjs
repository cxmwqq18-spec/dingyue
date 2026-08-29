#!/usr/bin/env node
import assert from "node:assert/strict";
import path from "node:path";
import createJiti from "jiti";

const jiti = createJiti(import.meta.url, { alias: { "@": path.join(process.cwd(), "src") } });
const {
  requestVideoPromptOptimization,
  VideoPromptOptimizationClientError
} = jiti("../src/lib/video-prompt-optimization-client.ts");

const body = {
  customerId: "customer-1",
  prompt: "An Acme cat walks through Shanghai.",
  personaId: "shot_director",
  locale: "en",
  videoThemeId: "theme-1",
  frameAssetIds: [],
  durationSeconds: 15,
  aspectRatio: "16:9",
  resolution: "720p"
};
const result = {
  optimizedPrompt: "Create one 15-second 16:9 720P video with Acme in Shanghai.",
  personaId: "shot_director",
  locale: "en",
  sourceHash: "a".repeat(64),
  optimizerVersion: "video-prompt-optimizer-v1"
};
const jsonResponse = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { "Content-Type": "application/json" }
});

const pollCalls = [];
const pollResponses = [
  jsonResponse({ ok: true, accepted: true, jobId: "job-1", job: { id: "job-1", status: "queued" } }, 202),
  jsonResponse({ ok: true, job: { id: "job-1", status: "running" } }),
  jsonResponse({ ok: true, job: { id: "job-1", status: "succeeded", result } })
];
const polled = await requestVideoPromptOptimization({
  siteId: "site-1",
  body,
  idempotencyKey: "idem-poll",
  headers: { "X-CSRF-Token": "csrf" },
  pollIntervalMs: 0,
  fetcher: async (url, options) => {
    pollCalls.push({ url: String(url), options });
    return pollResponses.shift();
  }
});
assert.deepEqual(polled, result);
assert.equal(pollCalls.length, 3);
assert.equal(pollCalls[0].options.method, "POST");
assert.equal(new Headers(pollCalls[0].options.headers).get("Idempotency-Key"), "idem-poll");
assert.match(pollCalls[1].url, /\/job-1$/);

const retryCalls = [];
const retried = await requestVideoPromptOptimization({
  siteId: "site-1",
  body,
  idempotencyKey: "idem-network-retry",
  headers: {},
  timeoutMs: 1_000,
  fetcher: async (_url, options) => {
    retryCalls.push(options);
    if (retryCalls.length === 1) throw new TypeError("network lost after submit");
    return jsonResponse({ ok: true, accepted: true, jobId: "job-2", job: { id: "job-2", status: "succeeded", result } }, 202);
  }
});
assert.deepEqual(retried, result);
assert.equal(retryCalls.length, 2);
assert.equal(new Headers(retryCalls[0].headers).get("Idempotency-Key"), "idem-network-retry");
assert.equal(new Headers(retryCalls[1].headers).get("Idempotency-Key"), "idem-network-retry");
assert.equal(retryCalls[0].body, retryCalls[1].body);

let refreshCount = 0;
let csrfCalls = 0;
let csrfHeaderVersion = 0;
const csrfHeaders = [];
await requestVideoPromptOptimization({
  siteId: "site-1",
  body,
  idempotencyKey: "idem-csrf",
  headers: () => ({ "X-CSRF-Token": `csrf-${csrfHeaderVersion}` }),
  refreshCsrf: async () => {
    refreshCount += 1;
    csrfHeaderVersion += 1;
  },
  fetcher: async (_url, options) => {
    csrfCalls += 1;
    csrfHeaders.push(new Headers(options.headers).get("X-CSRF-Token"));
    if (csrfCalls === 1) return jsonResponse({ error: "csrf_token_mismatch" }, 403);
    return jsonResponse({ ok: true, accepted: true, jobId: "job-3", job: { id: "job-3", status: "succeeded", result } }, 202);
  }
});
assert.equal(refreshCount, 1);
assert.equal(csrfCalls, 2);
assert.deepEqual(csrfHeaders, ["csrf-0", "csrf-1"]);

await assert.rejects(
  requestVideoPromptOptimization({
    siteId: "site-1",
    body,
    idempotencyKey: "idem-limit",
    headers: {},
    fetcher: async () => jsonResponse({ error: "video_prompt_optimization_limit_reached", retryAfter: 3600 }, 429)
  }),
  (error) => error instanceof VideoPromptOptimizationClientError && error.status === 429 && error.retryAfter === 3600
);

await assert.rejects(
  requestVideoPromptOptimization({
    siteId: "site-1",
    body,
    idempotencyKey: "idem-failed",
    headers: {},
    fetcher: async () => jsonResponse({ ok: true, accepted: true, jobId: "job-4", job: { id: "job-4", status: "failed", error: { message: "text_provider_not_configured" } } }, 202)
  }),
  /text_provider_not_configured/
);

await assert.rejects(
  requestVideoPromptOptimization({
    siteId: "site-1",
    body,
    idempotencyKey: "idem-invalid-result",
    headers: {},
    fetcher: async () => jsonResponse({ ok: true, accepted: true, jobId: "job-5", job: { id: "job-5", status: "succeeded", result: { ...result, locale: "es" } } }, 202)
  }),
  /video_prompt_optimization_invalid_result/
);

await assert.rejects(
  requestVideoPromptOptimization({
    siteId: "site-1",
    body,
    idempotencyKey: "idem-timeout",
    headers: {},
    timeoutMs: 5,
    pollIntervalMs: 1,
    fetcher: async (_url, options) => options?.method === "POST"
      ? jsonResponse({ ok: true, accepted: true, jobId: "job-6", job: { id: "job-6", status: "queued" } }, 202)
      : jsonResponse({ ok: true, job: { id: "job-6", status: "running" } })
  }),
  /video_prompt_optimization_timeout/
);

console.log(JSON.stringify({ ok: true, polling: true, idempotentNetworkRetry: true, csrfRetry: true, errors: true }, null, 2));
