#!/usr/bin/env node

import assert from "node:assert/strict";
import "./load-runtime-env.mjs";

const zoneId = process.env.AIDREAMCAPES_CLOUDFLARE_ZONE_ID?.trim() || "";
const hostnames = ["aidreamcapes.com", "www.aidreamcapes.com"];
const token = process.env.CLOUDFLARE_API_TOKEN?.trim() || "";
const apply = process.argv.includes("--apply");
const purgeOnly = process.argv.includes("--purge-only");
const confirmation = process.argv.find((arg) => arg.startsWith("--confirm="))?.slice("--confirm=".length);
const purge = !process.argv.includes("--no-purge");

const publicExactPaths = [
  "/",
  "/pricing",
  "/workflow",
  "/privacy",
  "/terms",
  "/cookies",
  "/refunds",
  "/content",
  "/digital-delivery",
  "/shipping",
  "/children-privacy",
  "/state-privacy",
  "/faq",
  "/about-us",
  "/contact-us",
  "/best-packages",
  "/best-ai-image",
  "/best-ai-video",
  "/ai-image-generation",
  "/ai-video-generation",
  "/marketing",
  "/collections",
  "/tools",
  "/blog",
  "/watch",
  "/help",
  "/about-us",
  "/contact-us",
  "/faq",
  "/creators-circle",
  "/partner-registration"
];
const publicPrefixes = [
  "/watch/",
  "/ai-image-generation/",
  "/ai-video-generation/",
  "/collections/",
  "/tools/",
  "/blog/",
  "/policies/"
];
// These routes were previously public and may still exist in an edge cache.
// Purge them after deployment, but do not include them in the new cache rule.
const retiredAidreamcapesPaths = [
  "/best-save-the-date",
  "/ai-save-the-date",
  "/holidays-events"
];
const cacheRulesetPath = zoneId ? `/zones/${zoneId}/rulesets/phases/http_request_cache_settings/entrypoint` : "";
const cacheRuleRef = "aidreamcapes_public_html_cache";
const publicCacheControl = "public, max-age=60, s-maxage=300, stale-while-revalidate=1800";
const publicCdnCacheControl = "public, s-maxage=300, stale-while-revalidate=1800";

function pathExpression() {
  const exact = publicExactPaths.map((path) => `http.request.uri.path eq "${path}"`);
  const prefixes = publicPrefixes.map((prefix) => `starts_with(http.request.uri.path, "${prefix}")`);
  return `(${[...exact, ...prefixes].join(" or ")})`;
}

function cacheRule() {
  return {
    ref: cacheRuleRef,
    description: "Cache public Aidreamcapes HTML while leaving private and internal routes uncached.",
    expression: `(http.host in {"${hostnames.join('" "')}"} and http.request.method in {"GET" "HEAD"} and ${pathExpression()})`,
    action: "set_cache_settings",
    action_parameters: {
      cache: true,
      browser_ttl: { mode: "respect_origin" },
      edge_ttl: { mode: "respect_origin" }
    }
  };
}

async function cloudflareFetch(apiPath, init = {}) {
  assert(zoneId, "AIDREAMCAPES_CLOUDFLARE_ZONE_ID is required for Cloudflare changes");
  assert(token, "CLOUDFLARE_API_TOKEN is required for Cloudflare changes");
  const response = await fetch(`https://api.cloudflare.com/client/v4${apiPath}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    const detail = body.errors?.map((error) => `${error.code ?? "?"}: ${error.message ?? "request failed"}`).join("; ");
    const error = new Error(detail || `Cloudflare API returned ${response.status}`);
    error.status = response.status;
    error.cloudflareErrors = body.errors ?? [];
    throw error;
  }
  return { status: response.status, body };
}

function summarizeRule(rule) {
  return { id: rule.id, ref: rule.ref, action: rule.action, expression: rule.expression, action_parameters: rule.action_parameters };
}

async function ensureCacheRule() {
  if (!apply) return { status: "would_create_or_verify", rule: cacheRule() };
  let response;
  try {
    response = await cloudflareFetch(cacheRulesetPath);
  } catch (error) {
    const missingEntrypoint =
      error?.status === 404 ||
      error?.cloudflareErrors?.some((item) => item.code === 10003) ||
      /could not find entrypoint ruleset/i.test(error?.message ?? "");
    if (!missingEntrypoint) throw error;
    response = { body: { result: null } };
  }
  const existing = response.body.result;
  if (!existing) {
    const created = await cloudflareFetch(`/zones/${zoneId}/rulesets`, {
      method: "POST",
      body: JSON.stringify({
        name: "Aidreamcapes public HTML cache",
        description: "Cache public Aidreamcapes HTML using origin freshness headers; private routes remain outside this expression.",
        kind: "zone",
        phase: "http_request_cache_settings",
        rules: [cacheRule()]
      })
    });
    return { status: "created", rule: summarizeRule(created.body.result?.rules?.[0] ?? cacheRule()), rulesetId: created.body.result?.id };
  }

  const current = existing.rules?.find((rule) => rule.ref === cacheRuleRef);
  if (!current) throw new Error(`Cloudflare cache ruleset ${existing.id} exists without ${cacheRuleRef}; refusing an implicit overwrite.`);
  assert.equal(current.action, "set_cache_settings", `${cacheRuleRef} must keep set_cache_settings`);
  assert.equal(current.expression, cacheRule().expression, `${cacheRuleRef} expression drifted; refusing an implicit overwrite`);
  return { status: "unchanged", rule: summarizeRule(current), rulesetId: existing.id };
}

function purgeUrls() {
  const paths = [
    ...publicExactPaths,
    ...publicPrefixes.map((prefix) => `${prefix}*`),
    ...retiredAidreamcapesPaths,
    ...retiredAidreamcapesPaths.map((path) => `${path}/*`),
    "/sitemap.xml",
    "/robots.txt"
  ];
  return hostnames.flatMap((hostname) => [...new Set(paths)].map((path) => `https://${hostname}${path}`));
}

async function purgePublicUrls() {
  const files = purgeUrls();
  if (!apply || !purge) return { status: "skipped", count: files.length, files };
  const response = await cloudflareFetch(`/zones/${zoneId}/purge_cache`, {
    method: "POST",
    body: JSON.stringify({ files })
  });
  return { status: response.body.result?.id ? "purged" : "requested", count: files.length, id: response.body.result?.id };
}

if (apply && confirmation !== "aidreamcapes-edge") {
  throw new Error("Production edge changes require --apply --confirm=aidreamcapes-edge.");
}

const result = {
  ok: true,
  mode: apply ? "apply" : "dry-run",
  purgeOnly,
  zoneId: zoneId || "unset",
  hostnames,
  targetHeaders: { cacheControl: publicCacheControl, cdnCacheControl: publicCdnCacheControl },
  cacheRule: purgeOnly ? { status: "skipped" } : await ensureCacheRule(),
  purge: purgeOnly || purge ? await purgePublicUrls() : { status: "skipped" }
};
console.log(JSON.stringify(result, null, 2));
