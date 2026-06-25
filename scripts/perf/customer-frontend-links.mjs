import { chromium } from "playwright";

const baseUrl = process.env.CUSTOMER_FRONTEND_BASE_URL ?? "http://localhost:3002";
const siteSlug = process.env.CUSTOMER_FRONTEND_SITE_SLUG ?? "dreamshoot";
const customerEmail = process.env.CUSTOMER_FRONTEND_EMAIL ?? "";
const customerPassword = process.env.CUSTOMER_FRONTEND_PASSWORD ?? "";
const headless = process.env.PW_HEADLESS !== "0";
const timeoutMs = Number.parseInt(process.env.CUSTOMER_FRONTEND_TIMEOUT_MS ?? "20000", 10);
const networkidleTimeoutMs = Number.parseInt(process.env.CUSTOMER_FRONTEND_NETWORKIDLE_TIMEOUT_MS ?? "8000", 10);
const settleWindowMs = Number.parseInt(process.env.CUSTOMER_FRONTEND_SETTLE_MS ?? "350", 10);
const homePath = `/site/${siteSlug}`;

const targets = [
  {
    name: "account",
    path: "/account",
    allowLoginRedirect: true,
    preferHomeTextLink: false,
    linkText: /account|start making|get started with email|continue with google/i,
    title: /account|sign in|private dreamshootai account|customer account|personal center|credits, orders, albums/i
  },
  {
    name: "app",
    path: "/app",
    allowLoginRedirect: true,
    preferHomeTextLink: false,
    linkText: /studio|workspace|start making|private workspace/i,
    title: /workspace|studio|sign in|private account|upload/i
  },
  {
    name: "upload",
    path: "/app#upload_1",
    allowLoginRedirect: true,
    preferHomeTextLink: false,
    linkText: /upload photos|private intake|start making/i,
    title: /upload|private intake|source photos|sign in/i
  },
  {
    name: "pricing",
    path: "/pricing",
    linkText: /^pricing$/i,
    title: /pricing|plans|transparent pricing|compare plans/i
  },
  {
    name: "tools",
    path: "/tools",
    linkText: /^tools$/i,
    title: /tools|photo ai|background changer|professional headshot/i
  },
  {
    name: "how-it-works",
    path: "/#workflow",
    linkText: /how it works/i,
    title: /from upload|workflow|how it works|private album/i
  },
  {
    name: "faq",
    path: "/help",
    linkText: /faq|help center/i,
    title: /faq|questions|help|before upload/i
  }
];

function absoluteUrl(path) {
  if (path.startsWith("/#")) return `${baseUrl}${homePath}${path.slice(1)}`;
  return `${baseUrl}${homePath}${path}`;
}

function nowMs() {
  return Math.round(performance.now());
}

function elapsedFrom(start) {
  return nowMs() - start;
}

function normalizeWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function summarizeConsoleMessage(message) {
  return {
    type: message.type(),
    text: normalizeWhitespace(message.text()).slice(0, 500),
    location: message.location()
  };
}

function isConsoleError(message) {
  return ["error", "pageerror"].includes(message.type());
}

async function firstVisibleText(page, selector) {
  const text = await page
    .locator(selector)
    .evaluateAll((elements) => {
      const visible = elements.find((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
      });
      return visible?.textContent ?? "";
    })
    .catch(() => "");
  return normalizeWhitespace(text);
}

async function pageKeyTitle(page) {
  const heading = await firstVisibleText(page, "h1, h2, [data-page-title], main [class*='title']");
  if (heading) return heading;
  return normalizeWhitespace(await page.title().catch(() => ""));
}

async function waitForStableContent(page, start) {
  const contentSelector = "main, body";
  await page.waitForSelector(contentSelector, { state: "visible", timeout: timeoutMs });

  let previous = "";
  let stableSince = performance.now();
  while (performance.now() - start < timeoutMs) {
    const snapshot = await page.evaluate(() => {
      const main = document.querySelector("main") || document.body;
      return {
        textLength: (main?.innerText || "").replace(/\s+/g, " ").trim().length,
        imageCount: document.images.length,
        height: document.documentElement.scrollHeight,
        pending: document.querySelectorAll('[aria-busy="true"], [data-loading="true"]').length
      };
    });
    const next = JSON.stringify(snapshot);
    if (next === previous && snapshot.textLength > 20 && snapshot.pending === 0) {
      if (performance.now() - stableSince >= settleWindowMs) return elapsedFrom(start);
    } else {
      previous = next;
      stableSince = performance.now();
    }
    await page.waitForTimeout(80);
  }

  throw new Error(`content did not stabilize within ${timeoutMs}ms`);
}

async function waitForAcceptedUrl(page, target, start) {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    if (urlAccepted(page.url(), target)) return elapsedFrom(start);
    await page.waitForTimeout(25);
  }
  return null;
}

async function findHomeLink(page, target) {
  const expectedUrl = absoluteUrl(target.path).replace(/\/$/, "");
  const byHref = page.locator("a");
  const count = await byHref.count();
  for (let index = 0; index < count; index += 1) {
    const link = byHref.nth(index);
    const href = await link.getAttribute("href").catch(() => "");
    if (!href) continue;
    const absoluteHref = new URL(href, `${baseUrl}${homePath}`).href.replace(/\/$/, "");
    if (absoluteHref === expectedUrl) return link;
  }

  if (target.preferHomeTextLink === false) return null;

  const directLink = page.getByRole("link", { name: target.linkText }).first();
  if (await directLink.count().catch(() => 0)) return directLink;

  return null;
}

function expectedPath(target) {
  return `${homePath}${target.path.startsWith("/#") ? target.path.slice(1) : target.path}`;
}

function urlAccepted(href, target) {
  const url = new URL(href);
  const expected = expectedPath(target);
  const actualPath = url.pathname.replace(/\/$/, "") || "/";
  const expectedParts = expected.split("#");
  const expectedPathname = (expectedParts[0] || "/").replace(/\/$/, "") || "/";
  const expectedHash = expectedParts[1] ? `#${expectedParts[1]}` : "";
  if (actualPath === expectedPathname && url.hash === expectedHash) return true;
  if (actualPath === expectedPathname && !expectedHash) return true;
  if (target.allowLoginRedirect && url.pathname === `${homePath}/login`) return true;
  return false;
}

async function clickTarget(page, target, start) {
  const link = await findHomeLink(page, target);
  if (link) {
    await link.scrollIntoViewIfNeeded();
    const tag = await link.evaluate((element) => ({
      text: (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim(),
      href: element.getAttribute("href") || ""
    }));
    await link.click({ noWaitAfter: true, timeout: 5000 });
    return { method: "link", text: tag.text, href: tag.href, clickedMs: elapsedFrom(start) };
  }

  await page.evaluate((url) => {
    const anchor = document.createElement("a");
    anchor.dataset.perfCustomerSyntheticLink = "true";
    anchor.href = url;
    anchor.textContent = url;
    anchor.style.position = "fixed";
    anchor.style.left = "8px";
    anchor.style.top = "8px";
    anchor.style.zIndex = "2147483647";
    anchor.style.background = "white";
    anchor.style.color = "black";
    anchor.style.padding = "4px";
    document.body.append(anchor);
  }, absoluteUrl(target.path));
  await page.locator("[data-perf-customer-synthetic-link='true']").click({ force: true, noWaitAfter: true, timeout: 5000 });
  return { method: "synthetic-link", text: "", href: target.path, clickedMs: elapsedFrom(start) };
}

async function measureTarget(browser, target, storageState) {
  const context = await browser.newContext({
    baseURL: baseUrl,
    viewport: { width: 1440, height: 1000 },
    storageState
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (isConsoleError(message)) consoleErrors.push(summarizeConsoleMessage(message));
  });
  page.on("pageerror", (error) => {
    consoleErrors.push({ type: "pageerror", text: normalizeWhitespace(error.message).slice(0, 500), location: {} });
  });

  try {
    await page.goto(homePath, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: networkidleTimeoutMs }).catch(() => null);
    const start = nowMs();
    const click = await clickTarget(page, target, start);

    const urlPromise = waitForAcceptedUrl(page, target, start);
    const titlePromise = page
      .getByText(target.title)
      .first()
      .waitFor({ state: "visible", timeout: timeoutMs })
      .then(() => elapsedFrom(start))
      .catch(() => null);

    const stablePromise = waitForStableContent(page, start).catch(async () => {
      const titleMs = await titlePromise;
      return titleMs === null ? null : titleMs + settleWindowMs;
    });
    const networkidlePromise = page.waitForLoadState("networkidle", { timeout: networkidleTimeoutMs }).then(() => elapsedFrom(start)).catch(() => null);

    const [urlMs, titleMs, stableContentMs, networkidleMs] = await Promise.all([
      urlPromise,
      titlePromise,
      stablePromise,
      networkidlePromise
    ]);

    if (target.path.includes("#")) {
      await page.waitForTimeout(settleWindowMs);
    }

    const actualUrl = page.url();
    const keyTitle = await pageKeyTitle(page);
    return {
      name: target.name,
      target: absoluteUrl(target.path),
      ok: Boolean(urlMs !== null && titleMs !== null && stableContentMs !== null && urlAccepted(actualUrl, target)),
      click,
      actualUrl,
      keyTitle,
      timingsMs: {
        clickToUrl: urlMs,
        clickToKeyTitle: titleMs,
        clickToStableContent: stableContentMs,
        clickToNetworkidle: networkidleMs
      },
      consoleErrors
    };
  } catch (error) {
    return {
      name: target.name,
      target: absoluteUrl(target.path),
      ok: false,
      actualUrl: page.url(),
      keyTitle: await pageKeyTitle(page).catch(() => ""),
      error: error instanceof Error ? error.message : String(error),
      consoleErrors
    };
  } finally {
    await context.close();
  }
}

function printResults(results) {
  const rows = results.map((result) => ({
    route: result.name,
    ok: result.ok ? "yes" : "no",
    urlMs: result.timingsMs?.clickToUrl ?? "timeout",
    titleMs: result.timingsMs?.clickToKeyTitle ?? "timeout",
    stableMs: result.timingsMs?.clickToStableContent ?? "timeout",
    networkidleMs: result.timingsMs?.clickToNetworkidle ?? "timeout",
    consoleErrors: result.consoleErrors.length,
    title: result.keyTitle
  }));

  console.table(rows);
  console.log(JSON.stringify({
    ok: results.every((result) => result.ok && result.consoleErrors.length === 0),
    baseUrl,
    siteSlug,
    testedAt: new Date().toISOString(),
    results
  }, null, 2));
}

async function loginCustomer(browser) {
  if (!customerEmail || !customerPassword) return undefined;

  const context = await browser.newContext({ baseURL: baseUrl });
  const page = await context.newPage();
  try {
    const response = await page.request.post(`/api/sites/site_${siteSlug}/auth/login`, {
      data: {
        email: customerEmail,
        password: customerPassword
      },
      timeout: timeoutMs
    });

    if (!response.ok()) {
      const body = await response.text().catch(() => "");
      throw new Error(`customer login failed: ${response.status()} ${body.slice(0, 300)}`);
    }

    return await context.storageState();
  } finally {
    await context.close();
  }
}

async function main() {
  const browser = await chromium.launch({ headless });
  try {
    const storageState = await loginCustomer(browser);
    const results = [];
    for (const target of targets) {
      const result = await measureTarget(browser, target, storageState);
      results.push(result);
      const status = result.ok ? "ok" : "failed";
      console.log(`[${status}] ${target.name} -> ${result.actualUrl}`);
    }
    printResults(results);

    if (results.some((result) => !result.ok || result.consoleErrors.length > 0)) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
