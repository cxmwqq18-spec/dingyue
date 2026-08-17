import { normalizeThemeSeo } from "@/lib/theme/seo";
import { themeValueToString } from "@/lib/theme-values";
import type { SectionBlockInstance, SectionInstance, Site, ThemePage, ThemeSettings, ThemeSettingValue } from "@/lib/types";

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
  prices: Array<{ stripePriceId: string | null; amountCents: number }>;
};

export type PublishPreflightSiteAiApp = {
  id: string;
  enabled: boolean;
  aiApp: { id: string; slug: string };
};

export type PublishPreflightMediaAsset = {
  id: string;
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

function productPriceCount(products: PublishPreflightProduct[]): number {
  return products.reduce((sum, product) => sum + product.prices.filter((price) => price.stripePriceId && price.amountCents > 0).length, 0);
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
  dirtyPageIds
}: {
  site: Site;
  products: PublishPreflightProduct[];
  siteAiApps: PublishPreflightSiteAiApp[];
  mediaAssets: PublishPreflightMediaAsset[];
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
  const activePrices = productPriceCount(activeProducts);
  const enabledAiApps = siteAiApps.filter((app) => app.enabled);
  const headerLinks = site.themeSettings.draftJson.navigation.headerLinks;
  const footerLinks = site.themeSettings.draftJson.navigation.footerLinks;
  const globalVisualChanges = collectThemeGlobalVisualChanges(site);
  const seo = normalizeThemeSeo(site, site.themeSettings.draftJson);
  const brokenLinks = [...headerLinks, ...footerLinks].filter((link) => !link.label.trim() || hasBrokenLink(link.href));
  const mediaIds = new Set(mediaAssets.map((asset) => asset.id));
  const missingMediaRefs = collectMediaReferencesFromSections(sections).filter((ref) => !mediaIds.has(ref));
  const pagesMissingSeoTitle = site.pages.filter((page) => !seo.pages[page.id]?.title.trim());
  const pagesMissingSeoDescription = site.pages.filter((page) => !seo.pages[page.id]?.description.trim());
  const pagesWithShortSeoDescription = site.pages.filter((page) => {
    const length = seo.pages[page.id]?.description.trim().length ?? 0;
    return length > 0 && length < 50;
  });
  const pagesWithBrokenCanonical = site.pages.filter((page) => hasBrokenCanonical(seo.pages[page.id]?.canonicalPath));

  checks.push(
    site.pages.length >= 10
      ? pass("page_count", "pages", "全站页面覆盖", `${site.pages.length} 个页面已进入主题页面树。`)
      : warn("page_count", "pages", "页面覆盖偏少", `当前只有 ${site.pages.length} 个页面，DreamShootAI 主题目标应覆盖首页、定价、工具、登录、工作台、相册、政策、帮助和博客。`)
  );

  checks.push(
    emptyPages.length
      ? block("empty_pages", "pages", "存在空页面", `${emptyPages.map((page) => page.title).join(", ")} 没有任何 section，发布后会形成空模板。`)
      : pass("empty_pages", "pages", "页面结构完整", "所有 draft 页面都有 section 顺序。")
  );

  checks.push(
    missingSectionRefs.length
      ? block("missing_sections", "pages", "页面树引用缺失", `${missingSectionRefs.slice(0, 4).join(", ")} 指向不存在的 section。`)
      : pass("missing_sections", "pages", "页面树引用有效", "sectionsOrder 中的 section 都能在 draft_json.sections 找到。")
  );

  checks.push(
    dirtyPages.length
      ? warn("dirty_pages", "pages", "存在未发布草稿", `${dirtyPages.length} 个页面草稿和线上版本不同，发布会一次性推到前台。`)
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
    missingMediaRefs.length
      ? warn("media_refs", "media", "部分媒体引用未入库", `${missingMediaRefs.slice(0, 6).join(", ")} 不在当前站点 media_assets 中，前台会走 fallback 或外部路径。`)
      : pass("media_refs", "media", "媒体引用有效", "draft 中的站点媒体引用都能在 media_assets 找到。")
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
