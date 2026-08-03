import { chromium } from "playwright";

const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:3002").replace(/\/$/, "");
const routeChecks = [
  { host: "www.mydreamshoots.com", paths: ["/", "/workflow", "/collections", "/collections/creator-portraits", "/tools", "/pricing", "/faq", "/login", "/about-us", "/contact-us", "/privacy", "/terms", "/cookies", "/refunds"] },
  { host: "www.aidreamcapes.com", paths: ["/", "/workflow", "/collections", "/collections/fan-scene-albums", "/collections/private-fan-scene-albums", "/collections/game-day-group-photos", "/collections/game-day-group-portraits", "/collections/christmas-holiday-albums", "/collections/christmas-group-albums", "/collections/new-year-countdown-albums", "/tools", "/tools/fan-scene-album-builder", "/tools/game-day-group-portrait-maker", "/tools/christmas-group-album-studio", "/tools/new-year-countdown-album-maker", "/tools/permission-safe-photo-planner", "/blog/private-fan-scene-album-photo-package-guide", "/pricing", "/faq", "/login", "/about-us", "/contact-us", "/privacy", "/terms", "/cookies", "/refunds"] }
];
const imageAltRouteChecks = [
  { host: "www.mydreamshoots.com", paths: ["/", "/collections", "/collections/world-cup-fan-photos", "/collections/christmas-photos", "/tools", "/tools/world-cup-fan-photos"] },
  { host: "www.aidreamcapes.com", paths: ["/", "/collections", "/collections/fan-scene-albums", "/collections/private-fan-scene-albums", "/collections/game-day-group-photos", "/collections/christmas-group-albums", "/tools", "/tools/fan-scene-album-builder", "/tools/new-year-countdown-album-maker"] }
];
const legacyRedirectChecks = [
  { host: "www.aidreamcapes.com", path: "/collections/route-portrait-albums", target: "/collections/fan-scene-albums" },
  { host: "www.aidreamcapes.com", path: "/collections/coastal-light-sets", target: "/collections/christmas-group-albums" },
  { host: "www.aidreamcapes.com", path: "/collections/old-quarter-walks", target: "/collections/premiere-style-portraits" },
  { host: "www.aidreamcapes.com", path: "/tools/route-portrait-engine", target: "/tools/fan-scene-album-builder" },
  { host: "www.aidreamcapes.com", path: "/tools/coastal-portrait", target: "/tools/christmas-group-album-studio" },
  { host: "www.aidreamcapes.com", path: "/tools/seasonal-celebration-album-maker", target: "/tools/new-year-countdown-album-maker" },
  { host: "www.aidreamcapes.com", path: "/blog/fan-scene-photo-albums-guide", target: "/blog/private-fan-scene-album-photo-package-guide" },
  { host: "www.aidreamcapes.com", path: "/blog/game-day-group-portraits-guide", target: "/blog/game-day-group-portraits-photo-package-guide" },
  { host: "www.aidreamcapes.com", path: "/blog/holiday-memory-albums-guide", target: "/blog/christmas-group-album-photo-package-guide" }
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestGetWithRetry(request, url, options, attempts = 5) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await request.get(url, options);
    } catch (error) {
      lastError = error;
      const message = String(error?.message ?? error);
      const retryable = /ECONNREFUSED|ECONNRESET|socket hang up|Target page, context or browser has been closed|Timeout/i.test(message);
      if (!retryable || attempt === attempts - 1) throw error;
      await wait(900 * (attempt + 1));
    }
  }
  throw lastError;
}

function normalizeHostPath(host, href) {
  try {
    const url = new URL(href, `https://${host}`);
    if (url.hostname !== host) return undefined;
    return `${url.pathname}${url.search}`;
  } catch {
    return undefined;
  }
}

async function statusForPath(request, host, path) {
  const response = await requestGetWithRetry(request, `${baseUrl}${path}`, {
    headers: { Host: host },
    maxRedirects: 0,
    timeout: 60000
  });
  return response.status();
}

async function redirectForPath(request, host, path) {
  return requestGetWithRetry(request, `${baseUrl}${path}`, {
    headers: { Host: host },
    maxRedirects: 0,
    timeout: 60000
  });
}

async function collectInternalLinks(request, host, path) {
  const response = await requestGetWithRetry(request, `${baseUrl}${path}`, {
    headers: { Host: host },
    timeout: 60000
  });
  if (response.status() >= 400) return [];
  const html = await response.text();
  const paths = new Set();
  for (const match of html.matchAll(/\bhref=["']([^"']+)["']/g)) {
    const href = match[1];
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) continue;
    const linkPath = normalizeHostPath(host, href);
    if (linkPath) paths.add(linkPath);
  }
  return Array.from(paths);
}

function decodeHtmlAttribute(value) {
  return String(value ?? "")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function attributesForTag(tag) {
  const attrs = new Map();
  for (const match of tag.matchAll(/([A-Za-z_:][-A-Za-z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    const [, name, doubleValue, singleValue, bareValue] = match;
    attrs.set(name.toLowerCase(), decodeHtmlAttribute(doubleValue ?? singleValue ?? bareValue ?? ""));
  }
  return attrs;
}

function invalidAltReason(host, alt) {
  const normalized = String(alt ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return "empty_alt";
  if (/^(?:image|photo|picture|preview|thumbnail|hero|undefined|null|n\/a)$/i.test(normalized)) return "placeholder_alt";
  if (host.includes("aidreamcapes") && /MyDreamShoots|DreamShootAI|DreamShoot/i.test(normalized)) return "cross_brand_alt";
  if (host.includes("mydreamshoots") && /Aidreamcapes/i.test(normalized)) return "cross_brand_alt";
  return undefined;
}

async function imageAltFailuresForPath(request, host, path) {
  const response = await requestGetWithRetry(request, `${baseUrl}${path}`, {
    headers: { Host: host },
    timeout: 60000
  });
  if (response.status() >= 400) return [{ host, path, status: response.status(), reason: "image_alt_page_unavailable" }];
  const html = await response.text();
  const failures = [];
  let index = 0;
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    index += 1;
    const attrs = attributesForTag(match[0]);
    const alt = attrs.get("alt");
    const reason = attrs.has("alt") ? invalidAltReason(host, alt) : "missing_alt";
    if (reason) {
      failures.push({
        host,
        path,
        index,
        src: attrs.get("src") || attrs.get("data-src") || "",
        alt: alt ?? "",
        reason
      });
    }
  }
  return failures;
}

async function smokeStorefrontPublicRoutes() {
  const browser = await chromium.launch({ headless: true });
  const failures = [];
  try {
    const context = await browser.newContext({ baseURL: baseUrl, viewport: { width: 1440, height: 900 } });
    const request = context.request;

    for (const check of routeChecks) {
      const paths = new Set(check.paths);
      for (const path of check.paths.slice(0, 6)) {
        for (const linkPath of await collectInternalLinks(request, check.host, path).catch(() => [])) {
          if (/^\/(?:site|api|platform|_next)(?:\/|$)/.test(linkPath)) continue;
          paths.add(linkPath);
        }
      }
      for (const path of Array.from(paths).sort()) {
        const status = await statusForPath(request, check.host, path).catch(() => 599);
        if (status === 404) failures.push({ host: check.host, path, status });
        if (status < 400 || [301, 302, 303, 307, 308, 401].includes(status)) {
          console.log(`✓ ${check.host}${path} -> ${status}`);
        } else {
          console.log(`✗ ${check.host}${path} -> ${status}`);
        }
      }
    }
    for (const check of legacyRedirectChecks) {
      const response = await redirectForPath(request, check.host, check.path).catch(() => undefined);
      const status = response?.status() ?? 599;
      const location = response?.headers().location ?? "";
      if (![301, 302, 307, 308].includes(status) || !location.includes(check.target)) {
        failures.push({ host: check.host, path: check.path, status, expectedRedirect: check.target, location });
        console.log(`✗ ${check.host}${check.path} -> ${status} ${location}`);
      } else {
        console.log(`✓ ${check.host}${check.path} -> ${status} ${location}`);
      }
    }
    for (const check of imageAltRouteChecks) {
      for (const path of check.paths) {
        const imageFailures = await imageAltFailuresForPath(request, check.host, path).catch((error) => [{ host: check.host, path, status: 599, reason: error.message }]);
        failures.push(...imageFailures);
        if (imageFailures.length) {
          console.log(`✗ ${check.host}${path} image alt -> ${imageFailures.length} failure(s)`);
        } else {
          console.log(`✓ ${check.host}${path} image alt`);
        }
      }
    }
  } finally {
    await browser.close();
  }

  assert(!failures.length, `Found storefront route failures: ${JSON.stringify(failures, null, 2)}`);
}

smokeStorefrontPublicRoutes().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
