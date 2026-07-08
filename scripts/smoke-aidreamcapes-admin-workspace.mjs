import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";

loadRuntimeEnv();

const prisma = new PrismaClient();
const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:3002").replace(/\/$/, "");
const siteId = "site_aidreamcapes";
const siteSlug = "aidreamcapes";
const password = "SmokePass1!";
const createdIds = {
  adminId: undefined,
  customerId: undefined,
  assetId: undefined
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function hashPassword(value) {
  return `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
}

function cookieHeader(headers) {
  const raw = headers.getSetCookie?.() ?? [];
  const cookies = raw.length ? raw : [headers.get("set-cookie")].filter(Boolean);
  return cookies.map((cookie) => cookie.split(";")[0]).join("; ");
}

function cookieValue(cookie, name) {
  return cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.split("=")
    .slice(1)
    .join("=");
}

async function createSmokeIdentity() {
  const sourceAsset = await prisma.assetUpload.findFirst({
    where: {
      siteId,
      role: { in: ["input", "training_input"] },
      deletedAt: null
    },
    orderBy: { createdAt: "desc" },
    select: {
      storageKey: true,
      mimeType: true,
      label: true
    }
  });
  assert(sourceAsset, "missing_source_asset_for_workspace_smoke");

  const siteAiApp = await prisma.siteAiApp.findFirst({
    where: { siteId, enabled: true, aiApp: { slug: "image_generator" } },
    include: { aiApp: true }
  });
  assert(siteAiApp, "missing_enabled_aidreamcapes_image_generator");

  const creativePack = await prisma.creativePack.findFirst({
    where: { siteId, status: "active", aiAppSlug: siteAiApp.aiApp.slug },
    orderBy: { createdAt: "asc" }
  });
  assert(creativePack, "missing_active_aidreamcapes_image_generator_pack");

  const customerId = uid("cust_admin_workspace_smoke");
  const adminId = uid("admin_workspace_smoke");
  const assetId = uid("asset_admin_workspace_smoke");
  const email = `${customerId}@example.test`;
  createdIds.customerId = customerId;
  createdIds.adminId = adminId;
  createdIds.assetId = assetId;

  await prisma.customer.create({
    data: {
      id: customerId,
      siteId,
      email,
      passwordHash: hashPassword(password),
      name: "Admin Workspace Smoke",
      status: "active",
      balance: {
        create: {
          id: uid("bal_admin_workspace_smoke"),
          siteId,
          balance: 500,
          reserved: 0
        }
      }
    }
  });
  await prisma.siteAdmin.create({
    data: {
      id: adminId,
      siteId,
      email,
      passwordHash: hashPassword(password),
      displayName: "Admin Workspace Smoke",
      role: "admin"
    }
  });
  await prisma.assetUpload.create({
    data: {
      id: assetId,
      siteId,
      customerId,
      label: sourceAsset.label || "Smoke source photo",
      storageKey: sourceAsset.storageKey,
      mimeType: sourceAsset.mimeType || "image/jpeg",
      role: "input",
      visibility: "private",
      reviewStatus: "approved",
      subjectRole: "primary"
    }
  });

  return { assetId, creativePack, customerId, email, siteAiApp };
}

async function loginCustomer(email) {
  const response = await fetch(`${baseUrl}/api/sites/${siteId}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const data = await response.json().catch(() => ({}));
  assert(response.ok && data.ok, `customer_login_failed:${response.status}:${data.error ?? "unknown"}`);
  const cookie = cookieHeader(response.headers);
  assert(cookie.includes(`customer_session_${siteId}`), "missing_customer_session_cookie");
  return cookie;
}

async function fetchBootstrap(cookie, assetId) {
  const response = await fetch(`${baseUrl}/api/site-slugs/${siteSlug}/customer/bootstrap`, {
    headers: { cookie }
  });
  const data = await response.json().catch(() => ({}));
  assert(response.ok && data.ok, `workspace_bootstrap_failed:${response.status}:${data.error ?? "unknown"}`);
  assert(data.workspaceRuntime?.adminAccess?.canBypassBilling === true, "workspace_admin_access_not_enabled");
  assert(
    (data.workspaceRuntime?.assets ?? []).some((asset) => asset.id === assetId && asset.previewUrl),
    "workspace_bootstrap_missing_initial_asset"
  );
  return data;
}

async function createAdminJob(cookie, identity) {
  const csrf = cookieValue(cookie, `customer_csrf_${siteId}`);
  assert(csrf, "missing_customer_csrf_cookie");
  const response = await fetch(`${baseUrl}/api/sites/${siteId}/ai/jobs`, {
    method: "POST",
    headers: {
      cookie,
      "Content-Type": "application/json",
      "x-csrf-token": decodeURIComponent(csrf),
      "x-smoke-skip-worker-dispatch": "1"
    },
    body: JSON.stringify({
      customerId: identity.customerId,
      aiAppSlug: identity.siteAiApp.aiApp.slug,
      params: {
        mode: "theme",
        creativePackId: identity.creativePack.id,
        assetIds: [identity.assetId],
        primaryAssetIds: [identity.assetId],
        partnerAssetIds: [],
        fields: {
          outputCount: 1,
          packageAudience: "self",
          creativePackName: identity.creativePack.name,
          creativePackPrompt: identity.creativePack.prompt ?? "",
          primaryAssetIds: [identity.assetId],
          partnerAssetIds: []
        }
      }
    })
  });
  const data = await response.json().catch(() => ({}));
  assert(response.ok && data.ok, `admin_job_create_failed:${response.status}:${data.error ?? "unknown"}`);
  assert(data.adminAccess?.canBypassBilling === true, "job_response_missing_admin_access");
  const expectedCredits = Number(identity.creativePack.creditCost ?? identity.siteAiApp.creditCost ?? 0);
  assert(data.job?.creditsReserved === expectedCredits, `admin_job_reserved_credits:${data.job?.creditsReserved}`);
  assert(data.ledgerAction?.type === "reserve", `admin_job_missing_reserve_ledger:${data.ledgerAction?.type ?? "none"}`);
  assert(data.ledgerAction?.amount === -expectedCredits, `admin_job_reserve_amount:${data.ledgerAction?.amount}`);
  assert(data.customerBalance?.available === 500 - expectedCredits, `admin_customer_available_changed:${data.customerBalance?.available}`);
  assert(data.customerBalance?.reserved === expectedCredits, `admin_customer_reserved_changed:${data.customerBalance?.reserved}`);
  return data;
}

async function cleanup() {
  await prisma.siteAdmin.deleteMany({ where: { id: createdIds.adminId } }).catch(() => undefined);
  await prisma.customer.deleteMany({ where: { id: createdIds.customerId } }).catch(() => undefined);
}

try {
  const identity = await createSmokeIdentity();
  const cookie = await loginCustomer(identity.email);
  await fetchBootstrap(cookie, identity.assetId);
  const created = await createAdminJob(cookie, identity);
  console.log(JSON.stringify({
    ok: true,
    bootstrap: "workspaceRuntime.assets present",
    jobId: created.job.id,
    creditsReserved: created.job.creditsReserved,
    ledgerAction: created.ledgerAction.type,
    subscriptionBypass: created.adminAccess.source
  }, null, 2));
} finally {
  await cleanup();
  await prisma.$disconnect();
}
