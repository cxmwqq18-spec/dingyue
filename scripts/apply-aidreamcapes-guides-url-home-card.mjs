#!/usr/bin/env node
// Guides URL to Video: replace the Orca IDE screenshot with the clean,
// homepage Product URL to Video card (URL field + parsed listing + tote photos).
//
// Run from the current production release directory:
//   node scripts/apply-aidreamcapes-guides-url-home-card.mjs
//   node scripts/apply-aidreamcapes-guides-url-home-card.mjs --apply-production \
//     --confirm=guides-url-home-card
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

loadRuntimeEnv();
const applying = process.argv.includes("--apply-production");
const confirmed = process.argv.includes("--confirm=guides-url-home-card");
assertDatabaseTarget({
  expectedTarget: "production",
  requireProductionConfirmation: applying,
  productionConfirmed: applying && confirmed
});

const SITE_ID = "site_aidreamcapes";
const SLUG = "/guides/how-do-url-to-video";

const stable = (value) => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
    : value;
const hash = (value) => crypto.createHash("sha256")
  .update(value === undefined ? "<undefined>" : JSON.stringify(stable(value)))
  .digest("hex");

const edits = [];
const record = (fieldPath, before, after) => {
  edits.push({ slug: SLUG, path: fieldPath, beforeHash: hash(before), afterHash: hash(after) });
};

const NEW_IMAGE = {
  alt: "Homepage Product URL to Video card with an example product URL and imported tote photos.",
  src: "/ai-image-generation/url-to-video-home-card.webp",
  width: 980,
  height: 888
};
const NEW_OG = "/ai-image-generation/url-to-video-home-card.webp";
const NEW_OG_ALT = "Homepage Product URL to Video card with an example product URL and imported tote photos.";

const db = new PrismaClient();
try {
  const row = await db.livePage.findFirstOrThrow({ where: { siteId: SITE_ID, slug: SLUG } });
  const next = structuredClone(row.contentJson);
  const howto = next.sections.v2_main.settings.data.howto;
  const seo = next.seo;

  assert.equal(howto.image.src, "/assets/sites/site_aidreamcapes/guides/ch07-url-to-video-real.webp", "url-to-video hero drifted");
  record("howto/image", howto.image, NEW_IMAGE);
  howto.image = structuredClone(NEW_IMAGE);

  assert.equal(
    howto.intro[1],
    "The screenshot above shows the URL to Video workspace with a real public listing. The example below shows the kind of photos the importer reads from a product page.",
    "url-to-video intro[1] drifted"
  );
  const intro1 = "The card above shows the import example: a product URL, the parsed listing, and the photos it returns. The example below uses a public BAGGU product page.";
  record("howto/intro/1", howto.intro[1], intro1);
  howto.intro[1] = intro1;

  assert.equal(
    howto.demo.lead,
    "The URL card above shows a real public product page. The imported photos and details populate the editable draft you review before generating.",
    "url-to-video demo.lead drifted"
  );
  const demoLead = "The URL field in this example uses a real public product page. The imported photos and details populate the editable draft you review before generating.";
  record("howto/demo/lead", howto.demo.lead, demoLead);
  howto.demo.lead = demoLead;

  assert.equal(seo.ogImage, "/assets/sites/site_aidreamcapes/guides/ch07-url-to-video-real.webp", "url-to-video seo.ogImage drifted");
  record("seo/ogImage", seo.ogImage, NEW_OG);
  seo.ogImage = NEW_OG;
  assert.equal(seo.ogImageAlt, "URL to Video product-page importer and draft entry point.", "url-to-video seo.ogImageAlt drifted");
  record("seo/ogImageAlt", seo.ogImageAlt, NEW_OG_ALT);
  seo.ogImageAlt = NEW_OG_ALT;

  const howToNode = seo.jsonLd["@graph"].find((node) => node["@type"] === "HowTo");
  assert.ok(howToNode, "url-to-video HowTo JSON-LD missing");
  record("seo/jsonLd/HowTo/image", howToNode.image, { url: `https://www.aivideosugc.com${NEW_OG}`, "@type": "ImageObject", caption: NEW_OG_ALT });
  howToNode.image = { url: `https://www.aivideosugc.com${NEW_OG}`, "@type": "ImageObject", caption: NEW_OG_ALT };

  const manifestDir = process.env.MANIFEST_DIR
    ? path.resolve(process.env.MANIFEST_DIR)
    : path.join(process.cwd(), "scripts", "manifests");
  fs.mkdirSync(manifestDir, { recursive: true });
  const manifestPath = path.join(
    manifestDir,
    `aidreamcapes-guides-url-home-card-${new Date().toISOString().slice(0, 10)}.json`
  );
  fs.writeFileSync(manifestPath, `${JSON.stringify({
    siteId: SITE_ID,
    generatedAt: new Date().toISOString(),
    applying,
    editCount: edits.length,
    pages: [SLUG],
    edits
  }, null, 2)}\n`);

  if (!applying) {
    console.log(JSON.stringify({ pages: [SLUG], editCount: edits.length, manifestPath }, null, 2));
    process.exit(0);
  }

  const result = await db.livePage.updateMany({
    where: { siteId: SITE_ID, id: row.id, updatedAt: row.updatedAt },
    data: { contentJson: next }
  });
  assert.equal(result.count, 1, `${SLUG}: compare-and-set failed`);
  const readback = await db.livePage.findFirstOrThrow({ where: { siteId: SITE_ID, id: row.id } });
  assert.equal(hash(readback.contentJson), hash(next), `${SLUG}: readback does not match the manifest`);

  console.log(JSON.stringify({ applied: 1, editCount: edits.length, manifestPath }, null, 2));
} finally {
  await db.$disconnect();
}
