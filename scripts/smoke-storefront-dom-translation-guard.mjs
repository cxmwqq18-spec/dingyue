import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { chromium } from "playwright";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";

loadRuntimeEnv();

const prisma = new PrismaClient();
const baseUrl = (process.env.SMOKE_BASE_URL || "http://127.0.0.1:3002").replace(/\/$/, "");
const siteId = "site_dreamshoot";
const siteSlug = process.env.SMOKE_DREAMSHOOT_SITE_SLUG || "mydreamshoots";
const password = "SmokePass1!";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
}

function hashPassword(value) {
  return `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
}

function isDomTranslationCrash(text) {
  return /insertBefore|removeChild|NotFoundError|Failed to execute|client-side exception|Application error|Runtime NotFoundError/i.test(text);
}

async function createSmokeCustomer() {
  const customerId = uid("cust_translate_guard");
  const email = `${customerId}@example.test`;
  await prisma.customer.create({
    data: {
      id: customerId,
      siteId,
      email,
      passwordHash: hashPassword(password),
      name: "Workspace Translate Guard Smoke",
      status: "active",
      balance: {
        create: {
          id: uid("bal_translate_guard"),
          siteId,
          balance: 0,
          reserved: 0
        }
      }
    }
  });
  return { id: customerId, email, password };
}

async function main() {
  const customer = await createSmokeCustomer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const clientErrors = [];
  page.on("pageerror", (error) => clientErrors.push(error.message));
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && isDomTranslationCrash(text)) clientErrors.push(text);
  });

  try {
    const login = await context.request.post(`${baseUrl}/api/sites/${siteId}/auth/login`, {
      data: { email: customer.email, password: customer.password }
    });
    assert(login.ok(), `smoke login failed with ${login.status()}: ${await login.text()}`);

    await page.goto(`${baseUrl}/site/${siteSlug}/app/create#video-workspace-videos`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(() => document.body.innerText.length > 200, null, { timeout: 30000 });
    await page.waitForFunction(() => Boolean(Node.__dreamshootBrowserTranslationDomGuard), null, { timeout: 30000 });
    assert(page.url().includes(`/site/${siteSlug}/app/create`), `workspace route did not stay signed in: ${page.url()}`);

    const guardResult = await page.evaluate(() => {
      const parent = document.createElement("div");
      const staleText = document.createTextNode("Refresh status");
      parent.appendChild(staleText);
      document.body.appendChild(parent);

      const translated = document.createElement("font");
      translated.setAttribute("style", "vertical-align: inherit;");
      translated.textContent = "Translated status";
      parent.insertBefore(translated, staleText);
      parent.removeChild(staleText);

      try {
        parent.removeChild(staleText);
        const staleReference = document.createTextNode("stale reference");
        const inserted = document.createElement("span");
        parent.insertBefore(inserted, staleReference);
        return {
          removeChildSafe: true,
          insertBeforeSafe: parent.lastChild === inserted
        };
      } finally {
        parent.remove();
      }
    });

    const bodyText = await page.locator("body").innerText({ timeout: 10000 }).catch(() => "");
    assert(guardResult.removeChildSafe, "translated stale text removal should not crash the workspace");
    assert(guardResult.insertBeforeSafe, "translated stale reference insertion should append safely");
    assert(!clientErrors.some(isDomTranslationCrash), `workspace crashed after translated DOM mutation: ${clientErrors.join(" | ")}`);
    assert(!isDomTranslationCrash(bodyText), "workspace rendered a runtime translation crash overlay");
    console.log("storefront DOM translation guard smoke passed");
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
    await prisma.customer.deleteMany({ where: { id: customer.id } }).catch(() => undefined);
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
