import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const TARGET_SITE_PATH_RE = /^\/site\/(?:aidreamcapes|mydreamshoots)(?:\/|$)/i;
const TARGET_HOST_RE = /(?:^|\.)((aidreamcapes|mydreamshoots)\.com)$/i;
const INTERNAL_PATH_RE = /^\/(?:api|assets|_next\/static|_next\/image|favicon\.ico|robots\.txt|sitemap\.xml)(?:\/|$)/i;
const PRIVATE_STORE_PATH_RE = /^\/site\/(?:aidreamcapes|mydreamshoots)\/(?:admin|app|account|login|register|reset-password|checkout)(?:\/|$)/i;
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

const SEO_HEAD_TAG_RE =
  /<title\b[^>]*>[\s\S]*?<\/title>|<meta\b(?=[^>]*(?:name=["'](?:description|keywords|robots|twitter:(?:card|title|description|image))["']|property=["']og:(?:title|description|url|site_name|image)["']))[^>]*\/?>|<link\b(?=[^>]*rel=["']canonical["'])[^>]*\/?>/gi;

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

function shouldReorderStorefrontHead(request: NextRequest): boolean {
  if (request.method !== "GET") return false;
  if (request.headers.get(REORDER_SKIP_HEADER) === "1") return false;
  const pathname = request.nextUrl.pathname;
  if (INTERNAL_PATH_RE.test(pathname) || PRIVATE_STORE_PATH_RE.test(pathname)) return false;

  const accept = request.headers.get("accept") ?? "";
  if (accept && !accept.includes("text/html") && !accept.includes("*/*")) return false;

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  return TARGET_SITE_PATH_RE.test(pathname) || TARGET_HOST_RE.test(host);
}

function leadingRequiredHeadLength(headContent: string): number {
  const leadingMetaRe = /^(?:\s*<meta\b(?=[^>]*(?:charset=|name=["']viewport["']))[^>]*\/?>)*/i;
  return headContent.match(leadingMetaRe)?.[0].length ?? 0;
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
  if (!seoTags.length) return html;

  const insertionPoint = leadingRequiredHeadLength(strippedHead);
  const reorderedHead = `${strippedHead.slice(0, insertionPoint)}${seoTags.join("")}${strippedHead.slice(insertionPoint)}`;
  return `${beforeHeadContent}${reorderedHead}${afterHeadContent}`;
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

export async function middleware(request: NextRequest) {
  const redirectResponse = aidreamcapesCollectionRedirect(request);
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
  const rewrittenHtml = moveSeoTagsBeforeResources(html);
  const headers = new Headers(upstreamResponse.headers);
  headers.delete("content-length");
  headers.set("x-storefront-head-seo-reordered", "1");

  return new Response(rewrittenHtml, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers
  });
}

export const config = {
  matcher: ["/((?!api|assets|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"]
};
