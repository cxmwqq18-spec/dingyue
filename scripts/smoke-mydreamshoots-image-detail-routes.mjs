#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const baseUrl = (process.env.SMOKE_BASE_URL || "http://127.0.0.1:3002").replace(/\/$/, "");
const sitePrefix = process.env.SMOKE_PUBLIC_HOST ? "" : "/site/mydreamshoots";
const publicHost = process.env.SMOKE_PUBLIC_HOST || "";
const taxonomy = JSON.parse(fs.readFileSync(new URL("../src/lib/mydreamshoots-theme-taxonomy.json", import.meta.url), "utf8"));
const expectedRedirectSlug = "motion-generator";
const expectedRedirectPath = `/ai-video-generation/${expectedRedirectSlug}`;
const requestConcurrency = 4;

async function check(slug) {
  const response = await fetch(`${baseUrl}${sitePrefix}/ai-image-generation/${slug}`, {
    headers: publicHost ? { host: publicHost, "x-forwarded-host": publicHost } : {},
    redirect: "manual"
  });
  await response.arrayBuffer();
  return { slug, status: response.status, location: response.headers.get("location") };
}

const results = [];
const items = taxonomy.items ?? [];
for (let index = 0; index < items.length; index += requestConcurrency) {
  const batch = items.slice(index, index + requestConcurrency);
  results.push(...await Promise.all(batch.map((item) => check(item.slug))));
}

const failures = results.filter((result) => {
  if (result.slug === expectedRedirectSlug) {
    return result.status !== 308 || !result.location?.endsWith(expectedRedirectPath);
  }
  return result.status !== 200;
});

assert.deepEqual(failures, [], `image detail route failures: ${JSON.stringify(failures)}`);
console.log(JSON.stringify({
  ok: true,
  baseUrl,
  checked: results.length,
  expectedRedirect: expectedRedirectPath,
  failures
}, null, 2));
