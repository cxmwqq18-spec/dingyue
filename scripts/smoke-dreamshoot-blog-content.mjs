import fs from "fs";
import path from "path";
import crypto from "crypto";
import { readPlatformStateFromSql } from "./lib/platform-state-sql.mjs";

const state = await readPlatformStateFromSql();
const seoIndexing = fs.readFileSync(path.join(process.cwd(), "src/lib/seo-indexing.ts"), "utf8");
const sitemapBuilder = seoIndexing.slice(seoIndexing.indexOf("function sitemapEntriesForSite"), seoIndexing.indexOf("function canonicalPathForSitemapPage"));
const storefrontRender = fs.readFileSync(path.join(process.cwd(), "src/lib/storefront-render.tsx"), "utf8");
const themeRenderer = fs.readFileSync(path.join(process.cwd(), "src/components/theme-renderer.tsx"), "utf8");
const siteStore = fs.readFileSync(path.join(process.cwd(), "src/lib/stores/site-store.ts"), "utf8");
const hostCatchAllPage = fs.readFileSync(path.join(process.cwd(), "src/app/[...path]/page.tsx"), "utf8");

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

function blogContentIdentity(page) {
  const articleSettings = page.publishedJson?.sections?.blog_detail_1?.settings ?? {};
  const value = page.publishedJson?.contentId ?? articleSettings.contentId;
  return typeof value === "string" && value.trim() ? `content:${value.trim()}` : `page:${page.id}`;
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

function imagePathnameForUrl(imageUrl) {
  return new URL(String(imageUrl ?? ""), "https://local.invalid").pathname;
}

function normalizedImageUrlForUniqueness(imageUrl) {
  return decodeURIComponent(imagePathnameForUrl(imageUrl)).replace(/\/+/g, "/").toLowerCase();
}

function imageFilePathForUrl(imageUrl) {
  return path.join(process.cwd(), "public", decodeURIComponent(imagePathnameForUrl(imageUrl)).replace(/^\/+/, ""));
}

function imageShaForUrl(imageUrl) {
  const filePath = imageFilePathForUrl(imageUrl);
  if (!fs.existsSync(filePath)) return `missing:${normalizedImageUrlForUniqueness(imageUrl)}`;
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function duplicateGroups(rows, keyFn) {
  const grouped = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }
  return Array.from(grouped.entries()).filter(([, group]) => group.length > 1);
}

const expectedSites = [
  {
    slug: "mydreamshoots",
    siteId: "site_dreamshoot",
    label: "Blog",
    coverageMode: "published-articles",
    foreignBrandPatterns: [/Aidreamcapes/i, /AIdreamcapes/i]
  },
  {
    slug: "aidreamcapes",
    siteId: "site_aidreamcapes",
    label: "Guides",
    coverageMode: "published-articles",
    foreignBrandPatterns: [/MyDreamShoots/i, /mydreamshoots/i, /DreamShootAI/i]
  }
];

assert(
  seoIndexing.includes("function sitemapEntriesForSite") &&
    seoIndexing.includes("createPublishedSiteSnapshot") &&
    seoIndexing.includes("resolveEffectivePublishedPage") &&
    !sitemapBuilder.includes("collectDynamicIndexablePaths") &&
    !sitemapBuilder.includes("collectExplicitSeoDirectoryPaths"),
  "sitemap derives indexable paths from effective published snapshot pages only"
);
assert(
  hostCatchAllPage.includes("DREAMSHOOT_LEGACY_BLOG_CATEGORY_REDIRECTS") &&
    hostCatchAllPage.includes("DREAMSHOOT_LEGACY_BLOG_TOOL_REDIRECTS") &&
    hostCatchAllPage.includes("DREAMSHOOT_LEGACY_BLOG_VIDEO_REDIRECTS") &&
    hostCatchAllPage.includes("AIDREAMCAPES_LEGACY_BLOG_CATEGORY_REDIRECTS") &&
    hostCatchAllPage.includes("AIDREAMCAPES_LEGACY_BLOG_TOOL_REDIRECTS") &&
    hostCatchAllPage.includes("AIDREAMCAPES_LEGACY_BLOG_VIDEO_REDIRECTS") &&
    hostCatchAllPage.includes("redirectLegacyBlogArticle(site, slug, routeQuery)"),
  "host route keeps legacy duplicate blog URLs on a permanent redirect path"
);
assert(
  seoIndexing.includes("if (isLocalHostRequest) return runtime.sites.flatMap((site) => sitemapEntriesForSite(runtime.state, site));") &&
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
  storefrontRender.includes("const blogArticleMetadataSettings") &&
    storefrontRender.includes("function lightweightBlogArticlePageForClient") &&
    storefrontRender.includes("Object.entries(sourceSection.settings).filter"),
  "non-current blog articles use metadata-only client payloads"
);
assert(
  themeRenderer.includes('aria-label="More guides"') &&
    themeRenderer.includes("blogCoverImageClassName(site)") &&
    themeRenderer.includes("preview={false}") &&
    themeRenderer.includes('data-dreamshoot-preview-disabled="true"') &&
    !themeRenderer.includes("Try the workflow yourself"),
  "blog details use a light internal-link footer and disable fullscreen cover previews"
);
const blogCoverHelper = themeRenderer.match(/function blogCoverImageClassName[\s\S]*?\n}\n/)?.[0] ?? "";
assert(
  themeRenderer.includes("aspect-[4/3] overflow-hidden bg-white/[0.08]") &&
    themeRenderer.includes("aspect-[4/3] overflow-hidden bg-zinc-100") &&
    blogCoverHelper.includes("object-contain object-center") &&
    !blogCoverHelper.includes("object-cover") &&
    !blogCoverHelper.includes("scale-["),
  "blog cards use link-safe cover frames without crop or scale obstruction"
);
assert(
  storefrontRender.includes("lightweightBlogArticlePageForClient(page)") &&
    !storefrontRender.includes("includeBlogEntries && page.slug.startsWith(\"/blog/\") {\n      pageMap.set(page.id, lightweightPageForClient(page, true));"),
  "section renders do not hydrate every related blog body"
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
  const coverage = { total: articlePages.length, targetHrefs: [] };
  assert(articlePages.length > 0, `${expected.slug}: current published source has blog articles`);
  const articleSlugs = articlePages.map((page) => page.slug).sort();
  assert(!articleSlugs.some((slug) => /-tool-guide$/i.test(slug)), `${expected.slug}: no tool-level blog articles remain`);
  assert(!articleSlugs.some((slug) => /-video-theme-guide$/i.test(slug)), `${expected.slug}: no video-theme blog articles remain`);
  const articleTargetHrefs = articlePages.map((article) => sectionSetting(article.publishedJson?.sections?.blog_detail_1, "targetHref"));
  for (const href of coverage.targetHrefs ?? []) {
    assert(articleTargetHrefs.includes(href), `${expected.slug}: package article links to focused theme detail`, href);
  }

  const allSlugs = site.pages.map((page) => page.slug);
  assert(new Set(allSlugs).size === allSlugs.length, `${expected.slug}: page slugs are unique`);
  const duplicateContentGroups = duplicateGroups(articlePages.map((article) => ({ identity: blogContentIdentity(article), slug: article.slug })), (row) => row.identity);
  assert(duplicateContentGroups.length === 0, `${expected.slug}: blog content identities are unique`, JSON.stringify(duplicateContentGroups));
  const imageRows = articlePages.map((article) => {
    const imageUrl = sectionSetting(article.publishedJson?.sections?.blog_detail_1, "imageUrl");
    return {
      slug: article.slug,
      imageUrl,
      normalizedUrl: normalizedImageUrlForUniqueness(imageUrl),
      sha: imageShaForUrl(imageUrl)
    };
  });
  const duplicateImageUrlGroups = duplicateGroups(imageRows, (row) => row.normalizedUrl);
  const duplicateImageShaGroups = duplicateGroups(imageRows, (row) => row.sha);
  assert(duplicateImageUrlGroups.length === 0, `${expected.slug}: blog cover normalized image URLs are unique`, JSON.stringify(duplicateImageUrlGroups));
  assert(duplicateImageShaGroups.length === 0, `${expected.slug}: blog cover image SHA fingerprints are unique`, JSON.stringify(duplicateImageShaGroups));

  const navBlogLinks = site.themeSettings?.publishedJson?.navigation?.footerLinks?.filter((link) => link.href === "/blog") ?? [];
  const blockBlogLinks = site.themeSettings?.publishedJson?.globalSections?.footer?.blocks?.filter((block) => block.settings?.href === "/blog") ?? [];
  const headerNavBlogLinks = site.themeSettings?.publishedJson?.navigation?.headerLinks?.filter((link) => link.href === "/blog") ?? [];
  const headerBlockBlogLinks = site.themeSettings?.publishedJson?.globalSections?.header?.blocks?.filter((block) => block.settings?.href === "/blog") ?? [];
  assert(headerNavBlogLinks.length === 1 && headerNavBlogLinks[0]?.label === expected.label, `${expected.slug}: header navigation has one ${expected.label} link`);
  assert(headerBlockBlogLinks.length === 1 && headerBlockBlogLinks[0]?.settings?.label === expected.label, `${expected.slug}: header blocks have one ${expected.label} link`);
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
    assert(sectionSetting(articleSection, "targetHref").length > 1, `${expected.slug}${article.slug}: targetHref is present`);
    assert(sectionSetting(articleSection, "targetLabel").length > 3, `${expected.slug}${article.slug}: targetLabel is present`);
    assert(
      article.publishedJson.sectionsOrder.length === 1 &&
        article.publishedJson.sectionsOrder[0] === "blog_detail_1" &&
        Object.keys(article.publishedJson.sections).every((sectionId) => sectionId === "blog_detail_1"),
      `${expected.slug}${article.slug}: detail page contains only blog_detail_1`
    );
    const targetHref = sectionSetting(articleSection, "targetHref");
    assert(/^(\/(?:ai-image-generation|collections)(?:\/[^/]+)?|\/pricing|\/login|\/policies\/[^/]+)$/.test(targetHref), `${expected.slug}${article.slug}: CTA target is a current local route`, targetHref);
    if (expected.siteId === "site_dreamshoot") {
      const imageUrl = sectionSetting(articleSection, "imageUrl");
      assert(!/\/pack-covers\//i.test(imageUrl), `${expected.slug}${article.slug}: cover avoids package cover composites`, imageUrl);
      assert(!/\/(category-covers|hero-grid)-|collage|contact-sheet|before-after|beforeafter|split|grid|montage|multi-panel|panel/i.test(imageUrl), `${expected.slug}${article.slug}: cover avoids collage-style assets`, imageUrl);
    }
    if (expected.siteId === "site_dreamshoot") {
      assert((pageSeo.title ?? "").length >= 45 && (pageSeo.title ?? "").length <= 70, `${expected.slug}${article.slug}: SEO title is search-result friendly`, pageSeo.title ?? "");
      assert((pageSeo.description ?? "").length >= 120 && (pageSeo.description ?? "").length <= 160, `${expected.slug}${article.slug}: SEO description is search-result friendly`, pageSeo.description ?? "");
    } else {
      assert(Boolean(pageSeo.title && pageSeo.description), `${expected.slug}${article.slug}: SEO title and description are present`);
    }
    assert(pageSeo.canonicalPath === article.slug, `${expected.slug}${article.slug}: canonical path matches slug`, pageSeo.canonicalPath ?? "");
    const body = sectionSetting(articleSection, "body");
    const deepArticle = expected.siteId === "site_dreamshoot";
    assert(body.length > (deepArticle ? 3400 : 700), `${expected.slug}${article.slug}: article body is substantial`, `${body.length} chars`);
    assert((body.match(/<h2(?: id="[^"]+")?>/g) ?? []).length >= (deepArticle ? 4 : 2), `${expected.slug}${article.slug}: body has scannable sections`);
    if (deepArticle) {
      assert((body.match(/<h3 id="/g) ?? []).length >= 3, `${expected.slug}${article.slug}: body includes FAQ-style subquestions`);
      assert(/faq/i.test(body), `${expected.slug}${article.slug}: body includes reader FAQ`);
      assert(/<table|<ul|<ol/i.test(body), `${expected.slug}${article.slug}: body includes scannable comparison or checklist content`);
    }
    assert(/<a href="\/(collections|pricing|login)"/i.test(body) || /private gallery|private job|private request|visible credit|credit cost|account gallery|package/i.test(body), `${expected.slug}${article.slug}: body ties advice to store workflow`);
    const lowerBody = body.toLowerCase();
    const badPhrase = forbiddenArticlePhrases.find((phrase) => lowerBody.includes(phrase));
    assert(!badPhrase, `${expected.slug}${article.slug}: body avoids prompt-like filler`, badPhrase ?? "");
  }

  const copyCheckedArticles = articlePages.filter((page) => !/-video-theme-guide$/i.test(page.slug));
  const combinedBlogText = copyCheckedArticles.map(pageText).join("\n");
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
