#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

// PostgreSQL is the only runtime/release source. data/platform-state.json is retired.
const prisma = new PrismaClient();
const repoRoot = process.cwd();
const copy = JSON.parse(fs.readFileSync(path.join(repoRoot, "src/lib/mydreamshoots-homepage-copy.json"), "utf8"));
const origin = String(process.env.MYDREAMSHOOTS_SMOKE_ORIGIN ?? "https://www.mydreamshoots.com").replace(/\/$/, "");

function assertText(value, expected, label) {
  assert.equal(String(value ?? "").replace(/[—–]/g, "-"), String(expected).replace(/[—–]/g, "-"), label);
}

async function main() {
  assert.ok(process.env.DATABASE_URL?.trim(), "DATABASE_URL is required; data/platform-state.json has been retired");
  const site = await prisma.site.findFirst({
    where: { OR: [{ id: "site_dreamshoot" }, { primaryDomain: "www.mydreamshoots.com" }] },
    select: {
      id: true,
      pages: { where: { slug: "/" }, select: { publishedJson: true } },
      publications: { orderBy: [{ version: "desc" }], take: 1, select: { id: true, version: true, snapshot: true } }
    }
  });
  assert.ok(site, "site_dreamshoot must exist in PostgreSQL");
  const page = site.pages[0]?.publishedJson;
  const publication = site.publications[0];
  assert.ok(page, "published MyDreamShoots homepage must exist");
  assert.ok(publication?.snapshot, "active publication snapshot must exist");
  const sections = page.sections ?? {};
  const order = page.sectionsOrder ?? [];
  assert.deepEqual(order, ["hero_1", "generation_showcase_1", "tutorial_video_1", "package_catalog_1", "proof_1", "faq_1", "conversion_1", "brand_strip_1"], "homepage order must use the current Phase B contract");
  assert.equal(sections.generation_showcase_1?.type, "dreamshoot_generation_showcase");
  assert.equal(sections.package_catalog_1?.type, "dreamshoot_package_catalog");
  assert.equal(sections.proof_1?.settings?.title, copy.reviewTitle);
  assert.equal(sections.conversion_1?.settings?.title, copy.conversionTitle);
  assertText(sections.conversion_1?.settings?.subtitle, copy.conversionSubtitle, "conversion subtitle drifted");
  assert.equal(sections.pricing_1?.settings?.description, "Use credits across eligible AI photo and video workflows. The required credit cost is shown before generation.");

  const rows = publication.snapshot.publishedHomepageShowcases ?? [];
  const counts = rows.reduce((result, row) => {
    result[row.kind] = (result[row.kind] ?? 0) + 1;
    return result;
  }, {});
  assert.ok(counts.video >= 8, `publication must expose at least 8 published video showcases (got ${counts.video ?? 0})`);
  assert.equal(counts.save_the_date, 4, "publication must expose four published Save the Date showcases");
  assert.equal(counts.photo, 8, "publication must expose eight published photo showcases");
  assert.ok(rows.every((row) => row.status === "published" && row.indexable === true && row.sitemapEligible === true), "homepage showcase projection must contain only published indexable rows");
  const videoUrls = rows.filter((row) => row.kind === "video").map((row) => row.videoUrl).filter(Boolean);
  assert.equal(new Set(videoUrls).size, videoUrls.length, "homepage video showcase URLs must be unique");

  const response = await fetch(`${origin}/`, { headers: { accept: "text/html,*/*" } });
  assert.equal(response.status, 200, "production homepage must return 200");
  const html = await response.text();
  assert.equal((html.match(/<h1\b/gi) ?? []).length, 1, "homepage must contain exactly one H1");
  assert.ok(!/<h2\b[^>]*>[^<]*Creative workflow examples built with myDreamshoots/i.test(html), "workflow examples must not render as an H2");
  assert.ok(!/<h2\b[^>]*>\s*(?:Soccer|Portrait Photo|Christmas Photo)\s*<\/h2>/i.test(html), "photo package cards must not render as H2");
  assert.ok(html.includes(copy.packageVideoLinkLabel), "photo packages must link to AI Video Generation");
  assert.ok(html.includes(copy.reviewTitle), "production homepage must expose the approved review heading");
  assert.ok(html.includes(copy.videoTitle) && html.includes(copy.saveTheDateTitle) && html.includes(copy.photoTitle), "production gallery headings must use the Phase B contract");

  console.log(JSON.stringify({ ok: true, publication: { id: publication.id, version: publication.version }, counts, production: { origin, status: response.status } }, null, 2));
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
