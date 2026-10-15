import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import Module from "node:module";
import { createHmac } from "node:crypto";
import ts from "typescript";

const root = process.cwd();
const source = path.join(root, "src/lib/aidreamcapes-workspace");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "aidreamcapes-developer-webhooks-"));
const originalLoad = Module._load;
const keys = new Map();
const customers = new Map([["customer-a", "site_aidreamcapes"], ["customer-other", "site_dreamshoot"]]);
const tasks = new Map();
const deliveries = new Map();

const prisma = {
  async $queryRaw(strings, ...values) {
    const query = strings.join("?");
    if (query.includes("INSERT INTO \"AidreamcapesDeveloperApiKey\"")) {
      const [id, siteId, customerId, name, secretHash, scopesJson, expiresAt] = values;
      if (customers.get(customerId) !== siteId) return [];
      const row = { id, siteId, customerId, name, scopes: JSON.parse(scopesJson), createdAt: new Date(), expiresAt, revokedAt: null, lastUsedAt: null };
      keys.set(id, { ...row, secretHash });
      return [row];
    }
    if (query.includes("FROM \"AidreamcapesDeveloperApiKey\" k")) {
      const hash = values.find(value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value));
      const row = [...keys.values()].find(key => key.secretHash === hash);
      return row && customers.get(row.customerId) === "site_aidreamcapes" ? [{ ...row, ownerSiteId: customers.get(row.customerId) }] : [];
    }
    if (query.includes("UPDATE \"AidreamcapesDeveloperApiKey\"")) {
      const [id, siteId, customerId] = values;
      const row = keys.get(id);
      if (!row || row.siteId !== siteId || row.customerId !== customerId || row.revokedAt || row.expiresAt && row.expiresAt <= new Date()) return [];
      const now = new Date();
      if (!row.rateLimitWindowAt || row.rateLimitWindowAt.getTime() <= now.getTime() - 60_000) {
        row.rateLimitWindowAt = now;
        row.rateLimitCount = 1;
      } else row.rateLimitCount = (row.rateLimitCount ?? 0) + 1;
      row.lastUsedAt = now;
      return [{ rateLimitCount: row.rateLimitCount, rateLimitWindowAt: row.rateLimitWindowAt }];
    }
    if (query.includes("INSERT INTO \"AidreamcapesVideoTask\"")) {
      const [id, siteId, customerId, dataJson] = values;
      if (tasks.has(id) || customers.get(customerId) !== siteId) return [];
      const row = { data: JSON.parse(dataJson), revision: 1, createdAt: new Date(), updatedAt: new Date() };
      tasks.set(id, row);
      return [row];
    }
    if (query.includes("FROM \"AidreamcapesVideoTask\"")) {
      const row = tasks.get(values[0]);
      return row ? [row] : [];
    }
    if (query.includes("FROM \"AidreamcapesWebhookDelivery\" d")) {
      const requestedNow = values.find(value => value instanceof Date) ?? new Date();
      return [...deliveries.values()].filter(row => row.status === "pending" && row.nextAttemptAt <= requestedNow && row.customerId === "customer-a");
    }
    throw new Error(`Unexpected query in isolated smoke test: ${query}`);
  },
  async $executeRaw(strings, ...values) {
    const query = strings.join("?");
    if (query.includes("UPDATE \"AidreamcapesDeveloperApiKey\" SET \"revokedAt\"")) {
      const row = keys.get(values[0]);
      if (!row || row.siteId !== values[1] || row.customerId !== values[2] || row.revokedAt) return 0;
      row.revokedAt = new Date();
      return 1;
    }
    if (query.includes("UPDATE \"AidreamcapesWebhookDelivery\"")) {
      const [attemptCount, status, nextAttemptAt, lastStatusCode, lastError, deliveredAt, id] = values;
      const row = deliveries.get(id);
      if (!row) return 0;
      Object.assign(row, { attemptCount, status, nextAttemptAt, lastStatusCode, lastError, deliveredAt });
      return 1;
    }
    throw new Error(`Unexpected write in isolated smoke test: ${query}`);
  }
};

Module._load = function (request, parent, isMain) {
  if (request === "server-only") return {};
  if (request === "@/lib/prisma") return { prisma };
  if (request === "@/lib/stores/asset-store") return {
    getCustomerAssetsRelational: async () => ({ assets: [] }),
    toThemeRuntimeAssetRelational: value => value
  };
  return originalLoad.call(this, request, parent, isMain);
};

try {
  for (const name of ["types", "catalogs", "capabilities", "pipeline", "developer-api", "webhooks", "store"]) {
    const result = ts.transpileModule(fs.readFileSync(path.join(source, `${name}.ts`), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
    });
    fs.writeFileSync(path.join(temp, `${name}.js`), result.outputText);
  }
  const require = createRequire(path.join(temp, "entry.cjs"));
  const api = require("./developer-api.js");
  const hooks = require("./webhooks.js");
  const store = require("./store.js");

  const created = await api.createDeveloperKey("site_aidreamcapes", "customer-a", "smoke key", ["read"]);
  assert.equal(created.key.name, "smoke key");
  assert.deepEqual(created.key.scopes, ["read"]);
  assert.match(created.oneTimeSecret, /^adk_live_[A-Za-z0-9_-]{43}$/);
  assert.equal(created.key.secret, undefined);
  assert.equal(created.key.secretHash, undefined);
  const storedKey = keys.get(created.key.id);
  assert.equal(storedKey.secretHash, api.hashDeveloperSecret(created.oneTimeSecret));
  assert.notEqual(storedKey.secretHash, created.oneTimeSecret);
  assert.equal((await api.authenticateDeveloperKey(new Request("https://local.test", { headers: { authorization: `Bearer ${created.oneTimeSecret}` } }), "site_aidreamcapes", "read")).customerId, "customer-a");
  await assert.rejects(() => api.authenticateDeveloperKey(new Request("https://local.test", { headers: { authorization: `Bearer ${created.oneTimeSecret}` } }), "site_aidreamcapes", "write"), error => error.code === "developer_key_scope_required");
  const writeCreated = await api.createDeveloperKey("site_aidreamcapes", "customer-a", "write key", ["write"]);
  assert.equal((await api.authenticateDeveloperKey(new Request("https://local.test", { headers: { authorization: `Bearer ${writeCreated.oneTimeSecret}` } }), "site_aidreamcapes", "write")).customerId, "customer-a");
  await assert.rejects(() => api.authenticateDeveloperKey(new Request("https://local.test", { headers: { authorization: `Bearer ${writeCreated.oneTimeSecret}` } }), "site_aidreamcapes", "read"), error => error.code === "developer_key_scope_required");
  assert.throws(() => api.normalizeDeveloperScopes(["admin"]), error => error.code === "developer_key_scopes_invalid");
  assert.equal(api.isDeveloperKeyActive({ expiresAt: new Date(Date.now() - 1) }), false);
  assert.equal(api.isDeveloperKeyActive({ revokedAt: new Date() }), false);
  const expiredSecret = api.createDeveloperSecret();
  keys.set("expired-key", { id: "expired-key", siteId: "site_aidreamcapes", customerId: "customer-a", name: "expired", scopes: ["read"],
    secretHash: expiredSecret.secretHash, createdAt: new Date(), expiresAt: new Date(Date.now() - 1), revokedAt: null, lastUsedAt: null });
  await assert.rejects(() => api.authenticateDeveloperKey(new Request("https://local.test", { headers: { authorization: `Bearer ${expiredSecret.secret}` } }), "site_aidreamcapes", "read"), error => error.status === 401);
  await api.revokeDeveloperKey("site_aidreamcapes", "customer-a", created.key.id);
  await assert.rejects(() => api.authenticateDeveloperKey(new Request("https://local.test", { headers: { authorization: `Bearer ${created.oneTimeSecret}` } }), "site_aidreamcapes", "read"), error => error.status === 401);
  await assert.rejects(() => api.createDeveloperKey("site_aidreamcapes", "customer-other", "wrong owner", ["read"]), error => error.code === "customer_site_mismatch");
  assert.throws(() => api.assertAidreamcapesOwner("site_dreamshoot", "site_dreamshoot"), error => error.status === 404);
  const limitedKey = await api.createDeveloperKey("site_aidreamcapes", "customer-a", "limited key", ["read"]);
  for (let attempt = 0; attempt < 120; attempt += 1) {
    await api.authenticateDeveloperKey(new Request("https://local.test", { headers: { authorization: `Bearer ${limitedKey.oneTimeSecret}` } }), "site_aidreamcapes", "read");
  }
  await assert.rejects(() => api.authenticateDeveloperKey(new Request("https://local.test", { headers: { authorization: `Bearer ${limitedKey.oneTimeSecret}` } }), "site_aidreamcapes", "read"), error => error.code === "developer_key_rate_limited");

  const input = require("./catalogs.js").defaultTaskInput("texture_closeup");
  const idempotency = api.developerIdempotencyKey("key-a", "request-123");
  assert.equal(idempotency, api.developerIdempotencyKey("key-a", "request-123"));
  const firstTask = await store.createTask("site_aidreamcapes", "customer-a", "texture_closeup", input, [], "Draft", idempotency);
  const replayTask = await store.createTask("site_aidreamcapes", "customer-a", "texture_closeup", input, [], "Draft", idempotency);
  assert.equal(firstTask.taskId, replayTask.taskId);
  assert.equal(firstTask.status, "draft");
  assert.equal(tasks.size, 1);
  await assert.rejects(() => store.createTask("site_aidreamcapes", "customer-a", "texture_closeup", { ...input, fields: { detail: "different" } }, [], "Draft", idempotency), error => error.code === "idempotency_conflict");

  process.env.AIDREAMCAPES_WEBHOOK_ENCRYPTION_KEY = "test-only-master-key-with-more-than-32-bytes";
  const webhookSecret = hooks.createWebhookSecret();
  const ciphertext = hooks.encryptWebhookSecret(webhookSecret);
  assert.equal(hooks.decryptWebhookSecret(ciphertext), webhookSecret);
  const timestamp = 1_800_000_000_000;
  let transportCalls = 0;
  let resolverCalls = 0;
  const publicResolver = async () => { resolverCalls += 1; return [{ address: "93.184.216.34", family: 4 }]; };
  await assert.rejects(() => hooks.resolvePublicWebhookTarget("https://public.example/hook", async () => [{ address: "127.0.0.1", family: 4 }]), error => error.code === "webhook_target_private");
  await assert.rejects(() => hooks.resolvePublicWebhookTarget("http://public.example/hook", publicResolver), error => error.code === "webhook_target_invalid");

  const signed = await hooks.deliverWebhookAttempt({ endpointUrl: "https://public.example/hook", secret: webhookSecret, eventType: "task.created", deliveryId: "delivery-1", payload: { test: true },
    resolveDns: publicResolver, now: timestamp, transport: async (target, body, headers) => {
      transportCalls += 1;
      assert.equal(target.addresses[0].address, "93.184.216.34");
      const expected = createHmac("sha256", webhookSecret).update(`${Math.floor(timestamp / 1000)}.${body}`).digest("hex");
      assert.equal(headers["X-Aidreamcapes-Signature"], `t=${Math.floor(timestamp / 1000)},v1=${expected}`);
      return { status: 202 };
    } });
  assert.equal(signed.status, 202);

  const now = new Date("2026-10-14T00:00:00.000Z");
  const deliveryId = "delivery-retry";
  deliveries.set(deliveryId, { id: deliveryId, siteId: "site_aidreamcapes", customerId: "customer-a", subscriptionId: "sub-a", eventKey: "retry-test", eventType: "task.created",
    payload: { id: "evt-test", type: "task.created" }, attemptCount: 0, endpointUrl: "https://public.example/hook", secretCiphertext: ciphertext, status: "pending", nextAttemptAt: now });
  const noNetworkTransport = async () => { transportCalls += 1; return { status: 503 }; };
  let expectedRetryAt = now.getTime();
  for (let attempt = 1; attempt <= hooks.MAX_WEBHOOK_ATTEMPTS; attempt += 1) {
    const row = deliveries.get(deliveryId);
    const result = await hooks.processDueWebhookDeliveries("site_aidreamcapes", "customer-a", { transport: noNetworkTransport, resolveDns: publicResolver, now: row.nextAttemptAt });
    assert.equal(result.processed, 1);
    assert.equal(row.attemptCount, attempt);
    assert.equal(row.status, attempt === hooks.MAX_WEBHOOK_ATTEMPTS ? "failed" : "pending");
    if (attempt < hooks.MAX_WEBHOOK_ATTEMPTS) {
      expectedRetryAt += hooks.webhookRetryDelayMs(attempt);
      assert.equal(row.nextAttemptAt.getTime(), expectedRetryAt);
    }
  }
  assert.equal(deliveries.get(deliveryId).status, "failed");
  assert.equal(resolverCalls, transportCalls);
  assert.equal(hooks.webhookRetryDelayMs(hooks.MAX_WEBHOOK_ATTEMPTS), 0);
  assert.equal(hooks.MAX_WEBHOOK_ATTEMPTS, 5);

  const routeFiles = [
    "src/app/api/sites/[siteId]/aivideosugc/developer-keys/route.ts",
    "src/app/api/sites/[siteId]/aivideosugc/developer-keys/[keyId]/route.ts",
    "src/app/api/sites/[siteId]/aivideosugc/developer/v1/tasks/route.ts",
    "src/app/api/sites/[siteId]/aivideosugc/webhooks/route.ts",
    "src/app/api/sites/[siteId]/aivideosugc/webhooks/[subscriptionId]/route.ts",
    "src/app/api/sites/[siteId]/aivideosugc/webhooks/deliveries/route.ts"
  ];
  for (const file of routeFiles) {
    const content = fs.readFileSync(path.join(root, file), "utf8");
    const routeLogic = content.replace(/^import\b[^\n]*$/gm, "");
    assert.doesNotMatch(routeLogic, /\b(?:chargeCredits|recordLedger|dispatchProvider|generate(?:Video|Speech|Audio)|speech|tts|asr)\b/i);
  }
  assert.match(fs.readFileSync(path.join(root, routeFiles[0]), "utf8"), /secretShownOnce:\s*true/);
  assert.match(fs.readFileSync(path.join(root, "src/lib/aidreamcapes-workspace/webhooks.ts"), "utf8"), /AIDREAMCAPES_WEBHOOK_DELIVERY_ENABLED/);
  assert.equal(transportCalls, 6);
  console.log("Aidreamcapes developer API and webhook smoke checks passed; injected transports kept network calls at zero.");
} finally {
  Module._load = originalLoad;
  fs.rmSync(temp, { recursive: true, force: true });
}
