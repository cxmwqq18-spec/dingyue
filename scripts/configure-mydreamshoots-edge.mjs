#!/usr/bin/env node
import assert from "node:assert/strict";
import "./load-runtime-env.mjs";

const zoneId = process.env.MYDREAMSHOOTS_CLOUDFLARE_ZONE_ID?.trim() || "7ef5975a18e8f29893a46450df47c6e3";
const hostname = "www.mydreamshoots.com";
const token = process.env.CLOUDFLARE_API_TOKEN?.trim() || "";
const apply = process.argv.includes("--apply");
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
  "/creators-circle",
  "/best-packages",
  "/best-ai-image",
  "/best-ai-video",
  "/best-save-the-date"
];
const publicPrefixes = [
  "/ai-video-generation/",
  "/ai-save-the-date/",
  "/ai-image-generation/",
  "/collections/",
  "/tools/",
  "/blog/"
];
const cacheRulesetPath = `/zones/${zoneId}/rulesets/phases/http_request_cache_settings/entrypoint`;
const cacheRuleRef = "mydreamshoots_public_html_cache";
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
    description: "Cache public MyDreamShoots HTML while leaving private and internal routes uncached.",
    expression: `(http.host eq "${hostname}" and http.request.method in {"GET" "HEAD"} and ${pathExpression()})`,
    action: "set_cache_settings",
    action_parameters: {
      cache: true,
      browser_ttl: { mode: "respect_origin" },
      edge_ttl: { mode: "respect_origin" }
    }
  };
}

const purgePaths = [
  ...publicExactPaths,
  "/ai-save-the-date/wedding-ceremony",
  "/ai-video-generation/cinematic-video",
  "/ai-video-generation/meme-video",
  "/ai-video-generation/music-video",
  "/ai-video-generation/social-media-video",
  "/ai-video-generation/youtube-video"
];

async function cloudflareFetch(path, init = {}) {
  assert(token, "CLOUDFLARE_API_TOKEN is required");
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
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
    error.body = body;
    throw error;
  }
  return { status: response.status, body };
}

async function readCacheEntrypoint() {
  try {
    return await cloudflareFetch(cacheRulesetPath);
  } catch (error) {
    if (error.status === 404) return { status: 404, body: { result: null } };
    throw error;
  }
}

function summarizeRule(rule) {
  return {
    id: rule.id,
    ref: rule.ref,
    action: rule.action,
    expression: rule.expression,
    action_parameters: rule.action_parameters
  };
}

async function ensureCacheRule() {
  const entrypoint = await readCacheEntrypoint();
  const existing = entrypoint.body.result;
  if (!existing) {
    if (!apply) return { status: "would_create", rule: cacheRule() };
    const created = await cloudflareFetch(`/zones/${zoneId}/rulesets`, {
      method: "POST",
      body: JSON.stringify({
        name: "MyDreamShoots public HTML cache",
        description: "Cache public HTML using origin freshness headers; private routes remain outside this expression.",
        kind: "zone",
        phase: "http_request_cache_settings",
        rules: [cacheRule()]
      })
    });
    return { status: "created", rule: summarizeRule(created.body.result?.rules?.[0] ?? cacheRule()), rulesetId: created.body.result?.id };
  }

  const current = existing.rules?.find((rule) => rule.ref === cacheRuleRef);
  if (!current) {
    throw new Error(`Cloudflare cache ruleset ${existing.id} already exists without ${cacheRuleRef}; append it through a reviewed ruleset update.`);
  }
  assert.equal(current.action, "set_cache_settings", `${cacheRuleRef} must keep set_cache_settings`);
  assert.equal(current.expression, cacheRule().expression, `${cacheRuleRef} expression drifted; refusing an implicit overwrite`);
  return { status: "unchanged", rule: summarizeRule(current), rulesetId: existing.id };
}

async function setEmailObfuscation() {
  const current = await cloudflareFetch(`/zones/${zoneId}/settings/email_obfuscation`);
  const value = current.body.result?.value;
  if (value === "off") return { status: "unchanged", value };
  if (!apply) return { status: "would_update", value, next: "off" };
  await cloudflareFetch(`/zones/${zoneId}/settings/email_obfuscation`, {
    method: "PATCH",
    body: JSON.stringify({ value: "off" })
  });
  return { status: "updated", value: "off" };
}

async function purgeUrls() {
  if (!apply || !purge) return { status: "skipped", count: purgePaths.length };
  const files = [...new Set(purgePaths)].map((path) => `https://${hostname}${path}`);
  const response = await cloudflareFetch(`/zones/${zoneId}/purge_cache`, {
    method: "POST",
    body: JSON.stringify({ files })
  });
  return { status: response.body.result?.id ? "purged" : "requested", count: files.length, id: response.body.result?.id };
}

if (apply && confirmation !== "mydreamshoots-edge") {
  throw new Error("Production edge changes require --apply --confirm=mydreamshoots-edge.");
}

const result = {
  ok: true,
  mode: apply ? "apply" : "dry-run",
  zoneId,
  hostname,
  targetHeaders: { cacheControl: publicCacheControl, cdnCacheControl: publicCdnCacheControl },
  emailObfuscation: await setEmailObfuscation(),
  cacheRule: await ensureCacheRule(),
  purge: await purgeUrls()
};
console.log(JSON.stringify(result, null, 2));
