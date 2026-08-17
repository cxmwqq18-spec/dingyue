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
const focusSiteSlug = process.env.STOREFRONT_MEGA_MENU_FOCUS_SITE || "";
const skipCustomerEntries = process.env.STOREFRONT_MEGA_MENU_SKIP_CUSTOMER === "1";
const pageLoadTimeoutMs = Number(process.env.STOREFRONT_MEGA_MENU_PAGE_TIMEOUT_MS ?? 60_000);
const interactionTimeoutMs = Number(process.env.STOREFRONT_MEGA_MENU_INTERACTION_TIMEOUT_MS ?? 20_000);
const packageMenuLabel = /AI Image Generation|AI Photoshoot|Headshot Generator|Occasion Albums|Browse occasion albums|Browse packages|Travel Packages|Ver paquetes|Paquetes de viaje|Paquetes de ocasion/i;
const toolsMenuLabel = /^(AI Video Generation|AI Tools|Tools|Herramientas)$/i;
const expectedVideoTopicSlugs = [
  "talking-photo",
  "cinematic-video",
  "tiktok-video",
  "instagram-reels",
  "social-media-video",
  "youtube-video",
  "story-video",
  "meme-video",
  "product-video"
];
const expectedVideoTopicLabels = [
  "Talking Photo",
  "Cinematic Video",
  "TikTok Video",
  "Instagram Reels",
  "Social Media Video",
  "YouTube Video",
  "Story Video",
  "Meme Video",
  "Product Video"
];
const anonymousEntries = [
  { label: "MyDreamShoots home", path: `/site/${siteSlug}` },
  { label: "MyDreamShoots collections", path: `/site/${siteSlug}/ai-image-generation` },
  { label: "MyDreamShoots package detail", path: `/site/${siteSlug}/ai-image-generation/portrait-photo` },
  { label: "MyDreamShoots video generation", path: `/site/${siteSlug}/ai-video-generation` },
  { label: "Aidreamcapes collections", path: "/site/aidreamcapes/collections" },
  { label: "Aidreamcapes package detail", path: "/site/aidreamcapes/collections/cinematic-travel" },
  { label: "Aidreamcapes tools", path: "/site/aidreamcapes/tools" }
];
const customerEntries = [
  { label: "MyDreamShoots workspace create", path: `/site/${siteSlug}/app/create` },
  { label: "MyDreamShoots workspace create step", path: `/site/${siteSlug}/app/create#step-create` },
  { label: "MyDreamShoots account", path: `/site/${siteSlug}/account` },
  { label: "MyDreamShoots signed-in collections", path: `/site/${siteSlug}/ai-image-generation` }
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

function entryMatchesFocusSite(entry) {
  if (!focusSiteSlug) return true;
  return entry.path === `/site/${focusSiteSlug}` || entry.path.startsWith(`/site/${focusSiteSlug}/`);
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
    await page.goto(entry.path, { waitUntil: "domcontentloaded", timeout: pageLoadTimeoutMs });
    await page.waitForLoadState("networkidle", { timeout: interactionTimeoutMs }).catch(() => undefined);
    const labelPattern = menu === "tools" ? toolsMenuLabel : packageMenuLabel;
    const browseButton = page.getByRole("button", { name: labelPattern }).first();
    await browseButton.waitFor({ state: "visible", timeout: interactionTimeoutMs });
    const buttonLabel = (await browseButton.textContent())?.trim().replace(/\s+/g, " ") || "package menu";
    await page.waitForTimeout(750);
    await browseButton.click({ force: true });
    await page.waitForFunction(
      () => Boolean(document.querySelector('[data-storefront-mega-menu-panel][aria-hidden="false"]')),
      undefined,
      { timeout: interactionTimeoutMs }
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
      const toolLinkCount = panelElement ? Array.from(panelElement.querySelectorAll('a[href*="/tools"], a[href*="/ai-video-generation"]')).length : 0;
      const hiddenVideoLinks = panelElement ? Array.from(panelElement.querySelectorAll('a[href*="/ai-video-generation/text-to-video"], a[href*="/ai-video-generation/image-to-video"]')).map((anchor) => ({
        text: (anchor.textContent || "").replace(/\s+/g, " ").trim(),
        href: anchor.getAttribute("href") || ""
      })) : [];
      const videoTopicLinks = panelElement ? Array.from(panelElement.querySelectorAll('a[href*="/ai-video-generation/"]')).map((anchor) => ({
        text: (anchor.textContent || "").replace(/\s+/g, " ").trim(),
        href: anchor.getAttribute("href") || ""
      })) : [];
      const viewAllThemesLinks = panelElement ? Array.from(panelElement.querySelectorAll('a[href*="/ai-video-generation"]')).filter((anchor) =>
        /View all themes/i.test(anchor.textContent || "") &&
        /\/ai-video-generation(?:[?#]|$)/.test(anchor.getAttribute("href") || "")
      ).map((anchor) => ({
        text: (anchor.textContent || "").replace(/\s+/g, " ").trim(),
        href: anchor.getAttribute("href") || ""
      })) : [];
      const panelText = panelElement?.textContent || "";
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
        route: location.pathname,
        toolLinkCount,
        hiddenVideoLinks,
        videoTopicLinks,
        viewAllThemesLinks,
        hasLegacyVideoToolLabels: /Profile Clip|Fan Poster Motion|Creator Intro Video|Product Teaser Clip|Animated Avatar|Fashion Reel|Album Story Video/.test(panelText),
        hasHiddenVideoWorkflowLabels: /Text to video|Image to Video/.test(panelText),
        hasVideoTopicDescriptions: /Explore a talking-photo workflow|Plan story-driven cinematic clips|Create TikTok-first vertical video briefs|Shape Reels around cover-aware framing|Adapt one master story|Plan long-form YouTube drafts|Shape story-led videos around setup|Turn reactions, POV setups|Turn product photos into clear video directions/.test(panelText),
        hasVideoCategoriesLabel: /\bCATEGOR(?:Y|IES)\b/i.test(panelText),
        hasNineVideoThemesLabel: /9\s+THEMES/i.test(panelText)
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
    } else if (entry.path.includes(`/site/${siteSlug}/`)) {
      const topicHrefs = metrics.videoTopicLinks.map((link) => link.href);
      const topicTexts = metrics.videoTopicLinks.map((link) => link.text).join(" ");
      assert(metrics.hiddenVideoLinks.length === 0, `${entry.label} ${entry.path}: AI Video Generation menu still links hidden Text/Image workflows`, { hiddenVideoLinks: metrics.hiddenVideoLinks });
      assert(metrics.videoTopicLinks.length === expectedVideoTopicSlugs.length, `${entry.label} ${entry.path}: AI Video Generation menu should expose ${expectedVideoTopicSlugs.length} topic links, found ${metrics.videoTopicLinks.length}`, { videoTopicLinks: metrics.videoTopicLinks });
      for (const slug of expectedVideoTopicSlugs) {
        assert(topicHrefs.some((href) => href.endsWith(`/ai-video-generation/${slug}`)), `${entry.label} ${entry.path}: AI Video Generation menu is missing topic href ${slug}`, { topicHrefs });
      }
      for (const label of expectedVideoTopicLabels) {
        assert(topicTexts.includes(label), `${entry.label} ${entry.path}: AI Video Generation menu is missing topic label ${label}`, { topicTexts });
      }
      assert(!metrics.hasHiddenVideoWorkflowLabels, `${entry.label} ${entry.path}: AI Video Generation menu still shows hidden Text/Image workflow labels`);
      assert(!metrics.hasVideoTopicDescriptions, `${entry.label} ${entry.path}: AI Video Generation menu should show topic names only, without description copy`);
      assert(metrics.viewAllThemesLinks.length >= 1, `${entry.label} ${entry.path}: AI Video Generation menu must include a View all themes link`, { viewAllThemesLinks: metrics.viewAllThemesLinks });
      assert(!metrics.hasVideoCategoriesLabel, `${entry.label} ${entry.path}: AI Video Generation menu should not report category counts`);
      assert(metrics.hasNineVideoThemesLabel, `${entry.label} ${entry.path}: AI Video Generation menu should report 9 themes`);
      assert(!metrics.hasLegacyVideoToolLabels, `${entry.label} ${entry.path}: AI Video Generation menu still exposes legacy video tool labels`);
    } else {
      assert(metrics.toolLinkCount >= 6, `${entry.label} ${entry.path}: tools menu shrank to ${metrics.toolLinkCount} tool links`);
    }
    const summary = menu === "packages" && metrics.packageCounts
      ? `${metrics.packageCounts.categories} categories / ${metrics.packageCounts.themes} themes`
      : entry.path.includes(`/site/${siteSlug}/`)
      ? `${metrics.videoTopicLinks.length} topic links`
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
    for (const entry of anonymousEntries.filter(entryMatchesFocusSite)) {
      await assertMegaMenuPosition(anonymousContext, entry);
    }
    const toolEntries = [
      { label: "MyDreamShoots package detail tools", path: `/site/${siteSlug}/ai-image-generation/portrait-photo` },
      { label: "Aidreamcapes package detail tools", path: "/site/aidreamcapes/collections/cinematic-travel" }
    ].filter(entryMatchesFocusSite);
    for (const entry of toolEntries) {
      await assertMegaMenuPosition(anonymousContext, entry, "tools");
    }

    if (skipCustomerEntries) return;
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
    for (const entry of customerEntries.filter(entryMatchesFocusSite)) {
      await assertMegaMenuPosition(customerContext, entry);
    }
    const customerToolEntries = [
      { label: "MyDreamShoots workspace video tools", path: `/site/${siteSlug}/app/create` }
    ].filter(entryMatchesFocusSite);
    for (const entry of customerToolEntries) {
      await assertMegaMenuPosition(customerContext, entry, "tools");
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
    for (const entry of compactCustomerEntries.filter(entryMatchesFocusSite)) {
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
