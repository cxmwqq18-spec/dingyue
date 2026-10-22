#!/usr/bin/env node
// Manage the Aidreamcapes public edge cache.
//
// The live storefront is served from www.aivideosugc.com, which is a
// different Cloudflare zone than the retired aidreamcapes.com brand domain.
// The cache rule and the purge set are both derived from the live sitemap so
// that every release can drop exactly what the rule caches.

import assert from "node:assert/strict";
import {
  PUBLIC_HOST,
  buildPublicSurface,
  cacheRule,
  chunk,
  parseSitemapPaths,
  PURGE_FILE_BATCH,
  PURGE_PREFIX_BATCH
} from "./lib/aidreamcapes-public-cache-surface.mjs";

const zoneId = (process.env.AIDREAMCAPES_PUBLIC_ZONE_ID || "").trim();
const token = (process.env.CLOUDFLARE_API_TOKEN || "").trim();
const apply = process.argv.includes("--apply");
const purgeOnly = process.argv.includes("--purge-only");
const confirmation = process.argv.find((arg) => arg.startsWith("--confirm="))?.slice("--confirm=".length);
const purge = !process.argv.includes("--no-purge");
const origin = (process.argv.find((arg) => arg.startsWith("--origin="))?.slice("--origin=".length) || `https://${PUBLIC_HOST}`).replace(/\/$/, "");
const cacheRulesetPath = (id) => `/zones/${id}/rulesets/phases/http_request_cache_settings/entrypoint`;
const cacheRuleRef = cacheRule().ref;

async function cloudflareFetch(apiPath, init = {}) {
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
    const detail = (body.errors ?? []).map((error) => `${error.code ?? "?"}: ${error.message ?? "request failed"}`).join("; ");
    const error = new Error(detail || `Cloudflare API returned ${response.status}`);
    error.status = response.status;
    error.cloudflareErrors = body.errors ?? [];
    throw error;
  }
  return body.result;
}

async function resolveZone() {
  if (zoneId) {
    const zone = await cloudflareFetch(`/zones/${zoneId}`);
    assert.equal(zone.name, PUBLIC_HOST.replace(/^www\./, ""), `Configured zone ${zone.name} does not serve ${PUBLIC_HOST}`);
    return zone.id;
  }
  const zones = await cloudflareFetch(`/zones?name=${encodeURIComponent(PUBLIC_HOST.replace(/^www\./, ""))}&per_page=5`);
  const zone = (zones ?? []).find((item) => item.name === PUBLIC_HOST.replace(/^www\./, ""));
  assert(zone, `No Cloudflare zone serves ${PUBLIC_HOST}`);
  return zone.id;
}

async function publicSurface() {
  const response = await fetch(`${origin}/sitemap.xml`, { headers: { accept: "application/xml,text/xml" } });
  assert(response.ok, `Sitemap request failed with ${response.status}`);
  return buildPublicSurface(parseSitemapPaths(await response.text()));
}

function summarizeRule(rule) {
  return { id: rule.id, ref: rule.ref, action: rule.action, expression: rule.expression, action_parameters: rule.action_parameters };
}

async function ensureCacheRule(zone) {
  const rule = cacheRule();
  if (!apply) return { status: "would_create_or_verify", rule };
  let response;
  try {
    response = await cloudflareFetch(cacheRulesetPath(zone));
  } catch (error) {
    const missingEntrypoint =
      error?.status === 404 ||
      error?.cloudflareErrors?.some((item) => item.code === 10003) ||
      /could not find entrypoint ruleset/i.test(error?.message ?? "");
    if (!missingEntrypoint) throw error;
    response = { result: null };
  }
  const existing = response.result;
  if (!existing) {
    const created = await cloudflareFetch(`/zones/${zone}/rulesets`, {
      method: "POST",
      body: JSON.stringify({
        name: "Aidreamcapes public HTML cache",
        description: "Cache public Aidreamcapes HTML using origin freshness headers; private, internal and authenticated routes stay uncached.",
        kind: "zone",
        phase: "http_request_cache_settings",
        rules: [rule]
      })
    });
    return { status: "created", rule: summarizeRule(created.rules?.[0] ?? rule), rulesetId: created.id };
  }
  const current = existing.rules?.find((item) => item.ref === cacheRuleRef);
  if (!current) throw new Error(`Cloudflare cache ruleset ${existing.id} exists without ${cacheRuleRef}; refusing an implicit overwrite.`);
  assert.equal(current.action, "set_cache_settings", `${cacheRuleRef} must keep set_cache_settings`);
  assert.equal(current.expression, rule.expression, `${cacheRuleRef} expression drifted; refusing an implicit overwrite`);
  return { status: "unchanged", rule: summarizeRule(current), rulesetId: existing.id };
}

async function purgePublicUrls(zone, surface) {
  const requests = [];
  if (!apply || !purge) {
    return { status: "skipped", files: surface.files.length, prefixes: surface.prefixes.length, requests };
  }
  for (const batch of chunk(surface.files, PURGE_FILE_BATCH)) {
    requests.push(await cloudflareFetch(`/zones/${zone}/purge_cache`, {
      method: "POST",
      body: JSON.stringify({ files: batch.map((path) => `https://${PUBLIC_HOST}${path}`) })
    }));
  }
  for (const batch of chunk(surface.prefixes, PURGE_PREFIX_BATCH)) {
    requests.push(await cloudflareFetch(`/zones/${zone}/purge_cache`, {
      method: "POST",
      body: JSON.stringify({ prefixes: batch.map((prefix) => `${PUBLIC_HOST}${prefix}`) })
    }));
  }
  return { status: "purged", files: surface.files.length, prefixes: surface.prefixes.length, requests: requests.length };
}

if (apply && confirmation !== "aidreamcapes-edge") {
  throw new Error("Production edge changes require --apply --confirm=aidreamcapes-edge.");
}

const zone = await resolveZone();
const surface = await publicSurface();
const result = {
  host: PUBLIC_HOST,
  zoneId: zone,
  cacheRule: purgeOnly ? { status: "skipped" } : await ensureCacheRule(zone),
  purge: purgeOnly || purge ? await purgePublicUrls(zone, surface) : { status: "skipped" }
};
console.log(JSON.stringify(result, null, 2));
