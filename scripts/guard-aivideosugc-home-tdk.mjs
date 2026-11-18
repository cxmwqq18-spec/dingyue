#!/usr/bin/env node
// Homepage TDK lock guard. The site owner has locked the homepage title,
// keywords and description; this guard fails when the live page no longer
// serves the approved baseline. To change TDK, the owner-approved lock file
// must be updated in the same reviewed change.
//
//   node scripts/guard-aivideosugc-home-tdk.mjs
//   node scripts/guard-aivideosugc-home-tdk.mjs --origin=http://127.0.0.1:3002
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const lock = JSON.parse(readFileSync(new URL("../docs/content-locks/aivideosugc-homepage-tdk-approved.json", import.meta.url), "utf8"));
const originArg = process.argv.find((arg) => arg.startsWith("--origin="))?.slice("--origin=".length);
const origin = (originArg || process.env.AIDREAMCAPES_TDK_ORIGIN || `https://${lock.site.primaryDomain}`).replace(/\/+$/, "");
const isLocal = /^(http:\/\/)?(127\.0\.0\.1|localhost)(:\d+)?\//.test(origin) || /^(http:\/\/)?(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin);
const url = `${origin}/?tdk-guard=${Date.now()}`;

function decode(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replace(/\s+/g, " ")
    .trim();
}
function attrs(tag) {
  return Object.fromEntries([...tag.matchAll(/([a-zA-Z_:][\w:-]*)="([^"]*)"/g)].map((match) => [match[1].toLowerCase(), match[2]]));
}
function meta(html, key) {
  const values = [];
  for (const tag of html.matchAll(/<meta\b[^>]*>/g)) {
    const attributes = attrs(tag[0]);
    if ((attributes.name || "").toLowerCase() === key || (attributes.property || "").toLowerCase() === key) {
      values.push(attributes.content ?? "");
    }
  }
  return values.length ? decode(values[0]) : undefined;
}
function title(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decode(match[1]) : undefined;
}
function jsonLdNodes(html) {
  const nodes = [];
  for (const script of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(script[1]);
      const list = Array.isArray(parsed?.["@graph"]) ? parsed["@graph"] : Array.isArray(parsed) ? parsed : [parsed];
      for (const node of list) if (node && typeof node === "object") nodes.push(node);
    } catch {
      // A malformed non-homepage script is reported by the SEO smoke, not here.
    }
  }
  return nodes;
}

const headers = { "cache-control": "no-cache" };
if (isLocal) {
  headers["x-forwarded-host"] = lock.site.primaryDomain;
  headers["x-forwarded-proto"] = "https";
}
const response = await fetch(url, { headers, redirect: "follow" });
assert(response.ok, `Homepage TDK guard could not read ${origin}/ (HTTP ${response.status}).`);
const html = await response.text();

const pageTitle = title(html);
const description = meta(html, "description");
const keywords = meta(html, "keywords");
const ogDescription = meta(html, "og:description");
const twitterDescription = meta(html, "twitter:description");
const webPage = jsonLdNodes(html).find((node) => node["@type"] === "WebPage");

const failures = [];
function compare(label, actual, expected, { ignoreCase = false } = {}) {
  const normalize = (value) => ignoreCase ? decode(value ?? "").toLowerCase() : decode(value ?? "");
  if (normalize(actual) !== normalize(expected)) {
    failures.push({ label, expected, actual: actual ?? "(missing)" });
  }
}
compare("title", pageTitle, lock.seo.title);
compare("meta description", description, lock.seo.description);
compare("meta keywords", keywords, lock.seo.keywords);
compare("og:description", ogDescription, lock.seo.description);
compare("twitter:description", twitterDescription, lock.seo.twitterDescription || lock.seo.description);
compare("JSON-LD WebPage.description", webPage?.description, lock.seo.description);
compare("JSON-LD WebPage.name", webPage?.name, lock.seo.title, { ignoreCase: true });

if (failures.length) {
  console.error(JSON.stringify({
    ok: false,
    origin,
    lockVersion: lock.lockVersion,
    lockedAt: lock.lockedAt,
    message: "Homepage TDK drifted from the owner-approved lock. Update the lock only with explicit owner approval.",
    failures
  }, null, 2));
    process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  origin,
  lockVersion: lock.lockVersion,
  lockedAt: lock.lockedAt,
  title: lock.seo.title,
  descriptionLength: lock.seo.description.length
}, null, 2));
