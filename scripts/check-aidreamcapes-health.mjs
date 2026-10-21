#!/usr/bin/env node
// Token-gated readiness probe for the Aidreamcapes production service.
//
// Usage:
//   AIDREAMCAPES_HEALTH_TOKEN=... node scripts/check-aidreamcapes-health.mjs
//   AIDREAMCAPES_HEALTH_ORIGIN=https://www.aivideosugc.com AIDREAMCAPES_HEALTH_TOKEN=... node scripts/check-aidreamcapes-health.mjs
import assert from "node:assert/strict";

const origin = String(process.env.AIDREAMCAPES_HEALTH_ORIGIN || "http://127.0.0.1:3013").replace(/\/$/, "");
const token = String(process.env.AIDREAMCAPES_HEALTH_TOKEN || "").trim();
assert(token.length >= 16, "AIDREAMCAPES_HEALTH_TOKEN is required");

const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 15000);
try {
  const response = await fetch(`${origin}/api/aidreamcapes/health`, {
    headers: {
      "x-aidreamcapes-health-token": token,
      accept: "application/json"
    },
    signal: controller.signal
  });
  const body = await response.json().catch(() => null);
  assert.equal(response.status, 200, `health returned ${response.status}`);
  assert.equal(body?.ok, true, "health payload is not ok");
  console.log(JSON.stringify(body, null, 2));
} finally {
  clearTimeout(timer);
}
