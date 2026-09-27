import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { readPlatformStateFromSql } from "./lib/platform-state-sql.mjs";

const state = await readPlatformStateFromSql();
const site = state.sites.find((item) => item.id === "site_dreamshoot");
assert(site, "MyDreamShoots site exists");

const expected = [
  {
    slug: "/blog/talking-photo-video-guide",
    title: "Talking Photo Videos: Plan the Portrait, Script, and Review",
    targetHref: "/ai-video-generation/talking-photo",
    cover: "/assets/dreamshoot/generated/homepage-showcase/posters/first-frame-talking-photo.jpg"
  },
  {
    slug: "/blog/motion-generator-video-guide",
    title: "AI Motion Generator: Turn One Photo Into a Reviewable Video",
    targetHref: "/ai-video-generation/motion-generator",
    cover: "/assets/dreamshoot/generated/homepage-showcase/posters/prompt-directed-motion.webp"
  },
  {
    slug: "/blog/cinematic-video-guide",
    title: "AI Cinematic Video: Build a Scene With Mood and Motion",
    targetHref: "/ai-video-generation/cinematic-video",
    cover: "/assets/dreamshoot/generated/homepage-showcase/posters/first-frame-cinematic-video.jpg"
  }
];

const oldSlug = "/blog/video-photo-package-guide";
const forbiddenPhrases = [
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
  "use this article as context"
];

function settings(page) {
  return page?.publishedJson?.sections?.blog_detail_1?.settings ?? {};
}

function assetPath(imageUrl) {
  const pathname = new URL(String(imageUrl), "https://local.invalid").pathname;
  return path.join(process.cwd(), "public", pathname.replace(/^\/+/, ""));
}

function assetHash(imageUrl) {
  const filePath = assetPath(imageUrl);
  assert(fs.existsSync(filePath), `cover exists: ${imageUrl}`);
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function wordSet(body) {
  return new Set((body.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []).filter(Boolean));
}

function jaccard(left, right) {
  const union = new Set([...left, ...right]);
  const intersection = [...left].filter((word) => right.has(word));
  return union.size ? intersection.length / union.size : 0;
}

const pages = expected.map(({ slug }) => {
  const page = site.pages.find((candidate) => candidate.slug === slug);
  assert(page, `article exists: ${slug}`);
  return page;
});

assert(!site.pages.some((page) => page.slug === oldSlug), "old article slug is not published as a second canonical page");
const blogHome = site.pages.find((page) => page.slug === "/blog");
assert(blogHome, "blog home exists");
const blogHomeText = JSON.stringify(blogHome?.publishedJson ?? {});
assert(/AI photo and video/i.test(blogHomeText), "blog home copy includes photo and video guidance");

const hashes = new Set();
const bodies = [];
for (const [index, page] of pages.entries()) {
  const expectedArticle = expected[index];
  const article = settings(page);
  const seo = page.publishedJson?.seo ?? {};
  const body = String(article.body ?? "");
  assert.equal(article.title, expectedArticle.title, `${expectedArticle.slug} topic is stable`);
  assert.equal(article.targetHref, expectedArticle.targetHref, `${expectedArticle.slug} CTA uses its video theme`);
  assert.equal(seo.canonicalPath, expectedArticle.slug, `${expectedArticle.slug} canonical matches slug`);
  assert.equal(page.draftJson?.seo?.canonicalPath, expectedArticle.slug, `${expectedArticle.slug} draft canonical matches slug`);
  assert.deepEqual(page.draftJson, page.publishedJson, `${expectedArticle.slug} draft and preview publication match`);
  assert(body.length > 3400, `${expectedArticle.slug} body is substantial`);
  assert((body.match(/<h2(?: id="[^"]+")?>/g) ?? []).length >= 4, `${expectedArticle.slug} has four or more H2 sections`);
  assert((body.match(/<h3 id="/g) ?? []).length >= 3, `${expectedArticle.slug} has FAQ H3 sections`);
  assert(/<table|<ul|<ol/i.test(body), `${expectedArticle.slug} has scannable content`);
  assert((article.relatedLinks ?? []).length >= 3 && (article.relatedLinks ?? []).length <= 5, `${expectedArticle.slug} has three to five related links`);
  assert((article.relatedLinks ?? []).every((link) => String(link.href).startsWith("/")), `${expectedArticle.slug} related links are local`);
  assert(body.includes(expectedArticle.targetHref), `${expectedArticle.slug} body links to its theme page`);
  assert(!/[\u3400-\u9fff]/u.test(JSON.stringify(article)), `${expectedArticle.slug} has no Chinese public copy`);
  assert(!/internal|prompt template|editorial note|placeholder/i.test(body), `${expectedArticle.slug} has no internal prompt or editorial text`);
  const lower = body.toLowerCase();
  assert(!forbiddenPhrases.some((phrase) => lower.includes(phrase)), `${expectedArticle.slug} avoids templated filler`);
  const hash = assetHash(article.imageUrl);
  assert(!hashes.has(hash), `${expectedArticle.slug} cover is unique`);
  hashes.add(hash);
  assert.equal(article.imageUrl, expectedArticle.cover, `${expectedArticle.slug} uses the assigned local cover`);
  bodies.push(wordSet(body));
}

for (let left = 0; left < bodies.length; left += 1) {
  for (let right = left + 1; right < bodies.length; right += 1) {
    const similarity = jaccard(bodies[left], bodies[right]);
    assert(similarity < 0.55, `article pair ${left + 1}/${right + 1} stays below similarity threshold`, `${similarity.toFixed(3)}`);
  }
}

const hostRoute = fs.readFileSync(path.resolve("src/app/[...path]/page.tsx"), "utf8");
const pathRoute = fs.readFileSync(path.resolve("src/app/site/[siteSlug]/[...path]/page.tsx"), "utf8");
const routeCanonical = fs.readFileSync(path.resolve("src/lib/site-route-canonical.ts"), "utf8");
assert(hostRoute.includes('"video-photo-package-guide": "/blog/talking-photo-video-guide"'), "host route redirects old article to Talking Photo");
assert(hostRoute.includes('"ai-video-add-ons": "/blog/motion-generator-video-guide"'), "host route sends the old video category alias to Motion Generator");
assert(pathRoute.includes("mydreamshootsLegacyBlogPathTarget"), "path route handles MyDreamShoots blog redirects");
assert(routeCanonical.includes('"/blog/video-photo-package-guide": "/blog/talking-photo-video-guide"'), "shared route map keeps the old URL as a permanent redirect target");
assert(routeCanonical.includes('"/blog/image-to-video": "/blog/motion-generator-video-guide"'), "shared route map sends a video alias to Motion Generator");

console.log(JSON.stringify({ ok: true, articles: expected.map(({ slug }) => slug), oldSlugRedirect: oldSlug }, null, 2));
