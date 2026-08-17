import "./load-runtime-env.mjs";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

const baseUrl = process.env.SITE_ADMIN_ROLE_SMOKE_BASE_URL ?? "http://127.0.0.1:3002";
const clientTimeoutMs = Number(process.env.SITE_ADMIN_ROLE_SMOKE_TIMEOUT_MS ?? 8_000);
const lockMs = Number(process.env.SITE_ADMIN_ROLE_SMOKE_LOCK_MS ?? clientTimeoutMs + 1_000);
const suffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const siteId = `smoke_admin_role_${suffix}`;
const siteSlug = `smoke-admin-role-${suffix}`;
const adminEmail = `owner-${suffix}@example.test`;
const customerEmail = `customer-${suffix}@example.test`;
const adminPassword = "smoke-owner-123";
const prisma = new PrismaClient();
const lockPrisma = new PrismaClient();
let originalPlatformState;
let hadPlatformStateDocument = false;

function hashPassword(password) {
  return `sha256:${crypto.createHash("sha256").update(password).digest("hex")}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cookieFrom(response, name) {
  const raw = response.headers.get("set-cookie") ?? "";
  const match = raw.match(new RegExp(`(?:^|,\\s*)(${name}=[^;]+)`));
  if (!match?.[1]) throw new Error(`missing_cookie:${name}`);
  return match[1];
}

async function requestWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

let lockReady;
const lockReadyPromise = new Promise((resolve) => {
  lockReady = resolve;
});

async function seed() {
  const platformDocument = await prisma.platformStateDocument.findUnique({
    where: { id: "platform" },
    select: { state: true }
  });
  hadPlatformStateDocument = Boolean(platformDocument);
  originalPlatformState = platformDocument?.state;
  if (!platformDocument) {
    await prisma.platformStateDocument.create({
      data: { id: "platform", state: { auditLogs: [] } }
    });
  }
  await prisma.site.create({
    data: {
      id: siteId,
      name: "Admin Role Smoke",
      slug: siteSlug,
      status: "active",
      primaryDomain: `${siteSlug}.localhost`,
      branding: { logoText: "Admin Role Smoke" }
    }
  });
  await prisma.siteAdmin.create({
    data: {
      id: `admin_${suffix}`,
      siteId,
      email: adminEmail,
      passwordHash: hashPassword(adminPassword),
      displayName: "Smoke Owner",
      role: "owner"
    }
  });
  await prisma.customer.create({
    data: {
      id: `customer_${suffix}`,
      siteId,
      email: customerEmail,
      name: "Smoke Customer",
      status: "active"
    }
  });
}

async function holdPlatformStateLock() {
  return lockPrisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "PlatformStateDocument" WHERE "id" = 'platform' FOR UPDATE`;
    lockReady();
    await sleep(lockMs);
  }, { maxWait: 5_000, timeout: lockMs + 5_000 });
}

async function run() {
  await seed();

  const login = await fetch(`${baseUrl}/api/sites/${siteId}/admin/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: adminEmail, password: adminPassword })
  });
  if (!login.ok) throw new Error(`login_failed:${login.status}:${await login.text()}`);

  const sessionCookie = cookieFrom(login, `site_admin_session_${siteId}`);
  const csrfCookie = cookieFrom(login, `site_admin_csrf_${siteId}`);
  const cookie = `${sessionCookie}; ${csrfCookie}`;

  const lockPromise = holdPlatformStateLock();
  await lockReadyPromise;

  const startedAt = performance.now();
  const response = await requestWithTimeout(
    `${baseUrl}/api/sites/${siteId}/customers/customer_${suffix}/admin-role`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie,
        "x-csrf-token": csrfCookie.split("=")[1]
      },
      body: JSON.stringify({ role: "admin" })
    },
    clientTimeoutMs
  ).catch((error) => {
    if (error?.name === "AbortError") return undefined;
    throw error;
  });
  const elapsedMs = Math.round(performance.now() - startedAt);

  await lockPromise;

  if (!response) {
    throw new Error(`admin_role_request_timed_out:${elapsedMs}ms`);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.admin?.email !== customerEmail || body.admin?.role !== "admin") {
    throw new Error(`admin_role_request_failed:${response.status}:${JSON.stringify(body)}`);
  }
  const auditLog = await prisma.auditLog.findFirst({
    where: {
      siteId,
      action: "site_admin_created",
      targetType: "site_admin",
      targetId: body.admin.id
    },
    select: { id: true }
  });
  if (!auditLog) throw new Error("admin_role_audit_log_missing");
  console.log(JSON.stringify({ ok: true, elapsedMs, customerEmail, auditLogId: auditLog.id }, null, 2));
}

try {
  await run();
} finally {
  await prisma.site.deleteMany({ where: { id: siteId } }).catch(() => undefined);
  if (hadPlatformStateDocument) {
    await prisma.platformStateDocument.update({ where: { id: "platform" }, data: { state: originalPlatformState } }).catch(() => undefined);
  } else {
    await prisma.platformStateDocument.deleteMany({ where: { id: "platform" } }).catch(() => undefined);
  }
  await lockPrisma.$disconnect().catch(() => undefined);
  await prisma.$disconnect().catch(() => undefined);
}
