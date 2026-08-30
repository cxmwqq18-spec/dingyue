#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const baseUrl = (process.env.SMOKE_BASE_URL || "http://127.0.0.1:3002").replace(/\/$/, "");
const sitePrefix = process.env.SMOKE_PUBLIC_HOST ? "" : "/site/mydreamshoots";
const publicHost = process.env.SMOKE_PUBLIC_HOST || "";
const taxonomy = JSON.parse(fs.readFileSync(new URL("../src/lib/mydreamshoots-theme-taxonomy.json", import.meta.url), "utf8"));
const expectedRedirectSlug = "motion-generator";

async function check(slug) {
  const response = await fetch(`${baseUrl}${sitePrefix}/ai-image-generation/${slug}`, {
    headers: publicHost ? { host: publicHost, "x-forwarded-host": publicHost } : {},
    redirect: "manual"
  });
  return { slug, status: response.status, location: response.headers.get("location") };
}

const results = [];
for (const item of taxonomy.items ?? []) {
  results.push(await check(item.slug));
}

const failures = results.filter((result) => {
  if (result.slug === expectedRedirectSlug) return result.status !== 404;
  return result.status !== 200;
});

assert.deepEqual(failures, [], `image detail route failures: ${JSON.stringify(failures)}`);
console.log(JSON.stringify({
  ok: true,
  baseUrl,
  checked: results.length,
  expectedLegacy404: expectedRedirectSlug,
  failures
}, null, 2));
