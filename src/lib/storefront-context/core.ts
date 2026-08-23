import type { Price, StorefrontProfileJson, ThemePageJson, ThemeSettings } from "@/lib/types";
import { mydreamshootsPageCopyForRoute } from "@/lib/mydreamshoots-page-copy";
import { pageCopyFromPublishedPageEntity } from "@/lib/mydreamshoots-published-contract";
import type { ResolvedOffer, ResolvedPageSeo, StorefrontContext, StorefrontContextBundle, StorefrontContextMode, StorefrontPublishScope } from "./types";
import { isPublicPriceFact, missingStorefrontProfileFacts } from "./facts";
import { isPrimaryMydreamshootsSite, resolveSiteCapability } from "./capabilities";
import { applyTitleTemplate, canonicalUrlForSite, normalizeCanonicalPath } from "./seo-projection";
import { robotsForPage } from "@/lib/theme/seo";

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

const MYDREAMSHOOTS_STANDARD_SEO_PATHS = new Set(["/about-us", "/best-packages", "/best-ai-image", "/pricing", "/faq", "/workflow"]);

function revisionHash(value: string): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  let third = 0x85ebca6b;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x5bd1e995);
    third = Math.imul(third ^ code, 0x27d4eb2d);
  }
  return [first, second, third]
    .map((part) => (part >>> 0).toString(16).padStart(8, "0"))
    .join("")
    .slice(0, 20);
}

function resolveSeo(bundle: StorefrontContextBundle, pageJson: ThemePageJson, settings: ThemeSettings): ResolvedPageSeo {
  const pageSeo = pageJson.seo;
  const brand = clean(bundle.site.branding.logoText) || clean(bundle.site.name);
  const rawTitle = clean(pageSeo?.title) || clean(bundle.page.title) || brand;
  const description = clean(pageSeo?.description);
  const path = normalizeCanonicalPath(pageSeo?.canonical ?? pageSeo?.canonicalPath, bundle.page.slug);
  const primaryMydreamshoots = isPrimaryMydreamshootsSite(bundle.site);
  const standardMedia = primaryMydreamshoots
    ? bundle.publishedStandardPageMedia?.[path]
    : undefined;
  const standardMediaRequired = primaryMydreamshoots && MYDREAMSHOOTS_STANDARD_SEO_PATHS.has(path);
  const standardMediaReady = !standardMediaRequired || standardMedia?.status === "ready";
  const defaultIndex = bundle.page.pageType !== "not_found" && bundle.page.slug !== "/404";
  const pageRobots = robotsForPage(bundle.page);
  const pageScopedSocial = primaryMydreamshoots && (
    path === "/about-us" || path === "/faq" || path === "/pricing" || path === "/workflow" ||
    path === "/best-ai-image" || path === "/ai-image-generation" || /^\/ai-image-generation\//.test(path)
  );
  return {
    title: applyTitleTemplate(rawTitle, settings, brand),
    description,
    keywords: clean(pageSeo?.keywords) || clean(settings.seo?.siteKeywords) || undefined,
    canonicalPath: path,
    canonicalUrl: canonicalUrlForSite(bundle.site, path),
    ogImage: standardMedia?.status === "ready"
      ? standardMedia.ogImage
      : clean(pageSeo?.ogImage) || (pageScopedSocial ? undefined : clean(settings.seo?.defaultOgImage) || undefined),
    index: defaultIndex && pageRobots.index && standardMediaReady && (pageSeo?.robots?.index ?? pageSeo?.index ?? settings.seo?.robots?.index ?? true),
    follow: pageRobots.follow && (pageSeo?.robots?.follow ?? pageSeo?.follow ?? settings.seo?.robots?.follow ?? true),
    sitemapEligible: defaultIndex && pageRobots.index && standardMediaReady && (pageSeo?.robots?.index ?? pageSeo?.index ?? settings.seo?.robots?.index ?? true)
  };
}

export function isPublicPrice(price: Price, now = new Date(), expectedCurrency?: string): boolean {
  return isPublicPriceFact(price, now, expectedCurrency);
}

function formatPrice(price: Price): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: price.currency.toUpperCase(),
    minimumFractionDigits: price.amountCents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  }).format(price.amountCents / 100);
}

function selectedOfferFromPage(active: ResolvedOffer[], pageJson: ThemePageJson): ResolvedOffer | undefined {
  for (const sectionId of pageJson.sectionsOrder) {
    const settings = pageJson.sections[sectionId]?.settings;
    if (!settings) continue;
    const rawProduct = settings.featuredProductId;
    const productId = typeof rawProduct === "string"
      ? clean(rawProduct)
      : rawProduct && typeof rawProduct === "object" && !Array.isArray(rawProduct) && typeof rawProduct.id === "string"
        ? clean(rawProduct.id)
        : "";
    if (!productId) continue;
    const rawInterval = clean(settings.defaultBillingCycle ?? settings.billingCycle) || "month";
    return active.find((offer) => offer.product.id === productId && offer.price.interval === rawInterval);
  }
  return undefined;
}

function resolvedOffers(bundle: StorefrontContextBundle, pageJson: ThemePageJson, now: Date): StorefrontContext["offers"] {
  const active = bundle.products
    .filter((product) => product.status === "active")
    .flatMap((product) => product.prices.filter((price) => isPublicPrice(price, now, bundle.site.currency)).map((price): ResolvedOffer => ({
      product,
      price,
      formattedPrice: formatPrice(price),
      checkoutEnabled: Boolean(bundle.site.connect?.chargesEnabled && bundle.site.connect?.payoutsEnabled)
    })));
  const byAmount = (left: ResolvedOffer, right: ResolvedOffer) => left.price.amountCents - right.price.amountCents;
  return {
    active,
    lowestPublicMonthlySubscriptionPrice: active
      .filter((offer) => offer.product.type === "subscription" && offer.price.interval === "month")
      .sort(byAmount)[0],
    lowestPublicOneTimeCreditPrice: active
      .filter((offer) => offer.product.type === "credit_pack" && offer.price.interval === "one_time")
      .sort(byAmount)[0],
    selectedOfferPrice: selectedOfferFromPage(active, pageJson)
  };
}

function normalizedProfile(value: StorefrontProfileJson | undefined): StorefrontProfileJson | undefined {
  if (!value || typeof value !== "object") return undefined;
  return {
    identity: {
      legalName: clean(value.identity?.legalName) || undefined,
      entityType: clean(value.identity?.entityType) || undefined,
      address: value.identity?.address,
      supportEmail: clean(value.identity?.supportEmail) || undefined,
      phone: clean(value.identity?.phone) || undefined,
      sameAs: Array.from(new Set((value.identity?.sameAs ?? []).map(clean).filter((url) => /^https:\/\//i.test(url))))
    },
    policyFacts: { ...(value.policyFacts ?? {}) }
  };
}

function revision(bundle: StorefrontContextBundle, mode: StorefrontContextMode, pageJson: ThemePageJson, settings: ThemeSettings, profile: StorefrontProfileJson | undefined): string {
  const products = [...bundle.products]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((product) => ({
      id: product.id,
      name: product.name,
      type: product.type,
      status: product.status,
      metadata: product.metadata,
      prices: [...product.prices]
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((price) => ({
          id: price.id,
          label: price.label,
          amountCents: price.amountCents,
          currency: price.currency,
          interval: price.interval,
          creditsGranted: price.creditsGranted,
          stripePriceId: price.stripePriceId,
          metadata: price.metadata,
          status: price.status,
          effectiveFrom: price.effectiveFrom,
          effectiveTo: price.effectiveTo,
          replacesPriceId: price.replacesPriceId,
          providerVerifiedAt: price.providerVerifiedAt,
          providerFingerprint: price.providerFingerprint
        }))
    }));
  const packs = [...bundle.creativePacks]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((pack) => ({
      id: pack.id,
      name: pack.name,
      headline: pack.headline,
      description: pack.description,
      category: pack.category,
      aiAppSlug: pack.aiAppSlug,
      status: pack.status,
      creditCost: pack.creditCost,
      outputCount: pack.outputCount,
      trainingRequired: pack.trainingRequired
    }));
  const payload = JSON.stringify({
    mode,
    site: {
      id: bundle.site.id,
      name: bundle.site.name,
      slug: bundle.site.slug,
      primaryDomain: bundle.site.primaryDomain,
      currency: bundle.site.currency,
      branding: bundle.site.branding
    },
    page: [bundle.page.id, pageJson, bundle.page.updatedAt],
    settings,
    profile,
    products,
    packs
  });
  return revisionHash(payload);
}

export function resolveStorefrontContext(
  bundle: StorefrontContextBundle,
  mode: StorefrontContextMode,
  options: { now?: Date; scope?: StorefrontPublishScope } = {}
): StorefrontContext {
  const scope = options.scope;
  const primaryMydreamshoots = isPrimaryMydreamshootsSite(bundle.site);
  const pageJson = mode === "draft" ? bundle.page.draftJson : bundle.page.publishedJson;
  const settings = mode === "draft" && scope?.includeThemeSettings
    ? bundle.site.themeSettings.draftJson
    : bundle.site.themeSettings.publishedJson;
  const profile = normalizedProfile(mode === "draft" && scope?.includeStorefrontProfile
    ? bundle.site.storefrontProfile?.draftJson
    : bundle.site.storefrontProfile?.publishedJson);
  const validPacks = bundle.creativePacks.filter((pack) => pack.status === "active" && pack.creditCost > 0 && pack.outputCount > 0);
  const invalidPacks = bundle.creativePacks.filter((pack) => pack.status === "active" && (pack.creditCost <= 0 || pack.outputCount <= 0));
  const seo = resolveSeo(bundle, pageJson, settings);
  const missingFacts = missingStorefrontProfileFacts(profile);
  const pageCopySlug = seo.canonicalPath.match(/^\/ai-image-generation\/([^/?#]+)$/)?.[1];
  const videoTopicSlug = seo.canonicalPath.match(/^\/ai-video-generation\/([^/?#]+)$/)?.[1];
  const pageEntity = (pageCopySlug || videoTopicSlug) && mode === "published" && bundle.publishedPageEntities
    ? bundle.publishedPageEntities[seo.canonicalPath]
    : undefined;
  const pageCopy = pageCopySlug && mode === "published" && primaryMydreamshoots
    ? pageEntity
      ? pageCopyFromPublishedPageEntity(pageEntity, bundle.publishedLinkRefs ?? [])
      : undefined
    : pageCopySlug
    ? mydreamshootsPageCopyForRoute({
        siteId: bundle.site.id,
        routeKind: "ai-image-theme-leaf",
        canonicalSlug: pageCopySlug,
        canonicalPath: seo.canonicalPath
      })
    : undefined;
  if (!seo.description && seo.index) missingFacts.push(`page.${bundle.page.id}.seo.description`);
  const snapshotFailClosed = mode === "published" && primaryMydreamshoots &&
    (Boolean(pageCopySlug || videoTopicSlug) || MYDREAMSHOOTS_STANDARD_SEO_PATHS.has(seo.canonicalPath)) &&
    bundle.snapshotIntegrity !== "valid";
  const resolvedSeo = pageEntity
    ? {
        ...seo,
        title: pageEntity.metadata.title,
        description: pageEntity.metadata.description,
        canonicalPath: pageEntity.metadata.canonicalPath,
        canonicalUrl: canonicalUrlForSite(bundle.site, pageEntity.metadata.canonicalPath),
        index: pageEntity.metadata.robots.index,
        follow: pageEntity.metadata.robots.follow,
        sitemapEligible: pageEntity.sitemapEligible
      }
    : snapshotFailClosed
      ? { ...seo, index: false, follow: true, sitemapEligible: false }
      : seo;
  if (snapshotFailClosed) missingFacts.push("published.seo.snapshot");
  if (mode === "published" && primaryMydreamshoots && MYDREAMSHOOTS_STANDARD_SEO_PATHS.has(resolvedSeo.canonicalPath) && !bundle.publishedStandardPageMedia?.[resolvedSeo.canonicalPath]) {
    missingFacts.push("published.standard_page_media");
  }
  return {
    mode,
    site: bundle.site,
    page: bundle.page,
    pageJson,
    settings,
    seo: resolvedSeo,
    profile,
    offers: resolvedOffers(bundle, pageJson, options.now ?? new Date()),
    catalog: {
      activePacks: validPacks,
      invalidPacks,
      activeImageWorkflowCount: validPacks.length
    },
    revisions: {
      publicationId: bundle.publication?.id,
      publicationVersion: bundle.publication?.version,
      factsRevision: mode === "published" && bundle.factsRevision
        ? bundle.factsRevision
        : revision(bundle, mode, pageJson, settings, profile),
      buildId: bundle.buildId || process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || "local",
      pageEntityId: pageCopy?.pageEntityId,
      copyRevision: pageCopy?.copyRevision,
      canonicalSlug: pageCopy ? pageCopySlug : undefined,
      snapshotRevision: bundle.publication?.snapshot.revisions?.snapshotHash,
      routeRevision: bundle.publication?.snapshot.revisions?.routeRevision,
      pageRevision: pageEntity?.pageRevision,
      offerRevision: bundle.publication?.snapshot.revisions?.offerRevision,
      collectionRevision: bundle.publication?.snapshot.revisions?.collectionRevision,
      linkRevision: bundle.publication?.snapshot.revisions?.linkRevision,
      policyRevision: bundle.publication?.snapshot.revisions?.policyRevision
    },
    capability: resolveSiteCapability(bundle.site),
    indexability: {
      index: resolvedSeo.index,
      follow: resolvedSeo.follow,
      sitemapEligible: resolvedSeo.sitemapEligible
    },
    missingFacts,
    publishedFacts: bundle.publishedFacts,
    publishedPageMedia: pageEntity ? bundle.publishedPageMedia?.[pageEntity.pageEntityId] : undefined,
    publishedStandardPageMedia: bundle.publishedStandardPageMedia?.[resolvedSeo.canonicalPath],
    publishedPageEntity: pageEntity,
    snapshotIntegrity: bundle.snapshotIntegrity ?? "legacy",
    pageCopy
  };
}

const bindingPattern = /\{(LIVE_[A-Z0-9_]+)\}/g;

const legacyFactClaimRules = [
  {
    key: "LEGACY_TRAINING_POLICY_CLAIM",
    token: "{LIVE_TRAINING_POLICY_STATEMENT}",
    pattern: /\b(?:no\s+ai\s+training|never\s+(?:be\s+)?used\s+to\s+train|not\s+used\s+to\s+train)\b/i
  },
  {
    key: "LEGACY_RETENTION_POLICY_CLAIM",
    token: "{LIVE_SOURCE_MEDIA_RETENTION_DAYS}",
    pattern: /(?:\b\d+\s*[- ]day\b.{0,80}\b(?:delete|deletion|retention|retain)|\b(?:delete|deletion|retention|retain).{0,80}\b\d+\s*days?\b)/i
  },
  {
    key: "LEGACY_REFUND_POLICY_CLAIM",
    token: "{LIVE_REFUND_REVIEW_POLICY_STATEMENT}",
    pattern: /(?:\bmoney[- ]back guarantee\b|\bguaranteed refund\b)/i
  },
  {
    key: "LEGACY_REFUND_WINDOW_CLAIM",
    token: "{LIVE_REFUND_WINDOW_DAYS}",
    pattern: /(?:\b\d+\s*[- ]day refund\b|\brefund.{0,80}\b\d+\s*days?\b)/i
  },
  {
    key: "LEGACY_PRICE_CLAIM",
    token: "{LIVE_LOWEST_ACTIVE_PLAN_PRICE}",
    pattern: /(?:[$€£]\s*\d+(?:[.,]\d{1,2})?)/
  },
  {
    key: "LEGACY_CREDIT_AMOUNT_CLAIM",
    token: "{LIVE_LOWEST_ONE_TIME_CREDIT_PRICE}",
    pattern: /\b\d+\s+credits?\b/i
  },
  {
    key: "LEGACY_WORKFLOW_COUNT_CLAIM",
    token: "{LIVE_AI_IMAGE_WORKFLOW_COUNT}",
    pattern: /\b\d+\s+(?:AI\s+image\s+workflows?|themes?)\b/i
  },
  {
    key: "LEGACY_SUPPORT_EMAIL_CLAIM",
    token: "{LIVE_SUPPORT_EMAIL}",
    pattern: /\b[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+\b/i
  }
] as const;

export function resolveStorefrontBindings(text: string, context: StorefrontContext): { value?: string; missing: string[] } {
  const address = context.profile?.identity.address;
  const formattedAddress = address
    ? [address.line1, address.line2, address.city, address.region, address.postalCode, address.country].map(clean).filter(Boolean).join(", ")
    : undefined;
  const values: Record<string, string | undefined> = {
    LIVE_LOWEST_ACTIVE_PLAN_PRICE: context.offers.lowestPublicMonthlySubscriptionPrice?.formattedPrice,
    LIVE_LOWEST_ONE_TIME_CREDIT_PRICE: context.offers.lowestPublicOneTimeCreditPrice?.formattedPrice,
    LIVE_AI_IMAGE_WORKFLOW_COUNT: context.catalog.activeImageWorkflowCount > 0 ? String(context.catalog.activeImageWorkflowCount) : undefined,
    LIVE_SOURCE_MEDIA_RETENTION_DAYS: context.profile?.policyFacts.sourceMediaRetentionDays
      ? String(context.profile.policyFacts.sourceMediaRetentionDays)
      : undefined,
    LIVE_REFUND_WINDOW_DAYS: context.profile?.policyFacts.refundWindowDays
      ? String(context.profile.policyFacts.refundWindowDays)
      : undefined,
    LIVE_SUPPORT_EMAIL: context.profile?.identity.supportEmail,
    LIVE_LEGAL_NAME: context.profile?.identity.legalName,
    LIVE_STORE_ADDRESS: formattedAddress,
    LIVE_POLICY_EFFECTIVE_DATE: context.profile?.policyFacts.effectiveDate,
    LIVE_TRAINING_POLICY_STATEMENT: context.profile?.policyFacts.usesCustomerMediaForTraining === undefined
      ? undefined
      : context.profile.policyFacts.usesCustomerMediaForTraining
        ? "Customer media may be used for model improvement under the published policy."
        : "Customer media is not used to train models.",
    LIVE_REFUND_REVIEW_POLICY_STATEMENT: context.profile?.policyFacts.refundReviewRequired === undefined
      ? undefined
      : context.profile.policyFacts.refundReviewRequired
        ? "Refund requests require review under the published refund policy."
        : "Eligible refunds follow the published refund policy."
    ,
    LIVE_CREDIT_RESERVE_STATEMENT: context.publishedFacts?.creditLifecycle?.reserve,
    LIVE_CREDIT_CONSUME_STATEMENT: context.publishedFacts?.creditLifecycle?.consume,
    LIVE_CREDIT_RELEASE_STATEMENT: context.publishedFacts?.creditLifecycle?.release,
    LIVE_SECURITY_TRANSPORT_STATEMENT: context.publishedFacts?.security?.transportClaimKey,
    LIVE_SECURITY_STORAGE_STATEMENT: context.publishedFacts?.security?.storageClaimKey
  };
  const missingBindings = Array.from(text.matchAll(bindingPattern))
    .map((match) => match[1])
    .filter((key) => !values[key]);
  // A valid PostgreSQL publication is the source of truth for published copy.
  // Apply the legacy hard-coded-claim guard to drafts and invalid snapshots,
  // while allowing the sealed publication payload to render unchanged.
  const isSealedPublishedSnapshot = context.snapshotIntegrity === "valid" && Boolean(context.revisions.publicationId);
  const legacyClaims = legacyFactClaimRules
    .filter(() => !isSealedPublishedSnapshot)
    .filter((rule) => rule.pattern.test(text.split(rule.token).join("")))
    .map((rule) => rule.key);
  const missing = [...missingBindings, ...legacyClaims];
  if (missing.length) return { missing: Array.from(new Set(missing)) };
  return {
    value: text.replace(bindingPattern, (_match, key: string) => values[key] ?? ""),
    missing: []
  };
}

export function selectOfferPrice(
  context: StorefrontContext,
  productId: string,
  billingCycle: "month" | "quarter" | "half_year" | "year" | "one_time"
): ResolvedOffer | undefined {
  return context.offers.active.find((offer) => offer.product.id === productId && offer.price.interval === billingCycle);
}

/** The pricing page projection shared by visible plan cards and its OfferCatalog. */
export function projectPublicPricingOffers(context?: StorefrontContext): ResolvedOffer[] {
  if (!context) return [];
  const planRank = (name: string) => {
    const normalized = name.trim().toLowerCase();
    if (normalized === "starter") return 0;
    if (normalized === "pro") return 1;
    if (normalized === "premium") return 2;
    return 99;
  };
  const subscriptionProducts = new Map(
    context.offers.active
      .filter((offer) => offer.product.type === "subscription")
      .map((offer) => [offer.product.id, offer.product] as const)
  );
  const visibleProductIds = Array.from(subscriptionProducts.values())
    .sort((left, right) => planRank(left.name) - planRank(right.name) || left.name.localeCompare(right.name))
    .slice(0, 3)
    .map((product) => product.id);
  const visibleProducts = new Set(visibleProductIds);
  return context.offers.active
    .filter((offer) =>
      visibleProducts.has(offer.product.id) &&
      offer.product.type === "subscription" &&
      ["month", "quarter", "half_year"].includes(offer.price.interval)
    )
    .sort((left, right) => planRank(left.product.name) - planRank(right.product.name) || left.product.name.localeCompare(right.product.name));
}

/** The public collection projection shared by directory cards and collection JSON-LD. */
export function projectPublicCreativePacks(
  context: StorefrontContext,
  candidates: StorefrontContext["catalog"]["activePacks"] = context.catalog.activePacks
): StorefrontContext["catalog"]["activePacks"] {
  const activeIds = new Set(context.catalog.activePacks.map((pack) => pack.id));
  return candidates.filter((pack) => activeIds.has(pack.id) && pack.status === "active" && pack.creditCost > 0 && pack.outputCount > 0);
}
