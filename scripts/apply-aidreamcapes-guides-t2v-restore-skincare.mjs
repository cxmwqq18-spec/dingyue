#!/usr/bin/env node
// Guides Text to Video correction (2026-11-21):
// - remove the homepage motion preview (Black presenter) from the hero;
//   use the left text/prompt card only
// - restore the demo to the earlier skincare gift set unboxing clip
// - restore the OG/cover and hub card to the previous skincare poster
//
// Run from the current production release directory:
//   node scripts/apply-aidreamcapes-guides-t2v-restore-skincare.mjs
//   node scripts/apply-aidreamcapes-guides-t2v-restore-skincare.mjs --apply-production \
//     --confirm=guides-t2v-restore-skincare
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

loadRuntimeEnv();
const applying = process.argv.includes("--apply-production");
const confirmed = process.argv.includes("--confirm=guides-t2v-restore-skincare");
assertDatabaseTarget({
  expectedTarget: "production",
  requireProductionConfirmation: applying,
  productionConfirmed: applying && confirmed
});

const SITE_ID = "site_aidreamcapes";
const SLUGS = ["/guides/how-do-text-to-video", "/guides"];

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
  alt: "Homepage Text to Video card with the prompt and creation controls, without the video preview.",
  src: "/ai-image-generation/text-to-video-text-card.webp",
  width: 1386,
  height: 888
};
const COVER = "/ai-image-generation/skincare-gift-set-unbox-routine-640.webp";
const COVER_ALT = "Creator packing a skincare gift set in a TikTok-style video.";
const DEMO_VIDEO = {
  src: "/ai-video-generation/skincare-gift-set-unbox-routine-p10.mp4",
  poster: "/ai-image-generation/skincare-gift-set-unbox-routine-poster.jpg"
};
const DEMO = {
  lead: "The prompt names the product, the setting, and the action. The clip shows a creator packing a skincare gift set; play it to see the result.",
  panel: {
    tabs: ["Text to Video", "AI Video", "AI Image"],
    activeTab: 0,
    input: "A creator packs a skincare gift set at a bright worktable: cleanser, serum, and face cream go into a gift box, then she closes it and holds it up.",
    chips: ["Product", "Presenter", "9:16", "15s"]
  },
  title: "One prompt → one clip",
  result: {
    frames: [
      {
        tag: "Example clip · skincare gift set unboxing",
        video: DEMO_VIDEO
      }
    ],
    prompt: "What made this prompt work: it named the three products, the gift box, and the packing order. Add the camera and the look only when the result needs them."
  }
};
const STEP1 = "Start with the product and one visible thing that happens. For this example: “A creator packs a skincare gift set at a bright worktable: cleanser, serum, and face cream go into a gift box.”";
const STEP2 = "Say where the clip happens and how it should look. For this example: “Bright worktable, natural light, handheld phone framing.”";
const SECTION1 = {
  h2: "Weak prompt vs strong prompt",
  cards: [
    { tag: "Weak", title: "Too vague", body: "Make a video of my skincare set." },
    { tag: "Strong", title: "Clear and specific", body: "A 15-second vertical video of a creator packing a skincare gift set at a bright worktable. She puts cleanser, serum, and face cream into a gift box, closes it, and holds it up. Natural light, handheld phone framing, no on-screen text." }
  ]
};

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
    if (row.slug === "/guides/how-do-text-to-video") {
      const howto = data.howto;
      const seo = next.seo;
      assert.equal(howto.image.src, "/ai-image-generation/text-to-video-home-card.webp", "text-to-video hero drifted");
      record(row.slug, "howto/image", howto.image, HERO);
      howto.image = structuredClone(HERO);

      assert.equal(
        howto.intro[1],
        "The example below uses a 15-second moisturizer review prompt. The clip shows the kind of result a clear prompt can produce.",
        "text-to-video intro[1] drifted"
      );
      const intro1 = "The example below uses a skincare gift set packing prompt. The clip shows the kind of result a clear prompt can produce.";
      record(row.slug, "howto/intro/1", howto.intro[1], intro1);
      howto.intro[1] = intro1;

      assert.equal(howto.demo.result.frames[0].video.src, "/ai-video-generation/bathroom-review-moisturizer-p10.mp4", "text-to-video demo drifted");
      record(row.slug, "howto/demo", howto.demo, DEMO);
      howto.demo = structuredClone(DEMO);

      assert.equal(howto.steps[1].title, "Name the product and the action", "text-to-video steps[1] drifted");
      record(row.slug, "howto/steps/1/body", howto.steps[1].body, STEP1);
      howto.steps[1].body = STEP1;
      assert.equal(howto.steps[2].title, "Add the setting and the look", "text-to-video steps[2] drifted");
      record(row.slug, "howto/steps/2/body", howto.steps[2].body, STEP2);
      howto.steps[2].body = STEP2;

      assert.equal(howto.sections[1].h2, "Weak prompt vs strong prompt", "text-to-video sections[1] drifted");
      record(row.slug, "howto/sections/1", howto.sections[1], SECTION1);
      howto.sections[1] = structuredClone(SECTION1);

      assert.equal(seo.ogImage, "/ai-image-generation/text-to-video-home-card.webp", "text-to-video seo.ogImage drifted");
      record(row.slug, "seo/ogImage", seo.ogImage, COVER);
      seo.ogImage = COVER;
      assert.equal(seo.ogImageAlt, "Homepage Text to Video card with a prompt, creation controls, and a motion preview.", "text-to-video seo.ogImageAlt drifted");
      record(row.slug, "seo/ogImageAlt", seo.ogImageAlt, COVER_ALT);
      seo.ogImageAlt = COVER_ALT;

      const howTo = seo.jsonLd["@graph"].find((node) => node["@type"] === "HowTo");
      assert.ok(howTo, "text-to-video HowTo JSON-LD missing");
      record(row.slug, "seo/jsonLd/HowTo/image", howTo.image, { url: `https://www.aivideosugc.com${COVER}`, "@type": "ImageObject", caption: COVER_ALT });
      howTo.image = { url: `https://www.aivideosugc.com${COVER}`, "@type": "ImageObject", caption: COVER_ALT };
      record(row.slug, "seo/jsonLd/HowTo/step/1/text", howTo.step[1].text, STEP1);
      howTo.step[1].text = STEP1;
      record(row.slug, "seo/jsonLd/HowTo/step/2/text", howTo.step[2].text, STEP2);
      howTo.step[2].text = STEP2;
    } else if (row.slug === "/guides") {
      const item = data.hub.howTos.items.find((entry) => entry.href === "/guides/how-do-text-to-video");
      assert.ok(item, "hub Text to Video card missing");
      assert.equal(item.image.src, "/ai-image-generation/text-to-video-home-card.webp", "hub Text to Video cover drifted");
      record(row.slug, `hub/howTos/${data.hub.howTos.items.indexOf(item)}/image`, item.image, { alt: COVER_ALT, src: COVER, width: 640, height: 640 });
      item.image = { alt: COVER_ALT, src: COVER, width: 640, height: 640 };
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
    `aidreamcapes-guides-t2v-restore-skincare-${new Date().toISOString().slice(0, 10)}.json`
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
