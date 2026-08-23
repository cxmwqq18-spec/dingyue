import fs from "node:fs";
import path from "node:path";

import { mydreamshootsBlogSeoRemediationArticles } from "./mydreamshoots-blog-seo-remediation-articles.mjs";
import {
  MYDREAMSHOOTS_SEASONAL_OCCASION_BLOG_SEO_SLUGS,
  mydreamshootsSeasonalOccasionBlogSeoArticles
} from "./mydreamshoots-seasonal-occasion-blog-seo-articles.mjs";
import { readPlatformStateFromSql } from "./lib/platform-state-sql.mjs";

const repoRoot = process.cwd();
const state = await readPlatformStateFromSql();
const routeSource = fs.readFileSync(path.join(repoRoot, "src", "app", "[...path]", "page.tsx"), "utf8");
const failures = [];
const warnings = [];
const site = state.sites.find((item) => item.id === "site_dreamshoot");

function assert(condition, label, detail = "") {
  if (!condition) failures.push(`${label}${detail ? `: ${detail}` : ""}`);
}

function normalizeText(value) {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[^;]+;/g, " ")
    .toLowerCase()
    .replace(/mydreamshoots/g, "brand")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ngrams(value, size = 5) {
  const words = normalizeText(value).split(" ").filter(Boolean);
  const result = new Set();
  for (let index = 0; index <= words.length - size; index += 1) result.add(words.slice(index, index + size).join(" "));
  return result;
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

function bodyHrefs(body) {
  return Array.from(String(body ?? "").matchAll(/<a\s+href="([^"]+)"/g), (match) => match[1]);
}

const pages = new Map((site?.pages ?? []).map((page) => [page.slug, page]));
const knownRoutes = new Set(pages.keys());
for (const pack of state.creativePacks.filter((item) => item.siteId === "site_dreamshoot" && item.status === "active")) {
  knownRoutes.add(`/ai-image-generation/${slugify(pack.name || pack.category)}`);
}
knownRoutes.add("/ai-image-generation");
knownRoutes.add("/content");

const subjectAltPatterns = new Map([
  ["/blog/boudoir-photo-package-guide", /boudoir|adult|private/i],
  ["/blog/christmas-couple-photo-package-guide", /christmas.*couple|couple.*christmas/i],
  ["/blog/christmas-photos-photo-package-guide", /christmas.*(?:group|family)|(?:group|family).*christmas/i],
  ["/blog/desi-wedding-photo-package-guide", /desi.*wedding/i],
  ["/blog/engagement-photo-package-guide", /engagement/i],
  ["/blog/halloween-party-photos-photo-package-guide", /halloween.*party/i],
  ["/blog/holiday-photo-package-guide", /holiday/i],
  ["/blog/indian-wedding-photo-package-guide", /indian.*wedding/i],
  ["/blog/thanksgiving-group-photos-photo-package-guide", /thanksgiving.*group/i]
]);
const genericCtaSlugs = new Set([
  "/blog/christmas-couple-photo-package-guide",
  "/blog/desi-wedding-photo-package-guide",
  "/blog/indian-wedding-photo-package-guide"
]);
const contractKeys = [
  "entityName", "primaryKeyword", "searchIntent", "seoTitle", "seoDescription", "title", "targetLabel",
  "targetHref", "relatedLinks", "imageAlt", "authorUrl", "reviewOwner", "evidenceType", "evidenceDate"
];

assert(Boolean(site), "MyDreamShoots site exists");
assert(MYDREAMSHOOTS_SEASONAL_OCCASION_BLOG_SEO_SLUGS.length === 9, "exactly nine seasonal and occasion slugs are declared");
assert(new Set(MYDREAMSHOOTS_SEASONAL_OCCASION_BLOG_SEO_SLUGS).size === 9, "seasonal and occasion slugs are unique");

const currentNgrams = new Map();
for (const article of mydreamshootsSeasonalOccasionBlogSeoArticles) {
  const page = pages.get(article.slug);
  assert(Boolean(page), `${article.slug} exists in local state`);
  for (const key of contractKeys) {
    const value = article[key];
    assert(Array.isArray(value) ? value.length > 0 : Boolean(String(value ?? "").trim()), `${article.slug} declares ${key}`);
  }
  if (!page) continue;

  const section = page.publishedJson?.sections?.blog_detail_1;
  const settings = section?.settings ?? {};
  const seo = page.publishedJson?.seo ?? {};
  const body = String(settings.body ?? "");
  const links = bodyHrefs(body);
  const visible = normalizeText(`${page.title} ${settings.title} ${settings.summary} ${body} ${seo.title} ${seo.description}`);
  const words = normalizeText(body).split(" ").filter(Boolean).length;
  const headingIds = Array.from(body.matchAll(/<h[23]\s+id="([^"]+)"/g), (match) => match[1]);

  assert(section?.type === "blog_article" && page.pageType === "article", `${article.slug} renders as an article`);
  assert(settings.title === article.title, `${article.slug} H1 matches its profile`);
  assert(settings.entityName === article.entityName, `${article.slug} entityName matches its profile`);
  assert(settings.primaryKeyword === article.primaryKeyword && settings.searchIntent === article.searchIntent, `${article.slug} keyword and intent match`);
  assert(settings.targetHref === article.targetHref && settings.targetLabel === article.targetLabel, `${article.slug} CTA matches its profile`);
  assert(JSON.stringify(settings.relatedLinks) === JSON.stringify(article.relatedLinks), `${article.slug} related links match its profile`);
  assert(settings.author === "myDreamshoots editorial team" && settings.authorType === "Organization", `${article.slug} author is the approved Organization`);
  assert(settings.authorUrl === "/about-us" && settings.reviewOwner === "myDreamshoots editorial team", `${article.slug} author and review URLs are present`);
  assert(settings.evidenceType === "editorial-guidance" && settings.evidenceDate === "2026-08-19", `${article.slug} evidence boundary is current`);
  assert(settings.publishedAt === "2026-07-28" && settings.updatedAt === "2026-08-19" && settings.reviewedAt === "2026-08-19", `${article.slug} publication dates follow the remediation contract`);
  assert(seo.title === article.seoTitle && seo.description === article.seoDescription, `${article.slug} SEO metadata matches its profile`);
  assert(seo.canonicalPath === article.slug && seo.robots?.index === true && seo.robots?.follow === true, `${article.slug} is self-canonical and indexable`);
  assert(seo.title.length >= 41 && seo.title.length <= 70, `${article.slug} title length is controlled`, String(seo.title.length));
  assert(seo.description.length >= 120 && seo.description.length <= 160, `${article.slug} description length is controlled`, String(seo.description.length));
  assert(words >= 700 && body.length >= 3400, `${article.slug} body retains useful depth`, `${words} words / ${body.length} chars`);
  assert((body.match(/<h2 id=/g) ?? []).length >= 5 && (body.match(/<h3 id=/g) ?? []).length >= 3, `${article.slug} has enough topic sections and FAQs`);
  assert(new Set(headingIds).size === headingIds.length, `${article.slug} heading anchors are unique`);
  assert(links.length >= 3 && links.length <= 5, `${article.slug} has 3-5 contextual links`, String(links.length));
  assert(links.every((href) => href.startsWith("/") && knownRoutes.has(href)), `${article.slug} contextual links use known local routes`, links.join(", "));
  assert((settings.relatedLinks ?? []).every((link) => knownRoutes.has(link.href)), `${article.slug} related links use known local routes`);
  assert(knownRoutes.has(settings.targetHref), `${article.slug} CTA uses a known public route`, settings.targetHref);
  assert(subjectAltPatterns.get(article.slug)?.test(settings.imageAlt), `${article.slug} cover alt matches its subject`, settings.imageAlt);
  assert(!/Use .+ when .+ and .+ are the nearest match|The strongest .+ requests keep the brief|Prepare clear approved source portraits/i.test(body), `${article.slug} removes generic template phrases`);
  assert(!/open avatar theme|ai video add-ons|start with headshot|photo package category/i.test(visible), `${article.slug} removes unrelated recommendations`);

  if (genericCtaSlugs.has(article.slug)) {
    assert(settings.targetHref === "/ai-image-generation" && settings.targetLabel === "Browse AI Image Generation", `${article.slug} uses the approved generic CTA`);
  }
  assert(!/nightlife|cannes|rich lifestyle/i.test(visible), `${article.slug} does not expose a mismatched product entity`);
  if (article.slug.endsWith("boudoir-photo-package-guide")) {
    assert(/consenting adults|adult consent|approved adult/i.test(visible) && /non explicit|non-explicit/i.test(visible), "Boudoir stays adult, consensual, and non-explicit");
  }

  currentNgrams.set(article.slug, ngrams(body));
}

const comparisonArticles = [...mydreamshootsSeasonalOccasionBlogSeoArticles, ...mydreamshootsBlogSeoRemediationArticles];
const comparisonNgrams = new Map(comparisonArticles.map((article) => [article.slug, ngrams(article.body)]));
let maximumSimilarity = { score: 0, pair: [] };
for (let leftIndex = 0; leftIndex < mydreamshootsSeasonalOccasionBlogSeoArticles.length; leftIndex += 1) {
  const left = mydreamshootsSeasonalOccasionBlogSeoArticles[leftIndex];
  for (let rightIndex = leftIndex + 1; rightIndex < comparisonArticles.length; rightIndex += 1) {
    const right = comparisonArticles[rightIndex];
    const score = jaccard(comparisonNgrams.get(left.slug), comparisonNgrams.get(right.slug));
    if (score > maximumSimilarity.score) maximumSimilarity = { score, pair: [left.slug, right.slug] };
    assert(score < 0.70, `${left.slug} and ${right.slug} stay below the 5-gram Jaccard hard limit`, score.toFixed(4));
    if (score >= 0.35) warnings.push(`${left.slug} and ${right.slug} need manual similarity review (${score.toFixed(4)})`);
  }
}

const routeMap = routeSource.match(/const DREAMSHOOT_LEGACY_BLOG_CATEGORY_REDIRECTS[\s\S]*?\n};/)?.[0] ?? "";
for (const slug of MYDREAMSHOOTS_SEASONAL_OCCASION_BLOG_SEO_SLUGS) {
  const key = slug.replace(/^\/blog\//, "").replace(/-photo-package-guide$/, "");
  assert(!routeMap.includes(`"${key}"`) && !routeMap.includes(`${key}:`), `${slug} has no legacy redirect mapping`);
}

if (failures.length) {
  console.error("MyDreamShoots seasonal and occasion blog SEO smoke failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    ok: true,
    status: "local-only-not-published",
    pageCount: mydreamshootsSeasonalOccasionBlogSeoArticles.length,
    maximumFiveGramJaccard: Number(maximumSimilarity.score.toFixed(4)),
    maximumSimilarityPair: maximumSimilarity.pair,
    warnings
  }, null, 2));
}
