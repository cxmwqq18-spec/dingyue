import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isSpanishStorefrontRequestIdentity } from "@/lib/spanish-storefronts";

const TARGET_SITE_PATH_RE = /^\/site\/(?:aidreamcapes|mydreamshoots|aidreamshoots|grownstride)(?:-xby|-eu)?(?:\/|$)/i;
const TARGET_HOST_RE = /(?:^|\.)(?:(?:aidreamcapes|mydreamshoots|aidreamshoots|grownstride)(?:-xby)?\.localhost|(?:aidreamcapes|mydreamshoots|grownstride)\.com|(?:aidreamcapes|aidreamshoots)\.eu)(?::\d+)?$/i;
const INTERNAL_PATH_RE = /^\/(?:api|assets|_next\/static|_next\/image|robots\.txt|sitemap\.xml)(?:\/|$)/i;
const BROWSER_ICON_PATH_RE = /^\/(?:favicon\.ico|favicon\.svg|icon\.svg|apple-touch-icon(?:\.png)?)$/i;
const GROWNSTRIDE_TEST_HOST = "test.grownstride.com";
const GROWNSTRIDE_LEGACY_HOSTS = new Set(["grownstride.com", "www.grownstride.com"]);
const PRIVATE_STORE_PATH_RE = /^\/site\/(?:aidreamcapes|mydreamshoots|aidreamshoots|grownstride)(?:-xby|-eu)?\/(?:admin|app|account|cart|dashboard|login|register|reset-password|checkout|logout)(?:\/|$)/i;
const HOST_PRIVATE_STORE_PATH_RE = /^\/(?:admin|app|account|cart|dashboard|login|register|reset-password|checkout|logout)(?:\/|$)/i;
const REORDER_SKIP_HEADER = "x-storefront-head-seo-reorder-skip";
const IMAGE_THEME_CONTEXT_HEADER = "x-storefront-image-theme";
const PUBLIC_STOREFRONT_CACHE_CONTROL = "public, max-age=60, s-maxage=300, stale-while-revalidate=1800";
const PUBLIC_STOREFRONT_CDN_CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=1800";
const PRIVATE_STOREFRONT_CACHE_CONTROL = "private, no-store, max-age=0, must-revalidate";
const STOREFRONT_GUARD_COOKIE_NAME = "k";
const STOREFRONT_GUARD_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 12;
const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-connection",
  "transfer-encoding",
  "upgrade",
  "te",
  "trailer"
]);
const LOCAL_DEFAULT_STOREFRONT_PATHS = new Set(["/ai-image-generation", "/ai-video-generation", "/pricing", "/help"]);
const LOCAL_DEFAULT_STOREFRONT_PREFIXES = ["/account", "/app", "/dashboard", "/login"];
// These aliases are also represented in the published route projection. Keep
// the edge list limited to public MyDreamShoots migration paths so redirects
// are emitted before an internal /site rewrite can turn them into 307/308.
const MYDREAMSHOOTS_LEGACY_PUBLIC_REDIRECTS: Record<string, string> = {
  "/help": "/faq",
  "/how-it-works": "/workflow",
  "/privacy-policy": "/privacy",
  "/policies/privacy": "/privacy",
  "/policies/privacy-policy": "/privacy",
  "/terms-of-service": "/terms",
  "/policies/terms": "/terms",
  "/policies/terms-of-service": "/terms",
  "/cookie-policy": "/cookies",
  "/policies/cookies": "/cookies",
  "/policies/cookie-policy": "/cookies",
  "/refund-policy": "/refunds",
  "/policies/refund": "/refunds",
  "/policies/refunds": "/refunds",
  "/content-policy": "/content",
  "/policies/content": "/content",
  "/shipping-policy": "/shipping",
  "/delivery-policy": "/shipping",
  "/policies/shipping": "/shipping",
  "/policies/delivery": "/shipping",
  "/policies/delivery-policy": "/shipping",
  "/children-privacy-policy": "/children-privacy",
  "/childrens-privacy": "/children-privacy",
  "/policies/children-privacy": "/children-privacy",
  "/policies/children": "/children-privacy",
  "/policies/children-privacy-policy": "/children-privacy",
  "/policies/childrens-privacy": "/children-privacy",
  "/state-privacy-rights": "/state-privacy",
  "/california-privacy": "/state-privacy",
  "/ccpa": "/state-privacy",
  "/policies/state-privacy": "/state-privacy",
  "/policies/state-privacy-rights": "/state-privacy",
  "/policies/california-privacy": "/state-privacy",
  "/policies/ccpa": "/state-privacy",
  "/collections": "/ai-image-generation",
  "/collections/engagement-photo": "/ai-image-generation/engagement-photo",
  "/engagement-photo": "/ai-image-generation/engagement-photo",
  "/collections/headshot": "/ai-image-generation/headshot",
  "/ai-image-generation/profile-cards": "/ai-image-generation/avatar",
  "/ai-image-generation/motion-generator": "/ai-video-generation/motion-generator",
  "/ai-video-generation/wedding-invitation": "/ai-save-the-date/wedding-invitation",
  "/holidays-events/wedding-invitation": "/ai-save-the-date/wedding-invitation",
  "/ai-video-generation/mothers-day": "/ai-save-the-date/mothers-day",
  "/ai-video-generation/new-year": "/ai-save-the-date/new-year",
  "/ai-video-generation/proposal": "/ai-save-the-date/proposal",
  "/ai-video-generation/save-the-date": "/ai-save-the-date/save-the-date",
  "/ai-video-generation/thanksgiving": "/ai-save-the-date/thanksgiving",
  "/ai-video-generation/valentines-day": "/ai-save-the-date/valentines-day"
};

const SEO_HEAD_TAG_RE =
  /<title\b[^>]*>[\s\S]*?<\/title>|<meta\b(?=[^>]*(?:name=["'](?:description|robots|twitter:(?:card|title|description|image))["']|property=["']og:(?:title|description|url|site_name|image)["']))[^>]*\/?>|<link\b(?=[^>]*rel=["']canonical["'])[^>]*\/?>|<script\b(?=[^>]*type=["']application\/ld\+json["'])[^>]*>[\s\S]*?<\/script>/gi;
const LEADING_SEO_HEAD_TAG_RE =
  /^(?:\s*(?:<title\b[^>]*>[\s\S]*?<\/title>|<meta\b(?=[^>]*(?:charset=|name=["'](?:viewport|description|robots|twitter:(?:card|title|description|image))["']|http-equiv=["']Content-Language["']|property=["']og:(?:title|description|url|site_name|image)["']))[^>]*\/?>|<link\b(?=[^>]*rel=["']canonical["'])[^>]*\/?>|<script\b(?=[^>]*type=["']application\/ld\+json["'])[^>]*>[\s\S]*?<\/script>))*/i;
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

function twoDigit(value: number): string {
  return String(value).padStart(2, "0");
}

function storefrontGuardCookieValue(now = new Date()): string {
  const shanghaiDate = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return `${twoDigit(shanghaiDate.getUTCFullYear() % 100)}${twoDigit(shanghaiDate.getUTCMonth() + 1)}${twoDigit(shanghaiDate.getUTCDate())}`;
}

function shouldSetStorefrontGuardCookie(request: NextRequest): boolean {
  const guardCookieEnabled = envSwitch(process.env.STOREFRONT_GUARD_COOKIE);
  if (guardCookieEnabled !== true) return false;
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  if (request.headers.get(REORDER_SKIP_HEADER) === "1") return false;
  if (INTERNAL_PATH_RE.test(request.nextUrl.pathname) || BROWSER_ICON_PATH_RE.test(request.nextUrl.pathname)) return false;
  if (isPrivateStorefrontHtmlRequest(request)) return false;

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  if (!TARGET_SITE_PATH_RE.test(request.nextUrl.pathname) && !TARGET_HOST_RE.test(host)) return false;

  const accept = request.headers.get("accept") ?? "";
  return !accept || accept.includes("text/html");
}

function withStorefrontGuardCookie(response: Response, request: NextRequest): Response {
  if (!shouldSetStorefrontGuardCookie(request)) return response;
  response.headers.append(
    "set-cookie",
    `${STOREFRONT_GUARD_COOKIE_NAME}=${storefrontGuardCookieValue()}; Path=/; Max-Age=${STOREFRONT_GUARD_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`
  );
  return response;
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

  if (
    normalizedPath === "/app/create" &&
    ["text-to-video", "image-to-video"].includes(request.nextUrl.searchParams.get("videoMode") ?? "")
  ) {
    return new NextResponse(null, { status: 404 });
  }

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
  return NextResponse.redirect(publicRedirectUrlForRequest(request, scopedPath === "/" ? "/" : scopedPath), 301);
}

function mydreamshootsLegacyPublicRedirect(request: NextRequest): NextResponse | undefined {
  const hostSlug = storefrontSlugForHost(request.headers.get("x-forwarded-host")) ?? storefrontSlugForHost(request.headers.get("host"));
  const sitePathMatch = request.nextUrl.pathname.match(/^\/site\/mydreamshoots(\/.*)?$/i);
  if (hostSlug !== "mydreamshoots" && !sitePathMatch) return undefined;

  const requestedPath = (sitePathMatch?.[1] || request.nextUrl.pathname || "/").replace(/\/+$/, "") || "/";
  const targetPath = MYDREAMSHOOTS_LEGACY_PUBLIC_REDIRECTS[requestedPath];
  if (!targetPath) return undefined;
  const target = publicRedirectUrlForRequest(request, targetPath);
  target.search = request.nextUrl.search;
  return NextResponse.redirect(target, 301);
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
  if (process.env.DINGYUE_ENV === "local" && process.env.STOREFRONT_INSTANT_DRAFT_PREVIEW !== "0") {
    return "private, no-store, max-age=0, must-revalidate";
  }
  // Public storefront HTML is rendered from the live database on every
  // request; never preserve a stale upstream/CDN cache directive.
  return PUBLIC_STOREFRONT_CACHE_CONTROL;
}

function applyStorefrontHtmlCacheHeaders(headers: Headers, request: NextRequest, upstreamHeaders: Headers) {
  const cacheControl = storefrontHtmlCacheControl(request, upstreamHeaders);
  headers.set("cache-control", cacheControl);
  if (!/(?:no-store|private)/i.test(cacheControl)) {
    headers.set("cdn-cache-control", PUBLIC_STOREFRONT_CDN_CACHE_CONTROL);
    headers.set("cloudflare-cdn-cache-control", PUBLIC_STOREFRONT_CDN_CACHE_CONTROL);
  } else {
    headers.delete("cdn-cache-control");
    headers.delete("cloudflare-cdn-cache-control");
  }
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

function shouldInlineAidreamcapesLogo(request: NextRequest): boolean {
  if (isSpanishXbyRequest(request)) return false;
  return siteIconForRequest(request)?.png === AIDREAMCAPES_ICON;
}

function rewriteStorefrontHtmlHead(html: string, request: NextRequest, shouldReorder: boolean): string {
  const htmlWithSeo = shouldReorder ? moveSeoTagsBeforeResources(html) : html;
  return withStorefrontLocale(
    withStorefrontIcons(htmlWithSeo, siteIconForRequest(request)),
    request
  );
}

function rewriteStorefrontHtmlFull(html: string, request: NextRequest, shouldReorder: boolean): string {
  const htmlWithSeo = shouldReorder ? moveSeoTagsBeforeResources(html) : html;
  return withStorefrontLocale(
    withInlineAidreamcapesLogo(withStorefrontIcons(htmlWithSeo, siteIconForRequest(request)), request),
    request
  );
}

function rewriteStorefrontHtmlStream(body: ReadableStream<Uint8Array>, request: NextRequest, shouldReorder: boolean): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = body.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let buffer = "";
      let emittedHead = false;

      try {
        while (!emittedHead) {
          const { done, value } = await reader.read();
          if (value) buffer += decoder.decode(value, { stream: !done });

          const headCloseMatch = buffer.match(/<\/head>/i);
          if (headCloseMatch?.index !== undefined) {
            const headEnd = headCloseMatch.index + headCloseMatch[0].length;
            const headPrefix = buffer.slice(0, headEnd);
            const bodyRemainder = buffer.slice(headEnd);
            controller.enqueue(encoder.encode(rewriteStorefrontHtmlHead(headPrefix, request, shouldReorder)));
            if (bodyRemainder) controller.enqueue(encoder.encode(bodyRemainder));
            buffer = "";
            emittedHead = true;
            break;
          }

          if (done) {
            const tail = decoder.decode();
            const rewritten = rewriteStorefrontHtmlFull(buffer + tail, request, shouldReorder);
            controller.enqueue(encoder.encode(rewritten));
            controller.close();
            return;
          }
        }

        while (true) {
          const { done, value } = await reader.read();
          if (value) {
            const chunk = decoder.decode(value, { stream: !done });
            if (chunk) controller.enqueue(encoder.encode(chunk));
          }
          if (done) {
            const tail = decoder.decode();
            if (tail) controller.enqueue(encoder.encode(tail));
            controller.close();
            return;
          }
        }
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    }
  });
}

function nextWithPathname(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(REORDER_SKIP_HEADER);
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

function headerHost(value: string | null | undefined): string {
  return String(value ?? "").split(",")[0]?.trim() ?? "";
}

function isInternalOriginHost(host: string): boolean {
  return /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host);
}

function isLocalStorefrontHost(host: string): boolean {
  return /(?:^|\.)(?:localhost)(?::\d+)?$/i.test(host);
}

function publicOriginForRequest(request: NextRequest): URL {
  const publicHost = [
    headerHost(request.headers.get("x-forwarded-host")),
    headerHost(request.headers.get("host"))
  ].find((host) => TARGET_HOST_RE.test(host));
  const host = publicHost || headerHost(request.headers.get("host")) || request.nextUrl.host;
  const forwardedProto = headerHost(request.headers.get("x-forwarded-proto")).replace(/:$/, "");
  const protocol = TARGET_HOST_RE.test(host) && !isInternalOriginHost(host) && !isLocalStorefrontHost(host)
    ? "https"
    : forwardedProto || request.nextUrl.protocol.replace(/:$/, "");
  return new URL(`${protocol}://${host}`);
}

function publicRedirectUrlForRequest(request: NextRequest, location: string): URL {
  const publicOrigin = publicOriginForRequest(request);
  const target = new URL(location, publicOrigin);
  if (isInternalOriginHost(target.host) || target.origin === request.nextUrl.origin) {
    target.protocol = publicOrigin.protocol;
    target.host = publicOrigin.host;
  }
  return target;
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

function mydreamshootsWorkspaceRedirect(request: NextRequest): Response | undefined {
  const hostSlug = storefrontSlugForHost(request.headers.get("x-forwarded-host")) ?? storefrontSlugForHost(request.headers.get("host"));
  const pathname = request.nextUrl.pathname;
  const isPublicMydreamshootsWorkspace = pathname === "/workspace" && hostSlug === "mydreamshoots";
  const isPathModeMydreamshootsWorkspace = pathname === "/site/mydreamshoots/workspace";
  if (!isPublicMydreamshootsWorkspace && !isPathModeMydreamshootsWorkspace) return undefined;

  const target = new URL(request.nextUrl);
  target.pathname = isPathModeMydreamshootsWorkspace ? "/site/mydreamshoots/app/create" : "/app/create";
  // This legacy public entry must be a real HTTP 301, not Next's 308 helper.
  return NextResponse.redirect(publicRedirectUrlForRequest(request, `${target.pathname}${target.search}`), 301);
}

function applyGrownstrideNoindex(response: Response, request: NextRequest): Response {
  if (isGrownstrideRequest(request)) response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

function finalizeStorefrontResponse(response: Response, request: NextRequest): Response {
  const guarded = withStorefrontGuardCookie(response, request);
  return applyGrownstrideNoindex(guarded, request);
}

function sameServerStorefrontUrl(request: NextRequest): URL {
  const upstreamUrl = sameServerUrl(request);
  const hostSlug = storefrontSlugForHost(request.headers.get("x-forwarded-host")) ?? storefrontSlugForHost(request.headers.get("host"));
  if (!hostSlug || upstreamUrl.pathname.startsWith("/site/")) return upstreamUrl;
  // Keep the directory renderer for its complete published shell, while the
  // category query lets its metadata resolve the requested image theme.
  const imageThemeMatch = upstreamUrl.pathname.match(/^\/ai-image-generation\/([^/]+)$/);
  if (hostSlug === "mydreamshoots" && imageThemeMatch?.[1]) {
    upstreamUrl.pathname = `/site/${hostSlug}/ai-image-generation`;
    upstreamUrl.searchParams.set("category", imageThemeMatch[1]);
    return upstreamUrl;
  }
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
    headers: sanitizeUpstreamHeaders(new Headers({ [REORDER_SKIP_HEADER]: "1" }))
  });
  if (!upstreamResponse.ok) return undefined;

  const headers = new Headers(upstreamResponse.headers);
  headers.delete("content-length");
  headers.set("content-type", "image/png");
  headers.set("cache-control", "no-store, max-age=0");

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers
  });
}

export async function middleware(request: NextRequest) {
  const workspaceRedirect = mydreamshootsWorkspaceRedirect(request);
  if (workspaceRedirect) return finalizeStorefrontResponse(workspaceRedirect, request);
  const legacyPublicRedirect = mydreamshootsLegacyPublicRedirect(request);
  if (legacyPublicRedirect) return finalizeStorefrontResponse(legacyPublicRedirect, request);
  const iconResponse = await storefrontIconResponse(request);
  if (iconResponse) return applyGrownstrideNoindex(iconResponse, request);

  const skipInternalRewrite = request.headers.get(REORDER_SKIP_HEADER) === "1";
  if (skipInternalRewrite) return applyGrownstrideNoindex(nextWithPathname(request), request);

  const redirectResponse = grownstrideLegacyHostRedirect(request) ?? canonicalPublicHostSitePathRedirect(request) ?? localDefaultStorefrontRedirect(request);
  if (redirectResponse) return finalizeStorefrontResponse(redirectResponse, request);
  if (!shouldRewriteStorefrontHtml(request)) return finalizeStorefrontResponse(nextWithPathname(request), request);

  const upstreamHeaders = new Headers(request.headers);
  upstreamHeaders.set(REORDER_SKIP_HEADER, "1");
  const imageThemeMatch = request.nextUrl.pathname.match(/^\/ai-image-generation\/([^/]+)$/);
  if (imageThemeMatch?.[1] && storefrontSlugForHost(request.headers.get("x-forwarded-host") ?? request.headers.get("host")) === "mydreamshoots") {
    upstreamHeaders.set(IMAGE_THEME_CONTEXT_HEADER, imageThemeMatch[1]);
  }
  const upstreamUrl = sameServerStorefrontUrl(request);
  const usesInternalSitePath = upstreamUrl.pathname.startsWith("/site/") && !request.nextUrl.pathname.startsWith("/site/");
  if (usesInternalSitePath) {
    const publicHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
    if (TARGET_HOST_RE.test(publicHost)) upstreamHeaders.set("x-forwarded-host", publicHost);
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
    if (location) return finalizeStorefrontResponse(NextResponse.redirect(publicRedirectUrlForRequest(request, location), upstreamResponse.status), request);
  }
  if (!upstreamResponse.ok || !contentType.includes("text/html")) return applyGrownstrideNoindex(upstreamResponse, request);

  const shouldReorder = shouldReorderStorefrontHead(request);
  const headers = new Headers(upstreamResponse.headers);
  headers.delete("content-length");
  applyStorefrontHtmlCacheHeaders(headers, request, upstreamResponse.headers);
  if (isSpanishXbyRequest(request)) {
    headers.set("content-language", "es");
  }
  if (isGrownstrideRequest(request)) headers.set("X-Robots-Tag", "noindex, nofollow");

  if (upstreamResponse.body && !shouldInlineAidreamcapesLogo(request)) {
    return finalizeStorefrontResponse(new Response(rewriteStorefrontHtmlStream(upstreamResponse.body, request, shouldReorder), {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers
    }), request);
  }

  const html = await upstreamResponse.text();
  return finalizeStorefrontResponse(new Response(rewriteStorefrontHtmlFull(html, request, shouldReorder), {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers
  }), request);
}

export const config = {
  matcher: ["/((?!api|assets|_next/static|_next/image|robots.txt|sitemap.xml).*)"]
};
