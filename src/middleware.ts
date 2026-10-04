import type { NextRequest } from "next/server";
import aidreamcapesSiteV2Redirects from "@/lib/aidreamcapes-site-v2-redirects.json";
import { NextResponse } from "next/server";
import { canonicalSpanishXbyCollectionSlug, isSpanishStorefrontRequestIdentity } from "@/lib/spanish-storefronts";
import { storefrontLocaleForRequestIdentity } from "@/lib/storefront-locale";
import { mydreamshootsPageCopyForSlug } from "@/lib/mydreamshoots-page-copy";
import { MYDREAMSHOOTS_LEGACY_PUBLIC_REDIRECTS as MYDREAMSHOOTS_PUBLISHED_LEGACY_REDIRECTS, isMydreamshootsRetiredPublicPath } from "@/lib/mydreamshoots-legacy-public-redirects";
import { aidreamcapesLegacyGalleryRedirectForPath, isAidreamcapesGonePublicPath, isRetiredAidreamcapesPublicPath } from "@/lib/aidreamcapes-image-theme-routes";
import { aidreamcapesLegacyVideoSaveTheDatePath } from "@/lib/save-the-date-routes";
import { aidreamcapesNotFoundResponse } from "@/lib/aidreamcapes-not-found";

const TARGET_SITE_PATH_RE = /^\/site\/(?:aidreamcapes|mydreamshoots|aidreamshoots|grownstride)(?:-xby|-eu)?(?:\/|$)/i;
const TARGET_HOST_RE = /(?:^|\.)(?:(?:aidreamcapes|mydreamshoots|aidreamshoots|grownstride)(?:-xby)?\.localhost|(?:aidreamcapes|aivideosugc|mydreamshoots|grownstride)\.com|(?:aidreamcapes|aidreamshoots)\.eu)(?::\d+)?$/i;
const INTERNAL_PATH_RE = /^\/(?:api|assets|_next\/static|_next\/image|robots\.txt|sitemap\.xml)(?:\/|$)/i;
const BROWSER_ICON_PATH_RE = /^\/(?:favicon\.ico|favicon\.svg|icon\.svg|apple-touch-icon(?:\.png)?)$/i;
const GROWNSTRIDE_TEST_HOST = "test.grownstride.com";
const GROWNSTRIDE_LEGACY_HOSTS = new Set(["grownstride.com", "www.grownstride.com"]);
const PRIVATE_STORE_PATH_RE = /^\/site\/(?:aidreamcapes|mydreamshoots|aidreamshoots|grownstride)(?:-xby|-eu)?\/(?:admin|app|account|cart|dashboard|login|register|reset-password|checkout|logout)(?:\/|$)/i;
const HOST_PRIVATE_STORE_PATH_RE = /^\/(?:admin|app|account|cart|dashboard|login|register|reset-password|checkout|logout)(?:\/|$)/i;
const REORDER_SKIP_HEADER = "x-storefront-head-seo-reorder-skip";
const IMAGE_THEME_CONTEXT_HEADER = "x-storefront-image-theme";
const STOREFRONT_ROUTE_MODE_HEADER = "x-storefront-route-mode";
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
const MYDREAMSHOOTS_LEGACY_SITE_SLUGS = new Set(["dreamshoot", "mydreamshoot"]);
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
  "/shipping": "/digital-delivery",
  "/shipping-policy": "/digital-delivery",
  "/delivery-policy": "/digital-delivery",
  "/policies/shipping": "/digital-delivery",
  "/policies/delivery": "/digital-delivery",
  "/policies/delivery-policy": "/digital-delivery",
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
  "/ai-image-generation/social-cards": "/ai-image-generation",
  ...Object.fromEntries(MYDREAMSHOOTS_PUBLISHED_LEGACY_REDIRECTS.map(({ aliasPath, targetPath }) => [aliasPath, targetPath])),
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
  /<title\b[^>]*>[\s\S]*?<\/title>|<meta\b(?=[^>]*(?:name=["'](?:description|robots|twitter:(?:card|title|description|image))["']|property=["']og:(?:title|description|url|site_name|image)["']))[^>]*\/?>|<link\b(?=[^>]*rel=["']canonical["'])[^>]*\/?>|<script\b(?:(?=[^>]*type=["']application\/ld\+json["'])|(?=[^>]*data-storefront-json-ld=["'][^"']+["']))[^>]*>[\s\S]*?<\/script>/gi;
const LEADING_SEO_HEAD_TAG_RE =
  /^(?:\s*(?:<title\b[^>]*>[\s\S]*?<\/title>|<meta\b(?=[^>]*(?:charset=|name=["'](?:viewport|description|robots|twitter:(?:card|title|description|image))["']|http-equiv=["']Content-Language["']|property=["']og:(?:title|description|url|site_name|image)["']))[^>]*\/?>|<link\b(?=[^>]*rel=["']canonical["'])[^>]*\/?>|<script\b(?=[^>]*type=["']application\/ld\+json["'])[^>]*>[\s\S]*?<\/script>))*/i;
const ESSENTIAL_HEAD_TAG_RE =
  /<meta\b(?=[^>]*(?:charset=|name=["']viewport["']|http-equiv=["']Content-Language["']))[^>]*\/?>/gi;
const ICON_HEAD_TAG_RE = /<link\b(?=[^>]*rel=["'][^"']*(?:icon|apple-touch-icon)[^"']*["'])[^>]*\/?>/gi;
const AIDREAMCAPES_ICON = "/assets/sites/site_aidreamcapes/brand/aidreamcapesai-logo-refined.svg?v=20260920favicon";
const AIDREAMCAPES_APPLE_ICON = "/assets/sites/site_aidreamcapes/brand/aidreamcapes-icon-180.png?v=20260919original";
const AIDREAMCAPES_EU_ICON = "/assets/sites/site_aidreamcapes_eu/brand/aidreamcapes-logo-refined.svg?v=20260920favicon";
const AIDREAMCAPES_EU_APPLE_ICON = "/assets/sites/site_aidreamcapes_eu/brand/aidreamcapes-icon-180.png?v=20260919original";
const AIDREAMSHOOTS_ICON = "/assets/sites/site_aidreamshoots/brand/aidreamshoots-logo-refined.svg?v=20260920favicon";
const AIDREAMSHOOTS_APPLE_ICON = "/assets/sites/site_aidreamshoots/brand/aidreamshoots-icon-180.png?v=20260919original";
const MYDREAMSHOOTS_ICON = "/assets/dreamshoot/brand/dreamshootai-logo-refined.svg?v=20260920favicon";
const MYDREAMSHOOTS_APPLE_ICON = "/assets/dreamshoot/brand/dreamshootai-icon-180.png?v=20260702";
const AIDREAMCAPES_EU_LEGACY_MEDIA_REDIRECTS: Record<string, string> = {
  "/assets/sites/site_aidreamcapes_eu/fan-holiday-theme/categories/portrait-professionnel.webp":
    "/assets/sites/site_aidreamcapes_eu/generated/recovered/aidreamcapes-eu-provider-4k-20260916-v1/reused-local/4916dfeaf3ca-polished-professional-headshot.webp",
  "/assets/sites/site_aidreamcapes_eu/fan-holiday-theme/categories/virtuel-essai.webp":
    "/assets/sites/site_aidreamcapes_eu/generated/recovered/aidreamcapes-eu-provider-4k-20260916-v1/reused-local/beea80062dd5-virtual-try-on-01.webp",
  "/assets/sites/site_aidreamcapes_eu/fan-holiday-theme/categories/noel-photo.webp":
    "/assets/sites/site_aidreamcapes_eu/generated/recovered/aidreamcapes-eu-provider-4k-20260916-v1/reused-local/a707445975aa-christmas-couple-cover.webp"
};
const AIDREAMCAPES_LEGACY_BLOG_REDIRECTS: Record<string, string> = {
  "/blog/video-photo-package-guide": "/blog/motion-generator-video-guide"
};

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
    (normalizedHost.includes("aidreamcapes") && /^aidreamcapes(?:-xby|-eu)?$/.test(siteSlug)) ||
    (normalizedHost.includes("aivideosugc") && siteSlug === "aidreamcapes");
  if (!hostMatchesSite) return undefined;
  const scopedPath = match[2] || "/";
  return NextResponse.redirect(publicRedirectUrlForRequest(request, scopedPath === "/" ? "/" : scopedPath), 301);
}

function aidreamcapesLegacyBlogRedirect(request: NextRequest): NextResponse | undefined {
  const normalizedPath = request.nextUrl.pathname.replace(/\/+$/, "") || "/";
  const match = normalizedPath.match(/^\/site\/(aidreamcapes)(\/blog\/[^/]+)$/i);
  if (!match) return undefined;
  const targetPath = AIDREAMCAPES_LEGACY_BLOG_REDIRECTS[match[2].toLowerCase()];
  if (!targetPath) return undefined;

  const target = `${targetPath}${request.nextUrl.search}`;
  return NextResponse.redirect(publicRedirectUrlForRequest(request, target), 308);
}

function aidreamcapesEuWwwRedirect(request: NextRequest): NextResponse | undefined {
  const host = String(request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase()
    .split(":")[0];
  if (host !== "www.aidreamcapes.eu") return undefined;
  const target = new URL(request.nextUrl);
  target.protocol = "https:";
  target.hostname = "aidreamcapes.eu";
  target.port = "";
  return NextResponse.redirect(target, 301);
}

// The storefront's address is www.aivideosugc.com; its other hosts (aivideosugc.com and the
// former aidreamcapes.com addresses) move there permanently, keeping the path and query.
const AIDREAMCAPES_CANONICAL_HOST = "www.aivideosugc.com";
const AIDREAMCAPES_HOSTS = new Set([AIDREAMCAPES_CANONICAL_HOST, "aivideosugc.com", "www.aidreamcapes.com", "aidreamcapes.com"]);

function aidreamcapesCanonicalHostRedirect(request: NextRequest): NextResponse | undefined {
  const forwardedHost = request.headers.get("x-forwarded-host") ?? "";
  const host = (forwardedHost || request.headers.get("host") || "").split(",")[0]?.trim().toLowerCase().split(":")[0] ?? "";
  if (!AIDREAMCAPES_HOSTS.has(host)) return undefined;

  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  const protocol = forwardedProtocol || request.nextUrl.protocol.replace(/:$/, "").toLowerCase();
  if (host === AIDREAMCAPES_CANONICAL_HOST && protocol === "https") return undefined;

  const target = request.nextUrl.clone();
  target.protocol = "https:";
  target.hostname = AIDREAMCAPES_CANONICAL_HOST;
  target.port = "";
  return NextResponse.redirect(target, 301);
}

function aidreamcapesLegacyGalleryRedirect(request: NextRequest): NextResponse | undefined {
  const normalizedPath = request.nextUrl.pathname.replace(/\/+$/, "") || "/";
  const pathMatch = normalizedPath.match(/^\/site\/([^/]+)(\/.*)?$/i);
  const hostSlug = storefrontSlugForHost(request.headers.get("x-forwarded-host")) ?? storefrontSlugForHost(request.headers.get("host"));
  const siteSlug = pathMatch?.[1]?.toLowerCase() === "aidreamcapes" ? "aidreamcapes" : hostSlug;
  const publicPath = pathMatch?.[2] || normalizedPath;
  const targetPath = aidreamcapesLegacyGalleryRedirectForPath(siteSlug, publicPath);
  if (!targetPath) return undefined;

  const target = request.nextUrl.clone();
  target.pathname = pathMatch ? `/site/${pathMatch[1]}${targetPath}` : targetPath;
  return NextResponse.redirect(publicRedirectUrlForRequest(request, `${target.pathname}${target.search}`), 301);
}

function aidreamcapesTrailingSlashRedirect(request: NextRequest): NextResponse | undefined {
  if (request.method !== "GET" && request.method !== "HEAD") return undefined;
  const pathname = request.nextUrl.pathname;
  if (pathname === "/" || !pathname.endsWith("/") || INTERNAL_PATH_RE.test(pathname) || BROWSER_ICON_PATH_RE.test(pathname)) return undefined;
  if (PRIVATE_STORE_PATH_RE.test(pathname) || HOST_PRIVATE_STORE_PATH_RE.test(pathname)) return undefined;
  if (/\.[a-z0-9]{2,5}$/i.test(pathname.replace(/\/+$/, ""))) return undefined;

  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  const pathMatch = normalizedPath.match(/^\/site\/([^/]+)(\/.*)?$/i);
  const hostSlug = storefrontSlugForHost(request.headers.get("x-forwarded-host")) ?? storefrontSlugForHost(request.headers.get("host"));
  const siteSlug = pathMatch?.[1]?.toLowerCase() === "aidreamcapes" ? "aidreamcapes" : hostSlug;
  if (siteSlug !== "aidreamcapes") return undefined;

  const target = request.nextUrl.clone();
  target.pathname = normalizedPath;
  return NextResponse.redirect(publicRedirectUrlForRequest(request, `${target.pathname}${target.search}`), 301);
}

function mydreamshootsLegacySiteSlugRedirect(request: NextRequest): NextResponse | undefined {
  const match = request.nextUrl.pathname.match(/^\/site\/([^/]+)(\/.*)?$/i);
  const legacySlug = match?.[1]?.toLowerCase();
  if (!legacySlug || !MYDREAMSHOOTS_LEGACY_SITE_SLUGS.has(legacySlug)) return undefined;

  const target = request.nextUrl.clone();
  target.pathname = `/site/mydreamshoots${match?.[2] ?? ""}`;
  return NextResponse.redirect(target, 301);
}

function aidreamshootsUrbanCanonicalRedirect(request: NextRequest): NextResponse | undefined {
  const normalizedPath = request.nextUrl.pathname.replace(/\/+$/, "") || "/";
  const sitePathMatch = normalizedPath.match(/^\/site\/([^/]+)(\/.*)?$/i);
  const scopedPath = sitePathMatch?.[2] || normalizedPath;
  const requestHost = String(request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  const isAidreamshootsRequest = /(?:^|\.)aidreamshoots\.eu(?::\d+)?$/i.test(requestHost)
    || Boolean(sitePathMatch && /^aidreamshoots(?:-xby|-eu)?$/i.test(sitePathMatch[1] ?? ""));
  if (!isAidreamshootsRequest || scopedPath !== "/ai-image-generation/urban") return undefined;
  const targetPath = sitePathMatch && !/(?:^|\.)aidreamshoots\.eu(?::\d+)?$/i.test(requestHost)
    ? `/site/${sitePathMatch[1]}/ai-image-generation/urbano`
    : "/ai-image-generation/urbano";
  const target = publicRedirectUrlForRequest(request, targetPath);
  target.search = request.nextUrl.search;
  return NextResponse.redirect(target, 308);
}

function spanishXbyCanonicalCollectionRedirect(request: NextRequest): NextResponse | undefined {
  if (!isSpanishXbyRequest(request)) return undefined;
  const normalizedPath = request.nextUrl.pathname.replace(/\/+$/, "") || "/";
  const sitePathMatch = normalizedPath.match(/^\/site\/([^/]+)(\/.*)?$/i);
  const scopedPath = sitePathMatch?.[2] || normalizedPath;
  const normalizedScopedPath = scopedPath.replace(/\/+$/, "") || "/";
  let targetScopedPath: string | undefined;
  if (normalizedScopedPath === "/collections" || normalizedScopedPath === "/collections/engagement-photo" || normalizedScopedPath === "/engagement-photo") {
    if (normalizedScopedPath === "/collections") {
      targetScopedPath = "/ai-image-generation";
    } else {
      targetScopedPath = "/ai-image-generation/engagement-photo";
    }
  } else {
    const aliasMatch = normalizedScopedPath.match(/^\/collections\/([^/]+)$/i);
    if (aliasMatch?.[1]) {
      const canonical = canonicalSpanishXbyCollectionSlug(aliasMatch[1]);
      if (canonical) targetScopedPath = `/ai-image-generation/${canonical}`;
    }
  }
  if (!targetScopedPath) return undefined;
  const requestHost = String(request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  const isAidreamshootsPublicAlias = Boolean(
    sitePathMatch &&
      /^aidreamshoots(?:-xby|-eu)?$/i.test(sitePathMatch[1] ?? "") &&
      /(?:^|\.)aidreamshoots\.eu(?::\d+)?$/i.test(requestHost)
  );
  const targetPath = sitePathMatch && !isAidreamshootsPublicAlias
    ? `/site/${sitePathMatch[1]}${targetScopedPath}`
    : targetScopedPath;
  const target = publicRedirectUrlForRequest(request, targetPath);
  target.search = request.nextUrl.search;
  return NextResponse.redirect(target, 308);
}

function mydreamshootsLegacyPublicRedirect(request: NextRequest): NextResponse | undefined {
  const hostSlug = storefrontSlugForHost(request.headers.get("x-forwarded-host")) ?? storefrontSlugForHost(request.headers.get("host"));
  const sitePathMatch = request.nextUrl.pathname.match(/^\/site\/mydreamshoots(\/.*)?$/i);
  if (hostSlug !== "mydreamshoots" && !sitePathMatch) return undefined;

  const requestedPath = (sitePathMatch?.[1] || request.nextUrl.pathname || "/").replace(/\/+$/, "") || "/";
  if (isMydreamshootsRetiredPublicPath(requestedPath)) {
    return new NextResponse(null, { status: 404, headers: { "cache-control": "no-store, max-age=0, must-revalidate" } });
  }
  const targetPath = MYDREAMSHOOTS_LEGACY_PUBLIC_REDIRECTS[requestedPath];
  if (!targetPath) return undefined;
  const target = publicRedirectUrlForRequest(request, targetPath);
  target.search = request.nextUrl.search;
  const imageAlias = requestedPath === "/ai-image-generation/estilo-y-fantasia" || requestedPath === "/ai-image-generation/urbano";
  return NextResponse.redirect(target, imageAlias ? 308 : 301);
}

function mydreamshootsUnknownImageThemeResponse(request: NextRequest): NextResponse | undefined {
  const hostSlug = storefrontSlugForHost(request.headers.get("x-forwarded-host")) ?? storefrontSlugForHost(request.headers.get("host"));
  const sitePathMatch = request.nextUrl.pathname.match(/^\/site\/mydreamshoots\/ai-image-generation\/([^/]+)\/?$/i);
  if (hostSlug !== "mydreamshoots" && !sitePathMatch) return undefined;
  const slug = sitePathMatch?.[1] ?? request.nextUrl.pathname.match(/^\/ai-image-generation\/([^/]+)\/?$/i)?.[1];
  if (!slug || mydreamshootsPageCopyForSlug(slug)) return undefined;
  return new NextResponse(request.method === "HEAD" ? null : "Page not found", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex, follow" }
  });
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
  if (INTERNAL_PATH_RE.test(pathname) || (!isSpanishXbyRequest(request) && !isFrenchXbyRequest(request) && (PRIVATE_STORE_PATH_RE.test(pathname) || (TARGET_HOST_RE.test(host) && HOST_PRIVATE_STORE_PATH_RE.test(pathname))))) return false;

  const accept = request.headers.get("accept") ?? "";
  if (accept && !accept.includes("text/html") && !accept.includes("*/*")) return false;

  return TARGET_SITE_PATH_RE.test(pathname) || TARGET_HOST_RE.test(host);
}

function isSpanishXbyRequest(request: NextRequest): boolean {
  const identity = `${request.nextUrl.pathname} ${request.headers.get("x-forwarded-host") ?? ""} ${request.headers.get("host") ?? ""}`.toLowerCase();
  return isSpanishStorefrontRequestIdentity(identity);
}

function isFrenchXbyRequest(request: NextRequest): boolean {
  const identity = `${request.nextUrl.pathname} ${request.headers.get("x-forwarded-host") ?? ""} ${request.headers.get("host") ?? ""}`.toLowerCase();
  return storefrontLocaleForRequestIdentity(identity) === "fr";
}

function shouldRewriteStorefrontHtml(request: NextRequest): boolean {
  const shouldReorder = shouldReorderStorefrontHead(request);
  if (!shouldReorder && !storefrontEdgeHtmlRewriteEnabled(request)) return false;
  if (request.method !== "GET") return false;
  if (request.headers.get(REORDER_SKIP_HEADER) === "1") return false;
  if (INTERNAL_PATH_RE.test(request.nextUrl.pathname)) return false;

  const accept = request.headers.get("accept") ?? "";
  if (accept && !accept.includes("text/html") && !accept.includes("*/*")) return false;

  return shouldReorder || isSpanishXbyRequest(request) || isFrenchXbyRequest(request);
}

function isPrivateStorefrontHtmlRequest(request: NextRequest): boolean {
  const pathname = request.nextUrl.pathname;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  return PRIVATE_STORE_PATH_RE.test(pathname) || (TARGET_HOST_RE.test(host) && HOST_PRIVATE_STORE_PATH_RE.test(pathname));
}

function isAidreamcapesComPublicHtmlRequest(request: NextRequest): boolean {
  if (isPrivateStorefrontHtmlRequest(request)) return false;
  const pathname = request.nextUrl.pathname;
  const hostSlug = storefrontSlugForHost(request.headers.get("x-forwarded-host")) ?? storefrontSlugForHost(request.headers.get("host"));
  return hostSlug === "aidreamcapes" || /^\/site\/aidreamcapes(?:\/|$)/i.test(pathname);
}

function hasCustomerSessionCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((cookie) => cookie.name.startsWith("customer_session_") && Boolean(cookie.value));
}

function storefrontHtmlCacheControl(request: NextRequest, _upstreamHeaders: Headers): string {
  // Public routes can still render customer-specific header controls. Never let
  // a browser or CDN reuse that HTML after the customer has signed out.
  if (isPrivateStorefrontHtmlRequest(request) || hasCustomerSessionCookie(request)) return PRIVATE_STOREFRONT_CACHE_CONTROL;
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
  if (isFrenchXbyRequest(request)) {
    const withFrenchLang = html.replace(/<html\b([^>]*)>/i, (tag, attrs: string) => {
      if (/\slang=(['"]).*?\1/i.test(tag)) return tag.replace(/\slang=(['"]).*?\1/i, ' lang="fr"');
      return `<html lang="fr"${attrs}>`;
    });
    if (/<meta\b(?=[^>]*http-equiv=(['"])Content-Language\1)[^>]*>/i.test(withFrenchLang)) {
      return withFrenchLang.replace(/<meta\b(?=[^>]*http-equiv=(['"])Content-Language\1)[^>]*>/i, (tag) => tag.replace(/\scontent=(['"]).*?\1/i, ' content="fr"'));
    }
    return withFrenchLang.replace(/<head\b[^>]*>/i, (tag) => `${tag}<meta http-equiv="Content-Language" content="fr">`);
  }
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

function dedupeJsonLdSeoTags(tags: string[]): string[] {
  const seen = new Set<string>();
  return tags.filter((tag) => {
    if (!/<script\b[^>]*type=["']application\/ld\+json["']/i.test(tag)) return true;
    const body = tag.match(/^[\s\S]*?>([\s\S]*?)<\/script>\s*$/i)?.[1]?.trim();
    if (!body || seen.has(body)) return false;
    seen.add(body);
    return true;
  });
}

function leadingSeoHeadLength(headContent: string): number {
  return headContent.match(LEADING_SEO_HEAD_TAG_RE)?.[0].length ?? 0;
}

function moveSeoTagsBeforeResources(html: string, preserveBodyMarker = false): string {
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
    if (/\sdata-storefront-json-ld=["']body-marker["']/i.test(tag)) {
      const headTag = tag
        .replace(/\sdata-storefront-json-ld=["'][^"']+["']/i, "")
        .replace(/\stype=["']application\/json["']/i, ' type="application/ld+json"')
        .replace(/\sid=["']storefront-json-ld-(\d+)["']/i, ' id="storefront-json-ld-head-$1"');
      seoTags.push(headTag);
      if (preserveBodyMarker) return tag;
      // Keep the normalized copy in <head>, but remove the body marker from
      // the final document so the same JSON-LD graph is not emitted twice.
      return "";
    }
    seoTags.push(tag);
    return "";
  });
  if (!seoTags.length) return html;

  const essentialTags: string[] = [];
  const remainingHead = strippedHead.replace(ESSENTIAL_HEAD_TAG_RE, (tag) => {
    essentialTags.push(tag);
    return "";
  });
  const { titleTag, seoTags: nonTitleSeoTags } = splitTitleAndSeoTags(dedupeJsonLdSeoTags(seoTags));
  const reorderedHead = `${titleTag}${essentialTags.join("")}${nonTitleSeoTags.join("")}${remainingHead}`;
  return `${beforeHeadContent}${reorderedHead}${strippedAfterHead}`;
}

const BODY_MARKER_JSON_LD_RE = /<script\b(?=[^>]*data-storefront-json-ld=["']body-marker["'])[^>]*>[\s\S]*?<\/script>/gi;

const RSC_BODY_MARKER_SCRIPT_RE = /<script\b[^>]*>[\s\S]*?<\/script>/gi;

function stripBodyMarkerJsonLd(html: string, inertSerializedBodyMarker = false): string {
  const withoutRenderedBodyMarker = html.replace(BODY_MARKER_JSON_LD_RE, "");
  if (!inertSerializedBodyMarker) return withoutRenderedBodyMarker;
  // React Server Components serialize the body JSON-LD element into a
  // self.__next_f flight chunk. Keep that chunk intact but make only its
  // duplicate script inert during hydration.
  return withoutRenderedBodyMarker.replace(RSC_BODY_MARKER_SCRIPT_RE, (tag) => {
    if (!/data-storefront-json-ld[\s\S]*body-marker/i.test(tag)) return tag;
    return tag.replace(/application\/(?:ld\+json|json)/gi, "text/plain");
  });
}

type StorefrontIconSet = {
  favicon: string;
  apple: string;
};

function siteIconForRequest(request: NextRequest): StorefrontIconSet | undefined {
  const identity = `${request.nextUrl.pathname} ${request.headers.get("x-forwarded-host") ?? ""} ${request.headers.get("host") ?? ""}`.toLowerCase();
  if (storefrontLocaleForRequestIdentity(identity) === "fr") {
    return { favicon: AIDREAMCAPES_EU_ICON, apple: AIDREAMCAPES_EU_APPLE_ICON };
  }
  if (isSpanishXbyRequest(request)) {
    if (identity.includes("aidreamcapes")) return { favicon: AIDREAMCAPES_EU_ICON, apple: AIDREAMCAPES_EU_APPLE_ICON };
    return { favicon: AIDREAMSHOOTS_ICON, apple: AIDREAMSHOOTS_APPLE_ICON };
  }
  if (identity.includes("aidreamcapes")) return { favicon: AIDREAMCAPES_ICON, apple: AIDREAMCAPES_APPLE_ICON };
  if (identity.includes("mydreamshoots")) return { favicon: MYDREAMSHOOTS_ICON, apple: MYDREAMSHOOTS_APPLE_ICON };
  if (BROWSER_ICON_PATH_RE.test(request.nextUrl.pathname)) return { favicon: MYDREAMSHOOTS_ICON, apple: MYDREAMSHOOTS_APPLE_ICON };
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
  // Keep one browser favicon candidate and point it to the same site-specific
  // logo asset used by the visible storefront header. Apple touch icons remain
  // separate because they have a different platform-specific size contract.
  const iconTags = `<link rel="icon" href="${icons.favicon}" type="image/svg+xml"/><link rel="apple-touch-icon" href="${icons.apple}" sizes="180x180"/>`;
  const insertionPoint = leadingSeoHeadLength(headContent);
  return `${beforeHeadContent}${headContent.slice(0, insertionPoint)}${iconTags}${headContent.slice(insertionPoint)}${afterHeadContent}`;
}

function mydreamshootsImageThemeSeo(request: NextRequest): { title: string; description: string; canonical: string } | undefined {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  if (storefrontSlugForHost(host) !== "mydreamshoots") return undefined;
  const slug = request.nextUrl.pathname.match(/^\/ai-image-generation\/([^/]+)$/i)?.[1]?.trim().toLowerCase();
  if (!slug) return undefined;
  const pageCopy = mydreamshootsPageCopyForSlug(slug);
  if (!pageCopy) return undefined;
  const label = slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  const title = pageCopy?.seoTitle || (slug === "edit-by-prompt"
    ? "AI Edit By Prompt for Safe Scene Changes, Style Adjustments, and Custom Photo Edits | myDreamshoots"
    : `AI ${label} Photo Package | myDreamshoots`);
  return {
    title,
    description: pageCopy?.cardDescription || `Explore private AI ${label.toLowerCase()} photo packages with myDreamshoots. Review examples, credits, and the private gallery workflow before you create.`,
    canonical: `https://www.mydreamshoots.com/ai-image-generation/${slug}`
  };
}

function withMydreamshootsImageThemeSeo(html: string, request: NextRequest): string {
  const seo = mydreamshootsImageThemeSeo(request);
  if (!seo) return html;
  let next = html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, `<title>${seo.title}</title>`);
  next = next.replace(/<meta\b(?=[^>]*name=["']description["'])[^>]*\/?>/i, `<meta name="description" content="${seo.description}"/>`);
  next = next.replace(/<meta\b(?=[^>]*name=["']robots["'])[^>]*\/?>/i, `<meta name="robots" content="index, follow"/>`);
  next = next.replace(/<link\b(?=[^>]*rel=["']canonical["'])[^>]*\/?>/i, `<link rel="canonical" href="${seo.canonical}"/>`);
  if (!/<meta\b(?=[^>]*name=["']robots["'])[^>]*\/?>/i.test(next)) {
    next = next.replace(/<\/head>/i, `<meta name="robots" content="index, follow"/></head>`);
  }
  if (!/<link\b(?=[^>]*rel=["']canonical["'])[^>]*\/?>/i.test(next)) {
    next = next.replace(/<\/head>/i, `<link rel="canonical" href="${seo.canonical}"/></head>`);
  }
  return next;
}

function rewriteStorefrontHtmlHead(html: string, request: NextRequest, shouldReorder: boolean): string {
  const htmlWithSeo = shouldReorder ? moveSeoTagsBeforeResources(html) : html;
  return withStorefrontLocale(
    withMydreamshootsImageThemeSeo(withStorefrontIcons(htmlWithSeo, siteIconForRequest(request)), request),
    request
  );
}

function rewriteStorefrontHtmlFull(html: string, request: NextRequest, shouldReorder: boolean, inertSerializedBodyMarker = false): string {
  const mydreamshootsWatch = (storefrontSlugForHost(request.headers.get("x-forwarded-host") ?? request.headers.get("host")) === "mydreamshoots" || request.nextUrl.pathname.startsWith("/site/mydreamshoots/watch/"))
    && /^(?:\/site\/mydreamshoots)?\/watch\//.test(request.nextUrl.pathname);
  const preserveBodyMarker = isAidreamcapesComPublicHtmlRequest(request) || mydreamshootsWatch;
  const reordered = shouldReorder ? moveSeoTagsBeforeResources(html, preserveBodyMarker) : html;
  const htmlWithSeo = preserveBodyMarker ? reordered : stripBodyMarkerJsonLd(reordered, inertSerializedBodyMarker);
  return withStorefrontLocale(
    withMydreamshootsImageThemeSeo(withStorefrontIcons(htmlWithSeo, siteIconForRequest(request)), request),
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
      let bodyBuffer = "";
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
            if (bodyRemainder) bodyBuffer += bodyRemainder;
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
            if (chunk) bodyBuffer += chunk;
          }
          if (done) {
            const tail = decoder.decode();
            if (tail) bodyBuffer += tail;
            const cleanedBody = stripBodyMarkerJsonLd(bodyBuffer);
            if (cleanedBody) controller.enqueue(encoder.encode(cleanedBody));
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

function isNonProductionStorefrontRequest(request: NextRequest): boolean {
  const hosts = [request.headers.get("x-forwarded-host"), request.headers.get("host")]
    .map(headerHost)
    .filter(Boolean);
  if (!hosts.length) return false;
  return hosts.every((host) => isInternalOriginHost(host) || isLocalStorefrontHost(host) || /(?:^|[.-])(staging|preview)(?:[.-]|$)/i.test(host));
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
  if (normalized.includes("aidreamcapes") || normalized.includes("aivideosugc")) return "aidreamcapes";
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

function retiredAidreamcapesImageToolResponse(request: NextRequest): Response | undefined {
  const normalizedPath = request.nextUrl.pathname.replace(/\/+$/, "") || "/";
  const pathMatch = normalizedPath.match(/^\/site\/([^/]+)(\/.*)?$/i);
  const hostSlug = storefrontSlugForHost(request.headers.get("x-forwarded-host")) ?? storefrontSlugForHost(request.headers.get("host"));
  const siteSlug = pathMatch?.[1]?.toLowerCase() === "aidreamcapes" ? "aidreamcapes" : hostSlug;
  const publicPath = pathMatch ? pathMatch[2] || "/" : normalizedPath;
  const isGone = isAidreamcapesGonePublicPath(siteSlug, publicPath);
  if (!isRetiredAidreamcapesPublicPath(siteSlug, publicPath) && !(siteSlug === "aidreamcapes" && aidreamcapesLegacyVideoSaveTheDatePath(publicPath))) return undefined;
  if (siteSlug === "aidreamcapes") return aidreamcapesNotFoundResponse(isGone ? 410 : 404);
  return new NextResponse(null, {
    status: isGone ? 410 : 404,
    headers: { "cache-control": "public, max-age=60" }
  });
}

function applyGrownstrideNoindex(response: Response, request: NextRequest): Response {
  if (isGrownstrideRequest(request)) response.headers.set("X-Robots-Tag", "noindex, nofollow");
  if (isNonProductionStorefrontRequest(request)) response.headers.set("X-Robots-Tag", "noindex, nofollow");
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
  // aidreamcapes.com/llms.txt is answered by an internal handler; every other host
  // keeps its usual handling for this path.
  if (hostSlug === "aidreamcapes" && upstreamUrl.pathname === "/llms.txt") {
    upstreamUrl.pathname = "/api/aidreamcapes/llms-txt";
    upstreamUrl.search = "";
    return upstreamUrl;
  }
  // Video watch pages are standalone routes for all three storefront hosts.
  // Keep them on the top-level App Router path so they do not fall through to
  // the database-backed storefront catch-all and lose their site-specific
  // video indexing contract.
  if (["mydreamshoots", "aidreamshoots", "aidreamcapes-eu"].includes(hostSlug) && upstreamUrl.pathname.startsWith("/watch/")) return upstreamUrl;
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

function aidreamcapesEuLegacyMediaRewrite(request: NextRequest): Response | undefined {
  if (request.method !== "GET" && request.method !== "HEAD") return undefined;
  const hostSlug = storefrontSlugForHost(request.headers.get("x-forwarded-host")) ?? storefrontSlugForHost(request.headers.get("host"));
  if (hostSlug !== "aidreamcapes-eu") return undefined;
  const targetPath = AIDREAMCAPES_EU_LEGACY_MEDIA_REDIRECTS[request.nextUrl.pathname];
  if (!targetPath) return undefined;

  const target = request.nextUrl.clone();
  target.pathname = targetPath;
  return NextResponse.rewrite(target);
}

async function storefrontIconResponse(request: NextRequest): Promise<Response | undefined> {
  if (request.method !== "GET" || !BROWSER_ICON_PATH_RE.test(request.nextUrl.pathname)) return undefined;

  const iconHref = siteIconForRequest(request);
  if (!iconHref) return undefined;

  const upstreamUrl = sameServerUrl(request);
  upstreamUrl.pathname = iconHref.favicon.split("?")[0] ?? iconHref.favicon;
  upstreamUrl.search = iconHref.favicon.includes("?") ? iconHref.favicon.split("?")[1] ?? "" : "";

  const upstreamResponse = await fetch(upstreamUrl, {
    headers: sanitizeUpstreamHeaders(new Headers({ [REORDER_SKIP_HEADER]: "1" }))
  });
  if (!upstreamResponse.ok) return undefined;

  const headers = new Headers(upstreamResponse.headers);
  headers.delete("content-length");
  headers.set("content-type", iconHref.favicon.split("?", 1)[0]?.endsWith(".svg") ? "image/svg+xml" : "image/png");
  headers.set("cache-control", "no-store, max-age=0");

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers
  });
}

// Aidreamcapes.com v2: retired v1 URLs move permanently to their closest v2 page.
// Only requests for the aidreamcapes.com host (or its /site/aidreamcapes path mode) match.
const AIDREAMCAPES_V2_REDIRECTS = new Map<string, string>(aidreamcapesSiteV2Redirects as [string, string][]);

function aidreamcapesV2Redirect(request: NextRequest): Response | undefined {
  const pathname = request.nextUrl.pathname.replace(/\/+$/, "") || "/";
  const pathMatch = pathname.match(/^\/site\/aidreamcapes(\/.*)?$/i);
  const hostSlug = storefrontSlugForHost(request.headers.get("x-forwarded-host")) ?? storefrontSlugForHost(request.headers.get("host"));
  if (hostSlug ? hostSlug !== "aidreamcapes" : !pathMatch) return undefined;
  const publicPath = pathMatch ? pathMatch[1] || "/" : pathname;
  const target = AIDREAMCAPES_V2_REDIRECTS.get(publicPath);
  if (!target) return undefined;
  const location = `${pathMatch && hostSlug !== "aidreamcapes" ? "/site/aidreamcapes" : ""}${target}${request.nextUrl.search}`;
  return NextResponse.redirect(publicRedirectUrlForRequest(request, location), 301);
}

export async function middleware(request: NextRequest) {
  const canonicalHostResponse = aidreamcapesCanonicalHostRedirect(request);
  if (canonicalHostResponse) return finalizeStorefrontResponse(canonicalHostResponse, request);
  const aidreamcapesV2RedirectResponse = aidreamcapesV2Redirect(request);
  if (aidreamcapesV2RedirectResponse) return finalizeStorefrontResponse(aidreamcapesV2RedirectResponse, request);
  const legacyGalleryRedirect = aidreamcapesLegacyGalleryRedirect(request);
  if (legacyGalleryRedirect) return finalizeStorefrontResponse(legacyGalleryRedirect, request);
  const retiredImageToolResponse = retiredAidreamcapesImageToolResponse(request);
  if (retiredImageToolResponse) return finalizeStorefrontResponse(retiredImageToolResponse, request);
  const trailingSlashResponse = aidreamcapesTrailingSlashRedirect(request);
  if (trailingSlashResponse) return finalizeStorefrontResponse(trailingSlashResponse, request);
  const workspaceRedirect = mydreamshootsWorkspaceRedirect(request);
  if (workspaceRedirect) return finalizeStorefrontResponse(workspaceRedirect, request);
  const legacySiteSlugRedirect = mydreamshootsLegacySiteSlugRedirect(request);
  if (legacySiteSlugRedirect) return finalizeStorefrontResponse(legacySiteSlugRedirect, request);
  const aidreamshootsUrbanRedirect = aidreamshootsUrbanCanonicalRedirect(request);
  if (aidreamshootsUrbanRedirect) return finalizeStorefrontResponse(aidreamshootsUrbanRedirect, request);
  const spanishXbyRedirect = spanishXbyCanonicalCollectionRedirect(request);
  if (spanishXbyRedirect) return finalizeStorefrontResponse(spanishXbyRedirect, request);
  const legacyPublicRedirect = mydreamshootsLegacyPublicRedirect(request);
  if (legacyPublicRedirect) return finalizeStorefrontResponse(legacyPublicRedirect, request);
  const unknownImageTheme = mydreamshootsUnknownImageThemeResponse(request);
  if (unknownImageTheme) return finalizeStorefrontResponse(unknownImageTheme, request);
  const legacyMediaRewrite = aidreamcapesEuLegacyMediaRewrite(request);
  if (legacyMediaRewrite) return applyGrownstrideNoindex(legacyMediaRewrite, request);
  const iconResponse = await storefrontIconResponse(request);
  if (iconResponse) return applyGrownstrideNoindex(iconResponse, request);

  const skipInternalRewrite = request.headers.get(REORDER_SKIP_HEADER) === "1";
  if (skipInternalRewrite) return applyGrownstrideNoindex(nextWithPathname(request), request);

  const redirectResponse = grownstrideLegacyHostRedirect(request) ?? aidreamcapesEuWwwRedirect(request) ?? aidreamcapesLegacyBlogRedirect(request) ?? canonicalPublicHostSitePathRedirect(request) ?? localDefaultStorefrontRedirect(request);
  if (redirectResponse) return finalizeStorefrontResponse(redirectResponse, request);
  if (!shouldRewriteStorefrontHtml(request)) return finalizeStorefrontResponse(nextWithPathname(request), request);

  const upstreamHeaders = new Headers(request.headers);
  upstreamHeaders.set(REORDER_SKIP_HEADER, "1");
  upstreamHeaders.set(
    "x-storefront-request-identity",
    `${request.nextUrl.pathname} ${request.headers.get("x-forwarded-host") ?? ""} ${request.headers.get("host") ?? ""}`
  );
  const imageThemeMatch = request.nextUrl.pathname.match(/^\/ai-image-generation\/([^/]+)$/);
  if (imageThemeMatch?.[1] && storefrontSlugForHost(request.headers.get("x-forwarded-host") ?? request.headers.get("host")) === "mydreamshoots") {
    upstreamHeaders.set(IMAGE_THEME_CONTEXT_HEADER, imageThemeMatch[1]);
  }
  const upstreamUrl = sameServerStorefrontUrl(request);
  const usesInternalSitePath = upstreamUrl.pathname.startsWith("/site/") && !request.nextUrl.pathname.startsWith("/site/");
  if (usesInternalSitePath) {
    upstreamHeaders.set(STOREFRONT_ROUTE_MODE_HEADER, "host");
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
  if (upstreamResponse.status === 404 && contentType.includes("text/html") && isAidreamcapesComPublicHtmlRequest(request)) {
    await upstreamResponse.body?.cancel();
    return finalizeStorefrontResponse(aidreamcapesNotFoundResponse(), request);
  }
  if (upstreamResponse.status >= 300 && upstreamResponse.status < 400) {
    const location = upstreamResponse.headers.get("location");
    if (location) return finalizeStorefrontResponse(NextResponse.redirect(publicRedirectUrlForRequest(request, location), upstreamResponse.status), request);
  }
  if (!upstreamResponse.ok || !contentType.includes("text/html")) return applyGrownstrideNoindex(upstreamResponse, request);

  const shouldReorder = shouldReorderStorefrontHead(request);
  const headers = new Headers(upstreamResponse.headers);
  headers.delete("content-length");
  applyStorefrontHtmlCacheHeaders(headers, request, upstreamResponse.headers);
  if (isFrenchXbyRequest(request)) {
    headers.set("content-language", "fr");
  } else if (isSpanishXbyRequest(request)) {
    headers.set("content-language", "es");
  }
  if (isGrownstrideRequest(request)) headers.set("X-Robots-Tag", "noindex, nofollow");

  // EU storefronts emit body-marker JSON-LD after the page body. Buffer their
  // public HTML so the existing full rewrite can relocate that schema into
  // <head>; otherwise the schema can remain only inside a React Flight payload
  // and is not exposed as crawlable JSON-LD in the response HTML. Aidreamcapes
  // .com has the same body-marker contract, so keep its public HTML buffered as
  // well. Keep other storefronts on their existing streaming path.
  const aboutUsRoute = /(?:^|\/)about-us\/?$/i.test(request.nextUrl.pathname);
  const aidreamcapesComPublicHtml = isAidreamcapesComPublicHtmlRequest(request);
  const mydreamshootsWatchHtml = (storefrontSlugForHost(request.headers.get("x-forwarded-host") ?? request.headers.get("host")) === "mydreamshoots" || request.nextUrl.pathname.startsWith("/site/mydreamshoots/watch/"))
    && /^(?:\/site\/mydreamshoots)?\/watch\//.test(request.nextUrl.pathname);
  const bufferSeoJsonLd = aboutUsRoute || aidreamcapesComPublicHtml || mydreamshootsWatchHtml || ((isSpanishXbyRequest(request) || isFrenchXbyRequest(request)) && !isPrivateStorefrontHtmlRequest(request));
  if (upstreamResponse.body && !bufferSeoJsonLd) {
    return finalizeStorefrontResponse(new Response(rewriteStorefrontHtmlStream(upstreamResponse.body, request, shouldReorder), {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers
    }), request);
  }

  const html = await upstreamResponse.text();
  return finalizeStorefrontResponse(new Response(rewriteStorefrontHtmlFull(html, request, shouldReorder, bufferSeoJsonLd), {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers
  }), request);
}

export const config = {
  // Keep static resources in the canonical-host redirect path. The request
  // still exits before HTML rewriting via INTERNAL_PATH_RE, so this only
  // enforces the non-www/HTTPS URL policy for assets and Next bundles.
  matcher: ["/((?!api).*)"]
};
