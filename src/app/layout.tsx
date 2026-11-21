import type { Metadata } from "next";
import { headers } from "next/headers";
import { isSpanishStorefrontRequestIdentity } from "@/lib/spanish-storefronts";
import { storefrontLocaleForRequestIdentity } from "@/lib/storefront-locale";
import { aidreamcapesV2ThemeCssHref } from "@/components/storefront/aidreamcapes-v2/styles";
import { ChunkLoadRecovery } from "@/components/storefront/chunk-load-recovery";
import { ClientErrorReporter } from "@/components/storefront/client-error-reporter";
import "./globals.css";

/**
 * Runs before React hydrates, so an exception thrown during hydration (which
 * replaces the page with Next's global error screen before ClientErrorReporter
 * can mount) still reaches the service journal. It only posts the message,
 * stack, page URL and user agent; no cookies, no identifiers. Chunk-load
 * failures are left to ChunkLoadRecovery.
 */
const EARLY_ERROR_BEACON = `(function(){try{
var sent=0,limit=8,seen={};
function report(kind,message,stack){try{
if(!message||/ChunkLoadError|Loading chunk |Failed to fetch dynamically imported module|Importing a module script failed/i.test(message))return;
var key=kind+':'+message;if(seen[key]||sent>=limit)return;seen[key]=1;sent++;
fetch('/api/client-errors',{method:'POST',headers:{'content-type':'application/json'},keepalive:true,
body:JSON.stringify({kind:kind,message:String(message).slice(0,600),stack:String(stack||'').slice(0,4000),url:location.href,userAgent:navigator.userAgent})}).catch(function(){});
}catch(e){}}
window.addEventListener('error',function(e){try{
if(e&&e.target&&e.target!==window&&(e.target.src||e.target.href))return;
var err=e&&e.error;report('early-error',(e&&e.message)||(err&&err.message)||'',err&&err.stack||'');
}catch(x){}},true);
window.addEventListener('unhandledrejection',function(e){try{
var reason=e&&e.reason;var msg=typeof reason==='string'?reason:(reason&&reason.message)||String(reason||'');
report('early-rejection',msg,(reason&&reason.stack)||'');
}catch(x){}});
}catch(e){}})();`;

/**
 * The fallback description of a route that has no description of its own.
 *
 * The default describes the platform that runs the storefronts, which is
 * internal information and must not appear on a customer's page. The
 * Aidreamcapes storefront therefore gets copy that describes what a visitor
 * does there, and every other store keeps the text it had.
 */
export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = (requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "")
    .split(",")[0]
    ?.trim()
    .toLowerCase()
    .split(":")[0] ?? "";
  if (host === "www.aivideosugc.com" || host === "aivideosugc.com") {
    return {
      title: "AIVideosUGC",
      description: "Create AI UGC video ads and product photos from a product link, an image or a prompt."
    };
  }
  return {
    title: "AI Subscription Platform",
    description: "Multi-site AI subscription platform with store-style theme designer."
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "";
  const requestIdentity = `${host} ${requestHeaders.get("x-storefront-request-identity") ?? ""}`;
  const language = storefrontLocaleForRequestIdentity(requestIdentity) === "fr"
    ? "fr"
    : isSpanishStorefrontRequestIdentity(requestIdentity)
      ? "es"
      : "en";
  const isAidreamcapesHost = /^(?:www\.)?(?:aivideosugc|aidreamcapes)\.com$/i.test(
    host.split(",")[0]?.trim().toLowerCase().split(":")[0] ?? ""
  );
  const aidreamcapesThemeCssHref = isAidreamcapesHost ? aidreamcapesV2ThemeCssHref() : undefined;
  return (
    {/* translate="no" keeps Chrome's auto-translate from rewriting text nodes
      * before React hydrates: pre-hydration mutation throws React #418 and the
      * client render then blanks the main content (2026-11-21, 17 occurrences
      * in one day, all on the storefront root). Manual translation from the
      * address bar still works because it mutates after hydration. The
      * chat-page incident on 2026-11-14 was the same family, fixed per-page. */}
    <html lang={language} suppressHydrationWarning translate="no">
      <head>
        <script dangerouslySetInnerHTML={{ __html: EARLY_ERROR_BEACON }} />
        <meta httpEquiv="Content-Language" content={language} />
        {/* The storefront theme stylesheet must be requested with the document:
          * when it arrives after the first paint, the unstyled shell reflows
          * (measured as CLS on throttled connections). The page still renders
          * the same link; React dedupes it by URL. */}
        {aidreamcapesThemeCssHref ? <link rel="stylesheet" precedence="high" href={aidreamcapesThemeCssHref} /> : null}
        {/* Fonts are self-hosted subsets of the previous Google Fonts css2
          * response (latin and latin-ext only; the storefront copy is English,
          * and Spanish accents sit inside the latin range). Same-origin fonts
          * drop the two cross-origin connection chains that used to sit in the
          * render-blocking critical path. Outfit is the v2 theme's single text
          * family, so its latin file is preloaded. */}
        <link rel="preload" href="/fonts/outfit-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="stylesheet" href="/fonts/aivideosugc-fonts.css?v=20261121" />
      </head>
      <body translate="no">
        <ChunkLoadRecovery />
        <ClientErrorReporter />
        {children}
      </body>
    </html>
  );
}
