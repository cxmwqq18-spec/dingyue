import fs from "fs";
import path from "path";

const statePath = path.join(process.cwd(), "data/platform-state.json");
const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
const seoIndexing = fs.readFileSync(path.join(process.cwd(), "src/lib/seo-indexing.ts"), "utf8");
const storefrontRender = fs.readFileSync(path.join(process.cwd(), "src/lib/storefront-render.tsx"), "utf8");
const themeRenderer = fs.readFileSync(path.join(process.cwd(), "src/components/theme-renderer.tsx"), "utf8");
const siteStore = fs.readFileSync(path.join(process.cwd(), "src/lib/stores/site-store.ts"), "utf8");

const checks = [];

function pass(label) {
  checks.push({ ok: true, label });
}

function fail(label, detail) {
  checks.push({ ok: false, label, detail });
}

function assert(condition, label, detail = "") {
  if (condition) pass(label);
  else fail(label, detail);
}

function sectionSetting(section, key) {
  const value = section?.settings?.[key];
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function pageText(page) {
  return JSON.stringify({
    slug: page.slug,
    title: page.title,
    draftJson: page.draftJson,
    publishedJson: page.publishedJson
  });
}

const forbiddenArticlePhrases = [
  "in today's fast-paced world",
  "game changer",
  "game-changing",
  "ultimate solution",
  "cutting-edge",
  "unlock the power",
  "elevate your",
  "seamless experience",
  "effortlessly",
  "dive into",
  "delve into",
  "in conclusion",
  "this article should",
  "use this article as context",
  "what to study in the product photos",
  "a quick comparison checklist",
  "helpful details to notice"
];

function slugifySegment(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function activeItems(key, siteId) {
  return (state[key] ?? []).filter((item) => item.siteId === siteId && item.status === "active");
}

function blockString(block, key, fallback = "") {
  const value = block?.settings?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function toolCardsFromSite(site) {
  const headerBlocks = site?.themeSettings?.publishedJson?.globalSections?.header?.blocks ?? [];
  const pageBlocks = (site?.pages ?? []).flatMap((page) =>
    Object.values(page.publishedJson?.sections ?? {}).flatMap((section) => section.blocks ?? [])
  );
  const seen = new Set();
  return [...headerBlocks, ...pageBlocks]
    .filter((block) => block.type === "tool_card")
    .map((block) => {
      const title = blockString(block, "title", block.id);
      const href = blockString(block, "href", "/tools");
      const slug = slugifySegment(href.split("?")[0].replace(/\/+$/, "").split("/").filter(Boolean).pop() || title);
      return {
        slug,
        title,
        category: blockString(block, "category", "AI Tools"),
        href
      };
    })
    .filter((tool) => tool.slug && tool.title)
    .filter((tool) => {
      const key = `${tool.slug}:${tool.href}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function uniqueValues(values) {
  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)));
}

function expectedCoverageForSite(site, expected) {
  const creativeCategories = activeItems("creativePackCategories", expected.siteId);
  const toolCategories = activeItems("toolCategories", expected.siteId);
  const toolMenuItems = activeItems("toolMenuItems", expected.siteId);
  const fallbackToolCards = toolMenuItems.length ? [] : toolCardsFromSite(site);
  const toolGroupLabels = toolCategories.length
    ? toolCategories.filter((category) => !category.parentId).map((category) => category.label)
    : uniqueValues(fallbackToolCards.map((tool) => tool.category));
  const toolItemLabels = toolMenuItems.length
    ? toolMenuItems.map((tool) => tool.title)
    : fallbackToolCards.map((tool) => tool.title);
  const videoThemeCategories = activeItems("videoThemeCategories", expected.siteId);
  return {
    total:
      expected.baseArticleSlugs.length +
      creativeCategories.length +
      toolGroupLabels.length +
      toolItemLabels.length +
      videoThemeCategories.length,
    labels: {
      creativeCategories: creativeCategories.map((category) => category.label),
      toolGroups: toolGroupLabels,
      toolItems: toolItemLabels,
      videoThemeCategories: videoThemeCategories.map((category) => category.label)
    }
  };
}

function normalizedText(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function articleLabelText(article) {
  const section = article.publishedJson?.sections?.blog_detail_1;
  return normalizedText([
    article.slug,
    article.title,
    sectionSetting(section, "title"),
    sectionSetting(section, "summary"),
    article.publishedJson?.seo?.title,
    article.publishedJson?.seo?.description
  ].join(" "));
}

function hasArticleForLabel(articleTexts, label) {
  const normalizedLabel = normalizedText(label);
  if (!normalizedLabel) return true;
  return articleTexts.some((text) => text.includes(normalizedLabel));
}

const expectedSites = [
  {
    slug: "mydreamshoots",
    siteId: "site_dreamshoot",
    label: "Blog",
    foreignBrandPatterns: [/Aidreamcapes/i, /AIdreamcapes/i],
    baseArticleSlugs: [
      "/blog/preparing-source-photos",
      "/blog/choosing-ai-photo-packages",
      "/blog/private-gallery-and-credits-guide"
    ]
  },
  {
    slug: "aidreamcapes",
    siteId: "site_aidreamcapes",
    label: "Blog",
    foreignBrandPatterns: [/MyDreamShoots/i, /mydreamshoots/i, /DreamShootAI/i],
    baseArticleSlugs: [
      "/blog/planning-dreamscape-source-photos",
      "/blog/destination-mood-references",
      "/blog/route-album-credit-planning"
    ]
  }
];

const mydreamshootsFallbackMatch = seoIndexing.match(/const FALLBACK_INDEXABLE_PATHS = \[([\s\S]*?)\];/);
const aidreamcapesFallbackMatch = seoIndexing.match(/const AIDREAMCAPES_FALLBACK_INDEXABLE_PATHS = \[([\s\S]*?)\];/);
assert(Boolean(mydreamshootsFallbackMatch), "sitemap fallback keeps MyDreamShoots path list");
assert(Boolean(aidreamcapesFallbackMatch), "sitemap fallback keeps Aidreamcapes path list");
const mydreamshootsFallback = mydreamshootsFallbackMatch?.[1] ?? "";
const aidreamcapesFallback = aidreamcapesFallbackMatch?.[1] ?? "";
assert(!aidreamcapesFallback.includes('"/blog/preparing-source-photos"'), "Aidreamcapes sitemap fallback does not include MyDreamShoots source-photo slug");
assert(
  seoIndexing.includes("if (isLocalHostRequest) return runtime.sites.flatMap((site) => getSitemapUrlsForSite(runtime.state, site));") &&
    !seoIndexing.includes("if (isLocalHostRequest) return publicFallbackSitemapUrlsForHost(normalizedHosts);"),
  "local sitemap reads real indexable site pages before falling back"
);
assert(
  themeRenderer.includes('sectionType !== "blog_article"') && themeRenderer.includes('sectionType !== "blog_list"'),
  "published blog list and article sections server-render instead of lazy-loading empty shells"
);
assert(
  themeRenderer.includes('pagePath === "/blog"') && themeRenderer.includes("keptIntro") && themeRenderer.includes("simpleBlogTitle"),
  "theme renderer keeps the blog homepage to a simple intro and article list"
);
assert(
  storefrontRender.includes("function pageNeedsBlogEntries") &&
    (storefrontRender.match(/includeBlogEntries && page\.slug\.startsWith\("\/blog\/"\)/g) ?? []).length >= 2,
  "storefront render payload keeps blog article pages available to blog list sections"
);
assert(
  siteStore.includes("function publicRuntimePageWhere") && siteStore.includes('startsWith: "/blog/"'),
  "public storefront runtime loads blog article pages for blog list routes"
);

for (const expected of expectedSites) {
  const site = state.sites.find((item) => item.id === expected.siteId || item.slug === expected.slug);
  assert(Boolean(site), `${expected.slug}: site exists`);
  if (!site) continue;
  assert(String(site.primaryDomain ?? "").endsWith(".com"), `${expected.slug}: .com store scoped`, site.primaryDomain ?? "");

  const blogHome = site.pages.find((page) => page.slug === "/blog");
  assert(Boolean(blogHome), `${expected.slug}: /blog page exists`);
  assert(blogHome?.pageType === "blog", `${expected.slug}: /blog page type is blog`, blogHome?.pageType ?? "");
  assert(blogHome?.publishedJson?.sections?.blog_list_1?.type === "blog_list", `${expected.slug}: /blog renders blog_list`);

  const articlePages = site.pages.filter((page) => page.slug.startsWith("/blog/"));
  const coverage = expectedCoverageForSite(site, expected);
  assert(articlePages.length === coverage.total, `${expected.slug}: blog articles cover all category and tool surfaces`, `expected ${coverage.total}, found ${articlePages.length}`);
  const articleSlugs = articlePages.map((page) => page.slug).sort();
  for (const slug of expected.baseArticleSlugs) {
    assert(articleSlugs.includes(slug), `${expected.slug}: base article slug present ${slug}`);
  }
  const fallbackSource = expected.siteId === "site_aidreamcapes" ? aidreamcapesFallback : mydreamshootsFallback;
  for (const slug of articleSlugs) {
    assert(fallbackSource.includes(`"${slug}"`), `${expected.slug}: sitemap fallback includes article ${slug}`);
  }
  const articleTexts = articlePages.map(articleLabelText);
  for (const [coverageType, labels] of Object.entries(coverage.labels)) {
    for (const label of labels) {
      assert(hasArticleForLabel(articleTexts, label), `${expected.slug}: ${coverageType} label has blog coverage`, label);
    }
  }

  const allSlugs = site.pages.map((page) => page.slug);
  assert(new Set(allSlugs).size === allSlugs.length, `${expected.slug}: page slugs are unique`);

  const navBlogLinks = site.themeSettings?.publishedJson?.navigation?.footerLinks?.filter((link) => link.href === "/blog") ?? [];
  const blockBlogLinks = site.themeSettings?.publishedJson?.globalSections?.footer?.blocks?.filter((block) => block.settings?.href === "/blog") ?? [];
  const headerNavBlogLinks = site.themeSettings?.publishedJson?.navigation?.headerLinks?.filter((link) => link.href === "/blog") ?? [];
  const headerBlockBlogLinks = site.themeSettings?.publishedJson?.globalSections?.header?.blocks?.filter((block) => block.settings?.href === "/blog") ?? [];
  assert(headerNavBlogLinks.length === 1 && headerNavBlogLinks[0]?.label === "Blog", `${expected.slug}: header navigation has one Blog link`);
  assert(headerBlockBlogLinks.length === 1 && headerBlockBlogLinks[0]?.settings?.label === "Blog", `${expected.slug}: header blocks have one Blog link`);
  assert(navBlogLinks.length === 1 && navBlogLinks[0]?.label === expected.label, `${expected.slug}: footer navigation has one ${expected.label} blog link`);
  assert(blockBlogLinks.length === 1 && blockBlogLinks[0]?.settings?.label === expected.label, `${expected.slug}: footer blocks have one ${expected.label} blog link`);

  const seoPages = site.themeSettings?.publishedJson?.seo?.pages ?? {};
  for (const page of [blogHome, ...articlePages].filter(Boolean)) {
    const pageSeo = page.publishedJson?.seo ?? {};
    const mappedSeo = seoPages[page.id] ?? {};
    assert(Boolean(pageSeo.title && pageSeo.description && pageSeo.canonicalPath), `${expected.slug}${page.slug}: page SEO fields present`);
    assert(Boolean(pageSeo.keywords && pageSeo.keywords.length > 40), `${expected.slug}${page.slug}: page SEO keywords are specific`, pageSeo.keywords ?? "");
    assert(pageSeo.robots?.index === true && pageSeo.robots?.follow === true, `${expected.slug}${page.slug}: page is indexable`);
    assert(mappedSeo.canonicalPath === page.slug && mappedSeo.index === true && mappedSeo.follow === true, `${expected.slug}${page.slug}: theme SEO map supports sitemap`);
    assert(mappedSeo.keywords === pageSeo.keywords, `${expected.slug}${page.slug}: theme SEO map keeps page keywords`, mappedSeo.keywords ?? "");
  }

  for (const article of articlePages) {
    const articleSection = article.publishedJson?.sections?.blog_detail_1;
    const pageSeo = article.publishedJson?.seo ?? {};
    assert(articleSection?.type === "blog_article", `${expected.slug}${article.slug}: uses blog_article section`);
    assert(JSON.stringify(article.draftJson) === JSON.stringify(article.publishedJson), `${expected.slug}${article.slug}: draft and published match`);
    assert(sectionSetting(articleSection, "title").length > 20, `${expected.slug}${article.slug}: article title present`);
    assert(sectionSetting(articleSection, "summary").length > 100, `${expected.slug}${article.slug}: article summary present`);
    assert(sectionSetting(articleSection, "author").length > 5, `${expected.slug}${article.slug}: author present`);
    assert(/^\d{4}-\d{2}-\d{2}$/.test(sectionSetting(articleSection, "publishedAt")), `${expected.slug}${article.slug}: published date is ISO date`);
    assert(/^\d+$/.test(sectionSetting(articleSection, "readMinutes")), `${expected.slug}${article.slug}: read minutes present`);
    assert(sectionSetting(articleSection, "imageUrl").startsWith("/assets/"), `${expected.slug}${article.slug}: cover image is local asset`);
    assert((pageSeo.title ?? "").length >= 45 && (pageSeo.title ?? "").length <= 70, `${expected.slug}${article.slug}: SEO title is search-result friendly`, pageSeo.title ?? "");
    assert((pageSeo.description ?? "").length >= 120 && (pageSeo.description ?? "").length <= 160, `${expected.slug}${article.slug}: SEO description is search-result friendly`, pageSeo.description ?? "");
    assert(pageSeo.canonicalPath === article.slug, `${expected.slug}${article.slug}: canonical path matches slug`, pageSeo.canonicalPath ?? "");
    const body = sectionSetting(articleSection, "body");
    assert(body.length > 3400, `${expected.slug}${article.slug}: article body is substantial`, `${body.length} chars`);
    assert((body.match(/<h2 id="/g) ?? []).length >= 4, `${expected.slug}${article.slug}: body has table-of-contents anchors`);
    assert((body.match(/<h3 id="/g) ?? []).length >= 3, `${expected.slug}${article.slug}: body includes FAQ-style subquestions`);
    assert(/faq/i.test(body), `${expected.slug}${article.slug}: body includes reader FAQ`);
    assert(/<table|<ul|<ol/i.test(body), `${expected.slug}${article.slug}: body includes scannable comparison or checklist content`);
    assert(/<a href="\/(collections|pricing|login)"/i.test(body) || /private gallery|private job|private request|visible credit|credit cost|account gallery|package/i.test(body), `${expected.slug}${article.slug}: body ties advice to store workflow`);
    const lowerBody = body.toLowerCase();
    const badPhrase = forbiddenArticlePhrases.find((phrase) => lowerBody.includes(phrase));
    assert(!badPhrase, `${expected.slug}${article.slug}: body avoids prompt-like filler`, badPhrase ?? "");
  }

  const combinedBlogText = articlePages.map(pageText).join("\n");
  for (const pattern of expected.foreignBrandPatterns) {
    assert(!pattern.test(combinedBlogText), `${expected.slug}: article copy does not mention sibling brand`, String(pattern));
  }
}

const euSites = state.sites.filter((site) => String(site.primaryDomain ?? "").endsWith(".eu"));
for (const site of euSites) {
  const articlePages = site.pages.filter((page) => page.slug.startsWith("/blog/"));
  assert(articlePages.length <= 1, `${site.slug}: .eu blog article count unchanged`, `found ${articlePages.length}`);
}

const failed = checks.filter((check) => !check.ok);
if (failed.length) {
  console.error("DreamShoot blog content smoke failed:");
  for (const check of failed) console.error(`- ${check.label}${check.detail ? `: ${check.detail}` : ""}`);
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    ok: true,
    checkCount: checks.length,
    sites: expectedSites.map((site) => site.slug)
  }, null, 2));
}
