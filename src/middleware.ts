import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const TARGET_SITE_PATH_RE = /^\/site\/(?:aidreamcapes|mydreamshoots)(?:-xby)?(?:\/|$)/i;
const TARGET_HOST_RE = /(?:^|\.)(?:(?:aidreamcapes|mydreamshoots)(?:-xby)?\.localhost|(?:aidreamcapes|mydreamshoots)\.com)(?::\d+)?$/i;
const INTERNAL_PATH_RE = /^\/(?:api|assets|_next\/static|_next\/image|robots\.txt|sitemap\.xml)(?:\/|$)/i;
const BROWSER_ICON_PATH_RE = /^\/(?:favicon\.ico|favicon\.svg|icon\.svg|apple-touch-icon(?:\.png)?)$/i;
const PRIVATE_STORE_PATH_RE = /^\/site\/(?:aidreamcapes|mydreamshoots)(?:-xby)?\/(?:admin|app|account|dashboard|login|register|reset-password|checkout|logout)(?:\/|$)/i;
const HOST_PRIVATE_STORE_PATH_RE = /^\/(?:admin|app|account|dashboard|login|register|reset-password|checkout|logout)(?:\/|$)/i;
const REORDER_SKIP_HEADER = "x-storefront-head-seo-reorder-skip";
const AIDREAMCAPES_COLLECTION_REDIRECTS: Record<string, string> = {
  adventure: "road-trip-frames",
  city: "old-quarter-walks",
  coastal: "coastal-light-sets",
  costero: "coastal-light-sets",
  destination: "route-portrait-albums",
  destino: "route-portrait-albums",
  postcard: "postcard-story-sets",
  postal: "postcard-story-sets",
  "cafe-street-journals": "cafe-street-stories",
  "destination-portrait-albums": "route-portrait-albums",
  "coastal-getaways": "coastal-light-sets",
  "old-city-walks": "old-quarter-walks",
  "scenic-overlooks": "golden-hour-route-stories",
  "mountain-trails": "alpine-trail-frames",
  "itinerary-moodboards": "route-moodboards",
  "postcard-social-sets": "postcard-story-sets",
  "travel-profile-stories": "solo-traveler-profiles",
  "lagoon-route-studys": "lagoon-route-studies"
};
const MYDREAMSHOOTS_COLLECTION_REDIRECTS: Record<string, string> = {
  creator: "creator-portraits",
  deportes: "world-cup-fan-photos",
  lifestyle: "travel-scene-pack",
  nature: "travel-scene-pack",
  "professional-headshots": "headshots",
  seasonal: "holiday",
  sports: "world-cup-fan-photos",
  travel: "travel-scene-pack",
  viaje: "travel-scene-pack",
  video: "ai-video-add-ons"
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
  "/packages": "/collections",
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
const AIDREAMCAPES_ICON = "/assets/sites/site_aidreamcapes/brand/aidreamcapes-icon-192.png?v=20260708c";
const AIDREAMCAPES_ICON_SVG = "/assets/sites/site_aidreamcapes/brand/aidreamcapesai-logo-refined.svg?v=20260708c";
const AIDREAMCAPES_APPLE_ICON = "/assets/sites/site_aidreamcapes/brand/aidreamcapes-icon-180.png?v=20260708c";
const MYDREAMSHOOTS_ICON = "/assets/dreamshoot/brand/dreamshootai-icon-192.png?v=20260702";
const MYDREAMSHOOTS_ICON_SVG = "/assets/dreamshoot/brand/dreamshootai-logo-refined.svg?v=20260702";
const MYDREAMSHOOTS_APPLE_ICON = "/assets/dreamshoot/brand/dreamshootai-icon-180.png?v=20260702";
const AIDREAMCAPES_INLINE_LOGO = `<svg class="h-full w-full object-contain" viewBox="0 0 512 512" role="img" aria-label="Aidreamcapes logo for AI travel portraits and private destination galleries"><defs><linearGradient id="aidreamcapes-header-logo" x1="84" y1="76" x2="424" y2="436" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff0b8"/><stop offset="0.38" stop-color="#ff75b7"/><stop offset="1" stop-color="#8a7cff"/></linearGradient><radialGradient id="aidreamcapes-header-aura" cx="0" cy="0" r="1" gradientTransform="matrix(176 0 0 176 250 232)" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffffff" stop-opacity="0.9"/><stop offset="0.55" stop-color="#b8f7ff" stop-opacity="0.25"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></radialGradient></defs><rect width="512" height="512" rx="118" fill="#080a12"/><circle cx="256" cy="256" r="162" fill="none" stroke="url(#aidreamcapes-header-logo)" stroke-width="30"/><circle cx="256" cy="256" r="82" fill="none" stroke="#ffffff" stroke-width="23" opacity="0.95"/><circle cx="256" cy="256" r="34" fill="url(#aidreamcapes-header-aura)"/><path d="M337 142v34M320 159h34M153 356v27M139 370h27" fill="none" stroke="url(#aidreamcapes-header-logo)" stroke-width="13" stroke-linecap="round"/><path d="M142 218h58M312 338h58" fill="none" stroke="#ffffff" stroke-width="17" stroke-linecap="round" opacity="0.76"/></svg>`;

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
  const pathMatch = pathname.match(/^\/site\/(aidreamcapes(?:-xby)?)\/collections\/([^/]+)(\/)?$/i);
  const hostMatch = TARGET_HOST_RE.test(host) && /aidreamcapes/i.test(host)
    ? pathname.match(/^\/collections\/([^/]+)(\/)?$/i)
    : undefined;
  const match = pathMatch ?? hostMatch;
  if (!match) return undefined;

  const currentSlug = normalizePathSlug(pathMatch ? match[2] ?? "" : match[1] ?? "");
  const canonicalSlug = AIDREAMCAPES_COLLECTION_REDIRECTS[currentSlug];
  if (!canonicalSlug) return undefined;

  const nextUrl = request.nextUrl.clone();
  nextUrl.pathname = pathMatch ? `/site/${pathMatch[1]?.toLowerCase()}/collections/${canonicalSlug}` : `/collections/${canonicalSlug}`;
  return NextResponse.redirect(nextUrl, 308);
}

function directoryCanonicalRedirect(request: NextRequest): NextResponse | undefined {
  const pathname = request.nextUrl.pathname;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";

  const pathMatch = pathname.match(/^\/site\/((?:aidreamcapes|mydreamshoots)(?:-xby)?)\/(collections|tools)\/([^/]+)(\/)?$/i);
  const hostMatch = TARGET_HOST_RE.test(host)
    ? pathname.match(/^\/(collections|tools)\/([^/]+)(\/)?$/i)
    : undefined;
  if (!pathMatch && !hostMatch) return undefined;

  const siteSlug = pathMatch?.[1]?.toLowerCase() ?? (host.toLowerCase().includes("aidreamcapes") ? "aidreamcapes" : "mydreamshoots");
  const siteFamily = siteSlug.startsWith("aidreamcapes") ? "aidreamcapes" : "mydreamshoots";
  const kind = (pathMatch?.[2] ?? hostMatch?.[1] ?? "").toLowerCase();
  const currentSlug = normalizePathSlug(pathMatch?.[3] ?? hostMatch?.[2] ?? "");
  const redirectMap =
    siteFamily === "aidreamcapes" && kind === "collections"
      ? AIDREAMCAPES_COLLECTION_REDIRECTS
      : siteFamily === "mydreamshoots" && kind === "collections"
        ? MYDREAMSHOOTS_COLLECTION_REDIRECTS
        : siteFamily === "mydreamshoots" && kind === "tools"
          ? MYDREAMSHOOTS_TOOL_REDIRECTS
          : siteFamily === "aidreamcapes" && kind === "tools"
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
  const pathMatch = pathname.match(/^\/site\/((?:aidreamcapes|mydreamshoots)(?:-xby)?)(\/.*)$/i);
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
  const match = pathname.match(/^\/site\/((?:aidreamcapes|mydreamshoots)(?:-xby)?)(\/.*)?$/i);
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
  if (INTERNAL_PATH_RE.test(pathname) || (!isSpanishXbyRequest(request) && (PRIVATE_STORE_PATH_RE.test(pathname) || (TARGET_HOST_RE.test(host) && HOST_PRIVATE_STORE_PATH_RE.test(pathname))))) return false;

  const accept = request.headers.get("accept") ?? "";
  if (accept && !accept.includes("text/html") && !accept.includes("*/*")) return false;

  return TARGET_SITE_PATH_RE.test(pathname) || TARGET_HOST_RE.test(host);
}

function isSpanishXbyRequest(request: NextRequest): boolean {
  const identity = `${request.nextUrl.pathname} ${request.headers.get("x-forwarded-host") ?? ""} ${request.headers.get("host") ?? ""}`.toLowerCase();
  return /\b(?:aidreamcapes|mydreamshoots)-xby\b/.test(identity);
}

function shouldRewriteStorefrontHtml(request: NextRequest): boolean {
  if (process.env.STOREFRONT_EDGE_HTML_REWRITE === "0") return false;
  if (request.method !== "GET") return false;
  if (request.headers.get(REORDER_SKIP_HEADER) === "1") return false;
  if (INTERNAL_PATH_RE.test(request.nextUrl.pathname)) return false;

  const accept = request.headers.get("accept") ?? "";
  if (accept && !accept.includes("text/html") && !accept.includes("*/*")) return false;

  return shouldReorderStorefrontHead(request) || isSpanishXbyRequest(request);
}

function withStorefrontLocale(html: string, request: NextRequest): string {
  if (!isSpanishXbyRequest(request)) return html;
  return html.replace(/<html\b([^>]*)>/i, (tag, attrs: string) => {
    if (/\slang=(["']).*?\1/i.test(tag)) return tag.replace(/\slang=(["']).*?\1/i, ' lang="es"');
    return `<html lang="es"${attrs}>`;
  });
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
  if (isSpanishXbyRequest(request)) return html;
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
  if (!shouldRewriteStorefrontHtml(request)) return nextWithPathname(request);

  const upstreamHeaders = new Headers(request.headers);
  upstreamHeaders.set(REORDER_SKIP_HEADER, "1");
  upstreamHeaders.set("x-pathname", request.nextUrl.pathname || "/");

  const upstreamResponse = await fetch(sameServerUrl(request), {
    headers: upstreamHeaders,
    redirect: "manual"
  });

  const contentType = upstreamResponse.headers.get("content-type") ?? "";
  if (upstreamResponse.status >= 300 && upstreamResponse.status < 400) {
    const location = upstreamResponse.headers.get("location");
    if (location) return NextResponse.redirect(new URL(location, request.url), upstreamResponse.status);
  }
  if (!upstreamResponse.ok || !contentType.includes("text/html")) return upstreamResponse;

  const html = await upstreamResponse.text();
  const shouldReorder = shouldReorderStorefrontHead(request);
  const htmlWithSeo = shouldReorder ? moveSeoTagsBeforeResources(html) : html;
  const rewrittenHtml = withStorefrontLocale(
    withInlineAidreamcapesLogo(withStorefrontIcons(htmlWithSeo, siteIconForRequest(request)), request),
    request
  );
  const headers = new Headers(upstreamResponse.headers);
  headers.delete("content-length");
  headers.set("cache-control", "no-store, max-age=0");
  if (shouldReorder) headers.set("x-storefront-head-seo-reordered", "1");
  if (isSpanishXbyRequest(request)) headers.set("x-storefront-locale", "es");

  return new Response(rewrittenHtml, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers
  });
}

export const config = {
  matcher: ["/((?!api|assets|_next/static|_next/image|robots.txt|sitemap.xml).*)"]
};
