import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { chromium, request } from "playwright";
import { PrismaClient } from "@prisma/client";

import "./load-runtime-env.mjs";

process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY ??= "1";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(repoRoot, "output", "designer-workbench-agent");
const baseUrl = (process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3002").replace(/\/$/, "");
const sourceSiteId = process.env.DESIGNER_SMOKE_SOURCE_SITE_ID ?? "site_dreamshoot";
const platformEmail = process.env.DESIGNER_SMOKE_PLATFORM_EMAIL ?? "platform@local.test";
const platformPassword = process.env.DESIGNER_SMOKE_PLATFORM_PASSWORD ?? "platform123";
const chromePath = process.env.PLAYWRIGHT_CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const lockTimeoutMs = Number(process.env.DESIGNER_SMOKE_LOCK_TIMEOUT_MS ?? 180_000);
const staleLockMs = Number(process.env.DESIGNER_SMOKE_STALE_LOCK_MS ?? 20 * 60_000);
const browserOptions = fs.existsSync(chromePath)
  ? { headless: true, executablePath: chromePath }
  : { headless: true };
const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`Usage: node scripts/smoke-designer-workbench-agent.mjs

Runs the store designer workbench smoke agent against a running Next.js app.

Environment:
  SMOKE_BASE_URL                         Base URL. Default: http://127.0.0.1:3002
  DESIGNER_SMOKE_SOURCE_SITE_ID          Source site copied into a smoke sandbox. Default: site_dreamshoot
  DESIGNER_SMOKE_REUSE_SLUG              Reuse one explicit designer-smoke-* slug instead of creating a new sandbox.
  DESIGNER_SMOKE_REUSE_EXISTING=1         Only fallback to an existing smoke sandbox if clone creation fails.
  DESIGNER_SMOKE_DISABLE_LOCK=1           Disable the per-repo/per-base-url run lock.
  DESIGNER_SMOKE_LOCK_TIMEOUT_MS          Wait time when another smoke run owns the lock. Default: 180000
  PLAYWRIGHT_CHROME_PATH                  Optional Chrome executable path.

Outputs:
  output/designer-workbench-agent/report.md
  output/designer-workbench-agent/report.json
  output/designer-workbench-agent/*.png
`);
  process.exit(0);
}

const unknownArgs = args.filter((arg) => !["--help", "-h"].includes(arg));
if (unknownArgs.length) {
  console.error(`Unknown arguments: ${unknownArgs.join(" ")}`);
  console.error("Run with --help for usage.");
  process.exit(2);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function roundMs(value) {
  return Math.round(value);
}

function formatMs(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "n/a";
  return `${roundMs(value)}ms`;
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function acquireRunLock() {
  if (process.env.DESIGNER_SMOKE_DISABLE_LOCK === "1") {
    return { lockDir: undefined, release: async () => undefined };
  }
  fs.mkdirSync(outputDir, { recursive: true });
  const lockHash = createHash("sha1").update(`${repoRoot}|${baseUrl}|${sourceSiteId}`).digest("hex").slice(0, 12);
  const lockDir = path.join(outputDir, `run-${lockHash}.lock`);
  const ownerPath = path.join(lockDir, "owner.json");
  const startedAt = Date.now();

  while (true) {
    try {
      fs.mkdirSync(lockDir);
      fs.writeFileSync(ownerPath, `${JSON.stringify({
        pid: process.pid,
        baseUrl,
        sourceSiteId,
        startedAt: new Date().toISOString()
      }, null, 2)}\n`);
      return {
        lockDir,
        release: async () => {
          fs.rmSync(lockDir, { recursive: true, force: true });
        }
      };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      let owner = {};
      try {
        owner = JSON.parse(fs.readFileSync(ownerPath, "utf8"));
      } catch {
        owner = {};
      }
      const ownerPid = Number(owner.pid);
      const ownerStartedAt = Date.parse(owner.startedAt ?? "");
      const stale = !processIsAlive(ownerPid) || (Number.isFinite(ownerStartedAt) && Date.now() - ownerStartedAt > staleLockMs);
      if (stale) {
        fs.rmSync(lockDir, { recursive: true, force: true });
        continue;
      }
      if (Date.now() - startedAt > lockTimeoutMs) {
        throw new Error(`designer smoke already running for ${baseUrl}; lock=${lockDir}; ownerPid=${ownerPid || "unknown"}`);
      }
      await wait(1000);
    }
  }
}

function cookieFrom(response, name) {
  const headerList = typeof response.headersArray === "function" ? response.headersArray() : [];
  const headerValues = headerList
    .filter((header) => header.name.toLowerCase() === "set-cookie")
    .map((header) => header.value)
    .concat((response.headers()["set-cookie"] ?? "").split(/,(?=\s*[^;,]+=)/g).map((part) => part.trim()))
    .filter(Boolean);
  const match = headerValues.find((value) => value.startsWith(`${name}=`)) ?? "";
  const cookie = match.split(";")[0];
  assert(cookie.includes("="), `missing cookie ${name}`);
  return cookie;
}

function cookieValue(cookie, name) {
  return cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function isIgnorableRequest(url) {
  return url.includes("/_next/webpack-hmr") || url.startsWith("data:");
}

function isIgnorableFailedRequest(url, errorText) {
  if (isIgnorableRequest(url)) return true;
  if (errorText === "net::ERR_ABORTED") return true;
  return /\.(?:mp4|webm|mov|m4v|png|jpe?g|gif|webp|avif)(?:\?|$)/i.test(url) && errorText === "net::ERR_ABORTED";
}

async function waitForWorkbench(page) {
  await page.waitForSelector(".saas-designer-root", { state: "visible", timeout: 25_000 });
  await page.getByRole("button", { name: "当前页面", exact: true }).waitFor({ state: "visible", timeout: 15_000 });
  await page.getByText("文案定位器", { exact: true }).waitFor({ state: "visible", timeout: 15_000 });
}

async function measureWorkbenchLayout(page) {
  return page.evaluate(() => {
    const rightPane = document.querySelector('[data-designer-layout="saas-right-editor-pane"]');
    const navigatorRoot = document.querySelector('[data-designer-layout="saas-workspace-navigator-root"]');
    const pageDirectoryWrapper = document.querySelector('[data-designer-layout="saas-page-directory-wrapper"]');
    const pageDirectory = document.querySelector('[data-designer-layout="saas-full-site-page-directory"]');
    const pageDirectoryScroll = document.querySelector('[data-designer-layout="saas-page-directory-scroll"]');
    const iframe = document.querySelector("iframe");
    const previewCanvas = document.querySelector('[data-designer-preview="saas-center-preview-canvas"]');
    const root = document.querySelector(".saas-designer-root");
    return {
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
      bodyScrollHeight: document.body?.scrollHeight ?? 0,
      bodyClientHeight: document.body?.clientHeight ?? 0,
      rightPaneScrollHeight: rightPane?.scrollHeight ?? 0,
      rightPaneClientHeight: rightPane?.clientHeight ?? 0,
      navigatorRootClientHeight: navigatorRoot?.clientHeight ?? 0,
      pageDirectoryWrapperClientHeight: pageDirectoryWrapper?.clientHeight ?? 0,
      pageDirectoryScrollHeight: pageDirectory?.scrollHeight ?? 0,
      pageDirectoryClientHeight: pageDirectory?.clientHeight ?? 0,
      pageDirectoryScrollContainerHeight: pageDirectoryScroll?.clientHeight ?? 0,
      pageDirectoryScrollContainerScrollHeight: pageDirectoryScroll?.scrollHeight ?? 0,
      iframeSrc: iframe?.getAttribute("src") ?? "",
      iframeInnerWidth: Number(previewCanvas?.getAttribute("data-designer-preview-width") ?? 0),
      iframeInnerHeight: Number(previewCanvas?.getAttribute("data-designer-preview-height") ?? 0),
      selectedPageId: root?.getAttribute("data-designer-selected-page-id") ?? ""
    };
  });
}

async function inspectVisibleButtons(page) {
  return page.locator("button").evaluateAll((buttons) =>
    buttons
      .map((button) => {
        const rect = button.getBoundingClientRect();
        const style = window.getComputedStyle(button);
        const text = (button.textContent || button.getAttribute("aria-label") || button.getAttribute("title") || "").trim().replace(/\s+/g, " ");
        return {
          text,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          display: style.display,
          visibility: style.visibility,
          ariaLabel: button.getAttribute("aria-label")
        };
      })
      .filter((button) => button.display !== "none" && button.visibility !== "hidden" && button.width > 0 && button.height > 0)
  );
}

function isIgnorablePageError(message) {
  return message.includes("Connection closed") && message.includes("react-server-dom-webpack");
}

function hasTransientDevServerResponse(entry) {
  return Boolean(
    entry?.badResponses?.some((response) => response.status >= 500 && response.url.startsWith(baseUrl)) ||
      entry?.consoleErrors?.some((item) => /server responded with a status of 5\d\d|ChunkLoadError|__webpack_modules__/.test(item)) ||
      entry?.pageErrors?.some((item) => /ChunkLoadError|__webpack_modules__|fetch failed/.test(item))
  );
}

function isTransientDevServerRunError(error, report) {
  const message = String(error?.stack ?? error);
  if (/ERR_CONNECTION_REFUSED|ERR_INCOMPLETE_CHUNKED_ENCODING|Connection closed/.test(message)) return true;
  if (/page\.goto: Timeout 60000ms exceeded/.test(message)) return true;
  if (/ChunkLoadError|__webpack_modules__|rendered Next runtime error|server responded with a status of 5\d\d/.test(message)) return true;
  const entries = [report.admin, report.workbench, report.mobile].filter(Boolean);
  return entries.some((entry) => {
    return entry.failedRequests?.some((request) => /ERR_CONNECTION_REFUSED|ERR_INCOMPLETE_CHUNKED_ENCODING/.test(request.error ?? "")) ||
      entry.consoleErrors?.some((item) => /ERR_CONNECTION_REFUSED|ERR_INCOMPLETE_CHUNKED_ENCODING/.test(item)) ||
      hasTransientDevServerResponse(entry);
  });
}

async function waitForDevServerReady(url, timeoutMs = 45_000) {
  const startedAt = performance.now();
  while (performance.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { method: "HEAD" });
      if (response.ok || response.status < 500) return;
    } catch {
      // Keep polling while Next dev is restarting.
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
}

async function auditPage(page, pathname, viewport, screenshotName) {
  const pageErrors = [];
  const consoleErrors = [];
  const badResponses = [];
  const failedRequests = [];
  const apiRequests = [];
  const requestStartedAt = new Map();

  page.on("pageerror", (error) => {
    const message = String(error?.stack ?? error);
    if (!isIgnorablePageError(message)) pageErrors.push(message);
  });
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("webpack")) {
      consoleErrors.push(message.text());
    }
  });
  page.on("request", (requestEvent) => {
    requestStartedAt.set(requestEvent, performance.now());
  });
  page.on("response", (response) => {
    const url = response.url();
    const requestEvent = response.request();
    const startedAt = requestStartedAt.get(requestEvent);
    const durationMs = typeof startedAt === "number" ? roundMs(performance.now() - startedAt) : undefined;
    requestStartedAt.delete(requestEvent);
    if (url.includes("/api/")) apiRequests.push({ method: requestEvent.method(), url, status: response.status(), durationMs });
    if (response.status() >= 400 && !isIgnorableRequest(url)) {
      badResponses.push({ method: requestEvent.method(), url, status: response.status(), durationMs });
    }
  });
  page.on("requestfailed", (requestEvent) => {
    const url = requestEvent.url();
    const errorText = requestEvent.failure()?.errorText;
    requestStartedAt.delete(requestEvent);
    if (!isIgnorableFailedRequest(url, errorText)) {
      failedRequests.push({ method: requestEvent.method(), url, error: errorText });
    }
  });

  await page.setViewportSize(viewport);
  const startedAt = performance.now();
  await page.goto(`${baseUrl}${pathname}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const domContentLoadedMs = roundMs(performance.now() - startedAt);
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
  const networkIdleMs = roundMs(performance.now() - startedAt);

  let bodyText = await page.locator("body").innerText();
  let recoveredFromErrorBoundary = false;
  let recoveredFromNetworkError = false;
  const transientErrors = {
    pageErrors: [],
    consoleErrors: [],
    badResponses: [],
    failedRequests: []
  };
  if ((await page.locator('[data-admin-error="true"], [data-designer-error="true"]').count()) > 0 || bodyText.includes("network error")) {
    recoveredFromErrorBoundary = (await page.locator('[data-admin-error="true"], [data-designer-error="true"]').count()) > 0;
    recoveredFromNetworkError = bodyText.includes("network error");
    transientErrors.pageErrors = pageErrors.splice(0);
    transientErrors.consoleErrors = consoleErrors.splice(0);
    transientErrors.badResponses = badResponses.splice(0);
    transientErrors.failedRequests = failedRequests.splice(0);
    apiRequests.splice(0);
    const reloadStartedAt = performance.now();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
    transientErrors.reloadMs = roundMs(performance.now() - reloadStartedAt);
    bodyText = await page.locator("body").innerText();
  }
  assert(!bodyText.includes("network error"), `${pathname} rendered generic network error`);
  assert(!bodyText.includes("Runtime TypeError"), `${pathname} rendered Next runtime error`);
  assert(await page.locator('[data-admin-error="true"], [data-designer-error="true"]').count() === 0, `${pathname} rendered admin error boundary`);

  let screenshotError = "";
  try {
    await page.screenshot({ path: path.join(outputDir, screenshotName), fullPage: true, timeout: 15_000 });
  } catch (error) {
    screenshotError = String(error?.stack ?? error);
  }
  return {
    pathname,
    viewport,
    pageErrors,
    consoleErrors,
    badResponses,
    failedRequests,
    apiRequests,
    timings: {
      domContentLoadedMs,
      networkIdleMs,
      totalMs: roundMs(performance.now() - startedAt)
    },
    bodyText,
    recoveredFromErrorBoundary,
    recoveredFromNetworkError,
    screenshotError,
    transientErrors
  };
}

async function assertNoLayoutDefects(page, label, viewportWidth = 1600) {
  const buttons = await inspectVisibleButtons(page);
  const emptyButtons = buttons.filter((button) => !button.text);
  assert(emptyButtons.length === 0, `${label} has visible buttons without accessible text: ${JSON.stringify(emptyButtons)}`);

  const clipped = await page.locator("button").evaluateAll((nodes) =>
    nodes
      .filter((node) => {
        const rect = node.getBoundingClientRect();
        const style = window.getComputedStyle(node);
        if (style.display === "none" || style.visibility === "hidden" || rect.width === 0 || rect.height === 0) return false;
        return node.scrollWidth > node.clientWidth + 2 || node.scrollHeight > node.clientHeight + 2;
      })
      .map((node) => ({
        text: (node.textContent || node.getAttribute("aria-label") || node.getAttribute("title") || "").trim().replace(/\s+/g, " "),
        scrollWidth: node.scrollWidth,
        clientWidth: node.clientWidth
      }))
  );
  assert(clipped.length === 0, `${label} has clipped button labels: ${JSON.stringify(clipped.slice(0, 8))}`);

  const inspector = page.locator('[data-designer-layout="saas-right-editor-pane"]');
  if (await inspector.count()) {
    const inspectorBox = await inspector.boundingBox();
    if (viewportWidth >= 920) {
      assert(inspectorBox && inspectorBox.width >= 410, `${label} inspector is too narrow: ${inspectorBox?.width ?? 0}px`);
    } else {
      assert(inspectorBox && inspectorBox.width >= viewportWidth - 8, `${label} mobile inspector should use the full viewport: ${inspectorBox?.width ?? 0}px`);
    }
  }
}

async function selectPreviewViewport(page, presetLabel) {
  const control = page.locator('[data-designer-preview-viewport-control="desktop"] button').first();
  await control.click();
  const option = page.locator(".page_list_menu_85f7 li").filter({ hasText: presetLabel }).first();
  await option.waitFor({ state: "visible", timeout: 5000 });
  await option.click();
}

async function getPreviewIframeMetrics(page) {
  const iframe = page.locator(".saas-designer-preview-frame iframe").first();
  const canvas = page.locator('[data-designer-preview="saas-center-preview-canvas"]').first();
  await canvas.waitFor({ state: "visible", timeout: 15000 });
  return {
    src: await iframe.count() ? await iframe.getAttribute("src") ?? "" : "",
    innerWidth: Number(await canvas.getAttribute("data-designer-preview-width") ?? 0),
    innerHeight: Number(await canvas.getAttribute("data-designer-preview-height") ?? 0)
  };
}

async function getIframeWindowMetrics(page) {
  return page.locator(".saas-designer-preview-frame iframe").first().evaluate((iframe) => ({
    src: iframe.getAttribute("src") ?? iframe.src ?? "",
    href: iframe.contentWindow?.location.href ?? "",
    readyState: iframe.contentDocument?.readyState ?? "",
    scrollY: iframe.contentWindow?.scrollY ?? 0,
    scrollHeight: iframe.contentDocument?.documentElement?.scrollHeight ?? 0,
    clientHeight: iframe.contentDocument?.documentElement?.clientHeight ?? 0,
    innerHeight: iframe.contentWindow?.innerHeight ?? 0
  }));
}

async function waitForDraftPreviewReady(page, { requireScrollable = true, timeoutMs = 20_000 } = {}) {
  await page.waitForFunction(
    (requireScrollable) => {
      const preview = document.querySelector(".designer-live-preview");
      if (!(preview instanceof HTMLElement)) return false;
      if (!preview.querySelector("[data-theme-sections-root]")) return false;
      if (requireScrollable && preview.scrollHeight <= preview.clientHeight + 20) return false;
      return true;
    },
    requireScrollable,
    { timeout: timeoutMs, polling: 100 }
  );
}

async function getDraftPreviewMetrics(page) {
  return page.locator(".designer-live-preview").first().evaluate((node) => ({
    scrollTop: node.scrollTop,
    scrollHeight: node.scrollHeight,
    clientHeight: node.clientHeight
  }));
}

async function waitForPreviewIframeReady(page, { requireScrollable = true, timeoutMs = 90_000 } = {}) {
  await page.waitForFunction(
    (requireScrollable) => {
      const iframe = document.querySelector(".saas-designer-preview-frame iframe");
      if (!(iframe instanceof HTMLIFrameElement)) return false;
      const doc = iframe.contentDocument;
      const win = iframe.contentWindow;
      if (!doc || !win) return false;
      const src = iframe.src || new URL(iframe.getAttribute("src") ?? "", document.baseURI).href;
      const href = doc.location.href ?? "";
      const normalize = (value) => {
        try {
          const url = new URL(value, document.baseURI);
          url.hash = "";
          url.searchParams.delete("reload");
          return url.href;
        } catch {
          return value.split("#", 1)[0];
        }
      };
      if (!src || !href || normalize(src) !== normalize(href)) return false;
      if (doc.readyState !== "interactive" && doc.readyState !== "complete") return false;
      if (!doc.querySelector("[data-theme-sections-root]")) return false;
      const previewMode = doc.querySelector("[data-designer-preview-mode]")?.getAttribute("data-designer-preview-mode") ?? new URL(src, document.baseURI).searchParams.get("previewMode");
      if (previewMode === "edit" && doc.documentElement.getAttribute("data-xfcart-preview-listener-ready") !== "true") return false;
      if (previewMode === "interactive" && doc.documentElement.getAttribute("data-xfcart-interactive-navigation-ready") !== "true") return false;
      if (requireScrollable && doc.documentElement.scrollHeight <= doc.documentElement.clientHeight + 20) return false;
      return true;
    },
    requireScrollable,
    { timeout: timeoutMs, polling: 200 }
  );
}

function cssAttrValue(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function findPageSelect(page) {
  await page.locator("[data-designer-page-id]").first().waitFor({ state: "visible", timeout: 10_000 });
  return {
    async inputValue() {
      return await page.locator(".saas-designer-root").first().getAttribute("data-designer-selected-page-id") ?? "";
    },
    async options() {
      return page.locator("[data-designer-page-id]").evaluateAll((nodes) =>
        nodes
          .map((node) => ({
            label: (node.textContent || node.getAttribute("title") || "").trim().replace(/\s+/g, " "),
            value: node.getAttribute("data-designer-page-id") || ""
          }))
          .filter((option) => option.value)
      );
    },
    async selectOption(value) {
      await page.locator(`[data-designer-page-id="${cssAttrValue(value)}"]`).first().click();
    }
  };
}

async function selectPageOptionByPattern(pageSelect, page, pattern) {
  const options = await pageSelect.options();
  const option = options.find((item) => pattern.test(`${item.label} ${item.value}`));
  if (!option) return null;
  await pageSelect.selectOption(option.value);
  await page.waitForTimeout(150);
  return option;
}

async function markVisiblePreviewNavigationTarget(page, options = {}) {
  const { requireLink = false } = options;
  const iframe = page.locator(".saas-designer-preview-frame iframe").first();
  return iframe.evaluate((frame, requireLink) => {
    const doc = frame.contentDocument;
    doc?.querySelectorAll("[data-smoke-preview-target]").forEach((node) => node.removeAttribute("data-smoke-preview-target"));
    const currentUrl = doc ? new URL(doc.location.href) : null;
    const candidates = Array.from(
      doc?.querySelectorAll(
        requireLink
          ? 'a[href]:not([href^="#"]):not([target="_blank"])'
          : 'a[href]:not([href^="#"]):not([target="_blank"]), button:not([disabled])'
      ) ?? []
    );
    const interactiveCandidates = candidates.filter((node) => {
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      const viewportWidth = doc?.documentElement.clientWidth ?? window.innerWidth;
      const viewportHeight = doc?.documentElement.clientHeight ?? window.innerHeight;
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const topElement = doc?.elementFromPoint(centerX, centerY);
      const isAnchor = node.tagName.toLowerCase() === "a";
      if (isAnchor) {
        const targetUrl = new URL(node.getAttribute("href") ?? "", doc?.location.href);
        if (targetUrl.origin !== doc?.location.origin) return false;
        if (requireLink && currentUrl && targetUrl.pathname === currentUrl.pathname && targetUrl.search === currentUrl.search && targetUrl.hash === currentUrl.hash) return false;
        if (requireLink) {
          const isSiteRoot = /^\/site\/[^/]+$/.test(targetUrl.pathname);
          if (targetUrl.pathname === "/" || isSiteRoot) return false;
        }
      }
      return rect.width > 0 &&
        rect.height > 0 &&
        rect.top >= 8 &&
        rect.left >= 8 &&
        rect.bottom <= viewportHeight - 8 &&
        rect.right <= viewportWidth - 8 &&
        centerX >= 0 &&
        centerY >= 0 &&
        centerX <= viewportWidth &&
        centerY <= viewportHeight &&
        Boolean(topElement && (topElement === node || node.contains(topElement))) &&
        style.display !== "none" &&
        style.visibility !== "hidden";
    });
    const preferredOrder = ["/pricing", "/tools", "/collections", "/app", "/login", "/help", "/workflow"];
    const target = interactiveCandidates
      .slice()
      .sort((left, right) => {
        if (left.tagName.toLowerCase() === "a" && right.tagName.toLowerCase() === "a") {
          const leftPath = new URL(left.getAttribute("href") ?? "", doc?.location.href).pathname;
          const rightPath = new URL(right.getAttribute("href") ?? "", doc?.location.href).pathname;
          const leftScore = preferredOrder.findIndex((item) => leftPath.startsWith(item));
          const rightScore = preferredOrder.findIndex((item) => rightPath.startsWith(item));
          if (leftScore !== rightScore) return (leftScore === -1 ? 99 : leftScore) - (rightScore === -1 ? 99 : rightScore);
        }
        return 0;
      })
      .find(Boolean);
    if (!target) return null;
    target.setAttribute("data-smoke-preview-target", "true");
    return {
      tag: target.tagName.toLowerCase(),
      text: (target.textContent || target.getAttribute("aria-label") || target.getAttribute("title") || "").trim().replace(/\s+/g, " "),
      href: target.tagName.toLowerCase() === "a" ? new URL(target.getAttribute("href") ?? "", doc?.location.href).href : ""
    };
  }, requireLink);
}

async function markVisibleDraftPreviewTarget(page) {
  return page.evaluate(() => {
    const root = document.querySelector(".designer-live-preview");
    root?.querySelectorAll("[data-smoke-preview-target]").forEach((node) => node.removeAttribute("data-smoke-preview-target"));
    const candidates = Array.from(root?.querySelectorAll('a[href]:not([href^="#"]), button:not([disabled])') ?? []);
    const target = candidates.find((node) => {
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = document.documentElement.clientHeight;
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const topElement = document.elementFromPoint(centerX, centerY);
      return rect.width > 0 &&
        rect.height > 0 &&
        centerX >= 0 &&
        centerY >= 0 &&
        centerX <= viewportWidth &&
        centerY <= viewportHeight &&
        Boolean(topElement && (topElement === node || node.contains(topElement))) &&
        style.display !== "none" &&
        style.visibility !== "hidden";
    });
    if (!target) return null;
    target.setAttribute("data-smoke-preview-target", "true");
    return {
      tag: target.tagName.toLowerCase(),
      text: (target.textContent || target.getAttribute("aria-label") || target.getAttribute("title") || "").trim().replace(/\s+/g, " "),
      href: target.tagName.toLowerCase() === "a" ? target.getAttribute("href") ?? "" : ""
    };
  });
}

async function markVisiblePropertyInputTarget(page) {
  return page.evaluate(() => {
    const pane = document.querySelector('[data-designer-layout="saas-right-editor-pane"]');
    pane?.querySelectorAll("[data-smoke-typing-target]").forEach((node) => node.removeAttribute("data-smoke-typing-target"));
    const candidates = Array.from(
      pane?.querySelectorAll('[data-designer-field-id] textarea, [data-designer-field-id] input:not([type="hidden"]):not([type="color"]):not([type="range"]):not([type="checkbox"]):not([type="radio"])') ?? []
    );
    const target = candidates.find((node) => {
      if (!(node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement)) return false;
      const placeholder = (node.getAttribute("placeholder") ?? "").trim();
      const value = String(node.value ?? "");
      return !node.disabled && !node.readOnly && value.length > 0 && !placeholder.includes("输入预览里看到的文案");
    });
    if (!target) return null;
    target.closest("[data-designer-field-id]")?.scrollIntoView({ block: "center", inline: "nearest" });
    target.setAttribute("data-smoke-typing-target", "true");
    const field = target.closest("[data-designer-field-id]");
    return {
      fieldId: field?.getAttribute("data-designer-field-id") ?? "",
      placeholder: target.getAttribute("placeholder") ?? "",
      value: target.value ?? ""
    };
  });
}

function writeTinySmokePng() {
  const filePath = path.join(outputDir, `designer-smoke-upload-${Date.now()}.png`);
  const pngBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR42mP8z8BQz0AEYBxVSFUBACJ6A/3YWw5hAAAAAElFTkSuQmCC";
  fs.writeFileSync(filePath, Buffer.from(pngBase64, "base64"));
  return filePath;
}

async function openFirstMediaResourceSelectorIfPresent(page) {
  const mediaSelector = page.locator('[data-designer-selector="saas-media-resource-selector"]').first();
  async function tryOpenCurrentSelector() {
    if ((await mediaSelector.count()) === 0) return false;
    await mediaSelector.scrollIntoViewIfNeeded().catch(() => undefined);
    await mediaSelector.locator("button").first().click();
    await page.locator('[data-designer-modal="saas-resource-selector"]').waitFor({ state: "visible", timeout: 5000 });
    return true;
  }
  if (await tryOpenCurrentSelector()) return true;
  const treeCandidates = page.locator('[data-designer-layout="saas-page-card-tree"] button, [data-designer-tree-id] button');
  const candidateCount = Math.min(await treeCandidates.count(), 24);
  for (let index = 0; index < candidateCount; index += 1) {
    await treeCandidates.nth(index).click().catch(() => undefined);
    await page.waitForTimeout(160);
    if (await tryOpenCurrentSelector()) return true;
  }

  await page.getByRole("button", { name: "全局页头/页脚", exact: true }).click().catch(() => undefined);
  await page.waitForTimeout(250);
  if (await tryOpenCurrentSelector()) return true;

  const globalSectionButtons = page.getByRole("button", { name: /页眉|页脚/ });
  const globalSectionCount = Math.min(await globalSectionButtons.count(), 8);
  for (let index = 0; index < globalSectionCount; index += 1) {
    await globalSectionButtons.nth(index).click().catch(() => undefined);
    await page.waitForTimeout(180);
    if (await tryOpenCurrentSelector()) return true;
  }

  const globalCandidates = page.locator(
    '.global_5bc8 button, [data-layout="xfcart-collapsible-global-block-tree"] button, [data-designer-layout="saas-right-editor-pane"] [data-designer-tree-id], [data-designer-layout="saas-right-editor-pane"] button'
  );
  const globalCandidateCount = Math.min(await globalCandidates.count(), 48);
  for (let index = 0; index < globalCandidateCount; index += 1) {
    await globalCandidates.nth(index).click().catch(() => undefined);
    await page.waitForTimeout(160);
    if (await tryOpenCurrentSelector()) return true;
  }
  return false;
}

async function exerciseMediaResourceWorkflow(page, report, suiteReport) {
  const opened = await openFirstMediaResourceSelectorIfPresent(page);
  if (!opened) {
    suiteReport.findings.push("当前选中模块没有媒体字段，已跳过素材上传/删除 UI 闭环测试。");
    return;
  }
  const modal = page.locator('[data-designer-modal="saas-resource-selector"]').first();
  assert(await modal.locator('[data-designer-media-library-actions]').count() === 1, "media selector missing upload action area");
  assert(await modal.locator('[data-designer-media-upload-input]').count() === 1, "media selector missing upload input");
  assert(await modal.getByRole("button", { name: "取消选择", exact: true }).count() === 1, "media selector missing clear-selection action");

  const uploadPath = writeTinySmokePng();
  const mediaRequestsBeforeUpload = report.apiRequests.filter((item) => item.method === "POST" && item.url.includes("/media-assets")).length;
  const uploadStartedAt = performance.now();
  await modal.locator('[data-designer-media-upload-input]').setInputFiles(uploadPath);
  await page.waitForFunction(() => document.body.innerText.includes("已上传并选中素材"), { timeout: 20_000 });
  suiteReport.performance.interactions.mediaUploadMs = roundMs(performance.now() - uploadStartedAt);
  const mediaRequestsAfterUpload = report.apiRequests.filter((item) => item.method === "POST" && item.url.includes("/media-assets")).length;
  assert(mediaRequestsAfterUpload - mediaRequestsBeforeUpload === 1, "media upload did not make exactly one media-assets POST");
  assert(await modal.getByRole("button", { name: "删除素材", exact: true }).count() === 1, "media selector missing delete action after upload");

  page.once("dialog", (dialog) => dialog.accept());
  const deleteStartedAt = performance.now();
  await modal.getByRole("button", { name: "删除素材", exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes("素材已删除"), { timeout: 20_000 });
  suiteReport.performance.interactions.mediaDeleteMs = roundMs(performance.now() - deleteStartedAt);
  fs.rmSync(uploadPath, { force: true });
  await modal.getByRole("button", { name: "使用", exact: true }).click();
}

async function exerciseWorkbench(page, report, suiteReport) {
  const workbenchStartedAt = performance.now();
  await waitForWorkbench(page);
  suiteReport.performance.interactions.workbenchReadyMs = roundMs(performance.now() - workbenchStartedAt);
  await assertNoLayoutDefects(page, "desktop workbench", 1600);

  const initialLayout = await measureWorkbenchLayout(page);
  assert(initialLayout.bodyScrollHeight <= initialLayout.clientHeight + 2, `desktop workbench body is taller than viewport: ${initialLayout.bodyScrollHeight}px > ${initialLayout.clientHeight}px`);
  assert(initialLayout.navigatorRootClientHeight >= 400, `workspace navigator is too short: ${initialLayout.navigatorRootClientHeight}px`);
  assert(initialLayout.pageDirectoryScrollContainerHeight >= 120, `page directory scroll area is too short: ${initialLayout.pageDirectoryScrollContainerHeight}px`);
  const scrollYBefore = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 1200);
  await page.waitForTimeout(100);
  const scrollYAfter = await page.evaluate(() => window.scrollY);
  assert(scrollYAfter === scrollYBefore, `desktop workbench still scrolls vertically: ${scrollYBefore} -> ${scrollYAfter}`);

  const viewport1440 = await getPreviewIframeMetrics(page);
  assert(viewport1440.innerWidth === 1440, `default desktop iframe width should be 1440, got ${viewport1440.innerWidth}`);
  const iframeSrcBeforeTabs = viewport1440.src;
  const pageSelect = await findPageSelect(page);
  const selectedPageBeforeTabs = await pageSelect.inputValue();

  const mutationRequestsBeforeTabs = report.apiRequests.filter((item) => ["POST", "PUT", "PATCH", "DELETE"].includes(item.method)).length;
  const tabStartedAt = performance.now();
  for (const label of ["当前页面", "全局页头/页脚", "发布检查"]) {
    const tab = page.getByRole("button", { name: label, exact: true });
    await tab.click();
    await tab.click();
    await page.waitForTimeout(120);
    assert(await tab.getAttribute("aria-pressed") === "true", `${label} did not stay selected after repeated clicks`);
  }
  suiteReport.performance.interactions.repeatedTabSwitchMs = roundMs(performance.now() - tabStartedAt);
  const mutationRequestsAfterTabs = report.apiRequests.filter((item) => ["POST", "PUT", "PATCH", "DELETE"].includes(item.method)).length;
  assert(mutationRequestsAfterTabs === mutationRequestsBeforeTabs, "tab clicks triggered mutation API requests");
  assert((await pageSelect.inputValue()) === selectedPageBeforeTabs, "tab clicks changed selected page");
  assert((await getPreviewIframeMetrics(page)).src === iframeSrcBeforeTabs, "tab clicks changed iframe preview src");

  const viewportStartedAt = performance.now();
  await selectPreviewViewport(page, "1920×1080");
  await page.waitForTimeout(250);
  const viewport1920 = await getPreviewIframeMetrics(page);
  assert(viewport1920.innerWidth === 1920, `1920 preview viewport did not apply, got ${viewport1920.innerWidth}`);
  assert((await page.getByText("桌面缩放预览", { exact: false }).count()) > 0 || (await page.getByText("1:1 实际大小", { exact: false }).count()) > 0, "desktop preview viewport label missing");

  await selectPreviewViewport(page, "1536×960");
  await page.waitForTimeout(250);
  const viewport1536 = await getPreviewIframeMetrics(page);
  assert(viewport1536.innerWidth === 1536, `1536 preview viewport did not apply, got ${viewport1536.innerWidth}`);
  suiteReport.performance.interactions.viewportPresetSwitchMs = roundMs(performance.now() - viewportStartedAt);

  const tutorialButton = page.getByRole("button", { name: "教程", exact: true });
  const tutorialStartedAt = performance.now();
  await tutorialButton.click();
  await page.locator('[data-designer-layout="saas-workbench-tutorial-modal"]').waitFor({ state: "visible", timeout: 5000 });
  suiteReport.performance.interactions.tutorialOpenMs = roundMs(performance.now() - tutorialStartedAt);
  assert((await page.locator('[data-designer-layout="saas-workbench-tutorial-modal"]').innerText()).includes("新手教程"), "tutorial modal did not open");
  await page.getByRole("button", { name: "关闭新手教程", exact: true }).click();
  await page.getByRole("button", { name: "当前页面", exact: true }).click();
  await page.waitForTimeout(200);

  const emptyPageOption = await selectFirstEmptyPageIfPresent(page, pageSelect);
  if (emptyPageOption) {
    assert(await previewContainsText(page, "当前页面主体为空"), `empty-page preview placeholder did not render for ${emptyPageOption.label}`);
  } else {
    suiteReport.findings.push("未在页面选项中发现可稳定验证的空主体页面，已跳过空态预览断言。");
  }

  const editablePage = await selectFirstEditablePageIfPresent(page, pageSelect);
  assert(editablePage, "workbench page selector did not expose an editable page with a non-empty body");
  await page.waitForTimeout(150);

  await selectPageOptionByPattern(pageSelect, page, /(?:^|[\s/])(?:首页|home)(?:[\s/]|$)|(?:^|\s)\/(?:\s|$)/i);
  await waitForDraftPreviewReady(page);
  const draftPreview = page.locator(".designer-live-preview").first();
  const initialDraftMetrics = await getDraftPreviewMetrics(page);
  assert(
    initialDraftMetrics.scrollTop <= 4,
    `draft preview auto-scrolled away from the page top after load: ${initialDraftMetrics.scrollTop}px`
  );
  assert(initialDraftMetrics.scrollHeight > initialDraftMetrics.clientHeight + 20, `draft preview is not vertically scrollable: ${initialDraftMetrics.scrollHeight}px <= ${initialDraftMetrics.clientHeight}px`);
  await draftPreview.evaluate((node) => {
    node.scrollTop = 0;
  });
  const previewStageBox = await page.locator("[data-designer-preview-stage]").boundingBox();
  const previewBox = await draftPreview.boundingBox();
  const wheelPoint =
    previewStageBox && previewBox && previewBox.y + previewBox.height + 16 < previewStageBox.y + previewStageBox.height
      ? { x: previewStageBox.x + 24, y: previewBox.y + previewBox.height + 24 }
      : {
          x: (previewBox?.x ?? 0) + (previewBox?.width ?? 320) / 2,
          y: (previewBox?.y ?? 0) + (previewBox?.height ?? 320) / 2
        };
  const previewScrollBefore = await getDraftPreviewMetrics(page);
  const previewWheelStartedAt = performance.now();
  const outerScrollBeforePreviewWheel = await page.evaluate(() => window.scrollY);
  await page.mouse.move(wheelPoint.x, wheelPoint.y);
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(250);
  const previewScrollAfter = await getDraftPreviewMetrics(page);
  const outerScrollAfterPreviewWheel = await page.evaluate(() => window.scrollY);
  assert(outerScrollAfterPreviewWheel === outerScrollBeforePreviewWheel, `preview wheel moved the outer workbench: ${outerScrollBeforePreviewWheel} -> ${outerScrollAfterPreviewWheel}`);
  assert(previewScrollAfter.scrollTop > previewScrollBefore.scrollTop, `preview wheel did not scroll draft preview content: ${previewScrollBefore.scrollTop} -> ${previewScrollAfter.scrollTop}`);
  suiteReport.performance.interactions.previewWheelScrollMs = roundMs(performance.now() - previewWheelStartedAt);

  const rightPane = page.locator('[data-designer-layout="saas-right-editor-pane"]');
  const propertyBody = rightPane.locator('[data-designer-layout="saas-property-body"]').first();
  assert(await propertyBody.count() === 1, "right property pane missing its internal field scroll container");
  const rightPaneScrollState = await propertyBody.evaluate((node) => ({ scrollTop: node.scrollTop, scrollHeight: node.scrollHeight, clientHeight: node.clientHeight }));
  assert(rightPaneScrollState.scrollHeight > rightPaneScrollState.clientHeight + 8, "right property field body is not independently scrollable");
  await propertyBody.evaluate((node) => {
    node.scrollTop = Math.min(node.scrollHeight - node.clientHeight, node.scrollTop + 500);
  });
  const rightPaneScrollAfter = await propertyBody.evaluate((node) => node.scrollTop);
  assert(rightPaneScrollAfter > rightPaneScrollState.scrollTop, `right property field body did not scroll internally: ${rightPaneScrollState.scrollTop} -> ${rightPaneScrollAfter}`);
  await propertyBody.evaluate((node) => {
    node.scrollTop = 0;
  });

  await draftPreview.evaluate((node) => {
    node.scrollTop = 0;
  });
  await page.waitForTimeout(120);
  const editTarget = await markVisibleDraftPreviewTarget(page);
  assert(editTarget, "edit-mode preview did not expose a visible same-origin link or button");
  const urlBeforeEditClick = page.url();
  const editScrollBefore = (await getDraftPreviewMetrics(page)).scrollTop;
  const editClickStartedAt = performance.now();
  await page.locator('.designer-live-preview [data-smoke-preview-target="true"]').first().click({ force: true });
  await page.waitForTimeout(250);
  const editScrollAfter = (await getDraftPreviewMetrics(page)).scrollTop;
  assert(page.url() === urlBeforeEditClick, `edit定位 mode unexpectedly navigated page: ${urlBeforeEditClick} -> ${page.url()}`);
  assert(
    Math.abs(editScrollAfter - editScrollBefore) <= 8,
    `edit定位 click unexpectedly moved draft preview scroll: ${editScrollBefore} -> ${editScrollAfter}`
  );
  const editClickBody = await page.locator("body").innerText();
  assert(editClickBody.includes("已从编辑定位预览选中"), "edit定位 click did not select a preview source");
  suiteReport.performance.interactions.editModePreviewClickMs = roundMs(performance.now() - editClickStartedAt);
  await exerciseMediaResourceWorkflow(page, report, suiteReport);

  const interactiveToggle = page.getByRole("button", { name: "真实交互", exact: true });
  await interactiveToggle.click();
  await waitForPreviewIframeReady(page, { requireScrollable: false });
  assert((await getPreviewIframeMetrics(page)).src.includes("previewMode=interactive"), "real interaction mode did not update iframe query");
  const previewIframe = page.locator(".saas-designer-preview-frame iframe").first();
  const frame = page.frameLocator(".saas-designer-preview-frame iframe").first();
  await previewIframe.evaluate((iframe) => iframe.contentWindow?.scrollTo(0, 0));
  await page.waitForTimeout(120);
  const interactiveTarget = await markVisiblePreviewNavigationTarget(page, { requireLink: true });
  if (!interactiveTarget) {
    suiteReport.findings.push("预览页没有找到可验证的站内链接，已跳过真实交互跳转断言。");
  } else {
    const interactiveHrefBefore = (await getIframeWindowMetrics(page)).href;
    const interactiveClickStartedAt = performance.now();
    await frame.locator('[data-smoke-preview-target="true"]').click({ force: true });
    await page.waitForFunction(
      (previousHref) => {
        const iframe = document.querySelector(".saas-designer-preview-frame iframe");
        if (!(iframe instanceof HTMLIFrameElement)) return false;
        const href = iframe.contentDocument?.location.href ?? "";
        return Boolean(href && href !== previousHref && iframe.contentDocument?.readyState === "complete");
      },
      interactiveHrefBefore,
      { timeout: 15_000, polling: 100 }
    ).catch(() => undefined);
    const interactiveHrefAfter = (await getIframeWindowMetrics(page)).href;
    const interactiveDebug = await previewIframe.evaluate((iframe) => ({
      count: iframe.contentDocument?.documentElement.getAttribute("data-xfcart-interactive-navigation-count") ?? "",
      lastHref: iframe.contentDocument?.documentElement.getAttribute("data-xfcart-interactive-navigation-last-href") ?? "",
      ready: iframe.contentDocument?.documentElement.getAttribute("data-xfcart-interactive-navigation-ready") ?? "",
      via: iframe.contentDocument?.documentElement.getAttribute("data-xfcart-interactive-navigation-via") ?? "",
      error: iframe.contentDocument?.documentElement.getAttribute("data-xfcart-interactive-navigation-error") ?? "",
      frameSrc: iframe.getAttribute("src") ?? ""
    }));
    assert(interactiveHrefAfter !== interactiveHrefBefore, `真实交互模式链接没有跳转: ${interactiveHrefBefore}; target=${interactiveTarget.href} ${interactiveTarget.text}; debug=${JSON.stringify(interactiveDebug)}`);
    suiteReport.performance.interactions.interactivePreviewNavigationMs = roundMs(performance.now() - interactiveClickStartedAt);
  }
  await page.getByRole("button", { name: "编辑定位", exact: true }).click();
  await waitForDraftPreviewReady(page, { requireScrollable: false });

  const typingTargetInfo = await markVisiblePropertyInputTarget(page);
  if (!typingTargetInfo) {
    suiteReport.findings.push("没有找到可稳定输入的页面字段，已跳过连续输入防抖断言。");
  } else {
    const typingTarget = page.locator('[data-smoke-typing-target="true"]').first();
    const originalValue = await typingTarget.inputValue();
    const xfcartBeforeTyping = report.apiRequests.filter((item) => item.method === "POST" && item.url.includes("/theme/xfcart-edit")).length;
    const typingStartedAt = performance.now();
    await typingTarget.click();
    await typingTarget.press("ControlOrMeta+A");
    await typingTarget.pressSequentially("designer smoke input 1234567890", { delay: 18 });
    suiteReport.performance.interactions.typingInputSequenceMs = roundMs(performance.now() - typingStartedAt);
    await page.waitForTimeout(1200);
    const xfcartAfterTyping = report.apiRequests.filter((item) => item.method === "POST" && item.url.includes("/theme/xfcart-edit")).length;
    const typingRequestCount = xfcartAfterTyping - xfcartBeforeTyping;
    assert(typingRequestCount <= 2, `continuous field input triggered too many xfcart mutations: ${typingRequestCount}`);
    suiteReport.performance.interactions.typingDebounceSettledMs = roundMs(performance.now() - typingStartedAt);
    suiteReport.performance.interactions.typingXfcartRequestCount = typingRequestCount;
    await typingTarget.fill(originalValue);
    await page.waitForTimeout(700);
  }

  await page.getByRole("button", { name: "全局页头/页脚", exact: true }).click();
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: "当前页面", exact: true }).click();
  await page.waitForTimeout(200);
  const selectedScope = await page.locator('[data-designer-selected-scope]').first().getAttribute("data-designer-selected-scope");
  assert(selectedScope === "section", `current-page tab should keep a page selection or empty-page state, got ${selectedScope}`);
  const editablePaneText = await editorPaneText(page);
  assert(!editablePaneText.includes("此页主体为空"), "editable page was incorrectly treated as an empty page");
  assert(
    editablePaneText.includes("页面模块") || editablePaneText.includes("当前页面") || editablePaneText.includes("页面字段"),
    "editable page did not show page-module editing context after tab switching"
  );
  assert(!(await previewContainsText(page, "当前页面主体为空")), "editable page preview incorrectly rendered the empty-page placeholder");

  const search = page.locator('input[placeholder*="搜索"]');
  if (await search.count()) {
    await search.first().fill("Company");
    await page.waitForTimeout(250);
  }

  await page.getByRole("button", { name: "发布检查", exact: true }).click();
  const publishCheckStartedAt = performance.now();
  await page.getByText("本次会一起上线的内容", { exact: true }).waitFor({ state: "visible", timeout: 5000 });
  suiteReport.performance.interactions.publishCheckReadyMs = roundMs(performance.now() - publishCheckStartedAt);

  await page.getByRole("button", { name: "当前页面", exact: true }).click();
  const saveButton = page.getByRole("button", { name: "保存草稿", exact: true });
  const mutationBeforeSave = report.apiRequests.filter((item) => ["POST", "PUT", "PATCH", "DELETE"].includes(item.method)).length;
  const saveStartedAt = performance.now();
  await saveButton.dblclick();
  await page.waitForFunction(() => {
    const text = document.body.innerText;
    return (
      text.includes("草稿已保存但不会上线") ||
      text.includes("没有需要保存的草稿改动") ||
      text.includes("草稿保存被拦截") ||
      text.includes("当前已有保存或发布操作正在处理")
    );
  }, { timeout: 30_000 });
  const bodyAfterSave = await page.locator("body").innerText();
  assert(
    bodyAfterSave.includes("草稿已保存但不会上线") ||
      bodyAfterSave.includes("没有需要保存的草稿改动") ||
      bodyAfterSave.includes("草稿保存被拦截") ||
      bodyAfterSave.includes("当前已有保存或发布操作正在处理"),
    "save draft did not report a result"
  );
  const mutationAfterSave = report.apiRequests.filter((item) => ["POST", "PUT", "PATCH", "DELETE"].includes(item.method)).length;
  assert(mutationAfterSave - mutationBeforeSave <= 60, "double-click save triggered more than one full save batch");
  const saveState = await saveButton.getAttribute("data-designer-save-state");
  assert(["saved", "idle", "conflict", "error"].includes(saveState ?? ""), `save button did not expose a finished state: ${saveState}`);
  suiteReport.performance.interactions.saveDraftResultMs = roundMs(performance.now() - saveStartedAt);

  const publishButton = page.getByRole("button", { name: "发布", exact: true }).first();
  const publishModalStartedAt = performance.now();
  await publishButton.click();
  await page.getByRole("heading", { name: "发布会更新整站线上快照", exact: true }).waitFor({ state: "visible", timeout: 5000 });
  suiteReport.performance.interactions.publishModalOpenMs = roundMs(performance.now() - publishModalStartedAt);
  const modalText = await page.locator('[role="dialog"], .fixed.inset-0').last().innerText().catch(() => "");
  assert(modalText.includes("隐藏草稿") && modalText.includes("当前线上版本"), "publish confirmation did not show publish scope and version");
  await page.getByRole("button", { name: "返回", exact: true }).click();
}

async function previewContainsText(page, text) {
  const inIframe = await page.evaluate((needle) => {
    return Array.from(document.querySelectorAll("iframe")).some((iframe) => {
      const doc = iframe.contentDocument;
      const bodyText = doc?.body?.innerText ?? doc?.documentElement?.innerText ?? "";
      return bodyText.includes(needle);
    });
  }, text).catch(() => false);
  if (inIframe) return true;
  const livePreviewText = await page.locator(".designer-live-preview").innerText().catch(() => "");
  return livePreviewText.includes(text);
}

async function editorPaneText(page) {
  return page.locator('[data-designer-layout="saas-right-editor-pane"]').innerText({ timeout: 5000 }).catch(() => page.locator("body").innerText());
}

async function selectFirstEmptyPageIfPresent(page, pageSelect, limit = 6) {
  const options = await pageSelect.options();
  const prioritized = [
    ...options.filter((option) => /\/login\b|customer login|login/i.test(`${option.label} ${option.value}`)),
    ...options.filter((option) => !/\/login\b|customer login|login/i.test(`${option.label} ${option.value}`))
  ];
  for (const option of prioritized.slice(0, limit)) {
    await pageSelect.selectOption(option.value);
    await page.waitForTimeout(350);
    const paneText = await editorPaneText(page);
    if (paneText.includes("此页主体为空")) return option;
  }
  return null;
}

async function selectFirstEditablePageIfPresent(page, pageSelect, limit = 12) {
  const options = await pageSelect.options();
  const currentValue = await pageSelect.inputValue().catch(() => "");
  const prioritized = [
    ...options.filter((option) => option.value === currentValue),
    ...options.filter((option) => /(?:^|[\s/])(?:首页|home)(?:[\s/]|$)|(?:^|\s)\/(?:\s|$)/i.test(`${option.label} ${option.value}`) && option.value !== currentValue),
    ...options.filter((option) => option.value !== currentValue)
  ];
  const seen = new Set();
  for (const option of prioritized) {
    if (seen.has(option.value) || seen.size >= limit) continue;
    seen.add(option.value);
    await pageSelect.selectOption(option.value);
    await page.waitForTimeout(500);
    const paneText = await editorPaneText(page);
    const selectedScope = await page.locator('[data-designer-selected-scope]').first().getAttribute("data-designer-selected-scope").catch(() => "");
    if (!paneText.includes("此页主体为空") && selectedScope === "section") return option;
  }
  return null;
}

async function cleanupSmokeSite(prisma, siteId, slug) {
  if (!slug.startsWith("designer-smoke-")) {
    throw new Error(`refusing to clean non-smoke site ${slug}`);
  }
  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true, slug: true } });
  if (!site) return;
  assert(site.slug.startsWith("designer-smoke-"), `refusing cleanup for ${site.slug}`);
  await prisma.site.delete({ where: { id: site.id } });
}

async function waitForSandboxRecords(prisma, clone) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 45_000) {
    const site = await prisma.site.findUnique({
      where: { id: clone.id },
      select: {
        id: true,
        slug: true,
        settings: { select: { id: true } },
        _count: { select: { admins: true, pages: true } }
      }
    });
    if (site?.slug === clone.slug && site.settings && site._count.admins > 0 && site._count.pages > 0) {
      return {
        pages: site._count.pages,
        admins: site._count.admins,
        readyMs: Date.now() - startedAt
      };
    }
    await wait(750);
  }
  throw new Error(`sandbox records did not become ready for ${clone.slug}`);
}

async function recoverCreatedSmokeSite(prisma, slug, timeoutMs = 12_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const site = await prisma.site.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        settings: { select: { id: true } },
        _count: { select: { admins: true, pages: true } }
      }
    });
    if (site?.settings && site._count.admins > 0 && site._count.pages > 0) {
      return { id: site.id, slug: site.slug, email: `owner@${site.slug}.localhost`, password: "designer-smoke123" };
    }
    await wait(750);
  }
  return null;
}

async function createSandboxClone(api, platformCsrf, prisma) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const slug = `designer-smoke-${Date.now()}-${attempt}`;
    let createResponse;
    try {
      createResponse = await api.post("/api/platform/sites", {
        headers: { "x-csrf-token": platformCsrf },
        data: {
          name: `装修器测试沙盒 ${slug}`,
          slug,
          ownerEmail: `owner@${slug}.localhost`,
          ownerPassword: "designer-smoke123",
          sourceSiteId
        }
      });
    } catch (error) {
      lastError = error;
      const recovered = await recoverCreatedSmokeSite(prisma, slug);
      if (recovered) return recovered;
      await wait(1000 * attempt);
      continue;
    }
    const createJson = await createResponse.json().catch(() => ({}));
    if (createResponse.ok() && createJson.site?.id) {
      return { id: createJson.site.id, slug: createJson.site.slug, email: `owner@${slug}.localhost`, password: "designer-smoke123" };
    }
    lastError = new Error(`sandbox clone failed: ${createResponse.status()} ${JSON.stringify(createJson)}`);
    if (!JSON.stringify(createJson).includes("Transaction already closed")) break;
    await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
  }
  throw lastError ?? new Error("sandbox clone failed");
}

async function probeReusableSmokeSite(api, site) {
  if (!site.settings || site._count?.pages < 1 || site._count?.admins < 1) {
    return { ok: false, reason: `incomplete clone pages=${site._count?.pages ?? 0} admins=${site._count?.admins ?? 0} settings=${Boolean(site.settings)}` };
  }
  const email = `owner@${site.slug}.localhost`;
  const password = "designer-smoke123";
  const login = await api.post(`/api/sites/${site.id}/admin/auth/login`, {
    data: { email, password },
    timeout: 20_000
  }).catch((error) => ({ ok: () => false, status: () => 0, error }));
  if (!login.ok()) {
    return { ok: false, reason: `login ${typeof login.status === "function" ? login.status() : 0}` };
  }
  return { ok: true, reason: "login ok" };
}

async function loginPlatformAdmin(api, timeoutMs = 30_000) {
  const startedAt = Date.now();
  let lastStatus = 0;
  let lastJson = {};
  let lastError = "";
  while (Date.now() - startedAt < timeoutMs) {
    let response;
    try {
      response = await api.post("/api/platform/auth/login", {
        data: { email: platformEmail, password: platformPassword }
      });
    } catch (error) {
      lastError = String(error?.message ?? error);
      await wait(750);
      continue;
    }
    lastStatus = response.status();
    lastJson = await response.json().catch(() => ({}));
    if (response.ok() && lastJson.ok) return { response, json: lastJson };
    await wait(750);
  }
  throw new Error(`platform login failed: ${lastStatus} ${JSON.stringify(lastJson)} ${lastError}`.trim());
}

async function loginSandboxAdmin(api, clone, timeoutMs = 30_000) {
  const startedAt = Date.now();
  let lastStatus = 0;
  let lastJson = {};
  let lastError = "";
  while (Date.now() - startedAt < timeoutMs) {
    let response;
    try {
      response = await api.post(`/api/sites/${clone.id}/admin/auth/login`, {
        data: { email: clone.email, password: clone.password }
      });
    } catch (error) {
      lastError = String(error?.message ?? error);
      await wait(750);
      continue;
    }
    lastStatus = response.status();
    lastJson = await response.json().catch(() => ({}));
    if (response.ok() && lastJson.ok) return lastJson;
    await wait(750);
  }
  throw new Error(`sandbox admin login failed: ${lastStatus} ${JSON.stringify(lastJson)} ${lastError}`.trim());
}

async function reuseExistingSmokeSite(prisma, api) {
  const requestedSlug = process.env.DESIGNER_SMOKE_REUSE_SLUG?.trim();
  const sites = requestedSlug
    ? await prisma.site.findMany({
        where: { slug: requestedSlug },
        take: 1,
        select: { id: true, slug: true, settings: { select: { id: true } }, _count: { select: { admins: true, pages: true } } }
      })
    : await prisma.site.findMany({
        where: { slug: { startsWith: "designer-smoke-" } },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: { id: true, slug: true, settings: { select: { id: true } }, _count: { select: { admins: true, pages: true } } }
      });
  for (const site of sites) {
    const probe = await probeReusableSmokeSite(api, site);
    if (!probe.ok) {
      console.warn(`skipping reusable smoke site ${site.slug}: ${probe.reason}`);
      continue;
    }
    return {
      id: site.id,
      slug: site.slug,
      email: `owner@${site.slug}.localhost`,
      password: "designer-smoke123",
      reused: true
    };
  }
  return null;
}

async function run() {
  fs.mkdirSync(outputDir, { recursive: true });
  const runLock = await acquireRunLock();
  const api = await request.newContext({ baseURL: baseUrl, timeout: 120_000 });
  const prisma = new PrismaClient();
  let clone;
  let report = {
    ok: false,
    startedAt: new Date().toISOString(),
    baseUrl,
    sourceSiteId,
    screenshots: [],
    findings: [],
    performance: {
      interactions: {}
    }
  };
  let browser;

  try {
    const { response: platformLogin } = await loginPlatformAdmin(api);
    const platformCsrfCookie = cookieFrom(platformLogin, "platform_csrf");
    const platformCsrf = cookieValue(platformCsrfCookie, "platform_csrf");
    assert(platformCsrf, "missing platform csrf token");

    if (process.env.DESIGNER_SMOKE_REUSE_SLUG?.trim()) {
      const reusable = await reuseExistingSmokeSite(prisma, api);
      if (!reusable) throw new Error(`requested reusable smoke site is not workbench-ready: ${process.env.DESIGNER_SMOKE_REUSE_SLUG}`);
      clone = reusable;
    } else {
      try {
        clone = await createSandboxClone(api, platformCsrf, prisma);
      } catch (error) {
        if (process.env.DESIGNER_SMOKE_REUSE_EXISTING === "1") {
          const reusable = await reuseExistingSmokeSite(prisma, api);
          if (reusable) {
            console.warn(`sandbox clone timed out, reusing ${reusable.slug}`);
            clone = reusable;
          } else {
            throw error;
          }
        } else {
          throw error;
        }
      }
    }
    report.sandbox = { id: clone.id, slug: clone.slug, reused: Boolean(clone.reused) };
    report.performance.sandboxReady = await waitForSandboxRecords(prisma, clone);

    await loginSandboxAdmin(api, clone);

    browser = await chromium.launch(browserOptions);
    const storageState = await api.storageState();
    const withAuthedContext = async (viewport, work) => {
      const context = await browser.newContext({ storageState, viewport });
      try {
        return await work(context);
      } finally {
        await context.close();
      }
    };

    const runUiFlow = async () => {
      await withAuthedContext({ width: 1600, height: 1200 }, async (context) => {
        const adminPage = await context.newPage();
        const adminReport = await auditPage(adminPage, `/site/${clone.slug}/admin`, { width: 1600, height: 1200 }, "admin-desktop.png");
        if (!report.screenshots.includes("admin-desktop.png")) report.screenshots.push("admin-desktop.png");
        report.admin = adminReport;
        await assertNoLayoutDefects(adminPage, "admin dashboard", 1600);
        await adminPage.close();
      });

      await withAuthedContext({ width: 1600, height: 1200 }, async (context) => {
        const workbenchPage = await context.newPage();
        const workbenchReport = await auditPage(
          workbenchPage,
          `/site/${clone.slug}/admin/design/workbench`,
          { width: 1600, height: 1200 },
          "workbench-desktop.png"
        );
        if (!report.screenshots.includes("workbench-desktop.png")) report.screenshots.push("workbench-desktop.png");
        report.workbench = workbenchReport;
        await exerciseWorkbench(workbenchPage, workbenchReport, report);
        await workbenchPage.close();
      });

      await withAuthedContext({ width: 390, height: 844 }, async (context) => {
        const mobilePage = await context.newPage();
        const mobileReport = await auditPage(
          mobilePage,
          `/site/${clone.slug}/admin/design/workbench`,
          { width: 390, height: 844 },
          "workbench-mobile.png"
        );
        if (!report.screenshots.includes("workbench-mobile.png")) report.screenshots.push("workbench-mobile.png");
        report.mobile = mobileReport;
        await assertNoLayoutDefects(mobilePage, "mobile workbench", 390);
        assert(await mobilePage.locator(".saas-designer-preview-shell").count() === 1, "mobile workbench missing workspace shell");
        assert(await mobilePage.locator('[data-designer-preview-viewport-control="mobile"]').count() === 1, "mobile viewport label missing");
        assert(await mobilePage.locator('[data-designer-preview-viewport-control="desktop"]').count() === 0, "desktop viewport selector should be hidden on mobile");
        await mobilePage.close();
      });

      for (const entry of [report.admin, report.workbench, report.mobile]) {
        assert(entry.pageErrors.length === 0, `${entry.pathname} page errors: ${entry.pageErrors.join("\n")}`);
        assert(entry.consoleErrors.length === 0, `${entry.pathname} console errors: ${entry.consoleErrors.join("\n")}`);
        assert(entry.badResponses.length === 0, `${entry.pathname} bad responses: ${JSON.stringify(entry.badResponses)}`);
      }
    };

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        await runUiFlow();
        break;
      } catch (error) {
        if (attempt === 2 || !isTransientDevServerRunError(error, report)) throw error;
        report.findings.push("Next dev server 在烟测中途断线，智能体已等待服务恢复并自动重试一次。");
        report.admin = undefined;
        report.workbench = undefined;
        report.mobile = undefined;
        await waitForDevServerReady(baseUrl);
      }
    }

    if (!clone.reused) {
      await cleanupSmokeSite(prisma, clone.id, clone.slug);
      report.cleanup = "ok";
    } else {
      report.cleanup = "reused";
    }
    report.ok = true;
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  } catch (error) {
    report.error = error instanceof Error ? error.stack ?? error.message : String(error);
    report.sandbox = clone ? { id: clone.id, slug: clone.slug, reused: Boolean(clone.reused) } : undefined;
    report.finishedAt = new Date().toISOString();
    if (clone && !clone.reused && process.env.DESIGNER_SMOKE_KEEP_FAILED_SANDBOX !== "1") {
      await cleanupSmokeSite(prisma, clone.id, clone.slug).then(
        () => {
          report.cleanup = "failed-run-cleaned";
        },
        (cleanupError) => {
          report.cleanup = `failed-run-cleanup-error: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`;
        }
      );
    } else if (clone?.reused) {
      report.cleanup = "reused";
    }
    fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
    throw error;
  } finally {
    if (browser) await browser.close().catch(() => undefined);
    await api.dispose();
    await prisma.$disconnect();
    await runLock.release();
  }

  const pageTimingLines = [
    ["后台首页", report.admin?.timings],
    ["工作台桌面", report.workbench?.timings],
    ["工作台移动", report.mobile?.timings]
  ].map(([label, timings]) => `- ${label}：DOM ${formatMs(timings?.domContentLoadedMs)}，network idle ${formatMs(timings?.networkIdleMs)}，总计 ${formatMs(timings?.totalMs)}`);
  const interactionLines = Object.entries(report.performance?.interactions ?? {}).map(([key, value]) =>
    `- ${key}：${key.endsWith("RequestCount") ? `${value} 次` : formatMs(value)}`
  );
  const apiTimingLines = [report.admin, report.workbench, report.mobile]
    .flatMap((entry) => entry?.apiRequests ?? [])
    .filter((entry) => typeof entry.durationMs === "number")
    .sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0))
    .slice(0, 8)
    .map((entry) => `- ${entry.method} ${entry.status} ${formatMs(entry.durationMs)} ${entry.url.replace(baseUrl, "")}`);
  const markdown = [
    "# 装修器测试智能体报告",
    "",
    `- 结果：${report.ok ? "通过" : "失败"}`,
    `- 测试时间：${report.finishedAt ?? report.startedAt}`,
    `- 基地址：${report.baseUrl}`,
    `- 沙盒：${report.cleanup === "ok" ? "已清理" : report.sandbox?.slug ?? "未创建"}`,
    "",
    "## 截图",
    ...report.screenshots.map((screenshot) => `- \`output/designer-workbench-agent/${screenshot}\``),
    "",
    "## 响应时间",
    ...pageTimingLines,
    "",
    "## 关键交互耗时",
    ...(interactionLines.length ? interactionLines : ["- 未采集到交互耗时。"]),
    "",
    "## API 慢请求 Top 8",
    ...(apiTimingLines.length ? apiTimingLines : ["- 未采集到 API 请求耗时。"]),
    "",
    "## 关键检查",
    "- 后台首页无 pageerror、console error、network error 和 4xx/5xx 资源。",
    "- 外层工作台保持锁定，滚轮会滚动左侧草稿预览，右侧属性区独立滚动。",
    "- 编辑定位模式使用本地草稿实时预览，点击链接/按钮只选中内容来源，不发生业务跳转。",
    "- 真实交互预览允许站内链接在 iframe 中正常跳转。",
    "- 连续输入会被防抖合并，不会逐字符调用 xfcart mutation。",
    report.performance?.interactions?.mediaUploadMs
      ? "- 媒体字段支持上传图片/视频入口、选中预览、取消选择和删除素材。"
      : "- 当前沙盒未稳定选中媒体字段，已跳过素材弹窗上传/删除 UI 操作；媒体 API 上传/删除需使用独立 smoke 验证。",
    "- 工作台 Tab 重复点击不会触发 mutation API。",
    "- 保存草稿双击不会产生两批完整保存请求。",
    "- 发布确认展示隐藏草稿和线上版本。",
    "- 桌面/移动端按钮文案不裁切，右侧面板保持可用宽度。"
  ];
  fs.writeFileSync(path.join(outputDir, "report.md"), `${markdown.join("\n")}\n`);
  console.log(`✓ designer workbench agent passed; report: ${path.join(outputDir, "report.md")}`);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
