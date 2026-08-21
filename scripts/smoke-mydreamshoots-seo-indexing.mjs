import fs from "fs";
import path from "path";

const repoRoot = process.cwd();

function readText(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function fail(message, details = {}) {
  console.error(`MyDreamShoots SEO indexing smoke failed: ${message}`);
  if (Object.keys(details).length) console.error(JSON.stringify(details, null, 2));
  process.exit(1);
}

function assert(condition, message, details) {
  if (!condition) fail(message, details);
}

function normalizePath(slug) {
  const value = String(slug || "").trim();
  if (!value || value === "/") return "/";
  return `/${value.replace(/^\/+/, "").replace(/\/+$/, "")}`;
}

function walk(value, visit, pathSegments = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visit, [...pathSegments, String(index)]));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const nextPath = [...pathSegments, key];
    visit(key, child, nextPath);
    walk(child, visit, nextPath);
  }
}

const seoIndexing = readText("src/lib/seo-indexing.ts");
const publishedContract = readText("src/lib/mydreamshoots-published-contract.ts");
const jsonLd = readText("src/lib/theme/json-ld.ts");
const dreamshootSeoContent = readText("src/lib/dreamshoot-seo-content.ts");
const robots = readText("src/app/robots.txt/route.ts");
const nextConfig = readText("next.config.mjs");
const sitemapRoute = readText("src/app/sitemap.xml/route.ts");
const hostCatchAllPage = readText("src/app/[...path]/page.tsx");
const siteCatchAllPage = readText("src/app/site/[siteSlug]/[...path]/page.tsx");
const siteToolPage = readText("src/app/site/[siteSlug]/tools/[toolSlug]/page.tsx");
const siteRouteCanonical = readText("src/lib/site-route-canonical.ts");
const storefrontRender = readText("src/lib/storefront-render.tsx");
const storefrontStateRelational = readText("src/lib/storefront-state-relational.ts");
const storefrontContextCore = readText("src/lib/storefront-context/core.ts");
const storefrontContextSnapshot = readText("src/lib/storefront-context/snapshot.ts");
const storefrontContextTypes = readText("src/lib/storefront-context/types.ts");
const themeRenderer = readText("src/components/theme-renderer.tsx");
const templates = readText("src/lib/theme/packages/dreamshoot-ai-studio/templates.ts");
const photoPackageTaxonomy = readText("src/lib/photo-package-taxonomy.ts");
const platformState = readJson("data/platform-state.json");
const mydreamshootsTaxonomy = readJson("src/lib/mydreamshoots-theme-taxonomy.json");
const photoPackageUseCaseProfiles = readJson("src/lib/photo-package-use-case-profiles.json");
const dreamshootPackProfiles = readJson("src/lib/dreamshoot-pack-profiles.json");
const mydreamshootsSite = platformState.sites.find((site) => site.id === "site_dreamshoot");
const aidreamcapesSite = platformState.sites.find((site) => site.id === "site_aidreamcapes");
const activeDreamshootCategorySlugs = new Set(
  (platformState.creativePackCategories ?? [])
    .filter((category) => category.siteId === "site_dreamshoot" && category.status === "active")
    .map((category) => category.slug)
);
const activeDreamshootPackCategories = new Set(
  (platformState.creativePacks ?? [])
    .filter((pack) => pack.siteId === "site_dreamshoot" && pack.status === "active")
    .map((pack) => pack.category)
);
const mydreamshootsTaxonomyPathBySlug = new Map([
  ["", "/ai-image-generation"],
  ...(mydreamshootsTaxonomy.roots ?? []).map((root) => [root.slug, "/ai-image-generation"]),
  ...(mydreamshootsTaxonomy.items ?? []).map((item) => [item.slug, `/ai-image-generation/${item.slug}`])
]);
const mydreamshootsUseCaseProfiles = photoPackageUseCaseProfiles.mydreamshootsCategories ?? {};
const requiredUseCaseProfileFields = [
  "headline",
  "cardDescription",
  "metaLabel",
  "tags",
  "detailTags",
  "detailIntro",
  "whatCreates",
  "bestFor",
  "workflow",
  "styleNotes",
  "coverNote",
  "safetyNote"
];
const requiredPageCopySlugs = (mydreamshootsTaxonomy.items ?? [])
  .map((item) => item.slug)
  .filter((slug) => typeof slug === "string" && slug.trim());
const requiredPageCopyFields = [
  "pageEntityId",
  "copyRevision",
  "seoTitle",
  "galleryTitle",
  "galleryIntro",
  "ctaEyebrow",
  "ctaTitle",
  "ctaSubtitle",
  "ctaLabel",
  "faqEyebrow",
  "faqTitle",
  "relatedEyebrow",
  "relatedTitle",
  "relatedSubtitle",
  "relatedCtaLabel"
];
const bannedTemplateProfilePhrases = [
  "turn approved uploads into a focused private photo set",
  "A private gallery of",
  "works best when the source photos are current, sharp",
  "Confirm the visible credit cost before generation starts"
];
const profileMissingRows = [];
const profileInvalidRows = [];
const packProfileInvalidRows = [];
const profileTemplateRows = [];
const profileTopicRows = [];
const pageCopyInvalidRows = [];
const packProfileOwnerRows = [];
for (const item of mydreamshootsTaxonomy.items ?? []) {
  const profile = mydreamshootsUseCaseProfiles[item.slug];
  if (!profile) {
    profileMissingRows.push(item.slug);
    continue;
  }
  const profileText = JSON.stringify(profile);
  const invalidFields = requiredUseCaseProfileFields.filter((field) => {
    const value = profile[field];
    return Array.isArray(value) ? value.length === 0 : typeof value !== "string" || !value.trim();
  });
  if (invalidFields.length) {
    profileInvalidRows.push({ slug: item.slug, invalidFields });
  }
  const packProfile = dreamshootPackProfiles[item.slug];
  if (!packProfile) {
    packProfileInvalidRows.push({ slug: item.slug, reason: "missing" });
  } else {
    const operationalFields = ["packId", "creditCost", "outputCount", "toolRef", "promptRef", "mediaRef", "operationalDescription"];
    const missingOperationalFields = operationalFields.filter((field) => !Object.hasOwn(packProfile, field));
    if (missingOperationalFields.length) packProfileInvalidRows.push({ slug: item.slug, reason: "operational fields missing", missingOperationalFields });
  }
  const templateHits = bannedTemplateProfilePhrases.filter((phrase) => profileText.toLowerCase().includes(phrase.toLowerCase()));
  if (templateHits.length) {
    profileTemplateRows.push({ slug: item.slug, templateHits });
  }
  const normalizedProfileText = profileText.toLowerCase();
  const topicTokens = Array.from(new Set([item.label, item.slug, ...(item.tags ?? [])]
    .flatMap((value) => String(value).toLowerCase().split(/[^a-z0-9]+/))
    .filter((token) => token.length >= 4 && !["photo", "photos", "image", "images", "private", "style"].includes(token))));
  if (!topicTokens.some((token) => normalizedProfileText.includes(token))) {
    profileTopicRows.push({ slug: item.slug, topicTokens });
  }
}
const seenFaqIds = new Map();
for (const slug of requiredPageCopySlugs) {
  const profile = mydreamshootsUseCaseProfiles[slug];
  const invalidFields = [];
  if (!profile) {
    pageCopyInvalidRows.push({ slug, invalidFields: ["missing"] });
    continue;
  }
  for (const field of requiredPageCopyFields) {
    const value = profile[field];
    if (typeof value !== "string" || !value.trim()) invalidFields.push(field);
  }
  if (profile.pageEntityId !== `mydreamshoots:ai-image-theme:${slug}`) invalidFields.push("pageEntityId:canonicalSlug");
  if (profile.copyRevision !== `2026-08-18.${slug}`) invalidFields.push("copyRevision:revision");
  if (!Array.isArray(profile.faqItems) || profile.faqItems.length !== 4) {
    invalidFields.push("faqItems:count");
  } else {
    for (const faqItem of profile.faqItems) {
      if (!faqItem?.id?.trim() || !faqItem?.question?.trim() || !faqItem?.answer?.trim()) invalidFields.push("faqItems:shape");
      const previous = seenFaqIds.get(faqItem.id);
      if (previous) invalidFields.push(`faqItems:duplicate:${faqItem.id}:${previous}`);
      seenFaqIds.set(faqItem.id, slug);
    }
  }
  if (invalidFields.length) {
    pageCopyInvalidRows.push({ slug, invalidFields });
  }
  const projection = dreamshootPackProfiles[slug];
  const forbiddenFields = [...requiredPageCopyFields, "faqItems", "headline", "cardDescription", "detailIntro", "whatCreates", "bestFor", "workflow", "styleNotes"];
  const ownerFields = forbiddenFields.filter((field) => Object.hasOwn(projection ?? {}, field));
  if (ownerFields.length) packProfileOwnerRows.push({ slug, ownerFields });
}

assert(mydreamshootsSite, "MyDreamShoots site must exist in platform state");
assert(aidreamcapesSite, "AIDreamCapes site must exist in platform state");
assert(
  !profileMissingRows.length,
  "Every MyDreamShoots AI Image Generation leaf theme must have a direct SEO use-case profile",
  { profileMissingRows }
);
assert(
  !profileInvalidRows.length,
  "MyDreamShoots direct theme SEO profiles must include the complete customer-facing profile shape",
  { profileInvalidRows }
);
assert(
  !packProfileInvalidRows.length,
  "MyDreamShoots pack profiles must keep the complete operational contract",
  { packProfileInvalidRows }
);
assert(
  !profileTemplateRows.length,
  "MyDreamShoots direct theme SEO profiles must not fall back to generic template copy",
  { profileTemplateRows }
);
assert(
  !profileTopicRows.length,
  "MyDreamShoots direct theme SEO profiles must contain topic-specific vocabulary",
  { profileTopicRows }
);
assert(
  !pageCopyInvalidRows.length,
  "All MyDreamShoots dynamic pages must have exact per-canonical-slug page copy fields",
  { pageCopyInvalidRows }
);
assert(
  !packProfileOwnerRows.length,
  "dreamshoot-pack-profiles.json must not duplicate page SEO or visible copy fields",
  { packProfileOwnerRows }
);
assert(
  dreamshootSeoContent.includes("mydreamshootsPageCopyForRoute(") &&
    themeRenderer.includes("storefrontContext?.pageCopy") &&
    jsonLd.includes("context.pageCopy") &&
    themeRenderer.includes("targetCopy?.cardDescription"),
  "MyDreamShoots published renderer and JSON-LD must consume the snapshotted page copy"
);
assert(
  storefrontContextTypes.includes('"page_copy"') &&
    storefrontContextCore.includes("pageEntityId: pageCopy?.pageEntityId") &&
    storefrontContextCore.includes("copyRevision: pageCopy?.copyRevision") &&
    storefrontContextSnapshot.includes('entityType: "page_copy"'),
  "published storefront context and snapshot must include page-copy identity"
);

const slugRows = mydreamshootsSite.pages.map((page) => ({
  id: page.id,
  slug: normalizePath(page.slug),
  pageType: page.pageType,
  title: page.title,
  index: page.publishedJson?.seo?.index ?? page.publishedJson?.seo?.robots?.index
}));
const duplicateSlugRows = Array.from(
  slugRows.reduce((map, row) => map.set(row.slug, [...(map.get(row.slug) ?? []), row]), new Map())
).filter(([, rows]) => rows.length > 1);
const imageRootPage = slugRows.find((row) => row.slug === "/ai-image-generation" && row.index === true);
const videoRootPage = slugRows.find((row) => row.slug === "/ai-video-generation" && row.index === true);
const mydreamshootsWorkflow = slugRows.find((row) => row.slug === "/workflow");
const aidreamcapesWorkflow = aidreamcapesSite.pages.find((page) => normalizePath(page.slug) === "/workflow");

assert(!duplicateSlugRows.length, "MyDreamShoots page slugs must be unique before sitemap expansion", { duplicateSlugRows });
assert(
  Boolean(mydreamshootsWorkflow) && mydreamshootsWorkflow.pageType === "content",
  "MyDreamShoots must expose a standalone /workflow content page",
  { mydreamshootsWorkflow }
);
assert(
  Boolean(aidreamcapesWorkflow) && aidreamcapesWorkflow.pageType === "content",
  "Aidreamcapes must expose a standalone /workflow content page",
  { aidreamcapesWorkflow: aidreamcapesWorkflow && { id: aidreamcapesWorkflow.id, slug: aidreamcapesWorkflow.slug, pageType: aidreamcapesWorkflow.pageType } }
);
for (const pathName of ["/best-packages", "/best-ai-image", "/best-ai-video"]) {
  const row = slugRows.find((item) => item.slug === pathName);
  assert(
    Boolean(row) && row.pageType === "content",
    "MyDreamShoots must expose the new Best page as a standalone content page",
    { pathName, row }
  );
}
assert(
  !/requestedPath === "\/workflow"[\s\S]*return "\/"/.test(siteRouteCanonical),
  "/workflow must not canonicalize to the homepage"
);
assert(
  siteRouteCanonical.includes('requestedPath === "/how-it-works") return "/workflow"'),
  "/how-it-works should canonicalize to /workflow for legacy compatibility"
);
assert(
  Boolean(imageRootPage) && imageRootPage.pageType === "collection",
  "MyDreamShoots must expose /ai-image-generation as the public image directory root",
  { imageRootPage }
);
assert(
  Boolean(videoRootPage) && videoRootPage.pageType === "tools",
  "MyDreamShoots must expose /ai-video-generation as the public video directory root",
  { videoRootPage }
);
assert(
  !dreamshootSeoContent.includes('kind === "tool" && !item.explicit') &&
    dreamshootSeoContent.includes("const canonicalPath = item.canonicalPath"),
  "tool detail metadata must self-canonicalize from the canonical directory content"
);
assert(
  !slugRows.some((row) => row.slug === "/app/legacy-ai-image-studio" && row.index !== false),
  "legacy image studio page must not enter the sitemap when present"
);

const hrefHits = [];
const visiblePackageLabelHits = [];
walk(mydreamshootsSite, (key, value, location) => {
  if (key === "href" && typeof value === "string") hrefHits.push({ href: value, location: location.join(".") });
  if (["label", "primaryCta", "secondaryCta", "ctaLabel"].includes(key) && typeof value === "string") {
    if (["Headshot Generator", "Browse packages", "Best Packages", "Best AI image", "Best AI video"].includes(value)) {
      visiblePackageLabelHits.push({ label: value, location: location.join(".") });
    }
  }
});
const headerLinks = mydreamshootsSite.themeSettings?.publishedJson?.navigation?.headerLinks ?? [];
const headerLabels = headerLinks.map((link) => link.label);
const headerHrefs = headerLinks.map((link) => link.href);
const footerProductLinks = (mydreamshootsSite.themeSettings?.publishedJson?.navigation?.footerLinks ?? []).filter((link) => link.group === "product");
const footerProductLabels = footerProductLinks.map((link) => link.label);
const badLegacyHrefHits = hrefHits.filter((hit) => ["/cookie-policy", "/privacy-policy", "/terms-of-service"].includes(hit.href));
const legacyCollectionHrefs = new Set([
  "/collections/wedding-portraits",
  "/collections/profile-cards",
  "/collections/headshots",
  "/collections/professional-headshots",
  "/collections/ai-video-add-ons",
  "/collections/world-cup-fan-photos",
  "/collections/christmas-photos",
  "/collections/halloween-party-photos",
  "/collections/thanksgiving-group-photos",
  "/collections/hairstyle"
]);
const requiredCollectionSlugs = ["headshot", "avatar", "background-changer", "motion-generator", "soccer"];
const requiredCollectionPaths = [
  "/ai-image-generation",
  "/ai-image-generation/headshot",
  "/ai-image-generation/avatar",
  "/ai-image-generation/background-changer",
  "/ai-image-generation/motion-generator",
  "/ai-image-generation/soccer"
];
function requiredCollectionPathIsCovered(requiredPath) {
  if (hrefHits.some((hit) => hit.href === requiredPath)) return true;
  if (requiredPath === "/ai-image-generation") return Boolean(imageRootPage);
  const parts = requiredPath.split("/").filter(Boolean);
  if (parts[0] !== "ai-image-generation") return false;
  const slug = parts.at(-1) ?? "";
  if (mydreamshootsTaxonomyPathBySlug.get(slug) !== requiredPath) return false;
  return activeDreamshootCategorySlugs.has(slug) && activeDreamshootPackCategories.has(slug);
}
const badLegacyCollectionHrefHits = hrefHits.filter((hit) => legacyCollectionHrefs.has(hit.href));
assert(!badLegacyHrefHits.length, "MyDreamShoots internal hrefs must use canonical policy paths to avoid redirects", { badLegacyHrefHits });
assert(
  !badLegacyCollectionHrefHits.length,
  "MyDreamShoots internal hrefs must not keep legacy collection slugs after the taxonomy migration",
  { badLegacyCollectionHrefHits }
);
assert(
  hrefHits.some((hit) => hit.href === "/cookies"),
  "MyDreamShoots navigation/footer data must link directly to /cookies"
);
assert(
  requiredCollectionSlugs.every((slug) => activeDreamshootCategorySlugs.has(slug) && activeDreamshootPackCategories.has(slug)),
  "MyDreamShoots active taxonomy must expose key migrated collection slugs",
  {
    requiredCollectionSlugs,
    missingCategories: requiredCollectionSlugs.filter((slug) => !activeDreamshootCategorySlugs.has(slug)),
    missingPacks: requiredCollectionSlugs.filter((slug) => !activeDreamshootPackCategories.has(slug))
  }
);
for (const requiredPath of requiredCollectionPaths) {
  assert(
    requiredCollectionPathIsCovered(requiredPath),
    "MyDreamShoots data must expose the new ai-image-generation public route shape",
    { requiredPath }
  );
}
assert(
  headerLabels.includes("Best Packages") && headerHrefs[headerLabels.indexOf("Best Packages")] === "/best-packages",
  "MyDreamShoots header must expose Best Packages at /best-packages",
  { headerLinks }
);
assert(
  headerLabels.includes("AI Image Generation") && headerHrefs[headerLabels.indexOf("AI Image Generation")] === "/ai-image-generation",
  "MyDreamShoots header must expose AI Image Generation at /ai-image-generation",
  { headerLinks }
);
assert(
  headerLabels.includes("AI Video Generation") && headerHrefs[headerLabels.indexOf("AI Video Generation")] === "/ai-video-generation",
  "MyDreamShoots header must expose AI Video Generation at /ai-video-generation",
  { headerLinks }
);
assert(
  JSON.stringify(headerLabels) === JSON.stringify(["AI Image Generation", "AI Video Generation", "Best Packages", "How it works", "Blog", "Pricing", "Workspace"]),
  "MyDreamShoots header labels must use the fixed shared navigation order",
  { headerLinks }
);
assert(
  !headerLabels.includes("FAQ") && !headerLabels.includes("Headshot Generator"),
  "MyDreamShoots header must not expose the old FAQ or Headshot Generator top label",
  { headerLinks }
);
for (const [label, href] of [["Best Packages", "/best-packages"], ["Best AI image", "/best-ai-image"], ["Best AI video", "/best-ai-video"]]) {
  assert(
    footerProductLinks.some((link) => link.label === label && link.href === href),
    "MyDreamShoots footer product links must expose the new Best entry",
    { label, href, footerProductLinks }
  );
  assert(
    visiblePackageLabelHits.some((hit) => hit.label === label),
    "MyDreamShoots visible labels must include the new Best entry",
    { label, visiblePackageLabelHits }
  );
}
assert(
  !footerProductLabels.includes("Headshot Generator"),
  "MyDreamShoots footer product links must not keep the old Headshot Generator label",
  { footerProductLinks }
);
assert(
  !visiblePackageLabelHits.some((hit) => hit.label === "Browse packages"),
  "MyDreamShoots visible CTA/nav labels must not use Browse packages",
  { visiblePackageLabelHits }
);

assert(
  templates.includes('href: "/creators-circle"') &&
    hostCatchAllPage.includes("canUseStorefrontPartnerTemplate(site, publicPageSlug)") &&
    hostCatchAllPage.includes("!findPage(site, pageSlug)") &&
    hostCatchAllPage.includes("canUseStorefrontPartnerTemplate(site, pageSlug)") &&
    siteCatchAllPage.includes("dreamshootPartnerTemplateSlugs.has(pageSlug)") &&
    siteCatchAllPage.includes("isDreamshootPartnerTemplateSite(publicSite)") &&
    storefrontRender.includes("function syntheticDreamShootPartnerPage") &&
    storefrontRender.includes("dreamshootAiStudioTemplatesForSite(site)[templateKey]"),
  "Creators Circle must be backed by the synthetic DreamShoot template in both host and site routes"
);
assert(!templates.includes('href: "/cookie-policy"'), "MyDreamShoots templates must not generate /cookie-policy links");
assert(templates.includes('href: "/ai-image-generation/headshot"'), "MyDreamShoots templates must preserve canonical links to /ai-image-generation/headshot");
for (const legacyHref of legacyCollectionHrefs) {
  assert(!templates.includes(`href: "${legacyHref}"`), "MyDreamShoots templates must not keep legacy collection hrefs", { legacyHref });
}
for (const [label, href] of [["Best Packages", "/best-packages"], ["Best AI image", "/best-ai-image"], ["Best AI video", "/best-ai-video"]]) {
  assert(
    templates.includes(`label: "${label}"`) && templates.includes(`href: "${href}"`),
    "MyDreamShoots templates must expose the new Best page links",
    { label, href }
  );
}
assert(
  !templates.includes('label: "Browse packages"') &&
    !templates.includes('primaryCta: "Browse packages"') &&
    !templates.includes('ctaLabel: "Browse packages"'),
  "MyDreamShoots templates must not expose Browse packages as a CTA or navigation label"
);

for (const pathName of ["/cookie-policy", "/privacy-policy", "/terms-of-service"]) {
  assert(seoIndexing.includes(`"${pathName}"`), "sitemap legacy duplicate exclusions must include old policy paths", { pathName });
}

for (const pathName of ["/tools", "/tools/image-studio", "/tools/ai-image-studio", "/tools/travel-portraits", "/ai-photoshoot"]) {
  assert(seoIndexing.includes(`"${pathName}"`) || seoIndexing.includes(`path === "${pathName}"`), "sitemap blockers must include old MyDreamShoots public route shapes", { pathName });
}

for (const pathName of ["/ai-video-generation"]) {
  assert(seoIndexing.includes(`"${pathName}"`), "sitemap required video paths must use /ai-video-generation", { pathName });
}
for (const slug of [
  "text-to-video",
  "image-to-video",
  "talking-photo",
  "profile-clip",
  "fan-poster-motion",
  "creator-intro-video",
  "product-teaser-clip",
  "animated-avatar",
  "fashion-reel",
  "album-story-video",
  "cinematic-video",
  "tiktok-video",
  "instagram-reels",
  "social-media-video",
  "youtube-video",
  "story-video",
  "meme-video",
  "product-video",
  "product-ad-video",
  "promo-video",
  "ugc-ad-video"
]) {
  assert(photoPackageTaxonomy.includes(`"${slug}"`), "MyDreamShoots internal video slug list must include the required video slug", { slug });
}
const publicVideoSlugSource = photoPackageTaxonomy.match(/MYDREAMSHOOTS_PUBLIC_AI_VIDEO_GENERATION_SLUGS\s*=\s*\[([\s\S]*?)\]\s*as const/)?.[1] ?? "";
for (const slug of ["text-to-video", "image-to-video"]) {
  assert(!publicVideoSlugSource.includes(`"${slug}"`), "hidden video workflow slug must not be in the public video generation slug list", { slug });
}
for (const slug of [
  "talking-photo",
  "cinematic-video",
  "tiktok-video",
  "instagram-reels",
  "social-media-video",
  "youtube-video",
  "story-video",
  "meme-video",
  "product-video",
  "product-ad-video",
  "promo-video",
  "ugc-ad-video"
]) {
  assert(publicVideoSlugSource.includes(`"${slug}"`), "public video generation slug list must include the published topic slug", { slug });
}

assert(
  /grownstride\.com/.test(robots) &&
    /["']Disallow: \/["']/.test(robots) &&
    /["']Allow: \/["']/.test(robots) &&
    nextConfig.includes('source: "/robots.txt"') &&
    nextConfig.includes('value: "Host, X-Forwarded-Host"') &&
    nextConfig.includes('source: "/search"') &&
    nextConfig.includes('source: "/site/:siteSlug/search"') &&
    !jsonLd.includes('"SearchAction"'),
  "robots should allow noindex discovery, use host-aware cache/security headers, /search should receive X-Robots-Tag, and JSON-LD must not emit SearchAction without an indexable search page"
);
assert(
  themeRenderer.includes("publicSeoCriticalSectionTypes") &&
    themeRenderer.includes('"pricing_table"') &&
    themeRenderer.includes('"testimonial_wall"') &&
    themeRenderer.includes('"reviews"') &&
    themeRenderer.includes('"trust_signal_bar"') &&
    themeRenderer.includes('"brand_logo_strip"') &&
    themeRenderer.includes("isPublicSeoRoute(pagePath) && publicSeoCriticalSectionTypes.has(sectionType)"),
  "public SEO critical pricing, review, and trust sections must be server-rendered instead of lazy placeholders"
);

for (const pathName of ["/privacy", "/terms", "/cookies", "/refunds", "/content", "/shipping"]) {
  assert(seoIndexing.includes(`"${pathName}"`), "required policy paths must use canonical short paths", { pathName });
}

for (const pathName of ["/policies/privacy", "/policies/terms", "/policies/refunds", "/policies/shipping", "/policies/content", "/policies/cookies"]) {
  assert(!seoIndexing.includes(`  "${pathName}",`), "required policy paths must not use long policy paths", { pathName });
}

assert(
  seoIndexing.includes("createPublishedSiteSnapshot(state, site)") &&
    seoIndexing.includes("const canonicalPath = canonicalPathForSitemapPage(page)") &&
    seoIndexing.includes('resolvePublishedRouteDisposition(snapshot, canonicalPath).kind !== "render"') &&
    seoIndexing.includes("resolveEffectivePublishedPage(snapshot, canonicalPath)") &&
    seoIndexing.includes("page.publishedJson.seo?.canonical") &&
    seoIndexing.includes("effective.indexability.sitemapEligible") &&
    seoIndexing.includes("effective.context.seo.canonicalUrl"),
  "sitemap must use one published snapshot, effective page disposition, indexability, and canonical URL"
);
assert(
  publishedContract.includes("mydreamshootsPublishedRouteManifest") &&
    publishedContract.includes('copySource: "page-copy" | "missing"') &&
    publishedContract.includes("fallbackUsed: false") &&
    publishedContract.includes("mediaEntityId") &&
    publishedContract.includes("review_required"),
  "MyDreamShoots published route and media contracts must fail closed without generic fallback"
);
assert(
    seoIndexing.includes("resolvePublicCollectionItems(snapshot)") &&
    seoIndexing.includes("const collectionPage = snapshot.pages.find") &&
    seoIndexing.includes("effective.context.seo.canonicalUrl"),
  "sitemap collection entries must come from the published snapshot and canonical effective page"
);
assert(
    seoIndexing.includes("for (const page of snapshot.pages)") &&
    seoIndexing.includes("effective.routeDisposition.kind !== \"render\"") &&
    seoIndexing.includes("effective.indexability.sitemapEligible"),
  "sitemap must only include published page entities that are renderable and sitemap eligible"
);
assert(
    dreamshootSeoContent.includes("dreamshootDefaultPublicToolSlugs") &&
    dreamshootSeoContent.includes('"talking-photo"') &&
    dreamshootSeoContent.includes('"cinematic-video"') &&
    dreamshootSeoContent.includes('"tiktok-video"') &&
    dreamshootSeoContent.includes('"instagram-reels"') &&
    dreamshootSeoContent.includes('"social-media-video"') &&
    dreamshootSeoContent.includes('"youtube-video"') &&
    dreamshootSeoContent.includes('"story-video"') &&
    dreamshootSeoContent.includes('"meme-video"') &&
    dreamshootSeoContent.includes('"product-video"') &&
    dreamshootSeoContent.includes('"product-ad-video"') &&
    dreamshootSeoContent.includes('"promo-video"') &&
    dreamshootSeoContent.includes('"ugc-ad-video"') &&
    dreamshootSeoContent.includes("indexableDreamshootDefaultTool") &&
    dreamshootSeoContent.includes("item.explicit || indexableDreamshootDefaultTool"),
  "default public MyDreamShoots video detail pages must be indexable when they are included in sitemap coverage"
);
const defaultPublicToolSlugSource = dreamshootSeoContent.match(/dreamshootDefaultPublicToolSlugs\s*=\s*new Set\(\[([\s\S]*?)\]\)/)?.[1] ?? "";
for (const slug of ["text-to-video", "image-to-video"]) {
  assert(!defaultPublicToolSlugSource.includes(`"${slug}"`), "hidden video workflow slug must not be a default public SEO tool slug", { slug });
}
assert(
  storefrontStateRelational.includes("creativePackCategories.map(toCreativePackCategory)") &&
    storefrontStateRelational.includes("toolCategories.map(toToolCategory)") &&
    storefrontStateRelational.includes("toolMenuItems.map(toToolMenuItem)") &&
    storefrontStateRelational.includes("prisma.creativePackCategory.findMany") &&
    storefrontStateRelational.includes("prisma.toolMenuItem.findMany") &&
    storefrontStateRelational.includes("categoryRecord: { include: { parent: true } }"),
  "relational platform state used by sitemap must include storefront navigation categories and tool menu items"
);
assert(
  sitemapRoute.includes('export const dynamic = "force-dynamic"') &&
    sitemapRoute.includes('request.headers.get("x-forwarded-host")') &&
    sitemapRoute.includes('request.headers.get("host")') &&
    sitemapRoute.includes("getStorefrontSitemapEntriesForHost") &&
    !sitemapRoute.includes("new Date().toISOString()") &&
    sitemapRoute.includes("entry.lastmod") &&
    sitemapRoute.includes("entry.changefreq") &&
    sitemapRoute.includes("xmlns:image=\"http://www.google.com/schemas/sitemap-image/1.1\"") &&
    sitemapRoute.includes('"cache-control"') &&
    sitemapRoute.includes('"x-sitemap-url-count"') &&
    sitemapRoute.includes('"x-sitemap-image-count"'),
  "sitemap route must select URLs using the request host, emit per-entry sitemap metadata, and avoid request-time lastmod"
);
assert(
  seoIndexing.includes("lastmod?: string") &&
    seoIndexing.includes("sitemapChangeFrequencyForPath") &&
    seoIndexing.includes("normalizeSitemapDate") &&
    !seoIndexing.includes("SITEMAP_STATIC_FALLBACK_LASTMOD") &&
    !seoIndexing.includes("sitemapFallbackEntry") &&
    !seoIndexing.includes("publicFallbackSitemapUrlsForHost") &&
    seoIndexing.includes('return "monthly"') &&
    seoIndexing.includes('return "weekly"'),
  "sitemap entries must carry stable publication timestamps and page-type changefreq metadata without static fallback"
);
assert(
  seoIndexing.includes("getStorefrontSitemapUrlsForHost(hosts: string | null | undefined | Array<string | null | undefined>") &&
    seoIndexing.includes("pageSitemapPathForSite(site: Site, page: ThemePage): string") &&
    seoIndexing.includes("getSiteByHostCandidatesFromState(runtime.state, siteHostCandidates)") &&
    seoIndexing.includes("siteHostCandidates.some((host) => isHostForSite(item, host))") &&
    seoIndexing.includes("getAidreamcapesSitemapUrls") &&
    seoIndexing.includes("isLocalDevelopmentHost") &&
    seoIndexing.includes("runtime.sites.flatMap((site) => getSitemapUrlsForSite(runtime.state, site))"),
  "sitemap indexing must expose a host-aware single-site URL selector"
);

const sitemapDomains = [
  { site: mydreamshootsSite, ownHost: "www.mydreamshoots.com", forbiddenHost: "www.aidreamcapes.com" },
  { site: aidreamcapesSite, ownHost: "www.aidreamcapes.com", forbiddenHost: "www.mydreamshoots.com" }
];
for (const { site, ownHost, forbiddenHost } of sitemapDomains) {
  assert(
    site.primaryDomain === ownHost,
    "sitemap site primary domain must match the expected production host",
    { siteId: site.id, primaryDomain: site.primaryDomain, ownHost }
  );
  assert(
    !(platformState.siteDomains ?? []).some((domain) => domain.siteId === site.id && domain.domain === forbiddenHost),
    "sitemap site domain bindings must not include the other production host",
    { siteId: site.id, forbiddenHost }
  );
}
assert(
  siteToolPage.includes('if (normalizePublicSiteSlug(siteSlug) === "mydreamshoots") notFound()') &&
    hostCatchAllPage.includes('if (firstSegment === "tools" && isMydreamshootsSite(site) && !isAidreamcapesSite(site)) notFound()') &&
    hostCatchAllPage.includes("const DREAMSHOOT_LEGACY_TOOL_REDIRECTS: Record<string, string> = {}") &&
    !siteToolPage.includes('publicSlug === "mydreamshoots") return DREAMSHOOT'),
  "legacy MyDreamShoots tool paths must be blocked with 404 instead of redirected"
);

console.log(JSON.stringify({
  ok: true,
  mydreamshootsPageSlugCount: slugRows.length,
  duplicateSlugCount: duplicateSlugRows.length,
  imageRootPage: imageRootPage?.id,
  videoRootPage: videoRootPage?.id,
  canonicalInternalLinks: {
    cookies: "/cookies",
    forbiddenLegacyPolicyHrefs: badLegacyHrefHits.length
  },
  syntheticRoutes: ["/workflow", "/creators-circle", "/partner-registration"],
  sitemapStrategy: "published snapshot pages only; renderable, indexable, canonical URLs per request host",
  hostAwareSitemaps: {
    mydreamshoots: "www.mydreamshoots.com only",
    aidreamcapes: "www.aidreamcapes.com only"
  }
}, null, 2));
