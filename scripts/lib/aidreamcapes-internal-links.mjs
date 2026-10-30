// Shared rules for the Aidreamcapes internal-link remediation.
//
// Scope: site_aidreamcapes only. Every rule below is a *link target* rule:
// it maps a path that currently answers 301/308 to the canonical path that
// answers 200. Nothing here creates, rewrites or removes public copy, and
// nothing here touches redirect configuration, navigation code or media
// slugs. Redirects stay exactly as they are; only the links that point at
// them are repointed at the final destination.

import crypto from "node:crypto";

export const ORIGIN = "https://www.aivideosugc.com";

/**
 * from: the redirecting path that is linked today.
 * to:   the canonical path that answers 200.
 * status: the HTTP status the redirecting path answers with.
 * owner: "content" when the link can be repointed inside LivePage.contentJson,
 *        "code" when the link is produced by storefront code and must not be
 *        touched by a content manifest.
 */
export const REDIRECTS = [
  // Media canonicalization pass 2 (2026-10-30) removed the owning publicSlug
  // of these two picker-card addresses, so they now answer 404 (noindex
  // orphans, no redirects) instead of the alias-era 308 recorded earlier.
  { from: "/ai-video-generation/lifestyle-app-recommendation-ai-video-generation", to: "/ai-video-generation/lifestyle-app-recommendation", status: 404, owner: "code" },
  { from: "/ai-video-generation/streamer-reaction-app-ai-video-generation", to: "/ai-video-generation/streamer-reaction-app", status: 404, owner: "code" },
  { from: "/ai-video-generation/ai-actors", to: "/ai-actors", status: 301, owner: "content" },
  { from: "/ai-image-generation/lifestyle-scene", to: "/ai-image-generation/lifestyle-photos", status: 301, owner: "content" },
  { from: "/ai-video-generation/ugc-ad-video", to: "/ai-video-generation/video-ads", status: 301, owner: "content" },
  { from: "/ai-image-generation/background-remove-replace", to: "/ai-image-generation/change-background", status: 301, owner: "content" },
  { from: "/ai-image-generation/on-model-generation", to: "/ai-image-generation/model-photos", status: 301, owner: "content" },
  { from: "/ai-image-generation/ecommerce-main-image", to: "/ai-image-generation/white-background-photos", status: 301, owner: "content" },
  { from: "/ai-image-generation/feed-ad-still", to: "/ai-image-generation/social-ad-photos", status: 301, owner: "content" },
  { from: "/ai-video-generation/ai-actor-product-ads", to: "/ai-video-generation/spokesperson-video", status: 301, owner: "content" },
];

/** Fields that may hold a structured link value. */
export const HREF_FIELD_PATTERN = /\/href$/;
export const PRIMARY_HREF_FIELD_PATTERN = /\/primaryHref$/;

/** Fields that may hold body copy with inline markdown/HTML links. */
export const LINK_FIELD_PATTERNS = [
  /^\/sections\/[^/]+\/settings\/data\/sections\/\d+\/paras\/\d+$/,
  /^\/sections\/[^/]+\/settings\/data\/benefits\/\d+\/d$/,
  /^\/sections\/[^/]+\/settings\/data\/more_sections\/\d+\/items\/\d+\/d$/,
  /^\/sections\/[^/]+\/settings\/data\/intro\/\d+$/,
  /^\/sections\/[^/]+\/settings\/data\/llmsText$/,
  /^\/sections\/[^/]+\/settings\/body$/,
  PRIMARY_HREF_FIELD_PATTERN,
];

export function isLinkField(path) {
  return HREF_FIELD_PATTERN.test(path) || LINK_FIELD_PATTERNS.some((pattern) => pattern.test(path));
}

/** The homepage description field pointers that render the same public string. */
export const HOME_DESCRIPTION_PATHS = new Set([
  "/seo/description",
  "/seo/twitterDescription",
  "/seo/jsonLd/@graph/2/description",
]);

export const HOME_DESCRIPTION_BEFORE =
  "Turn product URL, image, or prompt into authentic, high-converting UGC video ads in minutes with Ai video agent and Ai actors ,ready-to-use video templates.";
export const HOME_DESCRIPTION_AFTER =
  "Turn product URL, image, or prompt into authentic, high-converting UGC video ads in minutes with AI video agent and AI actors, ready-to-use video templates.";

export function hashValue(value) {
  const json = JSON.stringify(value);
  return crypto.createHash("sha256").update(json === undefined ? "__undefined__" : json).digest("hex");
}

function canonicalPath(raw) {
  const withoutOrigin = raw.startsWith(ORIGIN) ? raw.slice(ORIGIN.length) : raw;
  return withoutOrigin.split(/[?#]/)[0];
}

function replacePath(raw) {
  const path = canonicalPath(raw);
  const rule = REDIRECTS.find((entry) => entry.from === path);
  if (!rule) return raw;
  const withoutOrigin = raw.startsWith(ORIGIN) ? raw.slice(ORIGIN.length) : raw;
  const suffix = withoutOrigin.slice(path.length);
  return (raw.startsWith(ORIGIN) ? ORIGIN + rule.to : rule.to) + suffix;
}

/**
 * Repoint every markdown or html link target inside a copy string that
 * currently points at a redirecting path. Only the link destination changes;
 * the surrounding words are never touched.
 */
export function replaceRedirectTargets(value) {
  let out = value.replace(/\]\(([^)\s]+)(\s+"[^"]*")?\)/g, (match, raw, title) => {
    const replaced = replacePath(raw);
    return replaced === raw ? match : `](${replaced}${title || ""})`;
  });
  out = out.replace(/href\s*=\s*"([^"]*)"/gi, (match, raw) => {
    const replaced = replacePath(raw);
    return replaced === raw ? match : `href="${replaced}"`;
  });
  return out;
}

/**
 * Repoint a field value that is either a bare link destination or a copy
 * string with inline links. Only the link destination changes.
 */
export function repointField(value) {
  const whole = REDIRECTS.find((entry) => entry.from === value);
  if (whole) return whole.to;
  return replaceRedirectTargets(value);
}

/** List every link target inside a copy string that points at a redirecting path. */
export function findRedirectTargets(value) {
  const found = [];
  for (const match of value.matchAll(/\]\(([^)\s]+)(\s+"[^"]*")?\)/g)) {
    const rule = REDIRECTS.find((entry) => entry.from === canonicalPath(match[1]));
    if (rule) found.push({ kind: "markdown", raw: match[1], rule });
  }
  for (const match of value.matchAll(/href\s*=\s*"([^"]*)"/gi)) {
    const rule = REDIRECTS.find((entry) => entry.from === canonicalPath(match[1]));
    if (rule) found.push({ kind: "href", raw: match[1], rule });
  }
  return found;
}
