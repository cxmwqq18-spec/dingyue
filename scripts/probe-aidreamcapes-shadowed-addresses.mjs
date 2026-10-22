// Read-only HTTP probe for Aidreamcapes shadowed addresses (redirect sources,
// retired paths, legacy gallery aliases and legacy Save The Date video aliases).
//
// Run it on the release machine: the local egress to the CDN is reset.
//   node scripts/probe-aidreamcapes-shadowed-addresses.mjs <paths.json> <out.json>
//
// It records the status code, the redirect target, a body hash and the sitemap
// membership of every probed address, so a cleanup can prove that the visible
// HTTP contract is unchanged before and after the database change.

import fs from "node:fs";
import crypto from "node:crypto";

const ORIGIN = process.env.AIDC_ORIGIN || "https://www.aivideosugc.com";
const pathsFile = process.argv[2];
const outFile = process.argv[3];
const paths = JSON.parse(fs.readFileSync(pathsFile, "utf8"));

async function probe(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`${ORIGIN}${path}`, {
      redirect: "manual",
      signal: controller.signal,
      headers: { "user-agent": "aidreamcapes-retired-rows-audit/1.0" },
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      path,
      status: response.status,
      location: response.headers.get("location") || null,
      bytes: buffer.length,
      bodySha256: buffer.length ? crypto.createHash("sha256").update(buffer).digest("hex") : null,
      robots: response.headers.get("x-robots-tag") || "",
    };
  } catch (error) {
    return { path, status: 0, location: null, bytes: 0, bodySha256: null, robots: "", error: String(error?.message || error) };
  } finally {
    clearTimeout(timer);
  }
}

const results = [];
let index = 0;
async function worker() {
  while (index < paths.length) {
    const current = index++;
    results[current] = await probe(paths[current]);
  }
}
await Promise.all(Array.from({ length: 6 }, () => worker()));

const sitemap = await fetch(`${ORIGIN}/sitemap.xml`, { headers: { "user-agent": "aidreamcapes-retired-rows-audit/1.0" } });
const sitemapText = await sitemap.text();
const locs = [...sitemapText.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
const locSet = new Set(locs);
const sitemapMembership = paths.map((path) => ({ path, inSitemap: locSet.has(`${ORIGIN}${path}`) }));
const inSitemap = sitemapMembership.filter((entry) => entry.inSitemap).map((entry) => entry.path);

const report = {
  origin: ORIGIN,
  probedAt: new Date().toISOString(),
  sitemapStatus: sitemap.status,
  sitemapLocCount: locs.length,
  sitemapMembership,
  inSitemap,
  results,
};
// "-" writes the full report to stdout so a caller can read it over SSH.
if (outFile === "-") console.log(JSON.stringify(report));
else {
  if (outFile) fs.writeFileSync(outFile, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({
    origin: ORIGIN,
    sitemapStatus: sitemap.status,
    sitemapLocCount: locs.length,
    probed: results.length,
    inSitemap,
    statusCounts: results.reduce((acc, row) => { acc[row.status] = (acc[row.status] || 0) + 1; return acc; }, {}),
    out: outFile || null,
  }, null, 2));
}
