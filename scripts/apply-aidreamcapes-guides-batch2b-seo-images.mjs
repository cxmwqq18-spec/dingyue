#!/usr/bin/env node
// Batch 2b: sync the four tutorials' stored seo og:image, twitter:image, and
// HowTo image with the real workspace screenshots and demo posters from batch 2.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

loadRuntimeEnv();
const applying = process.argv.includes("--apply-production");
const confirmed = process.argv.includes("--confirm=guides-batch2b-seo-images");
assertDatabaseTarget({
  expectedTarget: "production",
  requireProductionConfirmation: applying,
  productionConfirmed: applying && confirmed
});

const SITE_ID = "site_aidreamcapes";
const ORIGIN = "https://www.aivideosugc.com";

const SEO_IMAGES = {
  "/guides/how-do-subtitle-studio": {
    expect: "/assets/sites/site_aidreamcapes/guides/subtitle-example-study-desk-lamp-poster.jpg",
    next: "/assets/sites/site_aidreamcapes/guides/subtitle-example-berry-bowl-poster.jpg",
    alt: "Berry-bowl clip frame used as the Subtitle Studio example poster."
  },
  "/guides/how-do-url-to-video": {
    expect: "/assets/sites/site_aidreamcapes/guides/ch07-url-to-video.webp",
    next: "/assets/sites/site_aidreamcapes/guides/ch07-url-to-video-real.webp",
    alt: "URL to Video workspace showing the product-page URL field and the imported product preview."
  },
  "/guides/how-do-product-links": {
    expect: "/assets/sites/site_aidreamcapes/guides/ch08-product-links.webp",
    next: "/assets/sites/site_aidreamcapes/guides/ch08-product-links-real.webp",
    alt: "Product Links workspace showing the saved-product library with confirmed entries."
  }
};

const stable = (v) => Array.isArray(v) ? v.map(stable)
  : v && typeof v === "object"
    ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])]))
    : v;
const hash = (v) => crypto.createHash("sha256").update(JSON.stringify(stable(v))).digest("hex");

const db = new PrismaClient();
try {
  const slugs = Object.keys(SEO_IMAGES);
  const rows = await db.livePage.findMany({
    where: { siteId: SITE_ID, slug: { in: slugs } },
    orderBy: { slug: "asc" }
  });
  assert.equal(rows.length, slugs.length);
  const edits = [];

  for (const row of rows) {
    const config = SEO_IMAGES[row.slug];
    const next = structuredClone(row.contentJson);
    const seo = next.seo;

    assert.equal(seo.ogImage, config.expect, `${row.slug}: ogImage drifted`);
    seo.ogImage = config.next;
    edits.push({ slug: row.slug, field: "seo.ogImage", from: config.expect, to: config.next });

    for (const node of seo.jsonLd["@graph"] || []) {
      if (node?.image?.url === `${ORIGIN}${config.expect}`) {
        node.image.url = `${ORIGIN}${config.next}`;
        if (node.image.contentUrl) node.image.contentUrl = `${ORIGIN}${config.next}`;
        edits.push({ slug: row.slug, field: "seo.jsonLd HowTo image", to: config.next });
      }
      if (node?.primaryImageOfPage?.url === `${ORIGIN}${config.expect}`) {
        node.primaryImageOfPage.url = `${ORIGIN}${config.next}`;
        edits.push({ slug: row.slug, field: "seo.jsonLd primaryImageOfPage", to: config.next });
      }
    }

    const result = await db.livePage.updateMany({
      where: { siteId: SITE_ID, id: row.id, updatedAt: row.updatedAt },
      data: { contentJson: next }
    });
    if (applying) {
      assert.equal(result.count, 1, `${row.slug}: CAS failed`);
      const readback = await db.livePage.findFirstOrThrow({ where: { siteId: SITE_ID, id: row.id } });
      assert.equal(hash(readback.contentJson), hash(next), `${row.slug}: readback mismatch`);
    }
  }

  if (!applying) {
    console.log(JSON.stringify({ editCount: edits.length, edits: edits.map((e) => ({ slug: e.slug, field: e.field })) }, null, 2));
    console.error(`dry run: ${edits.length} seo image edit(s)`);
    process.exit(0);
  }
  console.log(JSON.stringify({ applied: rows.length, editCount: edits.length }, null, 2));
} finally {
  await db.$disconnect();
}
