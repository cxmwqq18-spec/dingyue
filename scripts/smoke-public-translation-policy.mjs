import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";

loadRuntimeEnv();

const root = process.cwd();
const baseUrl = (process.env.SMOKE_BASE_URL || "").replace(/\/$/, "");
const prisma = baseUrl ? new PrismaClient() : undefined;
const publicSurfaceRoots = [
  "src/app/site",
  "src/components/theme-renderer.tsx",
  "src/components/storefront",
  "src/components/app",
  "src/lib/storefront-render.tsx",
  "src/lib/theme",
  "src/lib/dreamshoot-seo-content.ts"
];

const blockedPatterns = [
  { label: "notranslate class or token", pattern: /\bnotranslate\b/i },
  { label: "translate=no attribute", pattern: /\btranslate\s*=\s*["']no["']/i },
  { label: "translate={false} attribute", pattern: /\btranslate\s*=\s*\{\s*false\s*\}/i },
  { label: "translate={'no'} attribute", pattern: /\btranslate\s*=\s*\{\s*["']no["']\s*\}/i },
  { label: "google notranslate meta", pattern: /name\s*=\s*["']google["'][\s\S]{0,160}content\s*=\s*["']notranslate["']/i }
];

const runtimeRoutesBySite = {
  aidreamcapes: [
    "/",
    "/pricing",
    "/cart?product=prod_aidreamcapes_starter&price=price_aidreamcapes_trailhead_monthly",
    "/collections",
    "/collections/route-portrait-albums",
    "/tools",
    "/tools/route-portrait-engine",
    "/login",
    "/about-us",
    "/contact-us",
    "/privacy",
    "/terms",
    "/refunds",
    "/cookies",
    "/shipping",
    "/content",
    "/blog/planning-dreamscape-source-photos",
    "/search?q=privacy"
  ],
  mydreamshoots: [
    "/",
    "/pricing",
    "/cart?product=prod_dreamshoot_pro&price=price_dreamshoot_pro_yearly",
    "/collections",
    "/collections/travel",
    "/tools",
    "/tools/headshot",
    "/login",
    "/about-us",
    "/contact-us",
    "/privacy",
    "/terms",
    "/refunds",
    "/cookies",
    "/shipping",
    "/content",
    "/blog/preparing-source-photos",
    "/search?q=privacy"
  ]
};

const canonicalRouteAliases = {
  "/cookie-policy": "/cookies",
  "/policies/content": "/content",
  "/policies/cookies": "/cookies",
  "/policies/privacy": "/privacy",
  "/policies/refunds": "/refunds",
  "/policies/shipping": "/shipping",
  "/policies/terms": "/terms",
  "/privacy-policy": "/privacy",
  "/terms-of-service": "/terms"
};

function walk(target) {
  const fullPath = path.join(root, target);
  if (!fs.existsSync(fullPath)) return [];
  const stat = fs.statSync(fullPath);
  if (stat.isFile()) return [fullPath];
  return fs.readdirSync(fullPath, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith(".") || entry.name === "node_modules") return [];
    const child = path.join(target, entry.name);
    return walk(child);
  });
}

const allowedExtensions = new Set([".tsx", ".ts", ".jsx", ".js", ".mjs", ".json", ".html"]);
const files = publicSurfaceRoots
  .flatMap(walk)
  .filter((file) => allowedExtensions.has(path.extname(file)));

const violations = [];
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const lines = source.split(/\r?\n/);
  for (const rule of blockedPatterns) {
    lines.forEach((line, index) => {
      if (rule.pattern.test(line)) {
        violations.push({
          file: path.relative(root, file),
          line: index + 1,
          rule: rule.label,
          text: line.trim()
        });
      }
    });
  }
}

async function fetchRuntimeHtml(siteSlug, routePath) {
  const response = await fetch(`${baseUrl}/site/${siteSlug}${routePath}`, {
    redirect: "follow",
    headers: { accept: "text/html" }
  });
  const html = await response.text();
  return { response, html };
}

function validateRuntimeHtml(siteSlug, routePath, response, html) {
  const routeLabel = `${siteSlug}${routePath}`;
  const status = response.status;
  if (!response.ok) {
    violations.push({
      file: routeLabel,
      line: 0,
      rule: "runtime route should render translatable HTML",
      text: `status ${status}`
    });
    return;
  }
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    violations.push({
      file: routeLabel,
      line: 0,
      rule: "runtime route should render HTML",
      text: contentType || "missing content-type"
    });
    return;
  }
  const htmlTag = html.match(/<html\b[^>]*>/i)?.[0] || "";
  if (!/\blang\s*=\s*["']en["']/i.test(htmlTag)) {
    violations.push({
      file: routeLabel,
      line: 0,
      rule: "runtime html language",
      text: htmlTag || "missing <html>"
    });
  }
  if (/\btranslate\s*=\s*["']no["']/i.test(html) || /\bnotranslate\b/i.test(html)) {
    violations.push({
      file: routeLabel,
      line: 0,
      rule: "runtime browser translation blocker",
      text: "translate=no or notranslate found in rendered HTML"
    });
  }
}

function normalizeRuntimeRoute(routePath) {
  const normalized = routePath === "/" ? "/" : routePath.replace(/\/+$/, "");
  return canonicalRouteAliases[normalized] ?? normalized;
}

async function runtimeRoutesFromDatabase() {
  if (!prisma) return runtimeRoutesBySite;
  const dynamicRoutesBySite = {};
  for (const siteSlug of Object.keys(runtimeRoutesBySite)) {
    const site = await prisma.site.findUnique({
      where: { slug: siteSlug },
      include: {
        pages: { select: { slug: true } },
        creativePacks: { where: { status: "active" }, select: { category: true }, take: 16 },
        toolMenuItems: { where: { status: "active" }, select: { href: true, slug: true }, take: 24 }
      }
    });
    const routes = new Set(runtimeRoutesBySite[siteSlug]);
    for (const page of site?.pages ?? []) {
      if (!page.slug || page.slug === "/404") continue;
      if (page.slug === "/account" || page.slug === "/app" || page.slug.startsWith("/app/")) continue;
      if (page.slug === "/album") continue;
      routes.add(normalizeRuntimeRoute(page.slug));
    }
    for (const pack of site?.creativePacks ?? []) {
      if (pack.category) routes.add(`/collections/${pack.category}`);
    }
    for (const tool of site?.toolMenuItems ?? []) {
      const href = tool.href?.startsWith("/tools/") ? tool.href : tool.slug ? `/tools/${tool.slug}` : "";
      if (href) routes.add(href);
    }
    dynamicRoutesBySite[siteSlug] = Array.from(routes).sort();
  }
  return dynamicRoutesBySite;
}

if (baseUrl) {
  var routesToCheck = await runtimeRoutesFromDatabase();
  for (const [siteSlug, routes] of Object.entries(routesToCheck)) {
    for (const routePath of routes) {
      const { response, html } = await fetchRuntimeHtml(siteSlug, routePath);
      validateRuntimeHtml(siteSlug, routePath, response, html);
    }
  }
}

if (violations.length) {
  console.error("Public storefront translation policy failed.");
  console.error("MyDreamShoots and Aidreamcapes public pages must not disable browser translation.");
  for (const violation of violations) {
    console.error(`${violation.file}${violation.line ? `:${violation.line}` : ""} ${violation.rule}: ${violation.text}`);
  }
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  checkedFiles: files.length,
  checkedRuntimeRoutes: baseUrl ? Object.values(routesToCheck).reduce((sum, routes) => sum + routes.length, 0) : 0,
  policy: "public storefront translation enabled"
}, null, 2));

if (prisma) await prisma.$disconnect();
