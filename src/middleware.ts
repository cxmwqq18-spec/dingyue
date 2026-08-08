import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { canonicalSpanishXbyCollectionSlug, isSpanishStorefrontRequestIdentity } from "@/lib/spanish-storefronts";
import { STOREFRONT_PUBLIC_HOST_HEADER } from "@/lib/storefront-route-mode";

const TARGET_SITE_PATH_RE = /^\/site\/(?:aidreamcapes|mydreamshoots|aidreamshoots|grownstride)(?:-xby|-eu)?(?:\/|$)/i;
const TARGET_HOST_RE = /(?:^|\.)(?:(?:aidreamcapes|mydreamshoots|aidreamshoots|grownstride)(?:-xby)?\.localhost|(?:aidreamcapes|mydreamshoots|grownstride)\.com|(?:aidreamcapes|aidreamshoots)\.eu)(?::\d+)?$/i;
const INTERNAL_PATH_RE = /^\/(?:api|assets|_next\/static|_next\/image|robots\.txt|sitemap\.xml)(?:\/|$)/i;
const BROWSER_ICON_PATH_RE = /^\/(?:favicon\.ico|favicon\.svg|icon\.svg|apple-touch-icon(?:\.png)?)$/i;
const GROWNSTRIDE_TEST_HOST = "test.grownstride.com";
const GROWNSTRIDE_LEGACY_HOSTS = new Set(["grownstride.com", "www.grownstride.com"]);
const PRIVATE_STORE_PATH_RE = /^\/site\/(?:aidreamcapes|mydreamshoots|aidreamshoots|grownstride)(?:-xby|-eu)?\/(?:admin|app|account|cart|dashboard|login|register|reset-password|checkout|logout)(?:\/|$)/i;
const HOST_PRIVATE_STORE_PATH_RE = /^\/(?:admin|app|account|cart|dashboard|login|register|reset-password|checkout|logout)(?:\/|$)/i;
const REORDER_SKIP_HEADER = "x-storefront-head-seo-reorder-skip";
const PUBLIC_STOREFRONT_CACHE_CONTROL = "public, max-age=60, s-maxage=300, stale-while-revalidate=1800";
const PRIVATE_STOREFRONT_CACHE_CONTROL = "private, no-store, max-age=0, must-revalidate";
const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-connection",
  "transfer-encoding",
  "upgrade",
  "te",
  "trailer"
]);
const AIDREAMCAPES_COLLECTION_REDIRECTS: Record<string, string> = {
  adventure: "road-trip-frames",
  aventura: "game-day-group-photos",
  city: "old-quarter-walks",
  ciudad: "premiere-style-portraits",
  coastal: "coastal-light-sets",
  familia: "thanksgiving-memory-sets",
  costero: "coastal-light-sets",
  destination: "route-portrait-albums",
  destino: "route-portrait-albums",
  postcard: "postcard-story-sets",
  postal: "postcard-story-sets",
  "ano-nuevo": "new-year-countdown-albums",
  "cumpleanos": "birthday-fan-moment-sets",
  "cafe-corner-stories": "premiere-style-portraits",
  "cafe-street-journals": "cafe-street-stories",
  "destination-portrait-albums": "route-portrait-albums",
  "coastal-getaways": "coastal-light-sets",
  "old-city-walks": "old-quarter-walks",
  "mountain-trails": "alpine-trail-frames",
  navidad: "christmas-group-albums",
  "itinerary-moodboards": "route-moodboards",
  "route-moodboard": "seasonal-celebration-photos",
  "postcard-social-sets": "postcard-story-sets",
  "social-keepsakes": "seasonal-celebration-photos",
  montana: "alpine-trail-frames",
  viaje: "fan-scene-albums",
  "travel-profile-stories": "solo-traveler-profiles",
  "lagoon-route-studys": "lagoon-route-studies",
  nature: "nature-portrait-studio",
  boudoir: "boudoir-editorial-portraits",
  hairstyle: "hairstyle-try-on-stories",
  headshot: "professional-headshot-studio",
  headshots: "professional-headshot-studio",
  holiday: "holiday-couple-cards",
  gala: "gala-night-portraits",
  heritage: "heritage-celebration-portraits"
};
const MYDREAMSHOOTS_COLLECTION_REDIRECTS: Record<string, string> = {
  deportes: "world-cup-fan-photos",
  lifestyle: "outdoor-creator-scenes",
  "professional-headshots": "headshots",
  sports: "world-cup-fan-photos",
  travel: "outdoor-creator-scenes",
  viaje: "outdoor-creator-scenes",
  "travel-scene-pack": "outdoor-creator-scenes",
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
  "background-changer": "fan-scene-album-builder",
  "background-remover": "fan-scene-album-builder",
  "couple-escape-album": "birthday-fan-moment-maker",
  "dreamscape-generator": "fan-scene-album-builder",
  headshot: "premiere-portrait-set-builder",
  "image-generator": "fan-scene-album-builder",
  "image-to-video": "new-year-countdown-album-maker",
  "image-studio": "",
  "portrait-generator": "fan-scene-album-builder",
  "portrait-maker": "fan-scene-album-builder",
  "product-reverie": "permission-safe-photo-planner",
  "soft-glam": "premiere-portrait-set-builder",
  "wedding-portraits": "birthday-fan-moment-maker",
  "world-cup-fan-photos": "game-day-group-portrait-maker",
  "route-portrait-engine": "fan-scene-album-builder",
  "coastal-portrait": "christmas-group-album-studio",
  "island-resort-scenes": "new-year-countdown-album-maker",
  "scenic-overlook-story": "game-day-group-portrait-maker",
  "travel-profile-story": "fan-scene-album-builder",
  "editorial-getaway": "premiere-portrait-set-builder",
  "cafe-street-story": "premiere-portrait-set-builder",
  "cinematic-travel": "game-day-group-portrait-maker",
  "route-moodboard": "permission-safe-photo-planner",
  "social-keepsake": "birthday-fan-moment-maker",
  "family-travel-keepsakes": "thanksgiving-keepsake-set-maker",
  "seasonal-celebration-album-maker": "new-year-countdown-album-maker",
  "travel-journal-cover-maker": "new-year-countdown-album-maker"
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
  /^(?:\s*(?:<title\b[^>]*>[\s\S]*?<\/title>|<meta\b(?=[^>]*(?:charset=|name=["'](?:viewport|description|keywords|robots|twitter:(?:card|title|description|image))["']|http-equiv=["']Content-Language["']|property=["']og:(?:title|description|url|site_name|image)["']))[^>]*\/?>|<link\b(?=[^>]*rel=["']canonical["'])[^>]*\/?>|<script\b(?=[^>]*type=["']application\/ld\+json["'])[^>]*>[\s\S]*?<\/script>))*/i;
const ESSENTIAL_HEAD_TAG_RE =
  /<meta\b(?=[^>]*(?:charset=|name=["']viewport["']|http-equiv=["']Content-Language["']))[^>]*\/?>/gi;
const ICON_HEAD_TAG_RE = /<link\b(?=[^>]*rel=["'][^"']*(?:icon|apple-touch-icon)[^"']*["'])[^>]*\/?>/gi;
const AIDREAMCAPES_LOGO_IMG_RE =
  /<img\b(?=[^>]*src=["']\/assets\/sites\/site_aidreamcapes\/brand\/aidreamcapesai-logo-refined\.svg[^"']*["'])(?=[^>]*alt=["'][^"']*Aidreamcapes[^"']*["'])([^>]*)\/?>/gi;
const AIDREAMCAPES_ICON = "/assets/sites/site_aidreamcapes/brand/aidreamcapes-icon-192.png?v=20260708c";
const AIDREAMCAPES_ICON_SVG = "/assets/sites/site_aidreamcapes/brand/aidreamcapesai-logo-refined.svg?v=20260708c";
const AIDREAMCAPES_APPLE_ICON = "/assets/sites/site_aidreamcapes/brand/aidreamcapes-icon-180.png?v=20260708c";
const AIDREAMCAPES_EU_ICON = "/assets/sites/site_aidreamcapes_eu/brand/aidreamcapes-icon-192.png?v=20260717a";
const AIDREAMCAPES_EU_ICON_SVG = "/assets/sites/site_aidreamcapes_eu/brand/aidreamcapes-logo-refined.svg?v=20260717a";
const AIDREAMCAPES_EU_APPLE_ICON = "/assets/sites/site_aidreamcapes_eu/brand/aidreamcapes-icon-180.png?v=20260717a";
const AIDREAMSHOOTS_ICON = "/assets/sites/site_aidreamshoots/brand/aidreamshoots-icon-192.png?v=20260717a";
const AIDREAMSHOOTS_ICON_SVG = "/assets/sites/site_aidreamshoots/brand/aidreamshoots-logo-refined.svg?v=20260717a";
const AIDREAMSHOOTS_APPLE_ICON = "/assets/sites/site_aidreamshoots/brand/aidreamshoots-icon-180.png?v=20260717a";
const MYDREAMSHOOTS_ICON = "/assets/dreamshoot/brand/dreamshootai-icon-192.png?v=20260702";
const MYDREAMSHOOTS_ICON_SVG = "/assets/dreamshoot/brand/dreamshootai-logo-refined.svg?v=20260702";
const MYDREAMSHOOTS_APPLE_ICON = "/assets/dreamshoot/brand/dreamshootai-icon-180.png?v=20260702";
const AIDREAMCAPES_INLINE_LOGO = `<svg class="h-full w-full object-contain" viewBox="0 0 512 512" role="img" aria-label="Aidreamcapes logo for private fan-scene and holiday photo albums"><defs><linearGradient id="aidreamcapes-header-logo" x1="84" y1="76" x2="424" y2="436" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff0b8"/><stop offset="0.38" stop-color="#ff75b7"/><stop offset="1" stop-color="#8a7cff"/></linearGradient><radialGradient id="aidreamcapes-header-aura" cx="0" cy="0" r="1" gradientTransform="matrix(176 0 0 176 250 232)" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffffff" stop-opacity="0.9"/><stop offset="0.55" stop-color="#b8f7ff" stop-opacity="0.25"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></radialGradient></defs><rect width="512" height="512" rx="118" fill="#080a12"/><circle cx="256" cy="256" r="162" fill="none" stroke="url(#aidreamcapes-header-logo)" stroke-width="30"/><circle cx="256" cy="256" r="82" fill="none" stroke="#ffffff" stroke-width="23" opacity="0.95"/><circle cx="256" cy="256" r="34" fill="url(#aidreamcapes-header-aura)"/><path d="M337 142v34M320 159h34M153 356v27M139 370h27" fill="none" stroke="url(#aidreamcapes-header-logo)" stroke-width="13" stroke-linecap="round"/><path d="M142 218h58M312 338h58" fill="none" stroke="#ffffff" stroke-width="17" stroke-linecap="round" opacity="0.76"/></svg>`;

function envSwitch(value: string | undefined): boolean | undefined {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["0", "false", "off", "no"].includes(normalized)) return false;
  if (["1", "true", "on", "yes"].includes(normalized)) return true;
  return undefined;
}

function isEnglishPublicStorefrontHtmlRequest(request: NextRequest): boolean {
  if (isSpanishXbyRequest(request) || isPrivateStorefrontHtmlRequest(request)) return false;
  const pathname = request.nextUrl.pathname;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  return TARGET_SITE_PATH_RE.test(pathname) || TARGET_HOST_RE.test(host);
}

function storefrontEdgeHtmlRewriteEnabled(request: NextRequest): boolean {
  const globalRewrite = envSwitch(process.env.STOREFRONT_EDGE_HTML_REWRITE);
  if (globalRewrite !== undefined) return globalRewrite;

  const englishRewrite = envSwitch(process.env.STOREFRONT_ENGLISH_HTML_REWRITE);
  if (englishRewrite !== undefined && isEnglishPublicStorefrontHtmlRequest(request)) return englishRewrite;

  if (isEnglishPublicStorefrontHtmlRequest(request)) return false;

  return true;
}

function storefrontHeadSeoReorderEnabled(request: NextRequest): boolean {
  // Launch SEO rule: public storefront source must keep <title> first in <head>.
  // This cannot be disabled by the heavier HTML rewrite performance switches.
  if (storefrontHeadOrderRequired(request)) return true;

  const headRewrite = envSwitch(process.env.STOREFRONT_HEAD_SEO_REORDER);
  if (headRewrite !== undefined) return headRewrite;
  return storefrontEdgeHtmlRewriteEnabled(request);
}

function storefrontHeadOrderRequired(request: NextRequest): boolean {
  const pathname = request.nextUrl.pathname;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  if (INTERNAL_PATH_RE.test(pathname) || isPrivateStorefrontHtmlRequest(request)) return false;
  return TARGET_SITE_PATH_RE.test(pathname) || TARGET_HOST_RE.test(host);
}

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
  const pathMatch = pathname.match(/^\/site\/(aidreamcapes(?:-xby|-eu)?)\/collections\/([^/]+)(\/)?$/i);
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

  const pathMatch = pathname.match(/^\/site\/((?:aidreamcapes|mydreamshoots|aidreamshoots|grownstride)(?:-xby|-eu)?)\/(collections|tools)\/([^/]+)(\/)?$/i);
  const hostMatch = TARGET_HOST_RE.test(host)
    ? pathname.match(/^\/(collections|tools)\/([^/]+)(\/)?$/i)
    : undefined;
  if (!pathMatch && !hostMatch) return undefined;

  const normalizedHost = host.toLowerCase();
  const siteSlug =
    pathMatch?.[1]?.toLowerCase() ??
    (normalizedHost.includes("aidreamcapes") ? "aidreamcapes" : normalizedHost.includes("grownstride") ? "grownstride" : "mydreamshoots");
  const siteFamily = siteSlug.startsWith("aidreamcapes") ? "aidreamcapes" : "mydreamshoots";
  const kind = (pathMatch?.[2] ?? hostMatch?.[1] ?? "").toLowerCase();
  const currentSlug = normalizePathSlug(pathMatch?.[3] ?? hostMatch?.[2] ?? "");
  const spanishXbyCanonicalSlug = kind === "collections" && isSpanishStorefrontRequestIdentity(`${siteSlug} ${host}`)
    ? canonicalSpanishXbyCollectionSlug(currentSlug)
    : currentSlug;
  const redirectMap =
    spanishXbyCanonicalSlug !== currentSlug
      ? undefined
      : siteFamily === "aidreamcapes" && kind === "collections"
      ? AIDREAMCAPES_COLLECTION_REDIRECTS
      : siteFamily === "mydreamshoots" && kind === "collections"
        ? MYDREAMSHOOTS_COLLECTION_REDIRECTS
        : siteFamily === "mydreamshoots" && kind === "tools"
          ? MYDREAMSHOOTS_TOOL_REDIRECTS
          : siteFamily === "aidreamcapes" && kind === "tools"
            ? AIDREAMCAPES_TOOL_REDIRECTS
          : undefined;
  const canonicalSlug = spanishXbyCanonicalSlug !== currentSlug ? spanishXbyCanonicalSlug : redirectMap?.[currentSlug];
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
  const pathMatch = pathname.match(/^\/site\/((?:aidreamcapes|mydreamshoots|aidreamshoots|grownstride)(?:-xby|-eu)?)(\/.*)$/i);
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
  const forwardedHost = request.headers.get("x-forwarded-host") ?? "";
  if (TARGET_HOST_RE.test(forwardedHost)) return undefined;
  const host = (request.headers.get("host") ?? "").toLowerCase();
  if (!host.startsWith("localhost") && !host.startsWith("127.0.0.1")) return undefined;

  const defaultSiteSlug = process.env.DEFAULT_STOREFRONT_SITE_SLUG || "mydreamshoots";
  const nextUrl = request.nextUrl.clone();
  nextUrl.pathname = `/site/${defaultSiteSlug}${pathname}`;
  return NextResponse.redirect(nextUrl, 308);
}

function canonicalPublicHostSitePathRedirect(request: NextRequest): NextResponse | undefined {
  const pathname = request.nextUrl.pathname;
  if (PRIVATE_STORE_PATH_RE.test(pathname)) return undefined;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  if (!TARGET_HOST_RE.test(host)) return undefined;
  const match = pathname.match(/^\/site\/((?:aidreamcapes|mydreamshoots|aidreamshoots|grownstride)(?:-xby|-eu)?)(\/.*)?$/i);
  if (!match) return undefined;
  const siteSlug = match[1]?.toLowerCase() ?? "";
  const normalizedHost = host.toLowerCase();
  const hostMatchesSite =
    normalizedHost.includes(siteSlug) ||
    (normalizedHost.includes("aidreamshoots") && /^(?:aidreamshoots|mydreamshoots)(?:-xby|-eu)?$/.test(siteSlug)) ||
    (normalizedHost.includes("aidreamcapes") && /^aidreamcapes(?:-xby|-eu)?$/.test(siteSlug));
  if (!hostMatchesSite) return undefined;
  const scopedPath = match[2] || "/";
  const nextUrl = request.nextUrl.clone();
  nextUrl.pathname = scopedPath === "/" ? "/" : scopedPath;
  return NextResponse.redirect(nextUrl, 308);
}

function grownstrideLegacyHostRedirect(request: NextRequest): NextResponse | undefined {
  const host = String(request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "")
    .split(",")[0]
    ?.trim()
    .toLowerCase()
    .split(":")[0] ?? "";
  if (!GROWNSTRIDE_LEGACY_HOSTS.has(host)) return undefined;

  const nextUrl = request.nextUrl.clone();
  nextUrl.protocol = "https:";
  nextUrl.hostname = GROWNSTRIDE_TEST_HOST;
  nextUrl.port = "";
  return NextResponse.redirect(nextUrl, 308);
}

function shouldReorderStorefrontHead(request: NextRequest): boolean {
  if (!storefrontHeadSeoReorderEnabled(request)) return false;
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
  return isSpanishStorefrontRequestIdentity(identity);
}

function shouldRewriteStorefrontHtml(request: NextRequest): boolean {
  const shouldReorder = shouldReorderStorefrontHead(request);
  if (!shouldReorder && !storefrontEdgeHtmlRewriteEnabled(request)) return false;
  if (request.method !== "GET") return false;
  if (request.headers.get(REORDER_SKIP_HEADER) === "1") return false;
  if (INTERNAL_PATH_RE.test(request.nextUrl.pathname)) return false;

  const accept = request.headers.get("accept") ?? "";
  if (accept && !accept.includes("text/html") && !accept.includes("*/*")) return false;

  return shouldReorder || isSpanishXbyRequest(request);
}

function isPrivateStorefrontHtmlRequest(request: NextRequest): boolean {
  const pathname = request.nextUrl.pathname;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  return PRIVATE_STORE_PATH_RE.test(pathname) || (TARGET_HOST_RE.test(host) && HOST_PRIVATE_STORE_PATH_RE.test(pathname));
}

function storefrontHtmlCacheControl(request: NextRequest, upstreamHeaders: Headers): string {
  if (isPrivateStorefrontHtmlRequest(request)) return PRIVATE_STOREFRONT_CACHE_CONTROL;
  const upstreamCache = upstreamHeaders.get("cache-control") ?? "";
  if (upstreamCache && !/(?:no-store|private)/i.test(upstreamCache)) return upstreamCache;
  return PUBLIC_STOREFRONT_CACHE_CONTROL;
}

function withStorefrontLocale(html: string, request: NextRequest): string {
  if (!isSpanishXbyRequest(request)) return html;
  const withSpanishLang = html.replace(/<html\b([^>]*)>/i, (tag, attrs: string) => {
    if (/\slang=(["']).*?\1/i.test(tag)) return tag.replace(/\slang=(["']).*?\1/i, ' lang="es"');
    return `<html lang="es"${attrs}>`;
  });
  if (/<meta\b(?=[^>]*http-equiv=(["'])Content-Language\1)[^>]*>/i.test(withSpanishLang)) {
    return withSpanishLang.replace(/<meta\b(?=[^>]*http-equiv=(["'])Content-Language\1)[^>]*>/i, (tag) => {
      if (/\scontent=(["']).*?\1/i.test(tag)) return tag.replace(/\scontent=(["']).*?\1/i, ' content="es"');
      return tag.replace(/\/?>$/, ' content="es">');
    });
  }
  return withSpanishLang.replace(/<head\b[^>]*>/i, (tag) => `${tag}<meta http-equiv="Content-Language" content="es">`);
}

function splitTitleAndSeoTags(tags: string[]): { titleTag: string; seoTags: string[] } {
  const titleIndex = tags.findIndex((tag) => /^<title\b/i.test(tag));
  if (titleIndex < 0) return { titleTag: "", seoTags: tags };
  return {
    titleTag: tags[titleIndex],
    seoTags: [...tags.slice(0, titleIndex), ...tags.slice(titleIndex + 1)]
  };
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

  const essentialTags: string[] = [];
  const remainingHead = strippedHead.replace(ESSENTIAL_HEAD_TAG_RE, (tag) => {
    essentialTags.push(tag);
    return "";
  });
  const { titleTag, seoTags: nonTitleSeoTags } = splitTitleAndSeoTags(seoTags);
  const reorderedHead = `${titleTag}${essentialTags.join("")}${nonTitleSeoTags.join("")}${remainingHead}`;
  return `${beforeHeadContent}${reorderedHead}${strippedAfterHead}`;
}

type StorefrontIconSet = {
  png: string;
  svg: string;
  apple: string;
};

function siteIconForRequest(request: NextRequest): StorefrontIconSet | undefined {
  const identity = `${request.nextUrl.pathname} ${request.headers.get("x-forwarded-host") ?? ""} ${request.headers.get("host") ?? ""}`.toLowerCase();
  if (isSpanishXbyRequest(request)) {
    if (identity.includes("aidreamcapes")) return { png: AIDREAMCAPES_EU_ICON, svg: AIDREAMCAPES_EU_ICON_SVG, apple: AIDREAMCAPES_EU_APPLE_ICON };
    return { png: AIDREAMSHOOTS_ICON, svg: AIDREAMSHOOTS_ICON_SVG, apple: AIDREAMSHOOTS_APPLE_ICON };
  }
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
  upstreamUrl.port = sameServerPort(request);
  return upstreamUrl;
}

function sameServerPort(request: NextRequest): string {
  const configuredPort = process.env.STOREFRONT_INTERNAL_PORT || process.env.PORT;
  if (configuredPort) return configuredPort;

  const forwardedPort = request.headers.get("x-forwarded-port");
  if (forwardedPort && !["80", "443"].includes(forwardedPort)) return forwardedPort;

  const host = request.headers.get("host") ?? "";
  const localHostPort = host.match(/^(?:localhost|127\.0\.0\.1|\[::1\]):(\d+)$/i)?.[1];
  if (localHostPort) return localHostPort;

  return "3010";
}

function storefrontSlugForHost(host: string | null | undefined): string | undefined {
  const normalized = String(host ?? "").toLowerCase();
  if (!TARGET_HOST_RE.test(normalized)) return undefined;
  if (normalized.includes("aidreamshoots")) return "aidreamshoots";
  if (normalized.includes("aidreamcapes.eu")) return "aidreamcapes-eu";
  if (normalized.includes("aidreamcapes")) return "aidreamcapes";
  if (normalized.includes("mydreamshoots")) return "mydreamshoots";
  if (normalized.includes("grownstride")) return "grownstride";
  return undefined;
}

function isGrownstrideRequest(request: NextRequest): boolean {
  return [request.headers.get("x-forwarded-host"), request.headers.get("host")].some(
    (host) => storefrontSlugForHost(host) === "grownstride"
  );
}

function applyGrownstrideNoindex(response: Response, request: NextRequest): Response {
  if (isGrownstrideRequest(request)) response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

function sameServerStorefrontUrl(request: NextRequest): URL {
  const upstreamUrl = sameServerUrl(request);
  const hostSlug = storefrontSlugForHost(request.headers.get("x-forwarded-host")) ?? storefrontSlugForHost(request.headers.get("host"));
  if (!hostSlug || upstreamUrl.pathname.startsWith("/site/")) return upstreamUrl;
  upstreamUrl.pathname = `/site/${hostSlug}${upstreamUrl.pathname === "/" ? "" : upstreamUrl.pathname}`;
  return upstreamUrl;
}

function sanitizeUpstreamHeaders(headers: Headers): Headers {
  const next = new Headers(headers);
  for (const header of HOP_BY_HOP_HEADERS) next.delete(header);
  next.delete("content-length");
  next.delete("host");
  return next;
}

async function storefrontIconResponse(request: NextRequest): Promise<Response | undefined> {
  if (request.method !== "GET" || !BROWSER_ICON_PATH_RE.test(request.nextUrl.pathname)) return undefined;

  const iconHref = siteIconForRequest(request);
  if (!iconHref) return undefined;

  const upstreamUrl = sameServerUrl(request);
  upstreamUrl.pathname = iconHref.png.split("?")[0] ?? iconHref.png;
  upstreamUrl.search = "";

  const upstreamResponse = await fetch(upstreamUrl, {
    headers: sanitizeUpstreamHeaders(new Headers({ [REORDER_SKIP_HEADER]: "1", "x-pathname": request.nextUrl.pathname || "/" }))
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
  if (iconResponse) return applyGrownstrideNoindex(iconResponse, request);

  const skipInternalRewrite = request.headers.get(REORDER_SKIP_HEADER) === "1";
  const redirectResponse = skipInternalRewrite ? undefined : grownstrideLegacyHostRedirect(request) ?? canonicalPublicHostSitePathRedirect(request) ?? localDefaultStorefrontRedirect(request) ?? legacyPublicPathRedirect(request) ?? directoryCanonicalRedirect(request) ?? aidreamcapesCollectionRedirect(request);
  if (redirectResponse) return applyGrownstrideNoindex(redirectResponse, request);
  if (!shouldRewriteStorefrontHtml(request)) return applyGrownstrideNoindex(nextWithPathname(request), request);

  const upstreamHeaders = new Headers(request.headers);
  upstreamHeaders.set(REORDER_SKIP_HEADER, "1");
  upstreamHeaders.set("x-pathname", request.nextUrl.pathname || "/");
  const upstreamUrl = sameServerStorefrontUrl(request);
  const usesInternalSitePath = upstreamUrl.pathname.startsWith("/site/") && !request.nextUrl.pathname.startsWith("/site/");
  if (usesInternalSitePath) {
    const publicHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
    if (TARGET_HOST_RE.test(publicHost)) upstreamHeaders.set(STOREFRONT_PUBLIC_HOST_HEADER, publicHost);
    upstreamHeaders.set("x-forwarded-host", `127.0.0.1:${sameServerPort(request)}`);
  } else {
    const requestHost = request.headers.get("host") ?? "";
    const forwardedHost = upstreamHeaders.get("x-forwarded-host") ?? "";
    if (TARGET_HOST_RE.test(requestHost) && !TARGET_HOST_RE.test(forwardedHost)) {
      upstreamHeaders.set("x-forwarded-host", requestHost);
    } else if (!forwardedHost && requestHost) {
      upstreamHeaders.set("x-forwarded-host", requestHost);
    }
  }

  const upstreamResponse = await fetch(upstreamUrl, {
    headers: sanitizeUpstreamHeaders(upstreamHeaders),
    redirect: "manual"
  });

  const contentType = upstreamResponse.headers.get("content-type") ?? "";
  if (upstreamResponse.status >= 300 && upstreamResponse.status < 400) {
    const location = upstreamResponse.headers.get("location");
    if (location) return applyGrownstrideNoindex(NextResponse.redirect(new URL(location, request.url), upstreamResponse.status), request);
  }
  if (!upstreamResponse.ok || !contentType.includes("text/html")) return applyGrownstrideNoindex(upstreamResponse, request);

  const html = await upstreamResponse.text();
  const shouldReorder = shouldReorderStorefrontHead(request);
  const htmlWithSeo = shouldReorder ? moveSeoTagsBeforeResources(html) : html;
  const rewrittenHtml = withStorefrontLocale(
    withInlineAidreamcapesLogo(withStorefrontIcons(htmlWithSeo, siteIconForRequest(request)), request),
    request
  );
  const headers = new Headers(upstreamResponse.headers);
  headers.delete("content-length");
  headers.set("cache-control", storefrontHtmlCacheControl(request, upstreamResponse.headers));
  if (shouldReorder) headers.set("x-storefront-head-seo-reordered", "1");
  if (isSpanishXbyRequest(request)) {
    headers.set("x-storefront-locale", "es");
    headers.set("content-language", "es");
  }
  if (isGrownstrideRequest(request)) headers.set("X-Robots-Tag", "noindex, nofollow");

  return applyGrownstrideNoindex(new Response(rewrittenHtml, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers
  }), request);
}

export const config = {
  matcher: ["/((?!api|assets|_next/static|_next/image|robots.txt|sitemap.xml).*)"]
};
