#!/usr/bin/env node
import assert from "node:assert/strict";
import Module from "node:module";
import path from "node:path";
import createJiti from "jiti";

const repoRoot = process.cwd();
const sourceRoot = path.join(repoRoot, "src");
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveFilename(request, ...args) {
  const resolvedRequest = request.startsWith("@/") ? path.join(sourceRoot, request.slice(2)) : request;
  return originalResolveFilename.call(this, resolvedRequest, ...args);
};

const jiti = createJiti(import.meta.url);
const { projectPublicCreativePacks, projectPublicPricingOffers, resolveStorefrontBindings, resolveStorefrontContext, selectOfferPrice } = jiti("../src/lib/storefront-context/core.ts");
const { canonicalUrlForSite, storefrontBaseUrl } = jiti("../src/lib/storefront-context/seo-projection.ts");
const { metadataForSingleThemePage } = jiti("../src/lib/theme/seo.ts");
const { buildStorefrontJsonLd } = jiti("../src/lib/theme/json-ld.ts");

const pageSeo = {
  title: "Page-owned title",
  description: "Page-owned description",
  keywords: "page-owned keyword one, page-owned keyword two",
  canonicalPath: "/",
  robots: { index: true, follow: true }
};
const pageJson = {
  pageType: "home",
  version: 3,
  sectionsOrder: ["featured_plan"],
  sections: {
    featured_plan: {
      type: "pricing",
      settings: { featuredProductId: "product_subscription", defaultBillingCycle: "quarter" }
    }
  },
  seo: pageSeo
};
const profile = {
  identity: {
    legalName: "Verified Example LLC",
    entityType: "LLC",
    address: { line1: "1 Test Way", city: "Dover", region: "DE", postalCode: "19901", country: "US" },
    supportEmail: "support@example.test",
    sameAs: ["https://example.test/social"]
  },
  policyFacts: {
    usesCustomerMediaForTraining: false,
    sourceMediaRetentionDays: 30,
    refundReviewRequired: true,
    refundWindowDays: 30,
    effectiveDate: "2026-08-18"
  }
};
const monthlyPrice = {
  id: "price_monthly",
  siteId: "site_test",
  productId: "product_subscription",
  label: "Monthly",
  amountCents: 2450,
  currency: "usd",
  interval: "month",
  creditsGranted: 200,
  stripePriceId: "price_verified_monthly",
  status: "active",
  effectiveFrom: "2026-01-01T00:00:00.000Z",
  providerVerifiedAt: "2026-08-18T00:00:00.000Z",
  providerFingerprint: "verified-monthly"
};
const unverifiedQuarter = {
  ...monthlyPrice,
  id: "price_quarter",
  label: "Quarterly",
  interval: "quarter",
  amountCents: 6000,
  stripePriceId: "price_unverified_quarter",
  providerVerifiedAt: undefined,
  providerFingerprint: undefined
};
const bundle = {
  site: {
    id: "site_test",
    name: "Test Store",
    slug: "test-store",
    status: "active",
    primaryDomain: "example.test",
    currency: "usd",
    timezone: "UTC",
    signupCreditGrant: 0,
    branding: { logoText: "Test Store", market: "Test", description: "Site fallback must not replace page SEO." },
    connect: { stripeAccountId: "acct_test", status: "enabled", chargesEnabled: true, payoutsEnabled: true },
    themeSettings: {
      draftJson: {
        colors: {}, typography: {}, radii: {}, navigation: { headerLinks: [], footerLinks: [] },
        seo: {
          siteTitle: "Test Store",
          siteDescription: "Global description",
          titleTemplate: "%s | Test Store",
          robots: { index: true, follow: true },
          pages: { page_home: { title: "Conflicting settings title", description: "Conflicting settings description" } }
        }
      },
      publishedJson: {
        colors: {}, typography: {}, radii: {}, navigation: { headerLinks: [], footerLinks: [] },
        seo: {
          siteTitle: "Test Store",
          siteDescription: "Global description",
          titleTemplate: "%s | Test Store",
          robots: { index: true, follow: true },
          pages: { page_home: { title: "Conflicting settings title", description: "Conflicting settings description" } }
        }
      }
    },
    storefrontProfile: { id: "profile_test", siteId: "site_test", draftJson: profile, publishedJson: profile },
    pages: []
  },
  page: {
    id: "page_home",
    siteId: "site_test",
    pageType: "home",
    slug: "/",
    title: "Home",
    draftJson: pageJson,
    publishedJson: pageJson
  },
  products: [{
    id: "product_subscription",
    siteId: "site_test",
    name: "Starter",
    type: "subscription",
    status: "active",
    prices: [monthlyPrice, unverifiedQuarter]
  }],
  creativePacks: [
    { id: "pack_valid", siteId: "site_test", name: "Valid", headline: "Valid", description: "Valid", category: "Test", aiAppSlug: "test", status: "active", creditCost: 12, outputCount: 4, trainingRequired: false, generationCount: 0, conversionRate: 0 },
    { id: "pack_invalid", siteId: "site_test", name: "Invalid", headline: "Invalid", description: "Invalid", category: "Test", aiAppSlug: "test", status: "active", creditCost: 0, outputCount: 0, trainingRequired: false, generationCount: 0, conversionRate: 0 }
  ],
  publication: { id: "publication_test", siteId: "site_test", version: 1, snapshot: { pages: [], themeSettings: {} }, publishedBy: "test", publishedAt: "2026-08-18T00:00:00.000Z" },
  buildId: "test-build"
};

const context = resolveStorefrontContext(bundle, "published", { now: new Date("2026-08-18T12:00:00.000Z") });
assert.equal(canonicalUrlForSite(bundle.site, "/"), "https://example.test/", "the canonical root URL must preserve the trailing slash");
assert.equal(canonicalUrlForSite(bundle.site, "/pricing"), "https://example.test/pricing", "non-root canonical paths must remain slashless");
assert.equal(storefrontBaseUrl(bundle.site), "https://example.test/", "the host storefront base URL must preserve the trailing slash");
assert.equal(context.seo.title, "Page-owned title | Test Store", "page SEO should own the title");
assert.equal(context.seo.description, "Page-owned description", "ThemeSettings page map must not override page SEO");
assert.equal(context.offers.active.length, 1, "only verified active effective prices should be public");
assert.equal(context.offers.lowestPublicMonthlySubscriptionPrice?.formattedPrice, "$24.50");
assert.equal(context.offers.active.some((offer) => offer.price.interval === "quarter"), false, "missing quarterly verification must not fall back to monthly");
assert.equal(selectOfferPrice(context, "product_subscription", "quarter"), undefined, "selected quarterly offer must stay hidden when that billing cycle is unavailable");
assert.equal(context.offers.selectedOfferPrice, undefined, "page-selected quarterly offer must not fall back to the monthly offer");
assert.equal(projectPublicPricingOffers(context).length, 1, "pricing projection must exclude unavailable billing cycles and unshown topups");
assert.equal(context.catalog.activeImageWorkflowCount, 1, "invalid packs must not inflate public counts");
assert.equal(projectPublicCreativePacks(context).length, 1, "collection projection must exclude invalid packs");
assert.deepEqual(context.catalog.invalidPacks.map((pack) => pack.id), ["pack_invalid"]);
assert.equal(resolveStorefrontBindings("Plans start at {LIVE_LOWEST_ACTIVE_PLAN_PRICE}.", context).value, "Plans start at $24.50.");
assert.equal(resolveStorefrontBindings("No AI training on your photos - Your inputs are never used to train models.", context).value, undefined, "legacy policy claims must not bypass typed bindings");
assert.deepEqual(resolveStorefrontBindings("30-day auto-delete.", context).missing, ["LEGACY_RETENTION_POLICY_CLAIM"]);
assert.equal(resolveStorefrontBindings("Training policy - {LIVE_TRAINING_POLICY_STATEMENT}", context).value, "Training policy - Customer media is not used to train models.");
const livePageContext = {
  ...context,
  snapshotIntegrity: "valid",
  revisions: { ...context.revisions, snapshotRevision: undefined }
};
assert.equal(
  resolveStorefrontBindings("No AI training on your photos - Your inputs are never used to train models.", livePageContext).value,
  "No AI training on your photos - Your inputs are never used to train models.",
  "verified SQL-backed LivePage content must render without a historical snapshot revision"
);
const metadata = metadataForSingleThemePage(bundle.site, bundle.page, context);
assert.equal(metadata.description, context.seo.description);
assert.equal(metadata.keywords, context.seo.keywords, "page keywords must reach Next metadata output");
assert.equal(metadata.openGraph.description, context.seo.description);
assert.equal(metadata.twitter.description, context.seo.description);
const homeGraph = buildStorefrontJsonLd({ site: bundle.site, page: bundle.page, pageJson, pagePath: "/", routeMode: "host", context })[0]["@graph"];
assert.equal(context.seo.canonicalUrl, "https://example.test/", "homepage context canonical URL must preserve the trailing slash");
assert.equal(homeGraph.find((node) => node["@type"] === "Organization").url, "https://example.test/", "Organization URL must use the canonical root URL");
assert.equal(homeGraph.find((node) => node["@type"] === "Organization")["@id"], "https://example.test/#organization", "Organization ID must use the canonical root URL");
assert.equal(homeGraph.find((node) => node["@type"] === "WebSite").url, "https://example.test/", "WebSite URL must use the canonical root URL");
assert.equal(homeGraph.find((node) => node["@type"] === "WebSite")["@id"], "https://example.test/#website", "WebSite ID must use the canonical root URL");
assert.equal(homeGraph.find((node) => node["@type"] === "SoftwareApplication").url, "https://example.test/", "homepage SoftwareApplication URL must use the canonical root URL");
assert.equal(homeGraph.find((node) => node["@type"] === "SoftwareApplication")["@id"], "https://example.test/#app", "homepage SoftwareApplication ID must use the canonical root URL");
assert.equal(homeGraph.find((node) => node["@type"] === "BreadcrumbList").itemListElement[0].item, "https://example.test/", "homepage breadcrumb root must use the canonical root URL");
assert.equal(homeGraph.find((node) => node["@type"] === "SoftwareApplication").description, context.seo.description, "JSON-LD page description must serialize the resolved context");
assert.equal(homeGraph.find((node) => node["@type"] === "Organization").name, bundle.site.branding.logoText, "Organization JSON-LD must use the single display-brand source");
assert.equal(homeGraph.find((node) => node["@type"] === "Organization").legalName, profile.identity.legalName, "Organization JSON-LD must serialize the resolved profile");

const replacementBundle = structuredClone(bundle);
replacementBundle.page.slug = "/pricing";
replacementBundle.page.pageType = "pricing";
replacementBundle.page.publishedJson.seo.canonicalPath = "/pricing";
replacementBundle.products[0].prices = [{ ...replacementBundle.products[0].prices[0], id: "price_monthly_v2", amountCents: 2799, stripePriceId: "price_verified_monthly_v2", providerFingerprint: "verified-monthly-v2" }];
replacementBundle.page.publishedJson.sections.featured_plan.settings.defaultBillingCycle = "month";
const replacementContext = resolveStorefrontContext(replacementBundle, "published", { now: new Date("2026-08-18T12:00:00.000Z") });
assert.equal(replacementContext.offers.selectedOfferPrice?.price.amountCents, 2799, "the selected monthly offer must resolve from the active price version");
assert.notEqual(replacementContext.revisions.factsRevision, context.revisions.factsRevision, "price economics must change the facts revision");
const pricingGraph = buildStorefrontJsonLd({ site: replacementBundle.site, page: replacementBundle.page, pageJson: replacementBundle.page.publishedJson, pagePath: "/pricing", routeMode: "host", context: replacementContext })[0]["@graph"];
const offerCatalog = pricingGraph.find((node) => node["@type"] === "OfferCatalog");
assert.deepEqual(offerCatalog.itemListElement.map((offer) => offer.price), ["27.99"], "Schema offers must use the same replacement price as storefront context");

const noPriceContext = resolveStorefrontContext({ ...bundle, products: [] }, "published");
const unresolved = resolveStorefrontBindings("Plans start at {LIVE_LOWEST_ACTIVE_PLAN_PRICE}.", noPriceContext);
assert.equal(unresolved.value, undefined, "missing facts must hide the bound text instead of exposing a token");
assert.deepEqual(unresolved.missing, ["LIVE_LOWEST_ACTIVE_PLAN_PRICE"]);

const metadataRevisionBundle = structuredClone(bundle);
metadataRevisionBundle.products[0].metadata = { summary: "Updated package summary" };
const metadataRevisionContext = resolveStorefrontContext(metadataRevisionBundle, "published", { now: new Date("2026-08-18T12:00:00.000Z") });
assert.notEqual(metadataRevisionContext.revisions.factsRevision, context.revisions.factsRevision, "Product metadata changes must invalidate storefront facts");

const packRevisionBundle = structuredClone(bundle);
packRevisionBundle.creativePacks[0].outputCount = 5;
const packRevisionContext = resolveStorefrontContext(packRevisionBundle, "published", { now: new Date("2026-08-18T12:00:00.000Z") });
assert.notEqual(packRevisionContext.revisions.factsRevision, context.revisions.factsRevision, "CreativePack fact changes must invalidate storefront facts");

const missingProfile = resolveStorefrontContext({
  ...bundle,
  site: { ...bundle.site, storefrontProfile: undefined }
}, "published");
assert.ok(missingProfile.missingFacts.includes("profile.identity.legalName"), "missing legal identity must be explicit");

const stores = [
  ["site_dreamshoot", "myDreamshoots", "mydreamshoots.test", "https://social.test/mydreamshoots", 2799],
  ["site_aidreamcapes", "Aidreamcapes", "aidreamcapes.test", "https://social.test/aidreamcapes", 3199],
  ["site_xbyshoot", "XbyShoot", "xbyshoot.test", "https://social.test/xbyshoot", 2899],
  ["site_xbydream", "XbyDream", "xbydream.test", "https://social.test/xbydream", 3399]
].map(([siteId, brand, domain, social, amountCents]) => {
  const isolated = structuredClone(bundle);
  isolated.site.id = siteId;
  isolated.site.name = brand;
  isolated.site.slug = siteId;
  isolated.site.primaryDomain = domain;
  isolated.site.branding.logoText = brand;
  isolated.site.storefrontProfile.siteId = siteId;
  isolated.site.storefrontProfile.publishedJson.identity.legalName = `${brand} Verified LLC`;
  isolated.site.storefrontProfile.publishedJson.identity.sameAs = [social];
  isolated.page.siteId = siteId;
  isolated.products[0].siteId = siteId;
  isolated.products[0].prices[0].siteId = siteId;
  isolated.products[0].prices[0].amountCents = amountCents;
  isolated.creativePacks.forEach((pack) => { pack.siteId = siteId; });
  const resolved = resolveStorefrontContext(isolated, "published", { now: new Date("2026-08-18T12:00:00.000Z") });
  return { siteId, brand, domain, social, amountCents, resolved };
});
for (const store of stores) {
  assert.equal(store.resolved.site.id, store.siteId);
  assert.equal(store.resolved.site.branding.logoText, store.brand);
  assert.equal(store.resolved.seo.canonicalUrl, `https://${store.domain}/`);
  assert.deepEqual(store.resolved.profile?.identity.sameAs, [store.social]);
  assert.equal(store.resolved.offers.lowestPublicMonthlySubscriptionPrice?.price.amountCents, store.amountCents);
}
assert.equal(stores[1].resolved.offers.lowestPublicMonthlySubscriptionPrice?.price.amountCents, 3199, "myDreamshoots changes must not leak into Aidreamcapes");

console.log("storefront context contract smoke passed");
