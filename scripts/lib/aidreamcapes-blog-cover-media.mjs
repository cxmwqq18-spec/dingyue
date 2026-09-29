import assert from "node:assert/strict";

const IMAGE_EXTENSIONS = /\.(?:avif|gif|jpe?g|png|webp)(?:[?#].*)?$/i;

function isImageAsset(value) {
  return typeof value === "string"
    && value.startsWith("/assets/sites/site_aidreamcapes/")
    && IMAGE_EXTENSIONS.test(value);
}

function nestedImageCandidates(value, output = []) {
  if (!value || typeof value !== "object") return output;
  if (Array.isArray(value)) {
    for (const item of value) nestedImageCandidates(item, output);
    return output;
  }
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === "string" && /(?:src|image|poster|ogImage)$/i.test(key) && isImageAsset(child)) {
      output.push(child);
    } else if (child && typeof child === "object") {
      nestedImageCandidates(child, output);
    }
  }
  return output;
}

function nestedAltCandidates(value, output = []) {
  if (!value || typeof value !== "object") return output;
  if (Array.isArray(value)) {
    for (const item of value) nestedAltCandidates(item, output);
    return output;
  }
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === "string" && /(?:alt|ogImageAlt)$/i.test(key) && child.trim()) {
      output.push(child.trim());
    } else if (child && typeof child === "object") {
      nestedAltCandidates(child, output);
    }
  }
  return output;
}

export function aidreamcapesThemeCoverImage(pageJson) {
  const candidates = [
    pageJson?.seo?.ogImage,
    ...nestedImageCandidates(pageJson?.sections)
  ];
  return candidates.find(isImageAsset) || "";
}

export function aidreamcapesThemeCoverAlt(pageJson, fallback = "") {
  return [
    pageJson?.seo?.ogImageAlt,
    ...nestedAltCandidates(pageJson?.sections),
    fallback
  ].find((value) => typeof value === "string" && value.trim())?.trim() || "";
}

export function aidreamcapesBlogCoverSourceHref(article) {
  return String(article?.coverThemeHref || article?.targetHref || "").trim();
}

function assertUnique(values, label) {
  const normalized = values.filter(Boolean);
  assert.equal(new Set(normalized).size, normalized.length, `Aidreamcapes blog ${label} must be unique.`);
}

export function assertUniqueAidreamcapesBlogCovers(articles) {
  assertUnique(articles.map(aidreamcapesBlogCoverSourceHref), "cover theme sources");
  assertUnique(articles.map((article) => article.imageUrl), "cover image assets");
}
