import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

// Real auth orchestration, CSRF signatures and limiter; only the cookie context
// and relational session reader are mocked. No DB module or provider is loaded.
const nativeRequire = createRequire(import.meta.url);
const { NextRequest } = nativeRequire("next/server");
const SITE = "site_aidreamcapes";
const state = { hasCookie: true, active: true, customerSite: SITE, reads: 0 };
const expiresAt = new Date(Date.now() + 3600_000).toISOString();
const session = { id: "fixture-session", siteId: SITE, customerId: "fixture-customer", expiresAt };
const sessionHelpers = {
  customerSessionCookie: (siteId) => `customer_session_${siteId}`,
  platformSessionCookie: () => "platform_session",
  siteAdminSessionCookie: (siteId) => `site_admin_session_${siteId}`,
  shouldUseSecureCookie: () => false,
};
const sessionReader = async ({ siteId, sessionId }) => {
  state.reads++;
  assert.equal(siteId, SITE);
  assert.equal(sessionId, session.id);
  return state.active ? { session, customer: { id: session.customerId, siteId: state.customerSite } } : undefined;
};
const cache = new Map();
const mocks = {
  "server-only": {},
  "@/lib/session": sessionHelpers,
  "next/headers": { cookies: async () => ({ get: (name) =>
    state.hasCookie && name === sessionHelpers.customerSessionCookie(SITE) ? { value: session.id } : undefined }) },
  "@/lib/stores/customer-store": { getCustomerBySessionRelational: sessionReader },
  "@/lib/stores/platform-store": {},
  "@/lib/stores/site-store": {},
};
function load(relativePath) {
  const filename = path.resolve(relativePath);
  if (cache.has(filename)) return cache.get(filename);
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const fixtureModule = { exports: {} };
  cache.set(filename, fixtureModule.exports);
  const requireFixture = (id) => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (id === "next/server" || id === "crypto" || id.startsWith("node:")) return nativeRequire(id);
    if (id === "./store") return { assertWorkspaceSite: (siteId) => {
      if (siteId !== SITE) throw new (load("src/lib/aidreamcapes-workspace/types.ts").WorkspaceError)("workspace_site_not_found", 404);
    } };
    if (id === "./types") return load("src/lib/aidreamcapes-workspace/types.ts");
    if (id.startsWith("@/lib/")) return load(`src/lib/${id.slice("@/lib/".length)}.ts`);
    throw new Error(`Unexpected dependency; DB/network loading is forbidden: ${id}`);
  };
  new Function("require", "module", "exports", output)(requireFixture, fixtureModule, fixtureModule.exports);
  return fixtureModule.exports;
}
const sharedAuth = load("src/lib/api-auth.ts");
const csrf = load("src/lib/security/csrf.ts");
const { RATE_LIMITS, checkRateLimit } = load("src/lib/security/rate-limit.ts");
const workspace = load("src/lib/aidreamcapes-workspace/auth.ts");
const { WorkspaceError } = load("src/lib/aidreamcapes-workspace/types.ts");

// Baseline is the previous workspace orchestration using the unmodified shared
// guard. Keep the production shared guard in the comparison so policy drift
// (configuration/key/CSRF response) fails this smoke.
async function baseline(request, siteId, mutation = false) {
  if (siteId !== SITE) throw new WorkspaceError("workspace_site_not_found", 404);
  const current = await sharedAuth.getCurrentCustomerForSite(siteId);
  if (!current || current.customer.siteId !== siteId) throw new WorkspaceError("customer_login_required", 401);
  if (mutation) {
    const guard = await sharedAuth.requireCustomerMutation(request, siteId, current.customer.id);
    if (!guard.ok) return { ok: false, response: guard.response };
  }
  return { ok: true, current };
}
const reset = () => {
  Object.assign(state, { hasCookie: true, active: true, customerSite: SITE, reads: 0 });
  sharedAuth.clearCustomerSessionAuthCache();
  globalThis.__dingyueRateLimitStore.clear();
};
const request = (mode = "valid") => {
  const headers = {};
  if (mode !== "missing") {
    const token = csrf.createCsrfToken(`customer:${SITE}`, mode === "wrong-session" ? "other-session" : session.id);
    headers.cookie = `${csrf.csrfCookieName(`customer:${SITE}`)}=${token}`;
    headers["x-csrf-token"] = mode === "mismatch" ? "different" : token;
  }
  return new NextRequest("http://fixture.invalid/api/workspace", { method: "POST", headers });
};
async function outcome(guard, req, mutation = true, siteId = SITE) {
  try {
    const value = await guard(req, siteId, mutation);
    return value.ok ? { status: 200, customerId: value.current.customer.id } : {
      status: value.response.status, body: await value.response.json(),
      retryAfter: value.response.headers.get("Retry-After"),
      remaining: value.response.headers.get("X-RateLimit-Remaining"),
    };
  } catch (error) { return { status: error.status, error: error.code }; }
}
for (const [name, setup, mode, mutation, status] of [
  ["valid mutation", () => {}, "valid", true, 200],
  ["read", () => {}, "missing", false, 200],
  ["anonymous", () => { state.hasCookie = false; }, "valid", true, 401],
  ["revoked/blocked session", () => { state.active = false; }, "valid", true, 401],
  ["foreign customer", () => { state.customerSite = "site_other"; }, "valid", true, 401],
  ["missing CSRF", () => {}, "missing", true, 403],
  ["mismatched CSRF", () => {}, "mismatch", true, 403],
  ["CSRF signed for different session", () => {}, "wrong-session", true, 403],
]) {
  reset(); setup();
  const req = request(mode);
  const before = await outcome(baseline, req, mutation);
  const oldReads = state.reads;
  reset(); setup();
  const after = await outcome(workspace.workspaceAuth, req, mutation);
  assert.deepEqual(after, before, name);
  assert.equal(after.status, status, name);
  assert.equal(state.reads, state.hasCookie ? 1 : 0, `${name}: current request checks relational auth exactly once`);
  if (mutation && status !== 401) assert.equal(oldReads, 2, `${name}: baseline performs two relational reads`);
}
reset();
assert.deepEqual(await outcome(workspace.workspaceAuth, request(), true, "site_other"), { status: 404, error: "workspace_site_not_found" });
assert.equal(state.reads, 0, "reject foreign site before any customer read");

const req = request();
const fillSharedBucket = () => {
  for (let i = 0; i < RATE_LIMITS.api.maxRequests; i++) checkRateLimit(req, RATE_LIMITS.api, `${SITE}:${session.customerId}`);
};
reset(); fillSharedBucket();
const oldLimit = await outcome(baseline, req);
assert.equal(state.reads, 2);
reset(); fillSharedBucket();
const newLimit = await outcome(workspace.workspaceAuth, req);
assert.deepEqual(newLimit, oldLimit, "same shared API bucket and 429 response/headers");
assert.equal(newLimit.status, 429);
assert.equal(state.reads, 1);

reset();
const badCsrf = await outcome(workspace.workspaceAuth, request("missing"));
assert.equal(badCsrf.status, 403);
assert.equal(globalThis.__dingyueRateLimitStore.size, 0, "CSRF failure must not consume the API limit");
assert.equal((await outcome(workspace.workspaceAuth, request())).status, 200);
state.active = false;
assert.equal((await outcome(workspace.workspaceAuth, request())).status, 401,
  "revocation on the next request remains immediate; no positive-session cache is introduced");
assert.equal(state.reads, 3);
console.log("PASS: one relational session read per workspace mutation (previously two), preserving 401/404, signed CSRF 403, shared API rate-limit 429 and next-request revocation.");
