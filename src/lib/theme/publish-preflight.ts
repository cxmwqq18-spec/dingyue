import { normalizeThemeSeo } from "@/lib/theme/seo";
import { themeValueToString } from "@/lib/theme-values";
import { mydreamshootsPageCopyForRoute } from "@/lib/mydreamshoots-page-copy";
import { mydreamshootsPublishedRouteManifest, normalizePublishedSlug } from "@/lib/mydreamshoots-published-contract";
import { isPublicPriceFact, missingStorefrontProfileFacts } from "@/lib/storefront-context";
import type { SectionBlockInstance, SectionInstance, Site, StorefrontProfileJson, ThemePage, ThemeSettings, ThemeSettingValue } from "@/lib/types";

export type PublishPreflightSeverity = "pass" | "warn" | "block";

export type PublishPreflightCheck = {
  id: string;
  title: string;
  detail: string;
  severity: PublishPreflightSeverity;
  scope: "pages" | "navigation" | "commerce" | "ai" | "media" | "settings";
};

export type PublishPreflightResult = {
  checks: PublishPreflightCheck[];
  globalVisualChanges: PublishGlobalVisualChange[];
  canPublish: boolean;
  score: number;
  summary: {
    blockers: number;
    warnings: number;
    passes: number;
  };
};

export type PublishGlobalVisualChange = {
  id: string;
  label: string;
  live: string;
  draft: string;
};

export type PublishPreflightProduct = {
  id: string;
  status: "active" | "draft";
  type: "subscription" | "credit_pack";
  prices: Array<{ stripePriceId: string | null; amountCents: number; status?: string; currency?: string; interval?: string; providerVerifiedAt?: string | null; providerFingerprint?: string | null; effectiveFrom?: string | null; effectiveTo?: string | null }>;
};

export type PublishPreflightCreativePack = {
  id: string;
  status: string;
  creditCost: number;
  outputCount: number;
  category?: string;
  categoryRecord?: { slug?: string } | null;
  imageUrl?: string | null;
  galleryImages?: string[] | null;
  galleryImageAlts?: string[] | null;
};

export type PublishPreflightSiteAiApp = {
  id: string;
  enabled: boolean;
  aiApp: { id: string; slug: string };
};

export type PublishPreflightMediaAsset = {
  id: string;
  ownerId?: string;
  entityRevision?: string;
};

const mediaKeys = new Set([
  "mediaAssetId",
  "imageUrl",
  "secondaryImageUrl",
  "tertiaryImageUrl",
  "src",
  "image",
  "mobile_src",
  "bg_image",
  "beforeImage",
  "afterImage"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readPath(root: unknown, path: string[]): unknown {
  return path.reduce<unknown>((current, key) => (isRecord(current) ? current[key] : undefined), root);
}

function displaySettingValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "default";
  if (typeof value === "string") return value.trim() || "default";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `${value.length} items`;
  return JSON.stringify(value);
}

function globalSectionBlocks(settings: ThemeSettings, type: "header" | "footer"): SectionBlockInstance[] {
  return settings.globalSections?.[type]?.blocks ?? [];
}

function linkSignature(links: ThemeSettings["navigation"]["headerLinks"]): string {
  return links.map((link) => `${link.label.trim()} -> ${link.href.trim()}`).join(" | ");
}

function compareGlobalVisualValue(changes: PublishGlobalVisualChange[], id: string, label: string, live: unknown, draft: unknown) {
  const liveValue = displaySettingValue(live);
  const draftValue = displaySettingValue(draft);
  if (liveValue !== draftValue) changes.push({ id, label, live: liveValue, draft: draftValue });
}

export function summarizeThemeGlobalVisuals(settings: ThemeSettings): Record<string, string> {
  const headerLinks = settings.navigation?.headerLinks ?? [];
  const footerLinks = settings.navigation?.footerLinks ?? [];
  return {
    contentWidth: displaySettingValue(readPath(settings.saasSettingsCurrent, ["general_layout_width"])),
    layoutSpacing: displaySettingValue(readPath(settings.saasSettingsCurrent, ["general_layout_spacing"])),
    siteBackground: displaySettingValue(readPath(settings.saasSettingsCurrent, ["skin_bg"]) ?? settings.colors?.background),
    footerBackground: displaySettingValue(
      settings.globalSections?.footer?.settings?.backgroundColor ??
        readPath(settings.saasSettingsCurrent, ["sections", "footer_plus", "settings", "footer_bg_color"])
    ),
    footerText: displaySettingValue(
      settings.globalSections?.footer?.settings?.textColor ??
        readPath(settings.saasSettingsCurrent, ["sections", "footer_plus", "settings", "footer_text_color"])
    ),
    headerLinks: String(headerLinks.length),
    footerLinks: String(footerLinks.length),
    headerBlocks: String(globalSectionBlocks(settings, "header").length),
    footerBlocks: String(globalSectionBlocks(settings, "footer").length)
  };
}

export function collectThemeGlobalVisualChanges(site: Pick<Site, "themeSettings">): PublishGlobalVisualChange[] {
  const live = site.themeSettings.publishedJson;
  const draft = site.themeSettings.draftJson;
  const liveHeaderLinks = live.navigation?.headerLinks ?? [];
  const draftHeaderLinks = draft.navigation?.headerLinks ?? [];
  const liveFooterLinks = live.navigation?.footerLinks ?? [];
  const draftFooterLinks = draft.navigation?.footerLinks ?? [];
  const changes: PublishGlobalVisualChange[] = [];
  compareGlobalVisualValue(changes, "content_width", "Content width", readPath(live.saasSettingsCurrent, ["general_layout_width"]), readPath(draft.saasSettingsCurrent, ["general_layout_width"]));
  compareGlobalVisualValue(changes, "layout_spacing", "Layout spacing", readPath(live.saasSettingsCurrent, ["general_layout_spacing"]), readPath(draft.saasSettingsCurrent, ["general_layout_spacing"]));
  compareGlobalVisualValue(changes, "site_background", "Site background", readPath(live.saasSettingsCurrent, ["skin_bg"]) ?? live.colors?.background, readPath(draft.saasSettingsCurrent, ["skin_bg"]) ?? draft.colors?.background);
  compareGlobalVisualValue(changes, "footer_background", "Footer background", live.globalSections?.footer?.settings?.backgroundColor ?? readPath(live.saasSettingsCurrent, ["sections", "footer_plus", "settings", "footer_bg_color"]), draft.globalSections?.footer?.settings?.backgroundColor ?? readPath(draft.saasSettingsCurrent, ["sections", "footer_plus", "settings", "footer_bg_color"]));
  compareGlobalVisualValue(changes, "footer_text", "Footer text", live.globalSections?.footer?.settings?.textColor ?? readPath(live.saasSettingsCurrent, ["sections", "footer_plus", "settings", "footer_text_color"]), draft.globalSections?.footer?.settings?.textColor ?? readPath(draft.saasSettingsCurrent, ["sections", "footer_plus", "settings", "footer_text_color"]));
  compareGlobalVisualValue(changes, "header_blocks", "Header blocks", globalSectionBlocks(live, "header").length, globalSectionBlocks(draft, "header").length);
  compareGlobalVisualValue(changes, "footer_blocks", "Footer blocks", globalSectionBlocks(live, "footer").length, globalSectionBlocks(draft, "footer").length);
  compareGlobalVisualValue(changes, "header_link_count", "Header links", liveHeaderLinks.length, draftHeaderLinks.length);
  compareGlobalVisualValue(changes, "footer_link_count", "Footer links", liveFooterLinks.length, draftFooterLinks.length);
  if (liveHeaderLinks.length === draftHeaderLinks.length) {
    compareGlobalVisualValue(changes, "header_link_items", "Header link items", linkSignature(liveHeaderLinks), linkSignature(draftHeaderLinks));
  }
  if (liveFooterLinks.length === draftFooterLinks.length) {
    compareGlobalVisualValue(changes, "footer_link_items", "Footer link items", linkSignature(liveFooterLinks), linkSignature(draftFooterLinks));
  }
  return changes;
}

function pass(id: string, scope: PublishPreflightCheck["scope"], title: string, detail: string): PublishPreflightCheck {
  return { id, scope, title, detail, severity: "pass" };
}

function warn(id: string, scope: PublishPreflightCheck["scope"], title: string, detail: string): PublishPreflightCheck {
  return { id, scope, title, detail, severity: "warn" };
}

function block(id: string, scope: PublishPreflightCheck["scope"], title: string, detail: string): PublishPreflightCheck {
  return { id, scope, title, detail, severity: "block" };
}

function sectionEntries(page: ThemePage): Array<{ id: string; section?: SectionInstance }> {
  return page.draftJson.sectionsOrder.map((id) => ({ id, section: page.draftJson.sections[id] }));
}

function allSections(site: Pick<Site, "pages">): Array<{ page: ThemePage; sectionId: string; section: SectionInstance }> {
  return site.pages.flatMap((page) =>
    sectionEntries(page)
      .filter((entry): entry is { id: string; section: SectionInstance } => Boolean(entry.section))
      .map((entry) => ({ page, sectionId: entry.id, section: entry.section }))
  );
}

function setting(section: SectionInstance, key: string): string {
  return themeValueToString(section.settings[key], "").trim();
}

function productPriceCount(products: PublishPreflightProduct[], siteCurrency: string): number {
  return products.reduce((sum, product) => sum + product.prices.filter((price) => validPublishedPrice(price, Date.now(), siteCurrency)).length, 0);
}

function validPublishedPrice(price: PublishPreflightProduct["prices"][number], now = Date.now(), siteCurrency?: string): boolean {
  return isPublicPriceFact(price as Parameters<typeof isPublicPriceFact>[0], new Date(now), siteCurrency);
}

function collectLiveBindings(value: unknown, found = new Set<string>()): Set<string> {
  if (typeof value === "string") {
    for (const match of value.matchAll(/\{(LIVE_[A-Z0-9_]+)\}/g)) found.add(match[1]);
    return found;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectLiveBindings(item, found));
    return found;
  }
  if (isRecord(value)) Object.values(value).forEach((item) => collectLiveBindings(item, found));
  return found;
}

function activeProductsForFilter(products: PublishPreflightProduct[], filter: string): PublishPreflightProduct[] {
  return products
    .filter((product) => product.status === "active")
    .filter((product) => (filter === "subscription" || filter === "credit_pack" ? product.type === filter : true));
}

function aiAppMatches(siteAiApps: PublishPreflightSiteAiApp[], value: string): boolean {
  if (!value) return false;
  return siteAiApps.some((app) => app.enabled && (app.id === value || app.aiApp.id === value || app.aiApp.slug === value));
}

function hasBrokenLink(href: string): boolean {
  if (!href.trim()) return true;
  return !(
    href.startsWith("/") ||
    href.startsWith("#") ||
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("mailto:")
  );
}

function hasBrokenCanonical(value: string | undefined): boolean {
  const href = value?.trim() ?? "";
  if (!href) return false;
  return !(href.startsWith("/") || href.startsWith("http://") || href.startsWith("https://"));
}

function mediaReference(value: ThemeSettingValue | undefined): string {
  const stringValue = themeValueToString(value, "").trim();
  if (!stringValue.startsWith("media_")) return "";
  return stringValue;
}

function collectMediaReferencesFromSections(sections: Array<{ section: SectionInstance }>): string[] {
  const refs = new Set<string>();
  for (const { section } of sections) {
    for (const [key, value] of Object.entries(section.settings)) {
      if (mediaKeys.has(key)) {
        const ref = mediaReference(value);
        if (ref) refs.add(ref);
      }
    }
    for (const blockItem of section.blocks ?? []) {
      for (const [key, value] of Object.entries(blockItem.settings)) {
        if (mediaKeys.has(key)) {
          const ref = mediaReference(value);
          if (ref) refs.add(ref);
        }
      }
    }
  }
  return [...refs];
}

export function collectThemePublishMediaReferences(site: Pick<Site, "pages">): string[] {
  return collectMediaReferencesFromSections(allSections(site));
}

export function runThemePublishPreflight({
  site,
  products,
  siteAiApps,
  mediaAssets,
  storefrontProfile,
  creativePacks = [],
  dirtyPageIds
}: {
  site: Site;
  products: PublishPreflightProduct[];
  siteAiApps: PublishPreflightSiteAiApp[];
  mediaAssets: PublishPreflightMediaAsset[];
  storefrontProfile?: StorefrontProfileJson;
  creativePacks?: PublishPreflightCreativePack[];
  dirtyPageIds?: string[] | Set<string>;
}): PublishPreflightResult {
  const checks: PublishPreflightCheck[] = [];
  const sections = allSections(site);
  const missingSectionRefs = site.pages.flatMap((page) =>
    sectionEntries(page)
      .filter((entry) => !entry.section)
      .map((entry) => `${page.title}:${entry.id}`)
  );
  const emptyPages = site.pages.filter((page) => page.draftJson.sectionsOrder.length === 0);
  const dirtyPageIdSet = dirtyPageIds ? new Set(dirtyPageIds) : undefined;
  const dirtyPages = dirtyPageIdSet
    ? site.pages.filter((page) => dirtyPageIdSet.has(page.id))
    : site.pages.filter((page) => JSON.stringify(page.draftJson) !== JSON.stringify(page.publishedJson));
  const pricingSections = sections.filter((entry) => entry.section.type === "pricing_table");
  const aiBusinessSections = sections.filter((entry) =>
    ["ai_tool_grid", "ai_tool_entry", "generation_form", "upload_panel", "job_progress", "album_gallery"].includes(entry.section.type)
  );
  const generationForms = sections.filter((entry) => entry.section.type === "generation_form" || entry.section.type === "ai_tool_entry");
  const policyPages = site.pages.filter((page) => page.slug.includes("policy") || page.pageType.includes("policy"));
  const activeProducts = products.filter((product) => product.status === "active");
  const activePrices = productPriceCount(activeProducts, site.currency);
  const invalidActivePrices = activeProducts.flatMap((product) => product.prices.filter((price) => price.status === "active" && !validPublishedPrice(price, Date.now(), site.currency)));
  const invalidCreativePacks = creativePacks.filter((pack) => pack.status === "active" && (pack.creditCost <= 0 || pack.outputCount <= 0));
  const enabledAiApps = siteAiApps.filter((app) => app.enabled);
  const headerLinks = site.themeSettings.draftJson.navigation.headerLinks;
  const footerLinks = site.themeSettings.draftJson.navigation.footerLinks;
  const globalVisualChanges = collectThemeGlobalVisualChanges(site);
  const seo = normalizeThemeSeo(site, site.themeSettings.draftJson);
  const brokenLinks = [...headerLinks, ...footerLinks].filter((link) => !link.label.trim() || hasBrokenLink(link.href));
  const mediaIds = new Set(mediaAssets.map((asset) => asset.id));
  const missingMediaRefs = collectMediaReferencesFromSections(sections).filter((ref) => !mediaIds.has(ref));
  const mediaOwnerReviewRequired = mediaAssets.filter((asset) => mediaIds.has(asset.id) && (!asset.ownerId || !asset.entityRevision || asset.ownerId !== site.id));
  const pageCopyFailures: string[] = [];
  const pageCopyRouteFailures: string[] = [];
  const pageCopyRevisionFailures: string[] = [];
  const pageCopyFaqFailures: string[] = [];
  const pageCopyMediaFailures: string[] = [];
  if (site.id === "site_dreamshoot") {
    for (const route of mydreamshootsPublishedRouteManifest()) {
      if (route.copySource !== "page-copy") pageCopyRouteFailures.push(`${route.canonicalSlug}:PAGE_COPY_REVIEW_REQUIRED`);
      if (route.pageEntityId !== `mydreamshoots:ai-image-theme:${route.canonicalSlug}`) pageCopyRouteFailures.push(`${route.canonicalSlug}:PAGE_COPY_ENTITY_MISMATCH`);
      if (!route.copyRevision.trim()) pageCopyRevisionFailures.push(`${route.canonicalSlug}:PAGE_COPY_REVISION_MISSING`);
      try {
        const copy = mydreamshootsPageCopyForRoute({ siteId: site.id, routeKind: "ai-image-theme-leaf", canonicalSlug: route.canonicalSlug, canonicalPath: route.canonicalPath });
        if (!copy || !Array.isArray(copy.faqItems) || copy.faqItems.length < 4) pageCopyFaqFailures.push(`${route.canonicalSlug}:PAGE_COPY_FAQ_REQUIRED`);
      } catch (error) {
        pageCopyRouteFailures.push(`${route.canonicalSlug}:${error instanceof Error ? error.message : "PAGE_COPY_REVIEW_REQUIRED"}`);
      }
      const matchingPack = creativePacks.find((pack) => pack.status === "active" && pack.id === route.expectedPackId && normalizePublishedSlug(pack.categoryRecord?.slug || pack.category) === route.canonicalSlug);
      if (!matchingPack || !matchingPack.imageUrl || (matchingPack.galleryImages ?? []).length === 0 || route.status !== "published") {
        const reason = route.status !== "published" && route.reviewReason
          ? route.reviewReason
          : !matchingPack
            ? "PAGE_COPY_MEDIA_ENTITY_MISMATCH"
            : !matchingPack.imageUrl || (matchingPack.galleryImages ?? []).length === 0
              ? "PAGE_MEDIA_REQUIRED"
              : "PAGE_COPY_MEDIA_ENTITY_MISMATCH";
        pageCopyMediaFailures.push(`${route.canonicalSlug}:${reason}`);
      }
    }
    for (const page of site.pages) {
      const canonicalSlug = page.slug.match(/^\/ai-image-generation\/([^/?#]+)/)?.[1];
      if (!canonicalSlug) continue;
      const isIndexableLeaf = page.publishedJson?.seo?.index ?? page.publishedJson?.seo?.robots?.index ?? page.draftJson?.seo?.index ?? page.draftJson?.seo?.robots?.index;
      if (isIndexableLeaf === false) continue;
      try {
        const copy = mydreamshootsPageCopyForRoute({
          siteId: site.id,
          routeKind: "ai-image-theme-leaf",
          canonicalSlug,
          canonicalPath: page.slug
        });
        if (!copy) throw new Error("PAGE_COPY_REVIEW_REQUIRED");
        if (copy.pageEntityId !== `mydreamshoots:ai-image-theme:${canonicalSlug}`) throw new Error("PAGE_COPY_ENTITY_MISMATCH");
        if (!Array.isArray(copy.faqItems) || copy.faqItems.length < 4) throw new Error("PAGE_COPY_FAQ_REQUIRED");
      } catch (error) {
        pageCopyFailures.push(`${page.slug}:${error instanceof Error ? error.message : "PAGE_COPY_REVIEW_REQUIRED"}`);
      }
    }
  }
  const pagesMissingSeoTitle = site.pages.filter((page) => !page.draftJson.seo?.title?.trim());
  const pagesMissingSeoDescription = site.pages.filter((page) => !page.draftJson.seo?.description?.trim());
  const pagesWithShortSeoDescription = site.pages.filter((page) => {
    const length = page.draftJson.seo?.description?.trim().length ?? 0;
    return length > 0 && length < 50;
  });
  const pagesWithBrokenCanonical = site.pages.filter((page) => hasBrokenCanonical(page.draftJson.seo?.canonical ?? page.draftJson.seo?.canonicalPath));
  const address = storefrontProfile?.identity.address;
  const liveBindings = collectLiveBindings({ pages: site.pages.map((page) => page.draftJson), settings: site.themeSettings.draftJson });
  const bindingAvailability: Record<string, boolean> = {
    LIVE_LOWEST_ACTIVE_PLAN_PRICE: activeProducts.some((product) => product.type === "subscription" && product.prices.some((price) => price.interval === "month" && validPublishedPrice(price, Date.now(), site.currency))),
    LIVE_LOWEST_ONE_TIME_CREDIT_PRICE: activeProducts.some((product) => product.type === "credit_pack" && product.prices.some((price) => price.interval === "one_time" && validPublishedPrice(price, Date.now(), site.currency))),
    LIVE_AI_IMAGE_WORKFLOW_COUNT: creativePacks.some((pack) => pack.status === "active" && pack.creditCost > 0 && pack.outputCount > 0),
    LIVE_SOURCE_MEDIA_RETENTION_DAYS: Boolean(storefrontProfile?.policyFacts.sourceMediaRetentionDays),
    LIVE_REFUND_WINDOW_DAYS: Boolean(storefrontProfile?.policyFacts.refundWindowDays),
    LIVE_SUPPORT_EMAIL: Boolean(storefrontProfile?.identity.supportEmail),
    LIVE_LEGAL_NAME: Boolean(storefrontProfile?.identity.legalName),
    LIVE_STORE_ADDRESS: Boolean(address?.line1 && address.city && address.region && address.postalCode && address.country),
    LIVE_POLICY_EFFECTIVE_DATE: Boolean(storefrontProfile?.policyFacts.effectiveDate),
    LIVE_TRAINING_POLICY_STATEMENT: storefrontProfile?.policyFacts.usesCustomerMediaForTraining !== undefined,
    LIVE_REFUND_REVIEW_POLICY_STATEMENT: storefrontProfile?.policyFacts.refundReviewRequired !== undefined
  };
  const unresolvedBindings = [...liveBindings].filter((binding) => !bindingAvailability[binding]);
  const draftText = JSON.stringify({ pages: site.pages.map((page) => page.draftJson), settings: site.themeSettings.draftJson });
  const policyContradictions: string[] = [];
  const retentionClaims = [
    ...draftText.matchAll(/(\d+)[- ]day[^.]{0,80}(?:delete|retention)/gi),
    ...draftText.matchAll(/(?:delete|retention)[^.]{0,80}?(\d+)[- ]day/gi)
  ].map((match) => Number(match[1])).filter(Number.isFinite);
  if (storefrontProfile?.policyFacts.sourceMediaRetentionDays && retentionClaims.some((days) => days !== storefrontProfile.policyFacts.sourceMediaRetentionDays)) {
    policyContradictions.push("sourceMediaRetentionDays");
  }
  const refundWindowClaims = [...draftText.matchAll(/refund[^.]{0,100}?(\d+)[- ]day/gi)].map((match) => Number(match[1])).filter(Number.isFinite);
  if (storefrontProfile?.policyFacts.refundWindowDays && refundWindowClaims.some((days) => days !== storefrontProfile.policyFacts.refundWindowDays)) {
    policyContradictions.push("refundWindowDays");
  }
  if (storefrontProfile?.policyFacts.usesCustomerMediaForTraining === true && /(?:never|not) used to train models/i.test(draftText)) {
    policyContradictions.push("usesCustomerMediaForTraining");
  }
  if (storefrontProfile?.policyFacts.refundReviewRequired === true && /(?:automatic|guaranteed) refund/i.test(draftText)) {
    policyContradictions.push("refundReviewRequired");
  }

  checks.push(
    site.pages.length >= 10
      ? pass("page_count", "pages", "全站页面覆盖", `${site.pages.length} 个页面已进入主题页面树。`)
      : warn("page_count", "pages", "页面覆盖偏少", `当前只有 ${site.pages.length} 个页面，DreamShootAI 主题目标应覆盖首页、定价、工具、登录、工作台、相册、政策、帮助和博客。`)
  );

  const profileMissing = missingStorefrontProfileFacts(storefrontProfile).map((fact) => fact.replace(/^profile\.(identity|policyFacts)\./, ""));
  checks.push(profileMissing.length ? block("storefront_profile", "settings", "站点资料未确认", `Profile 缺少: ${profileMissing.join(", ")}。法人资料未确认时禁止整站发布。`) : pass("storefront_profile", "settings", "站点资料完整", "Footer、Contact、About 和 Organization Schema 共享同一份已发布 Profile。"));
  checks.push(invalidActivePrices.length ? block("price_provider_verification", "commerce", "报价未完成 provider 校验", `${invalidActivePrices.length} 个 active Price 缺少有效 Stripe read-only fingerprint。`) : pass("price_provider_verification", "commerce", "报价 provider 校验有效", "公开报价均有 active 状态、有效 Price ID 和 provider fingerprint。"));
  checks.push(invalidCreativePacks.length ? block("creative_pack_facts", "ai", "CreativePack 数值非法", `${invalidCreativePacks.map((pack) => pack.id).slice(0, 5).join(", ")} 的 credits/outputCount 必须大于 0。`) : pass("creative_pack_facts", "ai", "CreativePack 数值有效", "前台不会为缺失 credits 或 outputCount 伪造默认值。"));
  checks.push(unresolvedBindings.length ? block("storefront_bindings", "pages", "存在未解析事实 binding", unresolvedBindings.join(", ")) : pass("storefront_bindings", "pages", "事实 binding 可解析", "页面只使用白名单事实 binding，且当前值均可解析。"));
  checks.push(policyContradictions.length ? block("policy_fact_consistency", "settings", "Trust 文案与政策事实冲突", Array.from(new Set(policyContradictions)).join(", ")) : pass("policy_fact_consistency", "settings", "Trust 文案与政策事实一致", "政策数字和训练/退款声明由 Profile facts 或白名单 binding 提供。"));
  checks.push(pass("seo_schema_context", "pages", "SEO 与 Schema 使用同一解析结果", `页面 SEO 来自 ThemePage 草稿；站点默认值由 ${seo.siteTitle || "site defaults"} 提供。发布渲染不会读取旧的页面级全局 SEO 字段。`));

  checks.push(
    emptyPages.length
      ? block("empty_pages", "pages", "存在空页面", `${emptyPages.map((page) => page.title).join(", ")} 没有任何 section，发布后会形成空模板。`)
      : pass("empty_pages", "pages", "页面结构完整", "所有 draft 页面都有 section 顺序。")
  );

  if (site.id === "site_dreamshoot") {
    checks.push(pageCopyRouteFailures.length
      ? block("PAGE_COPY_REVIEW_REQUIRED", "pages", "MyDreamShoots page copy requires review", pageCopyRouteFailures.slice(0, 8).join("; "))
      : pass("PAGE_COPY_REVIEW_REQUIRED", "pages", "MyDreamShoots page copy is exact", "Every published route manifest row resolves to its direct page-copy owner."));
    checks.push(pageCopyRouteFailures.some((failure) => failure.includes("PAGE_COPY_ENTITY_MISMATCH"))
      ? block("PAGE_COPY_ENTITY_MISMATCH", "pages", "Page copy entity mismatch", pageCopyRouteFailures.filter((failure) => failure.includes("PAGE_COPY_ENTITY_MISMATCH")).slice(0, 8).join("; "))
      : pass("PAGE_COPY_ENTITY_MISMATCH", "pages", "Page copy entities match routes", "Every pageEntityId matches its canonical slug."));
    checks.push(pageCopyRevisionFailures.length
      ? block("PAGE_COPY_REVISION_MISSING", "pages", "Page copy revision missing", pageCopyRevisionFailures.slice(0, 8).join("; "))
      : pass("PAGE_COPY_REVISION_MISSING", "pages", "Page copy revisions present", "Every route manifest row has a non-empty copyRevision."));
    checks.push(pageCopyFaqFailures.length
      ? block("PAGE_COPY_FAQ_REQUIRED", "pages", "Page copy FAQ incomplete", pageCopyFaqFailures.slice(0, 8).join("; "))
      : pass("PAGE_COPY_FAQ_REQUIRED", "pages", "Page copy FAQ complete", "Every route copy contains at least four valid FAQ items."));
    checks.push(pageCopyMediaFailures.length
      ? block("PAGE_COPY_MEDIA_ENTITY_MISMATCH", "media", "Page media entity mismatch", pageCopyMediaFailures.slice(0, 8).join("; "))
      : pass("PAGE_COPY_MEDIA_ENTITY_MISMATCH", "media", "Page media entities match routes", "Every indexable route has an exact active pack owner with cover and gallery media."));
  }

  checks.push(
    missingSectionRefs.length
      ? block("missing_sections", "pages", "页面树引用缺失", `${missingSectionRefs.slice(0, 4).join(", ")} 指向不存在的 section。`)
      : pass("missing_sections", "pages", "页面树引用有效", "sectionsOrder 中的 section 都能在 draft_json.sections 找到。")
  );

  checks.push(
    dirtyPages.length
      ? warn("dirty_pages", "pages", "存在未发布草稿", `${dirtyPages.length} 个页面草稿和线上版本不同；单页发布只影响目标页，整站发布必须显式列入 manifest。`)
      : pass("dirty_pages", "pages", "草稿与线上一致", "当前页面 draft_json 与 published_json 没有差异。")
  );

  checks.push(
    globalVisualChanges.length
      ? warn(
          "global_visual_changes",
          "settings",
          "存在全局视觉变化",
          globalVisualChanges
            .slice(0, 5)
            .map((change) => `${change.label}: ${change.live} -> ${change.draft}`)
            .join("；")
        )
      : pass("global_visual_changes", "settings", "全局视觉设置一致", "宽度、间距、header/footer 和导航数量与线上一致。")
  );

  checks.push(
    headerLinks.length && footerLinks.length
      ? pass("navigation_links", "navigation", "导航菜单已配置", `Header ${headerLinks.length} 个链接，Footer ${footerLinks.length} 个链接。`)
      : block("navigation_links", "navigation", "导航菜单不完整", "Header 和 Footer 都需要至少一个有效链接。")
  );

  checks.push(
    brokenLinks.length
      ? block("navigation_urls", "navigation", "导航链接格式错误", `${brokenLinks.slice(0, 4).map((link) => `${link.label || "Untitled"} -> ${link.href || "empty"}`).join(", ")} 需要改为 /、#、http(s) 或 mailto 链接。`)
      : pass("navigation_urls", "navigation", "导航链接格式有效", "导航链接不会在发布前直接形成坏入口。")
  );

  if (pricingSections.length) {
    checks.push(
      activePrices
        ? pass("active_prices", "commerce", "真实价格可用", `${activeProducts.length} 个 active product，${activePrices} 个有效 Stripe price。`)
        : block("active_prices", "commerce", "没有可用真实价格", "pricing_table 已启用，但本站没有 active product + Stripe price。")
    );
    checks.push(
      site.connect.chargesEnabled
        ? pass("stripe_connect", "commerce", "收款状态可发布", "Stripe Connect chargesEnabled 已开启。")
        : block("stripe_connect", "commerce", "收款未准备好", "pricing_table 已启用，发布付费套餐前必须完成 Stripe Connect onboarding。")
    );
    const emptyPricingFilters = pricingSections.filter(({ section }) => activeProductsForFilter(products, setting(section, "productType") || "all").length === 0);
    checks.push(
      emptyPricingFilters.length
        ? block("pricing_filters", "commerce", "定价模块过滤为空", `${emptyPricingFilters.map(({ page }) => page.title).join(", ")} 的 pricing_table 过滤不到 active 产品。`)
        : pass("pricing_filters", "commerce", "定价模块能读取产品", "所有 pricing_table 都能读取到当前站点真实 active 产品。")
    );
  } else {
    checks.push(warn("pricing_sections", "commerce", "没有定价模块", "当前草稿没有 pricing_table，客户前台缺少订阅/credit pack 转化入口。"));
  }

  if (aiBusinessSections.length) {
    checks.push(
      enabledAiApps.length
        ? pass("enabled_ai_apps", "ai", "AI 工具已启用", `${enabledAiApps.length} 个 AI 工具可供前台模块绑定。`)
        : block("enabled_ai_apps", "ai", "没有启用 AI 工具", "AI 业务 section 已启用，但本站没有 enabled site_ai_apps。")
    );
    const invalidAiBindings = generationForms.filter(({ section }) => {
      const value = setting(section, "aiAppSlug") || setting(section, "aiAppId") || setting(section, "ai_app");
      return value ? !aiAppMatches(siteAiApps, value) : false;
    });
    checks.push(
      invalidAiBindings.length
        ? block("ai_bindings", "ai", "AI 表单绑定无效", `${invalidAiBindings.map(({ page }) => page.title).join(", ")} 绑定了本站未启用的 AI app。`)
        : pass("ai_bindings", "ai", "AI 表单绑定有效", "generation_form / ai_tool_entry 没有发现跨站或未启用工具绑定。")
    );
  } else {
    checks.push(warn("ai_sections", "ai", "没有 AI 业务模块", "当前草稿没有 AI tool grid、上传、生成、进度或相册模块。"));
  }

  checks.push(
    missingMediaRefs.length || mediaOwnerReviewRequired.length
      ? block("media_refs", "media", "媒体归属/版本需要复核", [
          missingMediaRefs.length ? `missing: ${missingMediaRefs.slice(0, 6).join(", ")}` : "",
          mediaOwnerReviewRequired.length ? `owner/revision: ${mediaOwnerReviewRequired.slice(0, 6).map((asset) => asset.id).join(", ")}` : ""
        ].filter(Boolean).join("; "))
      : pass("media_refs", "media", "媒体引用有效", "draft 中的站点媒体引用都有本站 owner 和 entity revision。")
  );

  checks.push(
    pageCopyFailures.length
      ? block("page_copy_contract", "pages", "MyDreamShoots 页级 copy 契约失败", pageCopyFailures.slice(0, 6).join("; "))
      : pass("page_copy_contract", "pages", "MyDreamShoots 页级 copy 契约通过", "已发布的 AI Image Generation leaf 页面都能解析到 exact page copy。")
  );

  checks.push(
    policyPages.length >= 2
      ? pass("policy_pages", "settings", "政策页面已覆盖", `${policyPages.length} 个政策页面已进入主题页面树。`)
      : warn("policy_pages", "settings", "政策页面不足", "隐私、退款、内容政策至少应有两个以上可装修页面。")
  );

  checks.push(
    seo.siteTitle.trim() && seo.siteDescription.trim()
      ? pass("seo_global", "settings", "站点 SEO 基础完整", "全局 site title、description 和 title template 已进入主题设置。")
      : block("seo_global", "settings", "站点 SEO 基础缺失", "发布前需要补全全局 site title 和 description。")
  );

  checks.push(
    pagesMissingSeoTitle.length
      ? block("seo_page_titles", "settings", "页面 SEO 标题缺失", `${pagesMissingSeoTitle.slice(0, 5).map((page) => page.title).join(", ")} 需要补全 title。`)
      : pass("seo_page_titles", "settings", "页面 SEO 标题完整", "所有主题页面都有 SEO title。")
  );

  checks.push(
    pagesMissingSeoDescription.length
      ? block("seo_page_descriptions", "settings", "页面 SEO 描述缺失", `${pagesMissingSeoDescription.slice(0, 5).map((page) => page.title).join(", ")} 需要补全 description。`)
      : pagesWithShortSeoDescription.length
      ? warn("seo_page_descriptions", "settings", "部分 SEO 描述偏短", `${pagesWithShortSeoDescription.slice(0, 5).map((page) => page.title).join(", ")} 的 description 少于 50 字符。`)
      : pass("seo_page_descriptions", "settings", "页面 SEO 描述可发布", "所有主题页面都有可用 description。")
  );

  checks.push(
    pagesWithBrokenCanonical.length
      ? block("seo_canonical", "settings", "Canonical 地址格式错误", `${pagesWithBrokenCanonical.slice(0, 5).map((page) => page.title).join(", ")} 需要使用 /path 或 http(s) URL。`)
      : pass("seo_canonical", "settings", "Canonical 地址有效", "页面 canonical path 格式可被前台 metadata 使用。")
  );

  const summary = checks.reduce(
    (current, check) => ({
      blockers: current.blockers + (check.severity === "block" ? 1 : 0),
      warnings: current.warnings + (check.severity === "warn" ? 1 : 0),
      passes: current.passes + (check.severity === "pass" ? 1 : 0)
    }),
    { blockers: 0, warnings: 0, passes: 0 }
  );
  const score = Math.max(0, Math.min(100, 100 - summary.blockers * 18 - summary.warnings * 7));

  return {
    checks,
    globalVisualChanges,
    canPublish: summary.blockers === 0,
    score,
    summary
  };
}
