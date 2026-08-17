import "./load-runtime-env.mjs";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { chromium } from "playwright";

const base = process.env.SMOKE_BASE_URL || "http://localhost:3002";
const siteId = process.env.SMOKE_SITE_ID || "site_dreamshoot";
const ownerEmail = process.env.SITE_ADMIN_USER || "owner@mydreamshoots.localhost";
const ownerPassword = process.env.SITE_ADMIN_PASSWORD || "mydreamshoots123";
const smokeIp = `127.82.${Math.floor(Math.random() * 200) + 1}.${Math.floor(Math.random() * 200) + 1}`;
const prisma = new PrismaClient();

function normalizedEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

function hashPassword(password) {
  return `sha256:${crypto.createHash("sha256").update(password).digest("hex")}`;
}

async function pickNonAdminCustomer() {
  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { slug: true } });
  if (!site) throw new Error(`site_not_found:${siteId}`);
  const currentAdmins = await prisma.siteAdmin.findMany({
    where: { siteId },
    select: { email: true }
  });
  const adminEmails = new Set(currentAdmins.map((admin) => normalizedEmail(admin.email)));
  const customer = await prisma.customer.findFirst({
    where: {
      siteId,
      email: { notIn: [...adminEmails] }
    },
    select: {
      id: true,
      email: true,
      name: true
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }]
  });
  if (!customer) throw new Error(`no_non_admin_customer:${siteId}`);
  return { site, customer };
}

async function rowText(page, email) {
  const row = page.locator("tbody tr", { hasText: email }).first();
  await row.waitFor({ timeout: 20_000 });
  return (await row.textContent()) ?? "";
}

async function waitForRowText(page, email, expected, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  let lastText = "";
  while (Date.now() < deadline) {
    lastText = await rowText(page, email);
    if (lastText.includes(expected)) return lastText;
    await page.waitForTimeout(250);
  }
  throw new Error(`customer_admin_highlight_stale:${email}:${lastText.replace(/\s+/g, " ").trim()}`);
}

async function main() {
  const { site, customer } = await pickNonAdminCustomer();
  let browser;
  let context;
  let createdAdminId;
  const cleanupEmail = normalizedEmail(customer.email);

  try {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({
      extraHTTPHeaders: { "x-forwarded-for": smokeIp }
    });

    const login = await context.request.post(`${base}/api/sites/${siteId}/admin/auth/login`, {
      data: { email: ownerEmail, password: ownerPassword },
      headers: { "x-forwarded-for": smokeIp },
      timeout: 60_000
    });
    if (!login.ok()) {
      throw new Error(`site_admin_login_failed:${login.status()}:${await login.text()}`);
    }
    const page = await context.newPage();
    await page.goto(`${base}/site/${site.slug}/admin/customers`, { waitUntil: "networkidle", timeout: 60_000 });
    await page.evaluate(() => {
      window.__siteAdminHighlightSmoke = true;
    });
    const beforeText = await rowText(page, customer.email);
    if (beforeText.includes("站点管理员") || beforeText.includes("站点所有者") || beforeText.includes("客服支持")) {
      throw new Error(`smoke_setup_customer_already_highlighted:${customer.email}`);
    }

    createdAdminId = `admin_highlight_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    await prisma.siteAdmin.create({
      data: {
        id: createdAdminId,
        siteId,
        email: cleanupEmail,
        passwordHash: hashPassword(`smoke${Date.now().toString(36)}`),
        displayName: customer.name || customer.email,
        role: "admin"
      }
    });

    await Promise.all([
      page.waitForURL((url) => url.pathname === `/site/${site.slug}/admin/settings`, { timeout: 30_000 }),
      page.locator(`a[href="/site/${site.slug}/admin/settings"]:visible`).first().click()
    ]);
    await page.evaluate(() => window.history.back());
    await page.waitForURL((url) => url.pathname === `/site/${site.slug}/admin/customers`, { timeout: 30_000 });
    const keptRuntime = await page.evaluate(() => Boolean(window.__siteAdminHighlightSmoke));
    if (!keptRuntime) {
      throw new Error("client_navigation_reloaded_document");
    }

    await waitForRowText(page, customer.email, "站点管理员");

    console.log(JSON.stringify({ ok: true, customerId: customer.id, email: customer.email }, null, 2));
  } finally {
    await prisma.siteAdmin.deleteMany({
      where: {
        siteId,
        email: cleanupEmail,
        ...(createdAdminId ? { id: createdAdminId } : {})
      }
    }).catch(() => undefined);
    await context?.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
