import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (relative) => readFileSync(path.join(root, relative), "utf8");

const themeRenderer = read("src/components/theme-renderer.tsx");
const instantLink = read("src/components/storefront/storefront-instant-link.tsx");
const routePrefetch = read("src/components/storefront/customer-route-prefetch.tsx");
const showcasePreview = read("src/components/storefront/dreamshoot-showcase-preview.tsx");
const layout = read("src/app/layout.tsx");
const pricingTable = read("src/components/storefront/pricing-billing-table.tsx");
const pricingInteractive = read("src/components/storefront/pricing-billing-interactive.tsx");
const partnerForm = read("src/components/storefront/partner-application-form.tsx");
const showcaseVideo = read("src/components/storefront/dreamshoot-showcase-video.tsx");
const showcaseRail = read("src/components/storefront/dreamshoot-showcase-rail.tsx");
const lazyVideo = read("src/components/storefront/lazy-storefront-video.tsx");
const headerMegaPanels = read("src/components/storefront/header-mega-menu-panels.tsx");
const jsonLd = read("src/components/storefront/storefront-json-ld.tsx");
const navigationFeedback = read("src/components/storefront/navigation-feedback.tsx");
const nativeMegaMenu = read("src/components/storefront/native-mega-menu.tsx");
const clickMegaMenu = read("src/components/storefront/click-mega-menu.tsx");
const sectionApi = read("src/app/api/site-slugs/[siteSlug]/storefront-section/route.ts");
const hostCatchAll = read("src/app/[...path]/page.tsx");
const sectionPage = read("src/app/site/[siteSlug]/%5F%5Fsection/[sectionId]/page.tsx");

assert.doesNotMatch(themeRenderer, /import .*LazyStorefrontSection|<LazyStorefrontSection\b/, "public renderer must not mount lazy section API fetches");
assert.doesNotMatch(themeRenderer, /<CustomerRoutePrefetch/, "public renderer must not mount route prefetchers");
assert.match(themeRenderer, /ClickMegaMenu/, "public navigation must use the controlled mega menu");
assert.match(themeRenderer, /disablePrefetch=\{disablePublicSeoPrefetch\}/, "public mega menus must disable route prefetching on public SEO pages");
for (const route of [
  'pagePath === "/"',
  'pagePath === "/pricing"',
  'pagePath === "/collections"',
  'pagePath === "/ai-image-generation"',
  'pagePath === "/tools"',
  'pagePath === "/ai-video-generation"',
  'pagePath === "/faq"',
  'pagePath === "/workflow"',
  'pagePath === "/blog"',
  'pagePath === "/creators-circle"',
  'pagePath === "/partner-registration"',
  'pagePath === "/best-packages"',
  'pagePath === "/best-ai-image"',
  'pagePath === "/best-ai-video"',
  'pagePath === "/best-save-the-date"',
  'pagePath === "/about-us"',
  'pagePath === "/contact-us"',
  'pagePath === "/privacy"',
  'pagePath === "/terms"',
  'pagePath === "/cookies"',
  'pagePath === "/refunds"',
  'pagePath === "/content"',
  'pagePath === "/shipping"',
  'pagePath === "/children-privacy"',
  'pagePath === "/state-privacy"',
  'pagePath.startsWith("/ai-video-generation/")',
  'pagePath.startsWith("/ai-save-the-date/")',
  'pagePath.startsWith("/holidays-events/")',
  'pagePath.startsWith("/ai-image-generation/")',
  'pagePath.startsWith("/collections/")',
  'pagePath.startsWith("/tools/")',
  'pagePath.startsWith("/blog/")',
  'pagePath === "/policies/privacy"',
  'pagePath === "/policies/terms"'
]) {
  assert.ok(themeRenderer.includes(route), `public SSR inventory must include ${route}`);
}
assert.match(themeRenderer, /pagePath\.startsWith\("\/holidays-events\/"\)/, "holiday detail routes must be in the public SSR inventory");
assert.match(themeRenderer, /pagePath\.startsWith\("\/ai-save-the-date\/"\)/, "Save the Date detail routes must be in the public SSR inventory");
assert.doesNotMatch(instantLink, /useRouter|router\.prefetch|\bfetch\s*\(/, "public links must use ordinary document navigation");
assert.doesNotMatch(routePrefetch, /useEffect|useRouter|\bfetch\s*\(/, "public route prefetch component must be inert");
assert.doesNotMatch(showcasePreview, /use client|useEffect|document\.|window\./, "public media preview must be server-only");
assert.match(themeRenderer, /<StorefrontNavigationFeedback\s*\//, "public renderer must show native navigation feedback");
assert.doesNotMatch(navigationFeedback, /\bfetch\s*\(|useRouter|router\.prefetch|customer\/runtime|customer\/bootstrap/, "navigation feedback must remain presentation-only");
assert.doesNotMatch(nativeMegaMenu, /use client|useEffect|document\.|window\./, "public mega menu must use native details behavior");
assert.match(clickMegaMenu, /document\.addEventListener\("pointerdown", handlePointerDown, true\)/, "controlled mega menu must close when clicking outside");
assert.doesNotMatch(layout, /HtmlLangSync/, "public root layout must not mount client language synchronization");
assert.equal(existsSync(path.join(root, "src/components/storefront/html-lang-sync.tsx")), false, "legacy public language sync component must be removed");
assert.doesNotMatch(pricingTable, /use client|useState|useMemo/, "public pricing must be server-rendered");
assert.match(pricingTable, /PricingBillingInteractive/, "public pricing server entry must render the interactive presentation layer");
assert.doesNotMatch(pricingInteractive, /\bfetch\s*\(|XMLHttpRequest|EventSource|customer\/runtime|customer\/bootstrap/, "public pricing interaction must use server-provided data");
assert.doesNotMatch(partnerForm, /use client|\bonSubmit=|\bfetch\s*\(/, "public partner form must use native form submission");
assert.doesNotMatch(showcaseVideo, /use client|useEffect|IntersectionObserver|\.play\s*\(/, "public showcase video must use native HTML media");
assert.match(showcaseRail, /use client/, "public showcase rail may use a client-only presentation layer");
assert.match(showcaseRail, /requestAnimationFrame/, "public showcase rail must retain automatic presentation motion");
assert.doesNotMatch(showcaseRail, /\b(?:fetch|XMLHttpRequest|EventSource)\b/, "public showcase rail must not fetch data from the browser");
assert.doesNotMatch(lazyVideo, /use client|useEffect|IntersectionObserver|\.play\s*\(/, "public video must not use client lazy-loading controls");
assert.doesNotMatch(headerMegaPanels, /^\s*["']use client["'];/m, "public mega menu panels must remain server components");
assert.doesNotMatch(jsonLd, /use client|useServerInsertedHTML|useRef/, "public JSON-LD must be emitted by the server component");
assert.equal(existsSync(path.join(root, "src/components/storefront/lazy-storefront-section.tsx")), false, "legacy public lazy section fetcher must be removed");
assert.match(themeRenderer, /publicStorefrontPage\s*=\s*false/, "header must receive an explicit public storefront boundary");
assert.match(themeRenderer, /!publicStorefrontPage\s*&&\s*runtime\?\.clientBootstrapCustomer/, "customer bootstrap must be private-only");
assert.match(hostCatchAll, /slug:\s*(?:pageSlug|renderPageSlug),[\s\S]{0,320}deferCustomerRuntime:\s*true/, "host public pages must defer customer runtime");
assert.match(sectionPage, /headers\(\)/, "section preview route must inspect request headers");
assert.match(sectionPage, /x-storefront-preview/, "section preview route must require an explicit preview marker");
assert.match(sectionPage, /index:\s*false/, "section preview route must be noindex");
assert.match(sectionApi, /x-storefront-preview/, "section API must require an explicit preview marker");
assert.match(sectionApi, /public_section_fetch_disabled/, "public section API calls must be rejected");

console.log(JSON.stringify({ ok: true, rule: "public-storefront-ssr-only" }));
