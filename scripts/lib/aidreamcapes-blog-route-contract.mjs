import assert from "node:assert/strict";

export const LEGACY_ARTICLE_PATH = "/blog/video-photo-package-guide";
export const MIGRATED_ARTICLE_PATH = "/blog/motion-generator-video-guide";

export const BLOG_ARTICLE_PATHS = [
  "/blog/ai-product-photography-guide",
  "/blog/ai-ugc-video-ads-guide",
  "/blog/ai-talking-photo-video-guide",
  "/blog/ecommerce-product-image-workflow",
  "/blog/ai-video-review-checklist",
  "/blog/ai-content-disclosure-safe-usage",
  MIGRATED_ARTICLE_PATH
];

const IMAGE_THEME_SLUGS = [
  "ecommerce-main-image", "lifestyle-scene", "packshot-multi-angle", "macro-details", "bundle-sets", "size-reference",
  "feature-infographic", "comparison-chart", "feed-ad-still", "ugc-still-ad", "story-ad-vertical", "carousel-set",
  "sale-campaign-key-visual", "lookbook-cover", "on-model-generation", "virtual-try-on", "hair-makeup-preview",
  "jewelry-positioning", "ghost-mannequin", "colorway-variations", "background-remove-replace", "enhance-upscale",
  "old-photo-restore", "commercial-lighting", "packaging-mockup", "professional-headshot", "creator-portrait",
  "team-directory", "social-profile-photo", "fashion-editorial"
];

const VIDEO_THEME_SLUGS = [
  "ugc-ad-video", "tiktok-reels-shorts", "multilingual-video", "talking-photo-recs", "how-to-video", "founder-update",
  "url-to-ad", "testimonial-ads", "cinematic-video", "product-video"
];

const FIXED_PUBLIC_PATHS = new Set(["/ai-video-generation", "/workflow", "/content", "/pricing", "/about-us"]);
const VALID_THEME_PATHS = new Set([
  ...IMAGE_THEME_SLUGS.map((slug) => `/ai-image-generation/${slug}`),
  ...VIDEO_THEME_SLUGS.map((slug) => `/ai-video-generation/${slug}`),
  ...FIXED_PUBLIC_PATHS
]);

export const LEGACY_ARTICLE_REDIRECTS = {
  [LEGACY_ARTICLE_PATH]: MIGRATED_ARTICLE_PATH
};

export function normalizeBlogHref(href) {
  const value = String(href || "").trim();
  if (!value.startsWith("/") || value.startsWith("//")) return value;
  const withoutQuery = value.split(/[?#]/, 1)[0];
  return withoutQuery.length > 1 ? withoutQuery.replace(/\/$/, "") : "/";
}

export function bodyLinkHrefs(body) {
  return [...String(body || "").matchAll(/\bhref=["']([^"']+)["']/gi)].map((match) => match[1]);
}

export function articleLinkHrefs(article) {
  return [
    article.targetHref,
    article.primaryHref,
    ...(article.relatedLinks || []).map(([href]) => href),
    ...bodyLinkHrefs(article.body)
  ].filter(Boolean).map(normalizeBlogHref);
}

export function validateAidreamcapesBlogLinks(article) {
  for (const href of articleLinkHrefs(article)) {
    assert(VALID_THEME_PATHS.has(href), `${article.slug}: unregistered Aidreamcapes blog link ${href}`);
    assert(!href.includes("video-photo-package-guide"), `${article.slug}: legacy blog link ${href}`);
  }
}

export function visibleText(body) {
  return String(body || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function validateAidreamcapesBlogArticle(article) {
  assert(article.title.length <= 60, `${article.slug}: title exceeds 60 characters.`);
  assert(article.description.length >= 140 && article.description.length <= 160, `${article.slug}: description length ${article.description.length} is outside 140-160.`);
  assert(article.relatedLinks.length >= 3 && article.relatedLinks.length <= 5, `${article.slug}: expected 3-5 related links.`);
  const body = String(article.body || "");
  const text = visibleText(body);
  const opening = visibleText(body.match(/^\s*<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] || "");
  const openingWordCount = opening.split(/\s+/).filter(Boolean).length;
  assert(openingWordCount >= 70 && openingWordCount <= 120, `${article.slug}: direct-answer opening is ${openingWordCount} words; expected 70-120.`);
  assert(text.length >= 3400, `${article.slug}: body text length ${text.length} is below 3400.`);
  assert((body.match(/<h2\b/gi) || []).length >= 5, `${article.slug}: expected at least five H2 sections.`);
  assert((body.match(/<h2\b/gi) || []).length <= 8, `${article.slug}: expected no more than eight H2 sections.`);
  assert((body.match(/<h3\b/gi) || []).length >= 3, `${article.slug}: expected at least three FAQ H3 headings.`);
  assert(/<h2[^>]*>\s*FAQ/i.test(body), `${article.slug}: FAQ section missing.`);
  assert(/<(?:ul|ol|table)\b/i.test(body), `${article.slug}: checklist or comparison structure missing.`);
  assert(!/[\u3400-\u9fff]/.test(body), `${article.slug}: Chinese internal copy found in public article body.`);
  assert(!/(in today's fast-paced world|game changer|ultimate solution|effortlessly|this article should|use this article as context)/i.test(body), `${article.slug}: generic or prompt-like copy found.`);
  const h2Ids = [...body.matchAll(/<h2[^>]*id=["']([^"']+)["']/gi)].map((match) => match[1]);
  assert.equal(new Set(h2Ids).size, h2Ids.length, `${article.slug}: duplicate H2 ids.`);
  validateAidreamcapesBlogLinks(article);
}
