import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";

loadRuntimeEnv();

const prisma = new PrismaClient();
const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:3002").replace(/\/$/, "");
const siteSlug = process.env.SITE_ADMIN_SITE_SLUG ?? "mydreamshoots";
const adminEmail = process.env.SITE_ADMIN_USER ?? "owner@mydreamshoots.localhost";
const adminPassword = process.env.SITE_ADMIN_PASSWORD ?? "mydreamshoots123";
const runId = `${Date.now().toString(36)}_${crypto.randomBytes(3).toString("hex")}`;
const created = {
  customerId: undefined,
  jobId: undefined
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function uid(prefix) {
  return `${prefix}_${runId}_${crypto.randomBytes(3).toString("hex")}`;
}

function hashPassword(value) {
  return `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
}

function splitSetCookie(headerValue) {
  if (!headerValue) return [];
  return headerValue.split(/,(?=\s*[^;,=]+=)/).map((part) => part.trim()).filter(Boolean);
}

function cookieFrom(response, name) {
  const setCookies = response.headers.getSetCookie?.() ?? splitSetCookie(response.headers.get("set-cookie"));
  const cookie = setCookies.find((value) => value.startsWith(`${name}=`))?.split(";")[0];
  if (!cookie) throw new Error(`missing_cookie:${name}`);
  return cookie;
}

function cookieValue(cookie, name) {
  const value = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
  if (!value) throw new Error(`missing_cookie_value:${name}`);
  return decodeURIComponent(value);
}

function signWorkerCallback(payload) {
  const unsigned = { ...payload };
  delete unsigned.signature;
  return crypto
    .createHmac("sha256", process.env.AI_WORKER_SECRET ?? "dev-worker-secret")
    .update(JSON.stringify(unsigned))
    .digest("hex");
}

async function request(path, { method = "GET", body, cookie, csrf, allowFailure = false } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      ...(csrf ? { "x-csrf-token": csrf } : {})
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual"
  });
  const json = await response.clone().json().catch(() => ({}));
  if (!allowFailure && !response.ok) {
    throw new Error(`${method} ${path} failed:${response.status}:${JSON.stringify(json)}`);
  }
  return { response, json };
}

async function loginSiteAdmin(siteId) {
  const { response } = await request(`/api/sites/${siteId}/admin/auth/login`, {
    method: "POST",
    body: { email: adminEmail, password: adminPassword }
  });
  const csrfName = `site_admin_csrf_${siteId}`;
  const sessionCookie = cookieFrom(response, `site_admin_session_${siteId}`);
  const csrfCookie = cookieFrom(response, csrfName);
  return {
    cookie: `${sessionCookie}; ${csrfCookie}`,
    csrf: cookieValue(csrfCookie, csrfName)
  };
}

async function createReservedRunningJob(siteId) {
  const aiApp = await prisma.aiApp.findFirst({ where: { slug: "image_generator" } });
  assert(aiApp, "missing_image_generator_ai_app");
  const customerId = uid("cust_process_smoke");
  const jobId = uid("job_process_smoke");
  created.customerId = customerId;
  created.jobId = jobId;

  await prisma.customer.create({
    data: {
      id: customerId,
      siteId,
      email: `${customerId}@example.test`,
      passwordHash: hashPassword("SmokePass1!"),
      name: "Process Management Smoke",
      status: "active",
      balance: {
        create: {
          id: uid("bal_process_smoke"),
          siteId,
          balance: 20,
          reserved: 0
        }
      }
    }
  });
  await prisma.generationJob.create({
    data: {
      id: jobId,
      siteId,
      customerId,
      aiAppId: aiApp.id,
      status: "running",
      creditsReserved: 5,
      requestJson: {
        mode: "theme",
        fields: { creativePackName: "Smoke Studio Pack" },
        billing: { outputCount: 2, unitCreditCost: 5, creditsReserved: 5 }
      },
      resultJson: {
        requestId: `req_${jobId}`,
        lastWorkerStatus: "running",
        lastWorkerStage: "provider_request_started",
        lastWorkerProgress: 35,
        outputSlots: [
          { index: 1, status: "running", stage: "provider_request_started", progress: 35 },
          { index: 2, status: "queued", stage: "queued", progress: 0 }
        ],
        providerTaskId: `provider_${jobId}`
      }
    }
  });
  await prisma.creditBalance.update({
    where: { customerId },
    data: { balance: { decrement: 5 }, reserved: { increment: 5 } }
  });
  await prisma.creditLedger.create({
    data: {
      id: uid("led_process_reserve"),
      siteId,
      customerId,
      amount: -5,
      type: "reserve",
      sourceType: "generation_job",
      sourceId: jobId
    }
  });
  return { aiAppId: aiApp.id, customerId, jobId };
}

async function cleanup() {
  await prisma.auditLog.deleteMany({ where: { targetId: created.jobId } }).catch(() => undefined);
  if (created.customerId) await prisma.customer.deleteMany({ where: { id: created.customerId } }).catch(() => undefined);
}

try {
  const site = await prisma.site.findUnique({ where: { slug: siteSlug } });
  assert(site, `missing_site:${siteSlug}`);
  const admin = await loginSiteAdmin(site.id);
  const smokeJob = await createReservedRunningJob(site.id);

  const listed = await request(`/api/sites/${site.id}/admin/processes-page?filter=active&search=${encodeURIComponent(smokeJob.jobId)}`, {
    cookie: admin.cookie
  });
  const process = listed.json.processes?.find((item) => item.id === smokeJob.jobId);
  assert(process, "process_not_listed_as_active");
  assert(process.canTerminate === true, "active_process_not_terminable");
  assert(process.alias.includes("图片生成") && process.alias.includes("Smoke Studio Pack"), `bad_process_alias:${process.alias}`);
  assert(listed.json.summary?.activeReservedCredits >= 5, "summary_missing_reserved_credits");

  const terminated = await request(`/api/sites/${site.id}/admin/processes/${smokeJob.jobId}/terminate`, {
    method: "POST",
    cookie: admin.cookie,
    csrf: admin.csrf,
    body: { reason: "smoke process termination" }
  });
  assert(terminated.json.job?.status === "failed", "terminated_job_not_failed");
  assert(terminated.json.job?.resultJson?.error === "generation_job_terminated_by_admin", "termination_error_code_missing");
  assert(terminated.json.ledgerAction?.type === "release" && terminated.json.ledgerAction?.amount === 5, "release_ledger_missing");
  assert(terminated.json.customerBalance?.available === 20 && terminated.json.customerBalance?.reserved === 0, "credits_not_released");

  const terminatedList = await request(`/api/sites/${site.id}/admin/processes-page?filter=terminated&search=${encodeURIComponent(smokeJob.jobId)}`, {
    cookie: admin.cookie
  });
  const terminatedProcess = terminatedList.json.processes?.find((item) => item.id === smokeJob.jobId);
  assert(terminatedProcess?.displayStatus === "已终止", "terminated_process_not_displayed");
  assert(terminatedProcess?.canTerminate === false, "terminated_process_still_terminable");

  const unsignedLateResult = {
    jobId: smokeJob.jobId,
    siteId: site.id,
    requestId: `late_${smokeJob.jobId}`,
    status: "succeeded",
    outputs: [{ storageKey: `smoke/${smokeJob.jobId}/late.webp`, mimeType: "image/webp" }],
    providerTrace: [{ provider: "smoke.fake.worker", attempts: 1 }],
    costTrace: { estimatedCostUsd: 0 }
  };
  const lateResult = await request(`/api/internal/ai-worker/jobs/${smokeJob.jobId}/result`, {
    method: "POST",
    body: { ...unsignedLateResult, signature: signWorkerCallback(unsignedLateResult) }
  });
  assert(lateResult.json.alreadyProcessed === true, "late_callback_not_idempotent");
  assert(lateResult.json.ledgerAction === null, "late_callback_changed_ledger");

  const [balance, releaseLedger, albums, auditLogs, activeJobs] = await Promise.all([
    prisma.creditBalance.findUniqueOrThrow({ where: { customerId: smokeJob.customerId } }),
    prisma.creditLedger.findUnique({ where: { siteId_customerId_type_sourceId: { siteId: site.id, customerId: smokeJob.customerId, type: "release", sourceId: smokeJob.jobId } } }),
    prisma.album.findMany({ where: { siteId: site.id, sourceJobId: smokeJob.jobId } }),
    prisma.auditLog.findMany({ where: { siteId: site.id, targetType: "generation_job", targetId: smokeJob.jobId, action: "generation_job_terminated" } }),
    prisma.generationJob.count({ where: { siteId: site.id, customerId: smokeJob.customerId, status: { in: ["queued", "running"] } } })
  ]);
  assert(balance.balance === 20 && balance.reserved === 0, `balance_after_late_callback_changed:${balance.balance}:${balance.reserved}`);
  assert(releaseLedger?.amount === 5 && releaseLedger.type === "release", "release_ledger_not_persisted");
  assert(albums.length === 0, "album_created_for_terminated_job");
  assert(auditLogs.length === 1, "termination_audit_log_missing");
  assert(activeJobs === 0, "terminated_job_still_blocks_next_generation");

  console.log(JSON.stringify({
    ok: true,
    siteId: site.id,
    jobId: smokeJob.jobId,
    alias: terminatedProcess.alias,
    releasedCredits: releaseLedger.amount,
    lateCallbackAlreadyProcessed: lateResult.json.alreadyProcessed,
    activeJobs
  }, null, 2));
} finally {
  await cleanup();
  await prisma.$disconnect();
}
