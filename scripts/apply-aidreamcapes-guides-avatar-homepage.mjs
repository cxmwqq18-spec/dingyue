#!/usr/bin/env node
// Guides AI Avatar: replace the Ari / cream-canvas-tote example with the
// homepage presenter examples (Yara + coffee bag, Tara + drink can).
//
// Run from the current production release directory:
//   node scripts/apply-aidreamcapes-guides-avatar-homepage.mjs
//   node scripts/apply-aidreamcapes-guides-avatar-homepage.mjs --apply-production \
//     --confirm=guides-avatar-homepage
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

loadRuntimeEnv();
const applying = process.argv.includes("--apply-production");
const confirmed = process.argv.includes("--confirm=guides-avatar-homepage");
assertDatabaseTarget({
  expectedTarget: "production",
  requireProductionConfirmation: applying,
  productionConfirmed: applying && confirmed
});

const SITE_ID = "site_aidreamcapes";
const SLUGS = ["/guides/how-do-ai-avatar", "/guides"];

const stable = (value) => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
    : value;
const hash = (value) => crypto.createHash("sha256")
  .update(value === undefined ? "<undefined>" : JSON.stringify(stable(value)))
  .digest("hex");

const edits = [];
const record = (slug, fieldPath, before, after) => {
  edits.push({ slug, path: fieldPath, beforeHash: hash(before), afterHash: hash(after) });
};

const HERO = {
  alt: "Yara, an AI presenter at a cafe counter, with a coffee bag product photo and the generated clip.",
  src: "/ai-image-generation/avatar-homepage-examples.webp",
  width: 1440,
  height: 900
};
const YARA = [
  {
    tag: "Example A · presenter · Yara",
    image: {
      alt: "Yara, an AI presenter at a cafe counter, holding a coffee bag.",
      src: "/ai-image-generation/avatar-yara-cafe-720x828.webp",
      width: 720,
      height: 828
    }
  },
  {
    tag: "Example A · product photo · coffee bag",
    image: {
      alt: "Coffee bag product photo.",
      src: "/ai-image-generation/cafe-counter-introduction-product.jpg",
      width: 941,
      height: 1672
    }
  },
  {
    tag: "Example A · generated clip · play with sound",
    image: {
      alt: "Yara holding a coffee bag in the generated clip.",
      src: "/ai-image-generation/avatar-yara-cafe-720x828.webp",
      width: 720,
      height: 828
    },
    video: {
      src: "/ai-video-generation/cafe-counter-introduction.mp4",
      poster: "/ai-image-generation/avatar-yara-cafe-720x828.webp"
    }
  }
];
const TARA = [
  {
    tag: "Example B · presenter · Tara",
    image: {
      alt: "Tara, an AI presenter at a poolside, holding a drink can.",
      src: "/ai-image-generation/avatar-tara-pool-720x828.webp",
      width: 720,
      height: 828
    }
  },
  {
    tag: "Example B · product photo · drink can",
    image: {
      alt: "Drink can product photo.",
      src: "/ai-image-generation/pool-poolside-greeting-product.jpg",
      width: 941,
      height: 1672
    }
  },
  {
    tag: "Example B · generated clip · play with sound",
    image: {
      alt: "Tara holding a drink can in the generated clip.",
      src: "/ai-image-generation/avatar-tara-pool-720x828.webp",
      width: 720,
      height: 828
    },
    video: {
      src: "/ai-video-generation/pool-poolside-greeting.mp4",
      poster: "/ai-image-generation/avatar-tara-pool-720x828.webp"
    }
  }
];
const DEMO = {
  title: "Two examples: presenter → product photo → generated clip",
  lead: "Choose the presenter, attach the product photo, then write the script. The first row uses Yara and a coffee bag; the second uses Tara and a drink can. Play either clip with sound.",
  frames: YARA,
  result: { frames: TARA }
};
const STEP2 = "Attach the product photo or photos requested by the composer, then enter a short script that describes only verifiable product details. For the examples above, the product photos are a coffee bag and a drink can; the script introduces each one in one short line.";
const OG = "/ai-image-generation/avatar-homepage-examples.webp";
const OG_ALT = "Yara, an AI presenter at a cafe counter, with a coffee bag product photo and the generated clip.";

const db = new PrismaClient();
try {
  const rows = await db.livePage.findMany({
    where: { siteId: SITE_ID, slug: { in: SLUGS } },
    orderBy: { slug: "asc" }
  });
  assert.equal(rows.length, SLUGS.length, `expected ${SLUGS.length} rows, found ${rows.length}`);

  const nextById = new Map();
  for (const row of rows) {
    const next = structuredClone(row.contentJson);
    const data = next.sections.v2_main.settings.data;
    if (row.slug === "/guides/how-do-ai-avatar") {
      const howto = data.howto;
      const seo = next.seo;
      assert.equal(howto.image.src, "/assets/sites/site_aidreamcapes/guides/li-ch09-avatar-picker.webp", "ai-avatar hero drifted");
      record(row.slug, "howto/image", howto.image, HERO);
      howto.image = structuredClone(HERO);

      assert.equal(
        howto.intro[1],
        "The example below shows the real chain: the presenter chooser, the cream canvas tote product photo, and the clip generated with Ari presenting that tote.",
        "ai-avatar intro[1] drifted"
      );
      const intro1 = "The two examples below follow the homepage presentation: Yara at a cafe counter with a coffee bag, and Tara at a poolside with a drink can. Each row shows the presenter, the product photo, and the generated clip.";
      record(row.slug, "howto/intro/1", howto.intro[1], intro1);
      howto.intro[1] = intro1;

      assert.equal(howto.demo.frames[0].image.src, "/assets/sites/site_aidreamcapes/guides/li-ch09-avatar-picker.webp", "ai-avatar demo frame 0 drifted");
      assert.equal(howto.demo.frames[2].video.src, "/ai-video-generation/indoor-entryway-greeting.mp4", "ai-avatar demo frame 2 drifted");
      record(row.slug, "howto/demo", howto.demo, DEMO);
      howto.demo = structuredClone(DEMO);

      assert.equal(howto.steps[2].title, "Add the product and script", "ai-avatar steps[2] drifted");
      record(row.slug, "howto/steps/2/body", howto.steps[2].body, STEP2);
      howto.steps[2].body = STEP2;

      assert.equal(howto.faq[1].q, "Will my clip sound like the sample?", "ai-avatar faq[1] drifted");
      const faq1 = {
        q: "Will my clip sound like the sample?",
        a: "Play the voice sample on the presenter card before choosing — your clip is generated with that presenter's voice. The example clips above play with sound."
      };
      record(row.slug, "howto/faq/1", howto.faq[1], faq1);
      howto.faq[1] = faq1;

      assert.equal(seo.ogImage, "/assets/sites/site_aidreamcapes/guides/li-ch09-avatar-picker.webp", "ai-avatar seo.ogImage drifted");
      record(row.slug, "seo/ogImage", seo.ogImage, OG);
      seo.ogImage = OG;
      assert.equal(seo.ogImageAlt, "AI Avatar presenter picker with sample voice previews.", "ai-avatar seo.ogImageAlt drifted");
      record(row.slug, "seo/ogImageAlt", seo.ogImageAlt, OG_ALT);
      seo.ogImageAlt = OG_ALT;

      const howTo = seo.jsonLd["@graph"].find((node) => node["@type"] === "HowTo");
      assert.ok(howTo, "ai-avatar HowTo JSON-LD missing");
      record(row.slug, "seo/jsonLd/HowTo/image", howTo.image, { url: `https://www.aivideosugc.com${OG}`, "@type": "ImageObject", caption: OG_ALT });
      howTo.image = { url: `https://www.aivideosugc.com${OG}`, "@type": "ImageObject", caption: OG_ALT };
      record(row.slug, "seo/jsonLd/HowTo/step/2/text", howTo.step[2].text, STEP2);
      howTo.step[2].text = STEP2;
    } else if (row.slug === "/guides") {
      const item = data.hub.howTos.items.find((entry) => entry.href === "/guides/how-do-ai-avatar");
      assert.ok(item, "hub AI Avatar card missing");
      assert.equal(item.image.src, "/ai-image-generation/actors/ari-640.webp", "hub AI Avatar cover drifted");
      const image = {
        alt: "Yara, the AI presenter example from this tutorial.",
        src: "/ai-image-generation/avatar-yara-cafe-720x828.webp",
        width: 720,
        height: 828
      };
      record(row.slug, `hub/howTos/${data.hub.howTos.items.indexOf(item)}/image`, item.image, image);
      item.image = structuredClone(image);
    }
    nextById.set(row.id, next);
  }

  const manifestDoc = {
    siteId: SITE_ID,
    generatedAt: new Date().toISOString(),
    applying,
    editCount: edits.length,
    pages: SLUGS,
    edits
  };
  const manifestDir = process.env.MANIFEST_DIR
    ? path.resolve(process.env.MANIFEST_DIR)
    : path.join(process.cwd(), "scripts", "manifests");
  fs.mkdirSync(manifestDir, { recursive: true });
  const manifestPath = path.join(
    manifestDir,
    `aidreamcapes-guides-avatar-homepage-${new Date().toISOString().slice(0, 10)}.json`
  );
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifestDoc, null, 2)}\n`);

  if (!applying) {
    console.log(JSON.stringify({ pages: SLUGS, editCount: edits.length, manifestPath }, null, 2));
    process.exit(0);
  }

  const otherBefore = hash(await db.livePage.findMany({
    where: { siteId: { not: SITE_ID } },
    orderBy: { id: "asc" },
    select: { id: true, contentJson: true }
  }));
  let applied = 0;
  for (const row of rows) {
    const next = nextById.get(row.id);
    const result = await db.livePage.updateMany({
      where: { siteId: SITE_ID, id: row.id, updatedAt: row.updatedAt },
      data: { contentJson: next }
    });
    assert.equal(result.count, 1, `${row.slug}: compare-and-set failed`);
    const readback = await db.livePage.findFirstOrThrow({ where: { siteId: SITE_ID, id: row.id } });
    assert.equal(hash(readback.contentJson), hash(next), `${row.slug}: readback does not match the manifest`);
    applied += 1;
  }
  const otherAfter = hash(await db.livePage.findMany({
    where: { siteId: { not: SITE_ID } },
    orderBy: { id: "asc" },
    select: { id: true, contentJson: true }
  }));
  assert.equal(otherBefore, otherAfter, "a row outside site_aidreamcapes changed during the apply");

  console.log(JSON.stringify({ applied, editCount: edits.length, manifestPath }, null, 2));
} finally {
  await db.$disconnect();
}
