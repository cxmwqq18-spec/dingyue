#!/usr/bin/env node
// Release gate for the 674 retired workspace-case addresses.
//
// Reads the reviewed production manifest, requests every retired long address
// in public host mode, and verifies:
//   * the retired address answers 308 with the exact short canonical path;
//   * every canonical target answers 200;
//   * the canonical page is self-canonical, noindex/follow, and exposes
//     exactly one workspace CTA;
//   * the sitemap lists neither the retired nor the canonical detail address.
//
// This script is read-only and never writes content or a publication.
//
// Usage:
//   AIDREAMCAPES_AUDIT_ORIGIN=http://127.0.0.1:3013 \
//     node scripts/aidreamcapes-workspace/smoke-workspace-case-aliases.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(
  process.env.PRISMA_BASE
    ? path.join(process.env.PRISMA_BASE, "package.json")
    : import.meta.url
);
const { load } = require("cheerio");

const origin = String(process.env.AIDREAMCAPES_AUDIT_ORIGIN || "http://127.0.0.1:3013").replace(/\/$/, "");
// A local development server routes by the site prefix instead of the public
// host, so the gate can be pointed at `/site/aidreamcapes`.
const sitePrefix = String(process.env.AIDREAMCAPES_AUDIT_SITE_PREFIX || "").replace(/\/$/, "");
const manifestPath = path.resolve(
  process.env.AIDREAMCAPES_AUDIT_MANIFEST
    || "scripts/manifests/aidreamcapes-workspace-case-aliases-production-2026-10-22.json"
);
const output = process.env.AIDREAMCAPES_AUDIT_OUTPUT;
const timeout = Number(process.env.AIDREAMCAPES_AUDIT_TIMEOUT || 60000);
const concurrency = Math.max(1, Math.min(12, Number(process.env.AIDREAMCAPES_AUDIT_CONCURRENCY || 6)));
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
assert.equal(manifest.ok, true, "Manifest is not an ok plan.");
assert.equal(manifest.siteId, "site_aidreamcapes", "Manifest is not scoped to site_aidreamcapes.");
assert.equal(manifest.addresses?.length, 674, `Expected 674 addresses, found ${manifest.addresses?.length}.`);

const headers = sitePrefix ? {} : { "x-forwarded-host": "www.aivideosugc.com", "x-forwarded-proto": "https" };
const pathFor = (pathname) => `${sitePrefix}${pathname}`;
const report = {
  ok: false,
  origin,
  manifest: path.relative(process.cwd(), manifestPath),
  planHash: manifest.planHash,
  aliases: manifest.addresses.length,
  canonicalTargets: 0,
  checks: 0,
  errors: [],
  writes: false
};

async function request(pathname, { html = false } = {}) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`${origin}${pathFor(pathname)}`, {
        headers,
        redirect: "manual",
        signal: AbortSignal.timeout(timeout)
      });
      const body = html ? await response.text() : "";
      if (!html) await response.body?.cancel();
      return { response, body };
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function mapLimit(items, limit, worker) {
  let index = 0;
  const results = new Array(items.length);
  await Promise.all(Array.from({ length: limit }, async () => {
    while (index < items.length) {
      const current = index++;
      results[current] = await worker(items[current], current);
    }
  }));
  return results;
}

const addresses = [...manifest.addresses].sort((a, b) => a.oldPath.localeCompare(b.oldPath));

await mapLimit(addresses, concurrency, async (address) => {
  try {
    const { response } = await request(address.oldPath);
    report.checks += 1;
    assert.equal(response.status, 308, `${address.oldPath} answered ${response.status}`);
    const location = response.headers.get("location") ?? "";
    const actual = new URL(location, origin);
    if (!sitePrefix) {
      assert.equal(actual.origin, "https://www.aivideosugc.com", `${address.oldPath} redirected to ${actual.origin}`);
    }
    assert(actual.pathname.endsWith(address.newPath), `${address.oldPath} redirected to ${actual.pathname}, expected ${address.newPath}`);
  } catch (error) {
    report.errors.push(`${address.oldPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
});

const canonicalPaths = [...new Set(addresses.map((address) => address.newPath))].sort();
report.canonicalTargets = canonicalPaths.length;
assert.equal(canonicalPaths.length, 37, `Expected 37 canonical targets, found ${canonicalPaths.length}.`);

await mapLimit(canonicalPaths, concurrency, async (pathname) => {
  try {
    const { response, body } = await request(pathname, { html: true });
    report.checks += 1;
    assert.equal(response.status, 200, `${pathname} answered ${response.status}`);
    const $ = load(body);
    assert.equal(
      $("link[rel=canonical]").attr("href"),
      `https://www.aivideosugc.com${pathname}`,
      `${pathname} canonical link mismatch`
    );
    const robots = ($("meta[name=robots]").attr("content") ?? "").toLowerCase();
    assert(robots.includes("noindex"), `${pathname} is not noindex`);
    assert(robots.includes("follow"), `${pathname} is not follow`);
    const workspaceCtas = $("a[data-workspace-entry]").filter((_, element) => {
      const href = $(element).attr("href") ?? "";
      return href.includes("/app/create/");
    }).length;
    assert.equal(workspaceCtas, 1, `${pathname} exposes ${workspaceCtas} workspace CTAs`);
  } catch (error) {
    report.errors.push(`${pathname}: ${error instanceof Error ? error.message : String(error)}`);
  }
});

try {
  const { response, body } = await request("/sitemap.xml", { html: true });
  report.checks += 1;
  assert.equal(response.status, 200, `sitemap answered ${response.status}`);
  for (const address of addresses) {
    assert(!body.includes(`<loc>https://www.aivideosugc.com${address.oldPath}</loc>`), `sitemap lists retired ${address.oldPath}`);
    assert(!body.includes(`<loc>https://www.aivideosugc.com${address.newPath}</loc>`), `sitemap lists detail ${address.newPath}`);
  }
} catch (error) {
  report.errors.push(`sitemap: ${error instanceof Error ? error.message : String(error)}`);
}

try {
  const { response } = await request("/");
  report.checks += 1;
  // A site-prefixed local server answers the bare home path with the
  // canonical redirect to the prefixed home path.
  assert([200, 301].includes(response.status), `homepage answered ${response.status}`);
} catch (error) {
  report.errors.push(`homepage: ${error instanceof Error ? error.message : String(error)}`);
}

report.ok = report.errors.length === 0;
if (output) {
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
