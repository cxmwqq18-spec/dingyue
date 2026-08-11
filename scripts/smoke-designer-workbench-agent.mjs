import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { chromium, request } from "playwright";
import { PrismaClient } from "@prisma/client";

import "./load-runtime-env.mjs";

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

async function auditPage(page, pathname, viewport, screenshotName) {
  const pageErrors = [];
  const consoleErrors = [];
  const badResponses = [];
  const failedRequests = [];
  const apiRequests = [];
  const requestStartedAt = new Map();

  page.on("pageerror", (error) => pageErrors.push(String(error?.stack ?? error)));
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

  await page.screenshot({ path: path.join(outputDir, screenshotName), fullPage: true });
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
  await iframe.waitFor({ state: "visible", timeout: 15000 });
  const canvas = page.locator('[data-designer-preview="saas-center-preview-canvas"]').first();
  return {
    src: await iframe.getAttribute("src") ?? "",
    innerWidth: Number(await canvas.getAttribute("data-designer-preview-width") ?? 0),
    innerHeight: Number(await canvas.getAttribute("data-designer-preview-height") ?? 0)
  };
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
  await page.waitForTimeout(500);

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
    ...options.filter((option) => /(?:^|\s)(?:首页|home|\/)(?:\s|$)/i.test(`${option.label} ${option.value}`) && option.value !== currentValue),
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
    const platformLogin = await api.post("/api/platform/auth/login", {
      data: { email: platformEmail, password: platformPassword }
    });
    const platformLoginJson = await platformLogin.json().catch(() => ({}));
    assert(platformLogin.ok() && platformLoginJson.ok, `platform login failed: ${platformLogin.status()} ${JSON.stringify(platformLoginJson)}`);
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

    const adminLogin = await api.post(`/api/sites/${clone.id}/admin/auth/login`, {
      data: { email: clone.email, password: clone.password }
    });
    const adminLoginJson = await adminLogin.json().catch(() => ({}));
    assert(adminLogin.ok() && adminLoginJson.ok, `sandbox admin login failed: ${adminLogin.status()} ${JSON.stringify(adminLoginJson)}`);

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

    await withAuthedContext({ width: 1600, height: 1200 }, async (context) => {
      const adminPage = await context.newPage();
      const adminReport = await auditPage(adminPage, `/site/${clone.slug}/admin`, { width: 1600, height: 1200 }, "admin-desktop.png");
      report.screenshots.push("admin-desktop.png");
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
      report.screenshots.push("workbench-desktop.png");
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
      report.screenshots.push("workbench-mobile.png");
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
  const interactionLines = Object.entries(report.performance?.interactions ?? {}).map(([key, value]) => `- ${key}：${formatMs(value)}`);
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
