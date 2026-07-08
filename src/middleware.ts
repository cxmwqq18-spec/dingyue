import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const TARGET_SITE_PATH_RE = /^\/site\/(?:aidreamcapes|mydreamshoots)(?:\/|$)/i;
const TARGET_HOST_RE = /(?:^|\.)((aidreamcapes|mydreamshoots)\.com)$/i;
const INTERNAL_PATH_RE = /^\/(?:api|assets|_next\/static|_next\/image|robots\.txt|sitemap\.xml)(?:\/|$)/i;
const BROWSER_ICON_PATH_RE = /^\/(?:favicon\.ico|favicon\.svg|icon\.svg|apple-touch-icon(?:\.png)?)$/i;
const PRIVATE_STORE_PATH_RE = /^\/site\/(?:aidreamcapes|mydreamshoots)\/(?:admin|app|account|dashboard|login|register|reset-password|checkout|logout)(?:\/|$)/i;
const HOST_PRIVATE_STORE_PATH_RE = /^\/(?:admin|app|account|dashboard|login|register|reset-password|checkout|logout)(?:\/|$)/i;
const REORDER_SKIP_HEADER = "x-storefront-head-seo-reorder-skip";
const AIDREAMCAPES_COLLECTION_REDIRECTS: Record<string, string> = {
  adventure: "cinematic-travel",
  city: "cafe-corner-stories",
  coastal: "coastal-light-sets",
  destination: "route-portrait-albums",
  postcard: "social-keepsakes",
  "cafe-street-journals": "cafe-street-stories",
  "destination-portrait-albums": "route-portrait-albums",
  "coastal-getaways": "coastal-light-sets",
  "old-city-walks": "cafe-corner-stories",
  "cafe-street-stories": "cafe-corner-stories",
  "scenic-overlooks": "golden-hour-route-stories",
  "mountain-trails": "cinematic-travel",
  "road-trip-frames": "cinematic-travel",
  "itinerary-moodboards": "route-moodboard",
  "postcard-social-sets": "social-keepsakes",
  "travel-profile-stories": "solo-traveler-profiles",
  "lagoon-route-studys": "lagoon-route-studies"
};
const MYDREAMSHOOTS_COLLECTION_REDIRECTS: Record<string, string> = {
  lifestyle: "travel",
  "professional-headshots": "headshots"
};
const MYDREAMSHOOTS_TOOL_REDIRECTS: Record<string, string> = {
  "ai-image-studio": "",
  "headshot-generator": "headshot",
  "image-studio": "",
  "travel-portraits": "nature-adventure"
};
const AIDREAMCAPES_TOOL_REDIRECTS: Record<string, string> = {
  "ai-image-studio": "",
  "background-changer": "route-portrait-engine",
  "background-remover": "route-portrait-engine",
  "couple-escape-album": "shared-route-album",
  "dreamscape-generator": "route-portrait-engine",
  headshot: "route-portrait-engine",
  "image-generator": "route-portrait-engine",
  "image-to-video": "route-portrait-engine",
  "image-studio": "",
  "portrait-generator": "route-portrait-engine",
  "portrait-maker": "route-portrait-engine",
  "product-reverie": "route-moodboard",
  "soft-glam": "cafe-street-story",
  "wedding-portraits": "",
  "world-cup-fan-photos": ""
};
const LEGACY_PUBLIC_PATH_REDIRECTS: Record<string, string> = {
  "/about": "/about-us",
  "/contact": "/contact-us",
  "/content-policy": "/content",
  "/cookie-policy": "/cookies",
  "/delivery-policy": "/shipping",
  "/examples": "/collections",
  "/policies/content": "/content",
  "/policies/cookies": "/cookies",
  "/policies/privacy": "/privacy",
  "/policies/refund": "/refunds",
  "/policies/refunds": "/refunds",
  "/policies/shipping": "/shipping",
  "/policies/terms": "/terms",
  "/privacy-policy": "/privacy",
  "/refund-policy": "/refunds",
  "/shipping-policy": "/shipping",
  "/terms-of-service": "/terms",
  "/tool": "/tools"
};
const LOCAL_DEFAULT_STOREFRONT_PATHS = new Set(["/collections", "/tools", "/pricing", "/help"]);
const LOCAL_DEFAULT_STOREFRONT_PREFIXES = ["/account", "/app", "/dashboard", "/login"];

const SEO_HEAD_TAG_RE =
  /<title\b[^>]*>[\s\S]*?<\/title>|<meta\b(?=[^>]*(?:name=["'](?:description|keywords|robots|twitter:(?:card|title|description|image))["']|property=["']og:(?:title|description|url|site_name|image)["']))[^>]*\/?>|<link\b(?=[^>]*rel=["']canonical["'])[^>]*\/?>|<script\b(?=[^>]*type=["']application\/ld\+json["'])[^>]*>[\s\S]*?<\/script>/gi;
const LEADING_SEO_HEAD_TAG_RE =
  /^(?:\s*(?:<title\b[^>]*>[\s\S]*?<\/title>|<meta\b(?=[^>]*(?:name=["'](?:description|keywords|robots|twitter:(?:card|title|description|image))["']|property=["']og:(?:title|description|url|site_name|image)["']))[^>]*\/?>|<link\b(?=[^>]*rel=["']canonical["'])[^>]*\/?>|<script\b(?=[^>]*type=["']application\/ld\+json["'])[^>]*>[\s\S]*?<\/script>))*/i;
const ICON_HEAD_TAG_RE = /<link\b(?=[^>]*rel=["'][^"']*(?:icon|apple-touch-icon)[^"']*["'])[^>]*\/?>/gi;
const AIDREAMCAPES_LOGO_IMG_RE =
  /<img\b(?=[^>]*src=["']\/assets\/sites\/site_aidreamcapes\/brand\/aidreamcapesai-logo-refined\.svg[^"']*["'])(?=[^>]*alt=["'][^"']*Aidreamcapes[^"']*["'])([^>]*)\/?>/gi;
const AIDREAMCAPES_ICON = "/assets/sites/site_aidreamcapes/brand/aidreamcapes-icon-192.png?v=20260702";
const AIDREAMCAPES_ICON_SVG = "/assets/sites/site_aidreamcapes/brand/aidreamcapesai-logo-refined.svg?v=20260702";
const AIDREAMCAPES_APPLE_ICON = "/assets/sites/site_aidreamcapes/brand/aidreamcapes-icon-180.png?v=20260702";
const MYDREAMSHOOTS_ICON = "/assets/dreamshoot/brand/dreamshootai-icon-192.png?v=20260702";
const MYDREAMSHOOTS_ICON_SVG = "/assets/dreamshoot/brand/dreamshootai-logo-refined.svg?v=20260702";
const MYDREAMSHOOTS_APPLE_ICON = "/assets/dreamshoot/brand/dreamshootai-icon-180.png?v=20260702";
const AIDREAMCAPES_INLINE_LOGO = `<svg class="h-full w-full object-contain" viewBox="0 0 512 512" role="img" aria-label="Aidreamcapes logo for AI travel portraits and private destination galleries"><defs><linearGradient id="aidreamcapes-header-logo" x1="92" y1="76" x2="420" y2="430" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#A855F7"/><stop offset="0.48" stop-color="#F65BA8"/><stop offset="1" stop-color="#52C7D8"/></linearGradient></defs><g fill="none" stroke="url(#aidreamcapes-header-logo)" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"><path d="M256 388c-56-49-126-91-126-174 0-52 41-84 85-70 19 6 32 20 41 38 9-18 22-32 41-38 44-14 85 18 85 70 0 83-70 125-126 174Z"/><path d="M256 176l42 78-42 86-42-86 42-78Z"/><path d="M192 254h128"/></g><circle cx="256" cy="254" r="18" fill="transparent" stroke="#F65BA8" stroke-width="12"/></svg>`;

function normalizePathSlug(value: string): string {
  const decoded = (() => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  })();
  return decoded
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function aidreamcapesCollectionRedirect(request: NextRequest): NextResponse | undefined {
  const pathname = request.nextUrl.pathname;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const pathMatch = pathname.match(/^\/site\/aidreamcapes\/collections\/([^/]+)(\/)?$/i);
  const hostMatch = TARGET_HOST_RE.test(host) && /aidreamcapes/i.test(host)
    ? pathname.match(/^\/collections\/([^/]+)(\/)?$/i)
    : undefined;
  const match = pathMatch ?? hostMatch;
  if (!match) return undefined;

  const currentSlug = normalizePathSlug(match[1] ?? "");
  const canonicalSlug = AIDREAMCAPES_COLLECTION_REDIRECTS[currentSlug];
  if (!canonicalSlug) return undefined;

  const nextUrl = request.nextUrl.clone();
  nextUrl.pathname = pathMatch ? `/site/aidreamcapes/collections/${canonicalSlug}` : `/collections/${canonicalSlug}`;
  return NextResponse.redirect(nextUrl, 308);
}

function directoryCanonicalRedirect(request: NextRequest): NextResponse | undefined {
  const pathname = request.nextUrl.pathname;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";

  const pathMatch = pathname.match(/^\/site\/(aidreamcapes|mydreamshoots)\/(collections|tools)\/([^/]+)(\/)?$/i);
  const hostMatch = TARGET_HOST_RE.test(host)
    ? pathname.match(/^\/(collections|tools)\/([^/]+)(\/)?$/i)
    : undefined;
  if (!pathMatch && !hostMatch) return undefined;

  const siteSlug = pathMatch?.[1]?.toLowerCase() ?? (host.toLowerCase().includes("aidreamcapes") ? "aidreamcapes" : "mydreamshoots");
  const kind = (pathMatch?.[2] ?? hostMatch?.[1] ?? "").toLowerCase();
  const currentSlug = normalizePathSlug(pathMatch?.[3] ?? hostMatch?.[2] ?? "");
  const redirectMap =
    siteSlug === "aidreamcapes" && kind === "collections"
      ? AIDREAMCAPES_COLLECTION_REDIRECTS
      : siteSlug === "mydreamshoots" && kind === "collections"
        ? MYDREAMSHOOTS_COLLECTION_REDIRECTS
        : siteSlug === "mydreamshoots" && kind === "tools"
          ? MYDREAMSHOOTS_TOOL_REDIRECTS
          : siteSlug === "aidreamcapes" && kind === "tools"
            ? AIDREAMCAPES_TOOL_REDIRECTS
          : undefined;
  const canonicalSlug = redirectMap?.[currentSlug];
  if (canonicalSlug === undefined) return undefined;

  const nextUrl = request.nextUrl.clone();
  nextUrl.pathname = canonicalSlug
    ? pathMatch
      ? `/site/${siteSlug}/${kind}/${canonicalSlug}`
      : `/${kind}/${canonicalSlug}`
    : pathMatch
      ? `/site/${siteSlug}/${kind}`
      : `/${kind}`;
  return NextResponse.redirect(nextUrl, 308);
}

function legacyPublicPathRedirect(request: NextRequest): NextResponse | undefined {
  const pathname = request.nextUrl.pathname.replace(/\/+$/, "") || "/";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const pathMatch = pathname.match(/^\/site\/(aidreamcapes|mydreamshoots)(\/.*)$/i);
  const scopedPath = pathMatch?.[2]?.toLowerCase() ?? "";
  const hostPath = TARGET_HOST_RE.test(host) ? pathname.toLowerCase() : "";
  const targetPath = LEGACY_PUBLIC_PATH_REDIRECTS[scopedPath] ?? LEGACY_PUBLIC_PATH_REDIRECTS[hostPath];
  if (!targetPath) return undefined;

  const nextUrl = request.nextUrl.clone();
  nextUrl.pathname = pathMatch ? `/site/${pathMatch[1].toLowerCase()}${targetPath}` : targetPath;
  return NextResponse.redirect(nextUrl, 308);
}

function localDefaultStorefrontRedirect(request: NextRequest): NextResponse | undefined {
  const pathname = request.nextUrl.pathname.replace(/\/+$/, "") || "/";
  const normalizedPath = pathname.toLowerCase();
  const shouldRedirect =
    LOCAL_DEFAULT_STOREFRONT_PATHS.has(normalizedPath) ||
    LOCAL_DEFAULT_STOREFRONT_PREFIXES.some((prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`));
  if (!shouldRedirect) return undefined;
  const host = (request.headers.get("host") ?? "").toLowerCase();
  if (!host.startsWith("localhost") && !host.startsWith("127.0.0.1")) return undefined;

  const defaultSiteSlug = process.env.DEFAULT_STOREFRONT_SITE_SLUG || "mydreamshoots";
  const nextUrl = request.nextUrl.clone();
  nextUrl.pathname = `/site/${defaultSiteSlug}${pathname}`;
  return NextResponse.redirect(nextUrl, 308);
}

function canonicalPublicHostSitePathRedirect(request: NextRequest): NextResponse | undefined {
  const pathname = request.nextUrl.pathname;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  if (!TARGET_HOST_RE.test(host)) return undefined;
  const match = pathname.match(/^\/site\/(aidreamcapes|mydreamshoots)(\/.*)?$/i);
  if (!match) return undefined;
  const siteSlug = match[1]?.toLowerCase() ?? "";
  if (!host.toLowerCase().includes(siteSlug)) return undefined;
  const scopedPath = match[2] || "/";
  const nextUrl = request.nextUrl.clone();
  nextUrl.pathname = scopedPath === "/" ? "/" : scopedPath;
  return NextResponse.redirect(nextUrl, 308);
}

function shouldReorderStorefrontHead(request: NextRequest): boolean {
  if (process.env.STOREFRONT_EDGE_HTML_REWRITE === "0") return false;
  if (request.method !== "GET") return false;
  if (request.headers.get(REORDER_SKIP_HEADER) === "1") return false;
  const pathname = request.nextUrl.pathname;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  if (INTERNAL_PATH_RE.test(pathname) || PRIVATE_STORE_PATH_RE.test(pathname) || (TARGET_HOST_RE.test(host) && HOST_PRIVATE_STORE_PATH_RE.test(pathname))) return false;

  const accept = request.headers.get("accept") ?? "";
  if (accept && !accept.includes("text/html") && !accept.includes("*/*")) return false;

  return TARGET_SITE_PATH_RE.test(pathname) || TARGET_HOST_RE.test(host);
}

function titleFirstSeoTags(tags: string[]): string[] {
  const titleIndex = tags.findIndex((tag) => /^<title\b/i.test(tag));
  if (titleIndex < 0) return tags;
  const titleTag = tags[titleIndex];
  return [titleTag, ...tags.slice(0, titleIndex), ...tags.slice(titleIndex + 1)];
}

function leadingSeoHeadLength(headContent: string): number {
  return headContent.match(LEADING_SEO_HEAD_TAG_RE)?.[0].length ?? 0;
}

function moveSeoTagsBeforeResources(html: string): string {
  const headOpen = html.search(/<head\b[^>]*>/i);
  if (headOpen < 0) return html;

  const headOpenEnd = html.indexOf(">", headOpen);
  const headClose = html.search(/<\/head>/i);
  if (headOpenEnd < 0 || headClose < 0 || headClose <= headOpenEnd) return html;

  const beforeHeadContent = html.slice(0, headOpenEnd + 1);
  const headContent = html.slice(headOpenEnd + 1, headClose);
  const afterHeadContent = html.slice(headClose);

  const seoTags: string[] = [];
  const strippedHead = headContent.replace(SEO_HEAD_TAG_RE, (tag) => {
    seoTags.push(tag);
    return "";
  });
  const strippedAfterHead = afterHeadContent.replace(SEO_HEAD_TAG_RE, (tag) => {
    seoTags.push(tag);
    return "";
  });
  if (!seoTags.length) return html;

  const reorderedHead = `${titleFirstSeoTags(seoTags).join("")}${strippedHead}`;
  return `${beforeHeadContent}${reorderedHead}${strippedAfterHead}`;
}

type StorefrontIconSet = {
  png: string;
  svg: string;
  apple: string;
};

function siteIconForRequest(request: NextRequest): StorefrontIconSet | undefined {
  const identity = `${request.nextUrl.pathname} ${request.headers.get("x-forwarded-host") ?? ""} ${request.headers.get("host") ?? ""}`.toLowerCase();
  if (identity.includes("aidreamcapes")) return { png: AIDREAMCAPES_ICON, svg: AIDREAMCAPES_ICON_SVG, apple: AIDREAMCAPES_APPLE_ICON };
  if (identity.includes("mydreamshoots")) return { png: MYDREAMSHOOTS_ICON, svg: MYDREAMSHOOTS_ICON_SVG, apple: MYDREAMSHOOTS_APPLE_ICON };
  if (BROWSER_ICON_PATH_RE.test(request.nextUrl.pathname)) return { png: MYDREAMSHOOTS_ICON, svg: MYDREAMSHOOTS_ICON_SVG, apple: MYDREAMSHOOTS_APPLE_ICON };
  return undefined;
}

function withStorefrontIcons(html: string, icons: StorefrontIconSet | undefined): string {
  if (!icons) return html;
  const headOpen = html.search(/<head\b[^>]*>/i);
  if (headOpen < 0) return html;

  const headOpenEnd = html.indexOf(">", headOpen);
  const headClose = html.search(/<\/head>/i);
  if (headOpenEnd < 0 || headClose < 0 || headClose <= headOpenEnd) return html;

  const beforeHeadContent = html.slice(0, headOpenEnd + 1);
  const headContent = html.slice(headOpenEnd + 1, headClose).replace(ICON_HEAD_TAG_RE, "");
  const afterHeadContent = html.slice(headClose);
  const iconTags = `<link rel="icon" href="${icons.png}" type="image/png" sizes="192x192"/><link rel="shortcut icon" href="${icons.png}" type="image/png"/><link rel="icon" href="${icons.svg}" type="image/svg+xml"/><link rel="apple-touch-icon" href="${icons.apple}" sizes="180x180"/>`;
  const insertionPoint = leadingSeoHeadLength(headContent);
  return `${beforeHeadContent}${headContent.slice(0, insertionPoint)}${iconTags}${headContent.slice(insertionPoint)}${afterHeadContent}`;
}

function withInlineAidreamcapesLogo(html: string, request: NextRequest): string {
  const iconHref = siteIconForRequest(request);
  if (iconHref?.png !== AIDREAMCAPES_ICON) return html;
  return html.replace(AIDREAMCAPES_LOGO_IMG_RE, AIDREAMCAPES_INLINE_LOGO);
}

function nextWithPathname(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname || "/");
  return NextResponse.next({ request: { headers: requestHeaders } });
}

function sameServerUrl(request: NextRequest): URL {
  const upstreamUrl = request.nextUrl.clone();
  upstreamUrl.protocol = "http:";
  upstreamUrl.hostname = "127.0.0.1";
  upstreamUrl.port = process.env.PORT || "3000";
  return upstreamUrl;
}

async function storefrontIconResponse(request: NextRequest): Promise<Response | undefined> {
  if (request.method !== "GET" || !BROWSER_ICON_PATH_RE.test(request.nextUrl.pathname)) return undefined;

  const iconHref = siteIconForRequest(request);
  if (!iconHref) return undefined;

  const upstreamUrl = sameServerUrl(request);
  upstreamUrl.pathname = iconHref.png.split("?")[0] ?? iconHref.png;
  upstreamUrl.search = "";

  const upstreamResponse = await fetch(upstreamUrl, {
    headers: { [REORDER_SKIP_HEADER]: "1", "x-pathname": request.nextUrl.pathname || "/" }
  });
  if (!upstreamResponse.ok) return undefined;

  const headers = new Headers(upstreamResponse.headers);
  headers.delete("content-length");
  headers.set("content-type", "image/png");
  headers.set("cache-control", "no-store, max-age=0");
  headers.set("x-storefront-icon-source", iconHref.png);

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers
  });
}

export async function middleware(request: NextRequest) {
  const iconResponse = await storefrontIconResponse(request);
  if (iconResponse) return iconResponse;

  const redirectResponse = canonicalPublicHostSitePathRedirect(request) ?? localDefaultStorefrontRedirect(request) ?? legacyPublicPathRedirect(request) ?? directoryCanonicalRedirect(request) ?? aidreamcapesCollectionRedirect(request);
  if (redirectResponse) return redirectResponse;
  if (!shouldReorderStorefrontHead(request)) return nextWithPathname(request);

  const upstreamHeaders = new Headers(request.headers);
  upstreamHeaders.set(REORDER_SKIP_HEADER, "1");
  upstreamHeaders.set("x-pathname", request.nextUrl.pathname || "/");

  const upstreamResponse = await fetch(sameServerUrl(request), {
    headers: upstreamHeaders,
    redirect: "manual"
  });

  const contentType = upstreamResponse.headers.get("content-type") ?? "";
  if (!upstreamResponse.ok || !contentType.includes("text/html")) return upstreamResponse;

  const html = await upstreamResponse.text();
  const rewrittenHtml = withInlineAidreamcapesLogo(withStorefrontIcons(moveSeoTagsBeforeResources(html), siteIconForRequest(request)), request);
  const headers = new Headers(upstreamResponse.headers);
  headers.delete("content-length");
  headers.set("cache-control", "no-store, max-age=0");
  headers.set("x-storefront-head-seo-reordered", "1");

  return new Response(rewrittenHtml, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers
  });
}

export const config = {
  matcher: ["/((?!api|assets|_next/static|_next/image|robots.txt|sitemap.xml).*)"]
};
