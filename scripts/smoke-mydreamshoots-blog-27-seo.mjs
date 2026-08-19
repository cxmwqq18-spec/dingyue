#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { mydreamshootsBlogSeoRemediationArticles } from "./mydreamshoots-blog-seo-remediation-articles.mjs";
import { mydreamshootsSeasonalOccasionBlogSeoArticles } from "./mydreamshoots-seasonal-occasion-blog-seo-articles.mjs";

const repoRoot = process.cwd();
const state = JSON.parse(fs.readFileSync(path.join(repoRoot, "data", "platform-state.json"), "utf8"));
const routeSource = fs.readFileSync(path.join(repoRoot, "src", "app", "[...path]", "page.tsx"), "utf8");
const seoSource = fs.readFileSync(path.join(repoRoot, "src", "lib", "theme", "seo.ts"), "utf8");
const jsonLdSource = fs.readFileSync(path.join(repoRoot, "src", "lib", "theme", "json-ld.ts"), "utf8");
const rendererSource = fs.readFileSync(path.join(repoRoot, "src", "components", "theme-renderer.tsx"), "utf8");

const prioritySlugs = [
  "/blog/cyberpunk-photo-package-guide",
  "/blog/mafia-photo-package-guide",
  "/blog/magic-upscaler-photo-package-guide",
  "/blog/nature-photo-package-guide",
  "/blog/outdoor-creator-scenes-photo-package-guide",
  "/blog/valentine-photos-photo-package-guide",
  "/blog/virtual-try-on-photo-package-guide",
  "/blog/wedding-portraits-photo-package-guide",
  "/blog/world-cup-fan-photos-photo-package-guide"
];
const remediationSlugs = mydreamshootsBlogSeoRemediationArticles.map((article) => article.slug);
const seasonalSlugs = mydreamshootsSeasonalOccasionBlogSeoArticles.map((article) => article.slug);
const targetSlugs = [...prioritySlugs, ...remediationSlugs, ...seasonalSlugs];
const expectedTargets = new Map([
  ["/blog/boudoir-photo-package-guide", "/ai-image-generation/boudoir"],
  ["/blog/christmas-couple-photo-package-guide", "/ai-image-generation"],
  ["/blog/christmas-photos-photo-package-guide", "/ai-image-generation/christmas-photo"],
  ["/blog/desi-wedding-photo-package-guide", "/ai-image-generation"],
  ["/blog/engagement-photo-package-guide", "/ai-image-generation/engagement-photo"],
  ["/blog/halloween-party-photos-photo-package-guide", "/ai-image-generation/halloween-photo"],
  ["/blog/holiday-photo-package-guide", "/ai-image-generation/holiday"],
  ["/blog/indian-wedding-photo-package-guide", "/ai-image-generation"],
  ["/blog/thanksgiving-group-photos-photo-package-guide", "/ai-image-generation/thanksgiving-photo"],
  ["/blog/anime-avatar-photo-package-guide", "/ai-image-generation/avatar"],
  ["/blog/creator-portraits-photo-package-guide", "/ai-image-generation/portrait-photo"],
  ["/blog/fashion-editorial-photo-package-guide", "/ai-image-generation"],
  ["/blog/gala-photos-photo-package-guide", "/ai-image-generation/gala-photo"],
  ["/blog/hairstyle-photo-package-guide", "/ai-image-generation/hairstyle-generator"],
  ["/blog/product-style-photo-package-guide", "/ai-image-generation"],
  ["/blog/professional-headshots-photo-package-guide", "/ai-image-generation/headshot"],
  ["/blog/profile-cards-photo-package-guide", "/ai-image-generation/avatar"],
  ["/blog/social-cards-photo-package-guide", "/ai-image-generation"],
  ["/blog/cyberpunk-photo-package-guide", "/ai-image-generation/cyberpunk"],
  ["/blog/mafia-photo-package-guide", "/ai-image-generation/mafia"],
  ["/blog/magic-upscaler-photo-package-guide", "/ai-image-generation/photo-enhancer"],
  ["/blog/nature-photo-package-guide", "/ai-image-generation/travel"],
  ["/blog/outdoor-creator-scenes-photo-package-guide", "/ai-image-generation/urban"],
  ["/blog/valentine-photos-photo-package-guide", "/ai-image-generation/valentines-photo"],
  ["/blog/virtual-try-on-photo-package-guide", "/ai-image-generation/virtual-try-on"],
  ["/blog/wedding-portraits-photo-package-guide", "/ai-image-generation/wedding-photo"],
  ["/blog/world-cup-fan-photos-photo-package-guide", "/ai-image-generation/soccer"]
]);

const failures = [];
const warnings = [];
const site = state.sites.find((item) => item.id === "site_dreamshoot");
const pages = new Map((site?.pages ?? []).map((page) => [page.slug, page]));

function fail(label, detail = "") {
  failures.push(`${label}${detail ? `: ${detail}` : ""}`);
}

function assert(condition, label, detail = "") {
  if (!condition) fail(label, detail);
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

function bodyLinks(body) {
  return Array.from(String(body ?? "").matchAll(/<a\s+href="([^"]+)"/g), (match) => match[1]);
}

assert(Boolean(site), "site_dreamshoot exists");
assert(targetSlugs.length === 27, "exactly 27 target slugs declared", String(targetSlugs.length));
assert(new Set(targetSlugs).size === targetSlugs.length, "target slugs are unique");
assert(rendererSource.includes('data-blog-article-actions="true"'), "article action renderer exists");
assert(seoSource.includes('type: "article"'), "article OG type is emitted");
assert(seoSource.includes("publishedTime") && seoSource.includes("modifiedTime"), "article OG dates are emitted");
assert(jsonLdSource.includes('"@type": "BlogPosting"'), "BlogPosting schema exists");
assert(jsonLdSource.includes("dreamshootai-logo-refined.svg"), "MyDreamShoots Organization logo is emitted");

const routeMap = routeSource.match(/const DREAMSHOOT_LEGACY_BLOG_CATEGORY_REDIRECTS[\s\S]*?\n};/)?.[0] ?? "";
const allNgrams = new Map();
const titles = new Set();
const h1s = new Set();

for (const slug of targetSlugs) {
  const page = pages.get(slug);
  assert(Boolean(page), `${slug} exists in local state`);
  if (!page) continue;
  const settings = page.publishedJson?.sections?.blog_detail_1?.settings ?? {};
  const seo = page.publishedJson?.seo ?? {};
  const body = String(settings.body ?? "");
  const links = bodyLinks(body);
  const relatedLinks = Array.isArray(settings.relatedLinks) ? settings.relatedLinks.map((link) => link.href).filter(Boolean) : [];
  const contextualLinks = [...new Set([...links, ...relatedLinks])];
  const oldKey = slug.replace(/^\/blog\//, "").replace(/-photo-package-guide$/, "");

  assert(page.pageType === "article" && page.templateKey === "blog-detail", `${slug} is an article page`);
  assert(settings.authorType === "Organization", `${slug} has Organization author`);
  assert(settings.authorUrl === "/about-us", `${slug} has author URL`);
  assert(settings.reviewOwner === "myDreamshoots editorial team", `${slug} has review owner`);
  assert(settings.evidenceType === "editorial-guidance" && settings.evidenceDate === "2026-08-19", `${slug} has evidence boundary`);
  assert(settings.publishedAt === "2026-07-28" && settings.updatedAt === "2026-08-19", `${slug} has correct publication dates`);
  for (const field of ["entityName", "primaryKeyword", "searchIntent", "seoTitle", "seoDescription", "title", "targetLabel", "targetHref", "imageAlt"]) {
    assert(typeof settings[field] === "string" && settings[field].trim().length > 0, `${slug} declares ${field}`);
  }
  assert(expectedTargets.get(slug) === settings.targetHref, `${slug} CTA target matches contract`, settings.targetHref);
  if (["/blog/christmas-couple-photo-package-guide", "/blog/desi-wedding-photo-package-guide", "/blog/indian-wedding-photo-package-guide", "/blog/fashion-editorial-photo-package-guide", "/blog/product-style-photo-package-guide", "/blog/social-cards-photo-package-guide"].includes(slug)) {
    assert(settings.targetHref === "/ai-image-generation" && settings.targetLabel === "Browse AI Image Generation", `${slug} uses generic CTA`);
  }
  assert(Array.isArray(settings.relatedLinks) && settings.relatedLinks.length >= 2 && settings.relatedLinks.length <= 4, `${slug} has 2-4 related links`);
  assert(contextualLinks.length >= 3 && contextualLinks.length <= 5, `${slug} has 3-5 contextual links`, String(contextualLinks.length));
  assert(links.every((href) => href.startsWith("/")), `${slug} uses local body links`);
  assert(seo.canonicalPath === slug && seo.title === settings.seoTitle && seo.description === settings.seoDescription, `${slug} SEO fields match article profile`);
  assert(seo.robots?.index === true && seo.robots?.follow === true, `${slug} is indexable`);
  assert(seo.title.length >= 41 && seo.title.length <= 70, `${slug} title length is controlled`, String(seo.title.length));
  assert(seo.description.length >= 120 && seo.description.length <= 160, `${slug} description length is controlled`, String(seo.description.length));
  assert((body.match(/<h2 id=/g) ?? []).length >= 5 && (body.match(/<h3 id=/g) ?? []).length >= 3, `${slug} has topic sections and FAQs`);
  assert(body.length >= 3400, `${slug} body has useful depth`, String(body.length));
  assert(!/Use .+ when .+ and .+ are the nearest match|The strongest .+ requests keep the brief|Prepare clear approved source portraits|photo package category|Open Avatar theme|AI Video Add-ons/i.test(body), `${slug} has no legacy template leakage`);
  if (slug === "/blog/profile-cards-photo-package-guide") {
    const visible = `${page.title} ${settings.title} ${settings.summary} ${body} ${seo.title} ${seo.description}`;
    assert(!/anime avatar|anime-style avatar|avatar photo set/i.test(visible), "Profile Cards remains separate from Anime Avatar");
  }
  assert(!routeMap.includes(`"${oldKey}"`) && !routeMap.includes(`${oldKey}:`), `${slug} has no legacy category redirect mapping`);
  titles.add(seo.title);
  h1s.add(settings.title);
  allNgrams.set(slug, ngrams(body));
}

assert(titles.size === targetSlugs.length, "all 27 SEO titles are unique", String(titles.size));
assert(h1s.size === targetSlugs.length, "all 27 H1 values are unique", String(h1s.size));

let maximumSimilarity = { score: 0, pair: [] };
for (let leftIndex = 0; leftIndex < targetSlugs.length; leftIndex += 1) {
  for (let rightIndex = leftIndex + 1; rightIndex < targetSlugs.length; rightIndex += 1) {
    const left = targetSlugs[leftIndex];
    const right = targetSlugs[rightIndex];
    const score = jaccard(allNgrams.get(left), allNgrams.get(right));
    if (score > maximumSimilarity.score) maximumSimilarity = { score, pair: [left, right] };
    assert(score < 0.70, `${left} and ${right} remain below 5-gram Jaccard hard limit`, score.toFixed(4));
    if (score >= 0.35) warnings.push(`${left} and ${right} need manual similarity review (${score.toFixed(4)})`);
  }
}

async function checkOnline(baseUrl) {
  const results = [];
  const routePrefix = process.env.BLOG_27_ROUTE_PREFIX ?? "";
  const publicHost = process.env.BLOG_27_HOST ?? "";
  for (const slug of targetSlugs) {
    const url = `${baseUrl.replace(/\/$/, "")}${routePrefix.replace(/\/$/, "")}${slug}`;
    for (const method of ["GET", "HEAD"]) {
      const response = await fetch(url, {
        method,
        redirect: "manual",
        headers: {
          "user-agent": "mydreamshoots-blog-27-seo-smoke/1.0",
          ...(publicHost ? { host: publicHost, "x-forwarded-host": publicHost } : {})
        }
      });
      const result = { slug, method, status: response.status, location: response.headers.get("location") ?? "" };
      results.push(result);
      if (result.status !== 200) fail(`${method} ${slug} returns 200`, String(result.status));
      if (result.location) fail(`${method} ${slug} has no redirect`, result.location);
    }
  }
  return results;
}

const onlineBaseUrl = process.env.BLOG_27_BASE_URL;
let online = [];
if (onlineBaseUrl) {
  try {
    online = await checkOnline(onlineBaseUrl);
  } catch (error) {
    fail("online 27-page check completed", String(error));
  }
}

if (failures.length) {
  console.error("MyDreamShoots 27-page SEO smoke failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    ok: true,
    status: onlineBaseUrl ? "online-checked" : "local-only-not-published",
    pageCount: targetSlugs.length,
    maximumFiveGramJaccard: Number(maximumSimilarity.score.toFixed(4)),
    maximumSimilarityPair: maximumSimilarity.pair,
    warningCount: warnings.length,
    onlineChecks: online.length,
    warnings
  }, null, 2));
}
