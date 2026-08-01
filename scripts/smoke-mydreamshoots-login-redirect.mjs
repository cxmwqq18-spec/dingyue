import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { chromium } from "playwright";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";

loadRuntimeEnv();

const prisma = new PrismaClient();
const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:3002").replace(/\/$/, "");
const siteSlug = process.env.SMOKE_SITE_SLUG || "mydreamshoots";
const siteId = process.env.SMOKE_SITE_ID || "site_dreamshoot";
const hostModePublicHost = process.env.SMOKE_PUBLIC_HOST || "www.mydreamshoots.com";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function hashPassword(password) {
  return `sha256:${crypto.createHash("sha256").update(password).digest("hex")}`;
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
}

async function createSmokeCustomer() {
  const customerId = uid("cust_login");
  const email = `${customerId}@example.test`;
  const password = "SmokePass1!";
  await prisma.customer.create({
    data: {
      id: customerId,
      siteId,
      email,
      passwordHash: hashPassword(password),
      name: "Login Redirect Smoke",
      status: "active",
      balance: {
        create: {
          id: uid("bal_login"),
          siteId,
          balance: 0,
          reserved: 0
        }
      }
    }
  });
  return { customerId, email, password };
}

async function smokeLoginRedirect() {
  const smoke = await createSmokeCustomer();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ baseURL: baseUrl });
    const loginResponses = [];
    page.on("response", (response) => {
      if (response.url().includes("/auth/login")) loginResponses.push(`${response.status()} ${response.url()}`);
    });

    await page.goto(`/site/${siteSlug}/login`, { waitUntil: "networkidle" });
    await page.getByLabel("Email").fill(smoke.email);
    await page.getByLabel("Password").fill(smoke.password);
    await page.locator("form").getByRole("button", { name: "Log in" }).last().click({ noWaitAfter: true });
    await page.waitForFunction((expectedPath) => window.location.pathname === expectedPath, `/site/${siteSlug}/app/create`, { timeout: 45000 });

    const bodyText = await page.locator("body").innerText({ timeout: 10000 });
    assert(
      /Generate Image|Create New AI Model|Pick Package|source photos/i.test(bodyText),
      "login redirect reached app/create, but the create workspace UI did not render"
    );
    assert(loginResponses.some((entry) => entry.startsWith("200 ")), `login API did not return 200: ${loginResponses.join(", ")}`);
    console.log(`✓ login redirects to /site/${siteSlug}/app/create and renders the create workspace`);

    const hostContext = await browser.newContext({
      baseURL: baseUrl,
      extraHTTPHeaders: { "x-forwarded-host": hostModePublicHost }
    });
    try {
      const hostPage = await hostContext.newPage();
      const hostLoginResponses = [];
      hostPage.on("response", (response) => {
        if (response.url().includes("/auth/login")) hostLoginResponses.push(`${response.status()} ${response.url()}`);
      });

      await hostPage.goto(`/login?next=${encodeURIComponent("/app/create")}`, { waitUntil: "networkidle" });
      await hostPage.getByLabel("Email").fill(smoke.email);
      await hostPage.getByLabel("Password").fill(smoke.password);
      await hostPage.locator("form").getByRole("button", { name: "Log in" }).last().click({ noWaitAfter: true });
      await hostPage.waitForFunction(() => window.location.pathname === "/app/create", undefined, { timeout: 45000 });
      const hostBodyText = await hostPage.locator("body").innerText({ timeout: 10000 });
      assert(
        /Generate Image|Create New AI Model|Pick Package|source photos/i.test(hostBodyText),
        "host-mode login redirect reached /app/create, but the create workspace UI did not render"
      );
      assert(hostLoginResponses.some((entry) => entry.startsWith("200 ")), `host-mode login API did not return 200: ${hostLoginResponses.join(", ")}`);

      await hostPage.goto(`/login?next=${encodeURIComponent("/app/create")}`, { waitUntil: "domcontentloaded" });
      await hostPage.waitForFunction(() => window.location.pathname === "/app/create", undefined, { timeout: 30000 });

      await hostPage.goto("/", { waitUntil: "networkidle" });
      await hostPage.getByRole("link", { name: /^Workspace$/ }).first().click();
      await hostPage.waitForFunction(() => window.location.pathname === "/app/create", undefined, { timeout: 30000 });
      await hostPage.goto("/", { waitUntil: "networkidle" });
      await hostPage.getByRole("link", { name: /Open workspace/i }).first().click();
      await hostPage.waitForFunction(() => window.location.pathname === "/app/create", undefined, { timeout: 30000 });
      console.log(`✓ host-mode /login, Workspace, and account header clicks land on /app/create for ${hostModePublicHost}`);
    } finally {
      await hostContext.close();
    }
  } finally {
    await browser.close();
    await prisma.customer.deleteMany({ where: { id: smoke.customerId } }).catch(() => undefined);
  }
}

smokeLoginRedirect()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
