import { chromium } from "playwright";

const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:3002").replace(/\/$/, "");
const routeChecks = [
  { host: "www.mydreamshoots.com", paths: ["/", "/workflow", "/collections", "/collections/creator-portraits", "/tools", "/pricing", "/faq", "/login", "/about-us", "/contact-us", "/privacy", "/terms", "/cookies", "/refunds"] },
  { host: "www.aidreamcapes.com", paths: ["/", "/workflow", "/collections", "/collections/cinematic-travel", "/tools", "/pricing", "/faq", "/login", "/about-us", "/contact-us", "/privacy", "/terms", "/cookies", "/refunds"] }
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
  const response = await request.get(`${baseUrl}${path}`, {
    headers: { Host: host },
    maxRedirects: 0,
    timeout: 60000
  });
  return response.status();
}

async function collectInternalLinks(request, host, path) {
  const response = await request.get(`${baseUrl}${path}`, {
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
  } finally {
    await browser.close();
  }

  assert(!failures.length, `Found storefront 404 routes: ${JSON.stringify(failures, null, 2)}`);
}

smokeStorefrontPublicRoutes().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
