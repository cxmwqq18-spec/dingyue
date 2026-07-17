import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { chromium } from "playwright";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";

loadRuntimeEnv();

const prisma = new PrismaClient();
const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:3002").replace(/\/$/, "");
const siteSlug = process.env.SMOKE_SITE_SLUG || "mydreamshoots";
const siteId = process.env.SMOKE_SITE_ID || "site_dreamshoot";
const hostName = new URL(baseUrl).hostname;
const packageMenuLabel = /Browse packages|Travel Packages|Ver paquetes|Paquetes de viaje/i;
const toolsMenuLabel = /^Tools$|^Herramientas$/i;
const anonymousEntries = [
  { label: "MyDreamShoots home", path: `/site/${siteSlug}` },
  { label: "MyDreamShoots collections", path: `/site/${siteSlug}/collections` },
  { label: "MyDreamShoots package detail", path: `/site/${siteSlug}/collections/creator-portraits` },
  { label: "MyDreamShoots tools", path: `/site/${siteSlug}/tools` },
  { label: "Aidreamcapes collections", path: "/site/aidreamcapes/collections" },
  { label: "Aidreamcapes package detail", path: "/site/aidreamcapes/collections/cinematic-travel" },
  { label: "Aidreamcapes tools", path: "/site/aidreamcapes/tools" }
];
const customerEntries = [
  { label: "MyDreamShoots workspace create", path: `/site/${siteSlug}/app/create` },
  { label: "MyDreamShoots workspace create step", path: `/site/${siteSlug}/app/create#step-create` },
  { label: "MyDreamShoots account", path: `/site/${siteSlug}/account` },
  { label: "MyDreamShoots signed-in collections", path: `/site/${siteSlug}/collections` }
];
const compactCustomerEntries = [
  { label: "MyDreamShoots compact workspace create", path: `/site/${siteSlug}/app/create` }
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
}

async function createSmokeSession() {
  const customer = await prisma.customer.findFirst({
    where: { siteId, status: "active" },
    select: { id: true }
  });
  assert(customer, `No active customer found for ${siteId}; cannot smoke-test the customer workspace menu`);

  const sessionId = uid("sess_mega_menu");
  await prisma.customerSession.create({
    data: {
      id: sessionId,
      siteId,
      customerId: customer.id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000)
    }
  });
  return sessionId;
}

async function assertMegaMenuPosition(context, entry, menu = "packages") {
  const page = await context.newPage();
  try {
    await page.goto(entry.path, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => undefined);
    const labelPattern = menu === "tools" ? toolsMenuLabel : packageMenuLabel;
    const browseButton = page.getByRole("button", { name: labelPattern }).first();
    await browseButton.waitFor({ state: "visible", timeout: 20000 });
    const buttonLabel = (await browseButton.textContent())?.trim().replace(/\s+/g, " ") || "package menu";
    await page.waitForTimeout(750);
    await browseButton.click({ force: true });
    await page.waitForFunction(
      () => Boolean(document.querySelector('[data-storefront-mega-menu-panel][aria-hidden="false"]')),
      undefined,
      { timeout: 10000 }
    );

    const metrics = await page.evaluate(() => {
      const header = document.querySelector("header")?.getBoundingClientRect();
      const panelElement = document.querySelector('[data-storefront-mega-menu-panel][aria-hidden="false"]');
      const panel = panelElement?.getBoundingClientRect();
      const panelStyle = panelElement ? getComputedStyle(panelElement) : null;
      const panelShell = panelElement?.querySelector(":scope > div");
      const shellStyle = panelShell ? getComputedStyle(panelShell) : null;
      let packageGrid = null;
      const categoryCard = panelElement?.querySelector(".group\\/category");
      for (let element = categoryCard?.parentElement ?? null; element && element !== panelElement; element = element.parentElement) {
        if (getComputedStyle(element).overflowY === "auto") {
          packageGrid = element;
          break;
        }
      }
      const packageGridStyle = packageGrid ? getComputedStyle(packageGrid) : null;
      const text = panelElement?.textContent ?? "";
      const packageCounts = text.match(/(\d+)\s+CATEGOR(?:Y|IES)\s+·\s+(\d+)\s+THEME(?:S)?/i);
      const toolLinkCount = panelElement ? Array.from(panelElement.querySelectorAll('a[href*="/tools"]')).length : 0;
      return {
        headerBottom: header?.bottom ?? null,
        panelTop: panel?.top ?? null,
        panelLeft: panel?.left ?? null,
        panelRight: panel?.right ?? null,
        panelWidth: panel?.width ?? null,
        panelBottom: panel?.bottom ?? null,
        panelMaxHeight: panelStyle?.maxHeight ?? "",
        shellMaxHeight: shellStyle?.maxHeight ?? "",
        packageGridMaxHeight: packageGridStyle?.maxHeight ?? "",
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        packageCounts: packageCounts ? { categories: Number(packageCounts[1]), themes: Number(packageCounts[2]) } : null,
        route: location.pathname
        ,
        toolLinkCount
      };
    });

    assert(metrics.headerBottom !== null, `${entry.label} ${entry.path}: header was not rendered`);
    assert(metrics.panelTop !== null, `${entry.label} ${entry.path}: package mega menu panel did not open`);
    const gap = Math.round(metrics.panelTop - metrics.headerBottom);
    assert(
      metrics.panelTop >= metrics.headerBottom - 1,
      `${entry.label} ${entry.path}: package mega menu overlaps the header by ${Math.round(metrics.headerBottom - metrics.panelTop)}px`
    );
    assert(metrics.panelWidth !== null && metrics.panelLeft !== null && metrics.panelRight !== null, `${entry.label} ${entry.path}: panel metrics unavailable`);
    assert(metrics.panelWidth <= 1121, `${entry.label} ${entry.path}: panel widened to ${Math.round(metrics.panelWidth)}px`);
    assert(Math.abs(metrics.panelLeft - (metrics.viewportWidth - metrics.panelWidth) / 2) <= 2, `${entry.label} ${entry.path}: panel is not centered`);
    assert(metrics.panelBottom <= metrics.viewportHeight - 8, `${entry.label} ${entry.path}: panel bottom ${Math.round(metrics.panelBottom)} exceeds viewport ${metrics.viewportHeight}`);
    if (menu === "packages") {
      assert(metrics.packageCounts, `${entry.label} ${entry.path}: package counts were not rendered`);
      assert(metrics.packageCounts.categories >= 3 && metrics.packageCounts.themes >= 6, `${entry.label} ${entry.path}: package menu shrank to ${metrics.packageCounts.categories} categories / ${metrics.packageCounts.themes} themes`);
      assert(metrics.shellMaxHeight === metrics.panelMaxHeight, `${entry.label} ${entry.path}: package shell max-height ${metrics.shellMaxHeight} did not inherit panel max-height ${metrics.panelMaxHeight}`);
      const responsiveCap = Math.min(760, Math.max(260, Math.floor(metrics.viewportHeight * 0.72)));
      assert(Number.parseFloat(metrics.panelMaxHeight) <= responsiveCap + 1, `${entry.label} ${entry.path}: package panel max-height ${metrics.panelMaxHeight} ignored responsive cap ${responsiveCap}px`);
      assert(metrics.packageGridMaxHeight === "none", `${entry.label} ${entry.path}: package list still uses fixed max-height ${metrics.packageGridMaxHeight}`);
    } else {
      assert(metrics.toolLinkCount >= 6, `${entry.label} ${entry.path}: tools menu shrank to ${metrics.toolLinkCount} tool links`);
    }
    const summary = menu === "packages" && metrics.packageCounts
      ? `${metrics.packageCounts.categories} categories / ${metrics.packageCounts.themes} themes`
      : `${metrics.toolLinkCount} tool links`;
    console.log(`✓ ${entry.label} (${metrics.route}) ${buttonLabel}: gap ${gap}px, width ${Math.round(metrics.panelWidth)}px, ${summary}`);
  } finally {
    await page.close().catch(() => undefined);
  }
}

async function smokeStorefrontMegaMenuPosition() {
  const sessionId = await createSmokeSession();
  const browser = await chromium.launch({ headless: true });
  try {
    const anonymousContext = await browser.newContext({
      baseURL: baseUrl,
      viewport: { width: 2048, height: 1180 }
    });
    for (const entry of anonymousEntries) {
      await assertMegaMenuPosition(anonymousContext, entry);
    }
    await assertMegaMenuPosition(anonymousContext, { label: "MyDreamShoots package detail tools", path: `/site/${siteSlug}/collections/creator-portraits` }, "tools");
    await assertMegaMenuPosition(anonymousContext, { label: "Aidreamcapes package detail tools", path: "/site/aidreamcapes/collections/cinematic-travel" }, "tools");

    const customerContext = await browser.newContext({
      baseURL: baseUrl,
      viewport: { width: 2048, height: 1180 }
    });
    await customerContext.addCookies([{
      name: `customer_session_${siteId}`,
      value: sessionId,
      domain: hostName,
      path: "/",
      httpOnly: true,
      sameSite: "Lax"
    }]);
    for (const entry of customerEntries) {
      await assertMegaMenuPosition(customerContext, entry);
    }
    const compactCustomerContext = await browser.newContext({
      baseURL: baseUrl,
      viewport: { width: 1366, height: 720 }
    });
    await compactCustomerContext.addCookies([{
      name: `customer_session_${siteId}`,
      value: sessionId,
      domain: hostName,
      path: "/",
      httpOnly: true,
      sameSite: "Lax"
    }]);
    for (const entry of compactCustomerEntries) {
      await assertMegaMenuPosition(compactCustomerContext, entry);
    }
  } finally {
    await browser.close();
    await prisma.customerSession.deleteMany({ where: { id: sessionId } }).catch(() => undefined);
  }
}

smokeStorefrontMegaMenuPosition()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
