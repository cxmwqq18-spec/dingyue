import fs from "node:fs";
import path from "node:path";

import {
  MYDREAMSHOOTS_BLOG_SEO_REMEDIATION_SLUGS,
  mydreamshootsBlogSeoRemediationArticles
} from "./mydreamshoots-blog-seo-remediation-articles.mjs";

const repoRoot = process.cwd();
const state = JSON.parse(fs.readFileSync(path.join(repoRoot, "data/platform-state.json"), "utf8"));
const routeSource = fs.readFileSync(path.join(repoRoot, "src", "app", "[...path]", "page.tsx"), "utf8");
const rendererSource = fs.readFileSync(path.join(repoRoot, "src", "components", "theme-renderer.tsx"), "utf8");
const seoSource = fs.readFileSync(path.join(repoRoot, "src", "lib", "theme", "seo.ts"), "utf8");
const jsonLdSource = fs.readFileSync(path.join(repoRoot, "src", "lib", "theme", "json-ld.ts"), "utf8");
const sitemapSource = fs.readFileSync(path.join(repoRoot, "src", "lib", "seo-indexing.ts"), "utf8");

const failures = [];
const warnings = [];
const site = state.sites.find((item) => item.id === "site_dreamshoot");

function assert(condition, label, detail = "") {
  if (!condition) failures.push(`${label}${detail ? `: ${detail}` : ""}`);
}

function normalizeText(value) {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .toLowerCase()
    .replace(/mydreamshoots/g, "brand")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ngrams(value, size = 5) {
  const words = normalizeText(value).split(" ").filter(Boolean);
  const values = new Set();
  for (let index = 0; index <= words.length - size; index += 1) values.add(words.slice(index, index + size).join(" "));
  return values;
}

function jaccard(left, right) {
  let intersection = 0;
  for (const value of left) if (right.has(value)) intersection += 1;
  const union = left.size + right.size - intersection;
  return union ? intersection / union : 0;
}

function slugify(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function hrefsFromBody(body) {
  return Array.from(String(body ?? "").matchAll(/<a\s+href="([^"]+)"/g), (match) => match[1]);
}

const pages = new Map((site?.pages ?? []).map((page) => [page.slug, page]));
const knownRoutes = new Set(pages.keys());
for (const pack of state.creativePacks.filter((item) => item.siteId === "site_dreamshoot" && item.status === "active")) {
  knownRoutes.add(`/ai-image-generation/${slugify(pack.name || pack.category)}`);
}
knownRoutes.add("/ai-image-generation");

assert(Boolean(site), "MyDreamShoots site exists");
assert(MYDREAMSHOOTS_BLOG_SEO_REMEDIATION_SLUGS.length === 9, "exactly nine remediation slugs are declared");
assert(rendererSource.includes("data-blog-article-actions=\"true\""), "blog article CTA renderer exists");
assert(rendererSource.includes("width={1024}") && rendererSource.includes("height={1024}"), "blog cover image dimensions are explicit");
assert(seoSource.includes('type: \"article\"'), "article Open Graph type is emitted");
assert(seoSource.includes("publishedTime") && seoSource.includes("modifiedTime"), "article Open Graph dates are emitted");
assert(jsonLdSource.includes('"@type": "BlogPosting"'), "BlogPosting schema exists");
assert(jsonLdSource.includes('"@type": "ImageObject"') && jsonLdSource.includes("dreamshootai-logo-refined.svg"), "Organization logo is emitted");
assert(sitemapSource.includes("pageContentLastModified"), "sitemap uses article content modified date");

const articlePages = [];
const articleNgrams = new Map();
for (const article of mydreamshootsBlogSeoRemediationArticles) {
  const page = pages.get(article.slug);
  assert(Boolean(page), `${article.slug} exists in local state`);
  if (!page) continue;
  articlePages.push(page);
  const section = page.publishedJson?.sections?.blog_detail_1;
  const settings = section?.settings ?? {};
  const seo = page.publishedJson?.seo ?? {};
  const body = String(settings.body ?? "");
  const bodyLinks = hrefsFromBody(body);
  const wordBody = ngrams(body);
  const headingIds = Array.from(body.matchAll(/<h[23]\s+id="([^"]+)"/g), (match) => match[1]);

  assert(section?.type === "blog_article", `${article.slug} uses blog_article`);
  assert(page.pageType === "article", `${article.slug} pageType is article`);
  assert(settings.title === article.title, `${article.slug} H1 matches profile`);
  assert(settings.title !== "Profile Card Photos: Plan a Consistent Image Set for Personal and Creator Uses" || article.entityName === "Profile Cards", `${article.slug} has the requested entity title`);
  assert(settings.entityName === article.entityName, `${article.slug} entityName matches`);
  assert(settings.primaryKeyword === article.primaryKeyword, `${article.slug} primaryKeyword matches`);
  assert(settings.searchIntent === article.searchIntent, `${article.slug} searchIntent matches`);
  assert(settings.targetHref === article.targetHref, `${article.slug} CTA route matches`, settings.targetHref);
  assert(settings.targetLabel === article.targetLabel, `${article.slug} CTA label matches`, settings.targetLabel);
  assert(JSON.stringify(settings.relatedLinks) === JSON.stringify(article.relatedLinks), `${article.slug} relatedLinks match profile`);
  assert(settings.author === "myDreamshoots editorial team" && settings.authorType === "Organization", `${article.slug} author entity is unified`);
  assert(settings.authorUrl === "/about-us" && settings.reviewOwner === "myDreamshoots editorial team", `${article.slug} author/reviewer metadata is present`);
  assert(settings.evidenceType === "editorial-guidance" && settings.evidenceDate === "2026-08-19", `${article.slug} evidence boundary is present`);
  assert(seo.canonicalPath === article.slug, `${article.slug} canonical is self-referencing`);
  assert(seo.robots?.index === true && seo.robots?.follow === true, `${article.slug} remains index/follow`);
  assert(typeof seo.title === "string" && seo.title.length >= 41 && seo.title.length <= 70, `${article.slug} title length is controlled`, seo.title);
  assert(typeof seo.description === "string" && seo.description.length >= 120 && seo.description.length <= 160, `${article.slug} description length is controlled`, String(seo.description?.length));
  assert(body.length >= 3400, `${article.slug} body is substantive`, String(body.length));
  assert((body.match(/<h2 id=/g) ?? []).length >= 5, `${article.slug} has topic sections`);
  assert((body.match(/<h3 id=/g) ?? []).length >= 3, `${article.slug} has three topic FAQs`);
  assert(new Set(headingIds).size === headingIds.length, `${article.slug} heading anchors are unique`);
  assert(bodyLinks.length >= 3 && bodyLinks.length <= 5, `${article.slug} has 3-5 body links`, String(bodyLinks.length));
  assert(bodyLinks.every((href) => href.startsWith("/")), `${article.slug} body links are local`);
  for (const href of [...bodyLinks, ...(settings.relatedLinks ?? []).map((link) => link.href), article.targetHref]) {
    assert(knownRoutes.has(href) || href === "/content" || href.startsWith("/policies/"), `${article.slug} link has a known public route`, href);
  }
  assert(!/Use .+ when .+ and .+ are the nearest match|The strongest .+ requests keep the brief|Prepare clear approved source portraits/i.test(body), `${article.slug} removes forbidden template phrases`);
  if (article.entityName === "Profile Cards") {
    const visible = `${page.title} ${settings.title} ${settings.summary} ${body} ${seo.title} ${seo.description}`;
    assert(!/anime avatar|anime-style avatar|avatar photo set/i.test(visible), "Profile Cards is independent from Anime Avatar content");
    assert(!/photo package category|start with headshot/i.test(visible), "Profile Cards has no generic category template leakage");
  }
  assert(typeof settings.imageAlt === "string" && settings.imageAlt.length >= 45, `${article.slug} has topic-specific image alt`);
  if (article.entityName === "Professional Headshots") assert(!/credit|panel/i.test(settings.imageAlt), "Professional Headshots alt is not a credit-panel description");
  if (article.entityName === "Social Cards") assert(!/profile card/i.test(settings.imageAlt), "Social Cards alt is not a profile-card description");
  if (article.entityName === "Product Style") assert(/product|packag|lifestyle|commerce/i.test(settings.imageAlt), "Product Style alt describes commerce subject");

  articleNgrams.set(article.slug, wordBody);
}

let maximumSimilarity = { score: 0, pair: [] };
for (let leftIndex = 0; leftIndex < articlePages.length; leftIndex += 1) {
  for (let rightIndex = leftIndex + 1; rightIndex < articlePages.length; rightIndex += 1) {
    const left = articlePages[leftIndex];
    const right = articlePages[rightIndex];
    const score = jaccard(articleNgrams.get(left.slug), articleNgrams.get(right.slug));
    if (score > maximumSimilarity.score) maximumSimilarity = { score, pair: [left.slug, right.slug] };
    assert(score < 0.70, `${left.slug} and ${right.slug} stay below 5-gram Jaccard hard limit`, score.toFixed(4));
    if (score >= 0.35) warnings.push(`${left.slug} and ${right.slug} need manual similarity review (${score.toFixed(4)})`);
  }
}

const routeMap = routeSource.match(/const DREAMSHOOT_LEGACY_BLOG_CATEGORY_REDIRECTS[\s\S]*?\n};/)?.[0] ?? "";
for (const slug of MYDREAMSHOOTS_BLOG_SEO_REMEDIATION_SLUGS) {
  const key = slug.replace(/^\/blog\//, "").replace(/-photo-package-guide$/, "");
  assert(!routeMap.includes(`"${key}"`) && !routeMap.includes(`${key}:`), `${slug} has no legacy redirect mapping`);
}

if (failures.length) {
  console.error("MyDreamShoots blog SEO remediation smoke failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ ok: true, status: "local-only-not-published", pageCount: articlePages.length, maximumFiveGramJaccard: Number(maximumSimilarity.score.toFixed(4)), maximumSimilarityPair: maximumSimilarity.pair, warnings }, null, 2));
}
