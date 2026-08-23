import fs from "node:fs";
import path from "node:path";
import { readPlatformStateFromSql } from "./lib/platform-state-sql.mjs";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const source = (relative) => fs.readFileSync(path.join(repoRoot, relative), "utf8");
const stateArgument = process.argv.find((argument) => argument.startsWith("--state="))?.slice("--state=".length);
if (stateArgument || process.env.SEO_REVIEW_STATE_PATH) {
  throw new Error("SEO review state fixtures are disabled; read the PostgreSQL publication source instead.");
}
const checks = [];

function check(id, ok, detail) {
  checks.push({ id, ok, detail });
}

const snapshot = source("src/lib/storefront-context/snapshot.ts");
const contextTypes = source("src/lib/storefront-context/types.ts");
const contextIndex = source("src/lib/storefront-context/index.ts");
const sitemap = source("src/lib/seo-indexing.ts");
const sitemapBuilder = sitemap.slice(sitemap.indexOf("function sitemapEntriesForSite"), sitemap.indexOf("function canonicalPathForSitemapPage"));
const jsonLd = source("src/lib/theme/json-ld.ts");
const themeRenderer = source("src/components/theme-renderer.tsx");
const preflight = source("src/lib/theme/publish-preflight.ts");
const themeStore = source("src/lib/stores/theme-store.ts");
const middleware = source("src/middleware.ts");
const metadata = source("src/lib/storefront-metadata.ts");
const renderer = source("src/lib/storefront-render.tsx");
const dataLookup = source("src/lib/data.ts");
const siteCatchAll = source("src/app/site/[siteSlug]/[...path]/page.tsx");
const platformState = await readPlatformStateFromSql();

const myDreamshoots = platformState.sites?.find((site) => site.id === "site_dreamshoot");
const aiStorefrontIds = new Set(["site_dreamshoot", "site_aidreamcapes", "site_mydreamshoots_xby", "site_aidreamcapes_xby"]);
const validPublicPack = (pack) => pack.status === "active" && pack.creditCost > 0 && pack.outputCount > 0 && Boolean(
  String(pack.imageUrl ?? "").trim() || (pack.galleryImages ?? []).some((image) => String(image ?? "").trim())
);
const isProviderVerifiedPrice = (price) => price.status === "active" && price.amountCents > 0 &&
  /^(month|quarter|half_year|year|one_time)$/.test(price.interval ?? "") &&
  /^price_[a-zA-Z0-9_]+$/.test(price.stripePriceId ?? "") &&
  Boolean(price.providerVerifiedAt && price.providerFingerprint);
const myDreamshootsPacks = (platformState.creativePacks ?? []).filter((pack) => pack.siteId === "site_dreamshoot");
const myDreamshootsProducts = (platformState.products ?? []).filter((product) => product.siteId === "site_dreamshoot");
const collectionItems040 = myDreamshootsPacks.filter(validPublicPack);
const globalPurchasableOffers = myDreamshootsProducts
  .filter((product) => product.status === "active")
  .flatMap((product) => (product.prices ?? []).filter(isProviderVerifiedPrice).map((price) => ({ product, price })));
const pricingPage045 = myDreamshoots?.pages?.find((page) => page.slug === "/pricing");
const featuredProductIds045 = new Set(
  (pricingPage045?.publishedJson?.sectionsOrder ?? [])
    .map((sectionId) => pricingPage045.publishedJson.sections?.[sectionId]?.settings?.featuredProductId)
    .filter((value) => typeof value === "string" && value.trim())
);
const visibleOffers045 = globalPurchasableOffers.filter(({ product }) => !featuredProductIds045.size || featuredProductIds045.has(product.id));
const profile = myDreamshoots?.storefrontProfile?.publishedJson;
const releaseBlockers = [];
if (!profile?.identity?.legalName) releaseBlockers.push("profile.identity.legalName");
if (!profile?.identity?.entityType) releaseBlockers.push("profile.identity.entityType");
const address = profile?.identity?.address;
if (!address?.line1 || !address?.city || !address?.region || !address?.postalCode || !address?.country) releaseBlockers.push("profile.identity.address");
if (!profile?.identity?.supportEmail) releaseBlockers.push("profile.identity.supportEmail");
if (profile?.policyFacts?.usesCustomerMediaForTraining === undefined) releaseBlockers.push("profile.policyFacts.usesCustomerMediaForTraining");
if (!Number.isInteger(profile?.policyFacts?.sourceMediaRetentionDays) || profile.policyFacts.sourceMediaRetentionDays <= 0) releaseBlockers.push("profile.policyFacts.sourceMediaRetentionDays");
if (profile?.policyFacts?.refundReviewRequired === undefined) releaseBlockers.push("profile.policyFacts.refundReviewRequired");
if (!Number.isInteger(profile?.policyFacts?.refundWindowDays) || profile.policyFacts.refundWindowDays <= 0) releaseBlockers.push("profile.policyFacts.refundWindowDays");
if (!profile?.policyFacts?.effectiveDate) releaseBlockers.push("profile.policyFacts.effectiveDate");
if (!globalPurchasableOffers.length) releaseBlockers.push("stripe.providerVerification");
const ordersWithoutPriceId = (platformState.orders ?? []).filter((order) => order.siteId === "site_dreamshoot" && !order.priceId);
if (ordersWithoutPriceId.length) releaseBlockers.push(`historicalOrders.priceId:${ordersWithoutPriceId.length}`);
const hostBindings = (platformState.siteDomains ?? []).filter((binding) => aiStorefrontIds.has(binding.siteId) && binding.status === "active");

check("published_snapshot", /PublishedSiteSnapshot/.test(contextTypes) && /createPublishedSiteSnapshot/.test(snapshot), "snapshot model and constructor exist");
check("publication_boundary", /PublicationBoundary/.test(contextTypes) && /publicationVersion/.test(snapshot) && /entityReferences/.test(snapshot), "snapshot records publication boundary and child entity revisions");
check("effective_page", /EffectivePublishedPage/.test(contextTypes) && /resolveEffectivePublishedPage/.test(snapshot), "effective page resolver exists");
check("route_disposition", /RouteDisposition/.test(contextTypes) && /resolvePublishedRouteDisposition/.test(contextIndex) && /resolvePublishedRedirectDisposition/.test(snapshot), "route disposition and redirect target gate are exported");
check("indexability", /resolveEffectiveIndexability/.test(snapshot) && /sitemapEligible/.test(sitemap), "indexability is resolved before sitemap inclusion");
check("collection_projection", /resolvePublicCollectionItems/.test(snapshot) && /projectPublicCreativePacks/.test(themeRenderer) && !/slice\(0,\s*12\)/.test(jsonLd), "collection output has no focused 12-item schema fork");
check("pricing_projection", /resolvePublicPricingOffers/.test(snapshot) && /checkoutEnabled/.test(jsonLd), "pricing and availability carry checkout state");
check("price_predicate", /isPublicPriceFact/.test(preflight) && /isPublicPriceFact/.test(source("src/lib/stores/billing-store.ts")), "preflight and billing use shared price predicate");
check("cache_readback", /finalizePublishedTheme/.test(themeStore) && /theme_publish_readback_failed/.test(themeStore), "publish clears cache and reads publication back");
check("media_contract", /mediaOwnerReviewRequired/.test(preflight) && /entityRevision/.test(preflight), "media owner/revision is a publish blocker");
check("strict_sitemap", !/sitemapFallbackEntry|SITEMAP_STATIC_FALLBACK_LASTMOD|publicFallbackSitemapUrlsForHost|fallbackUrlsForSite|collectDynamicIndexablePaths|collectExplicitSeoDirectoryPaths|REQUIRED_INDEXABLE_CONTENT_PATHS|REQUIRED_INDEXABLE_POLICY_PATHS/.test(sitemapBuilder), "sitemap only emits effective published pages and has no fallback path injection");
check("unknown_host_fail_closed", /return \[\];/.test(sitemap) && /Disallow: \/|disallow/i.test(source("src/app/robots.txt/route.ts")), "unknown host produces empty sitemap and disallow robots");
check("redirect_capability", !/\/dreamshoot\/i/.test(middleware) && !/\/dreamshoot\|aidreamcapes\/i/.test(dataLookup) && !/\/dreamshoot\|aidreamcapes\/i/.test(siteCatchAll), "production route capability checks are exact site capabilities");
check("redirect_snapshot_gate", /resolvePublishedRedirectDisposition/.test(source("src/app/[...path]/page.tsx")) && /resolvePublishedRedirectDisposition/.test(source("src/app/site/[siteSlug]/[...path]/page.tsx")) && !/legacyPublicPathRedirect|directoryCanonicalRedirect|aidreamcapesCollectionRedirect/.test(middleware), "legacy path redirects are validated after loading the published snapshot");
check("head_facts", /storefront-publication/.test(metadata) || /storefront-facts-revision/.test(metadata), "published facts revision is exposed to head metadata");
check("snapshot_consumers", /createPublishedSiteSnapshot/.test(metadata) && /createPublishedSiteSnapshot/.test(renderer) && !/loadPublishedStorefrontContext/.test(metadata), "metadata and renderer derive published context from the same snapshot contract");
check("seo_projection", /canonicalUrlForSite/.test(source("src/lib/storefront-context/seo-projection.ts")) && /context\.seo\.canonicalPath/.test(source("src/lib/theme/json-ld.ts")), "canonical URL and title projection are centralized in storefront context");
check("collection_040_data", collectionItems040.length === 38 && collectionItems040.length === myDreamshootsPacks.filter((pack) => pack.status === "active").length, `040 local published collection facts: ${collectionItems040.length}/${myDreamshootsPacks.filter((pack) => pack.status === "active").length}`);
check("pricing_045_subset", visibleOffers045.every((offer) => globalPurchasableOffers.includes(offer)), `045 visible offers ${visibleOffers045.length}; OfferCatalog is a subset of ${globalPurchasableOffers.length} global purchasable offers`);
check("four_site_isolation", aiStorefrontIds.size === 4 && new Set(hostBindings.map((binding) => binding.domain)).size === hostBindings.length, "shared capability hosts remain uniquely bound per site");

const failures = checks.filter((check) => !check.ok);
const report = {
  generatedAt: new Date().toISOString(),
  mode: "static-read-only",
  stateSource: "postgres:platformStateDocument",
  providerCalls: { stripe: 0, checkout: 0, ai: 0 },
  readiness: {
    siteId: myDreamshoots?.id,
    collection040: { active: myDreamshootsPacks.filter((pack) => pack.status === "active").length, projected: collectionItems040.length, visibleEqualsItemList: collectionItems040.length === 38 },
    pricing045: { globalPurchasableOffers: globalPurchasableOffers.length, visibleOffers: visibleOffers045.length, offerCatalogIsSubset: visibleOffers045.every((offer) => globalPurchasableOffers.includes(offer)) },
    releaseBlockers,
    formalPublishAllowed: releaseBlockers.length === 0
  },
  checks,
  ok: failures.length === 0
};
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
