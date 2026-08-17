import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:3002").replace(/\/$/, "");
const base = new URL(baseUrl);
const storefrontRoutes = [
  {
    host: "www.mydreamshoots.com",
    paths: ["/", "/collections", "/tools", "/best-packages", "/best-ai-image", "/best-ai-video", "/pricing", "/workflow", "/faq", "/blog", "/about-us", "/contact-us"]
  },
  {
    host: "www.aidreamcapes.com",
    paths: ["/", "/collections", "/tools", "/best-packages", "/best-ai-image", "/best-ai-video", "/pricing", "/workflow", "/faq", "/blog", "/about-us", "/contact-us"]
  },
  {
    host: "aidreamshoots.eu",
    paths: ["/", "/collections", "/tools", "/pricing", "/workflow", "/faq", "/blog", "/about-us", "/contact-us"]
  },
  {
    host: "aidreamcapes.eu",
    paths: ["/", "/collections", "/tools", "/pricing", "/workflow", "/faq", "/blog", "/about-us", "/contact-us"]
  }
];
const spanishXbyCollectionAliasRoutes = [
  ["/collections/belleza", "/collections/beauty"],
  ["/collections/creativo", "/collections/creative"],
  ["/collections/deportes", "/collections/world-cup-fan-photos"],
  ["/collections/estilo-de-vida", "/collections/estilo-y-fantasia"],
  ["/collections/creador", "/collections/creator"],
  ["/collections/retratos", "/collections/retratos-y-perfiles"],
  ["/collections/temporada", "/collections/seasonal"],
  ["/collections/utilidades", "/collections/video-y-utilidades"],
  ["/collections/video", "/collections/ai-video-add-ons"]
];
const viewports = [
  { name: "desktop", viewport: { width: 1440, height: 900 } },
  { name: "mobile", viewport: { width: 390, height: 844 } }
];

const smokeRetryAttempts = 5;
const smokeRequestTimeoutMs = 60000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, init) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), smokeRequestTimeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchTextWithRecovery(url, init, label, redirectDepth = 0) {
  let lastError;
  for (let attempt = 1; attempt <= smokeRetryAttempts; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, init);
      if (response.status !== 200) {
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get("location");
          if (!location) {
            assert(response.status === 200, `${label} should return 200, got ${response.status}`);
          }
          if (redirectDepth >= smokeRetryAttempts) {
            throw new Error(`${label} exceeded redirect depth`);
          }
          const nextUrl = new URL(location, url).toString();
          return fetchTextWithRecovery(nextUrl, init, `${label} -> ${nextUrl}`, redirectDepth + 1);
        }
        if (response.status >= 500 && attempt < smokeRetryAttempts) {
          lastError = new Error(`${label} returned ${response.status}`);
          await sleep(1200 * attempt);
          continue;
        }
        assert(response.status === 200, `${label} should return 200, got ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < smokeRetryAttempts) {
        await sleep(1200 * attempt);
        continue;
      }
    }
  }
  throw new Error(`${label} fetch failed after ${smokeRetryAttempts} attempts`, { cause: lastError });
}

async function fetchHtml(host, path) {
  return fetchTextWithRecovery(`${baseUrl}${path}`, {
    headers: {
      Accept: "text/html,*/*",
      Host: host,
      "x-forwarded-host": host,
      "user-agent": "public-seo-ssr-smoke"
    },
    redirect: "manual"
  }, `${host}${path}`);
}

async function fetchSitemapPaths(host) {
  const xml = await fetchTextWithRecovery(`${baseUrl}/sitemap.xml`, {
    headers: {
      Accept: "application/xml,text/xml,*/*",
      Host: host,
      "x-forwarded-host": host,
      "user-agent": "public-seo-ssr-smoke"
    },
    redirect: "manual"
  }, `${host}/sitemap.xml`);
  return Array.from(new Set(
    Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/gi))
      .map((match) => {
        try {
          const url = new URL(match[1]);
          return url.pathname + url.search || "/";
        } catch {
          return "";
        }
      })
      .filter(Boolean)
  ));
}

function internalPathsFromHtml(host, html) {
  const paths = new Set();
  for (const match of html.matchAll(/\bhref=["']([^"'<>]+)["']/gi)) {
    const href = match[1];
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) continue;
    try {
      const url = new URL(href, `https://${host}`);
      if (url.hostname !== host) continue;
      const path = `${url.pathname}${url.search}` || "/";
      if (!isPublicSeoCrawlPath(path)) continue;
      paths.add(path);
    } catch {
      // Ignore invalid hrefs.
    }
  }
  return Array.from(paths);
}

function isPublicSeoCrawlPath(path) {
  if (!path || !path.startsWith("/")) return false;
  return !/^\/(?:_next|account|admin|album|api|app|cart|checkout|dashboard|job|login|logout|platform|search|site)(?:\/|$|\?)/.test(path);
}

async function crawlPublicPathsForHost(host) {
  const seedPaths = new Set([
    ...(await fetchSitemapPaths(host)),
    ...storefrontRoutes.find((item) => item.host === host)?.paths ?? ["/"]
  ]);
  const queue = Array.from(seedPaths);
  const seen = new Set();
  const results = [];
  while (queue.length) {
    const path = queue.shift();
    if (!path || seen.has(path)) continue;
    seen.add(path);
    const html = await fetchHtml(host, path);
    assert(
      !html.includes('data-lazy-storefront-section="true"'),
      `${host}${path} must not SSR lazy storefront section placeholders`
    );
    assert(
      !html.includes("/storefront-section"),
      `${host}${path} must not embed storefront section API URLs in initial HTML`
    );
    results.push({ host, path, htmlBytes: Buffer.byteLength(html) });
    for (const linkPath of internalPathsFromHtml(host, html)) {
      if (!seen.has(linkPath) && !queue.includes(linkPath)) queue.push(linkPath);
    }
    if (seen.size >= 260) break;
  }
  return results;
}

async function sectionLayoutSnapshot(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll(".xfcart-section[data-section-id]")).map((element) => {
    const rect = element.getBoundingClientRect();
    return {
      id: element.getAttribute("data-section-id") || "",
      top: Math.round(rect.top * 100) / 100,
      left: Math.round(rect.left * 100) / 100,
      width: Math.round(rect.width * 100) / 100,
      height: Math.round(rect.height * 100) / 100
    };
  }));
}

function assertSameSectionLayout(before, after, label) {
  assert(before.length === after.length, `${label} section count changed from ${before.length} to ${after.length}`);
  for (let index = 0; index < before.length; index += 1) {
    const a = before[index];
    const b = after[index];
    assert(a.id === b.id, `${label} section order changed at index ${index}: ${a.id} -> ${b.id}`);
    for (const key of ["top", "left", "width", "height"]) {
      const delta = Math.abs((a[key] || 0) - (b[key] || 0));
      assert(delta <= 0.5, `${label} section ${a.id} ${key} changed by ${delta.toFixed(2)}px`);
    }
  }
}

async function gotoWithRecovery(page, url, label) {
  let lastError;
  for (let attempt = 1; attempt <= smokeRetryAttempts; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(750);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < smokeRetryAttempts) {
        await sleep(1200 * attempt);
        continue;
      }
    }
  }
  throw new Error(`${label} navigation failed after ${smokeRetryAttempts} attempts`, { cause: lastError });
}

const htmlResults = [];
for (const [aliasPath, canonicalPath] of spanishXbyCollectionAliasRoutes) {
  const html = await fetchHtml("aidreamshoots.eu", aliasPath);
  assert(
    html.includes(`<link rel="canonical" href="https://aidreamshoots.eu${canonicalPath}"`),
    `aidreamshoots.eu${aliasPath} must canonicalize to ${canonicalPath}`
  );
  assert(
    !html.includes('data-lazy-storefront-section="true"'),
    `aidreamshoots.eu${aliasPath} must not SSR lazy storefront section placeholders`
  );
  assert(
    !html.includes("/storefront-section"),
    `aidreamshoots.eu${aliasPath} must not embed storefront section API URLs in initial HTML`
  );
}
for (const storefront of storefrontRoutes) {
  for (const path of storefront.paths) {
    const html = await fetchHtml(storefront.host, path);
    assert(
      !html.includes('data-lazy-storefront-section="true"'),
      `${storefront.host}${path} must not SSR lazy storefront section placeholders`
    );
    assert(
      !html.includes("/storefront-section"),
      `${storefront.host}${path} must not embed storefront section API URLs in initial HTML`
    );
    htmlResults.push({ host: storefront.host, path, htmlBytes: Buffer.byteLength(html) });
  }
}

const fullCrawlResults = [];
for (const storefront of storefrontRoutes) {
  fullCrawlResults.push(...await crawlPublicPathsForHost(storefront.host));
}

const browser = await chromium.launch({ headless: true });
const requestResults = [];
const layoutResults = [];
try {
  for (const { name: viewportName, viewport } of viewports) {
    const context = await browser.newContext({
      baseURL: baseUrl,
      viewport
    });
    for (const storefront of storefrontRoutes) {
      for (const path of storefront.paths) {
        const requests = [];
        const page = await context.newPage();
        page.on("request", (request) => {
          if (/\/api\/site-slugs\/[^/]+\/storefront-section(?:\?|$)/.test(request.url())) {
            requests.push(request.url());
          }
        });
        await page.setExtraHTTPHeaders({
          "x-forwarded-host": storefront.host,
          "x-forwarded-port": base.port || (base.protocol === "https:" ? "443" : "80"),
          "user-agent": "public-seo-ssr-smoke"
        });
        await gotoWithRecovery(page, new URL(path, baseUrl).toString(), `${storefront.host}${path} ${viewportName}`);
        const before = await sectionLayoutSnapshot(page);
        const after = await sectionLayoutSnapshot(page);
        assert(!requests.length, `${storefront.host}${path} must not request storefront sections on initial load: ${requests.join(", ")}`);
        assertSameSectionLayout(before, after, `${storefront.host}${path} ${viewportName}`);
        requestResults.push({ host: storefront.host, path, viewport: viewportName, sectionApiRequests: requests.length });
        layoutResults.push({ host: storefront.host, path, viewport: viewportName, sections: before.length });
        await page.close();
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({ ok: true, htmlResults, fullCrawlResults, requestResults, layoutResults }, null, 2));
