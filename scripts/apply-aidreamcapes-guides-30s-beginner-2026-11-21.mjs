#!/usr/bin/env node
// Guides audit fixes (2026-11-21):
// - use the real 30-second clips instead of the 10-second previews
// - align the Text to Video example length with the 30-second clip
// - rewrite the worst inline jargon definitions for first-time readers
// - clarify the URL to Video BAGGU URL vs canvas-tote example
//
// Run from the current production release directory:
//   node scripts/apply-aidreamcapes-guides-30s-beginner-2026-11-21.mjs
//   node scripts/apply-aidreamcapes-guides-30s-beginner-2026-11-21.mjs --apply-production \
//     --confirm=guides-30s-beginner-2026-11-21
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

loadRuntimeEnv();
const applying = process.argv.includes("--apply-production");
const confirmed = process.argv.includes("--confirm=guides-30s-beginner-2026-11-21");
assertDatabaseTarget({
  expectedTarget: "production",
  requireProductionConfirmation: applying,
  productionConfirmed: applying && confirmed
});

const SITE_ID = "site_aidreamcapes";
const SLUGS = [
  "/guides/how-do-ai-video",
  "/guides/how-do-image-to-video",
  "/guides/how-do-text-to-video",
  "/guides/how-do-ai-avatar",
  "/guides/how-do-ai-image",
  "/guides/how-do-url-to-video",
  "/guides/how-do-subtitle-studio"
];

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
const setField = (slug, obj, key, oldValue, newValue) => {
  assert.deepEqual(obj[key], oldValue, `${slug}: ${key} drifted`);
  record(slug, key, obj[key], newValue);
  obj[key] = newValue;
};
const replaceIn = (slug, obj, key, oldSub, newSub) => {
  const before = obj[key];
  assert.equal(typeof before, "string", `${slug}: ${key} is not a string`);
  assert.ok(before.includes(oldSub), `${slug}: ${key} missing expected text`);
  const after = before.replace(oldSub, newSub);
  record(slug, `${key}`, before, after);
  obj[key] = after;
};
const replaceStep = (slug, howto, index, oldSub, newSub) => {
  const step = howto.steps[index];
  assert.ok(step, `${slug}: step ${index} missing`);
  assert.ok(step.body.includes(oldSub), `${slug}: step ${index} missing expected text`);
  const after = step.body.replace(oldSub, newSub);
  record(slug, `steps/${index}/body`, step.body, after);
  step.body = after;
};

function rebuildJsonLd(slug, seo, howto) {
  const before = structuredClone(seo.jsonLd);
  const graph = seo.jsonLd["@graph"];
  const article = graph.find((node) => node["@type"] === "Article");
  if (article) {
    article.headline = howto.h1;
    article.description = howto.lead;
  }
  const howTo = graph.find((node) => node["@type"] === "HowTo");
  if (howTo) {
    howTo.name = howto.h1;
    howTo.description = howto.lead;
    howTo.step = howto.steps.map((step) => ({ name: step.title, text: step.body, "@type": "HowToStep" }));
  }
  const faq = graph.find((node) => node["@type"] === "FAQPage");
  if (faq) {
    faq.mainEntity = howto.faq.map((item) => ({
      name: item.q,
      "@type": "Question",
      acceptedAnswer: { text: item.a, "@type": "Answer" }
    }));
  }
  record(slug, "seo/jsonLd", before, seo.jsonLd);
}

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
    const howto = data.howto;
    const seo = next.seo;
    const slug = row.slug;
    let changed = false;

    if (slug === "/guides/how-do-ai-video") {
      setField(slug, howto, "h1", "AI Video: Start a Product Clip from Reference Photos", "AI Video: Start a Product Clip from Your Product Photos");
      setField(slug, howto, "lead", "Add product reference photos, describe the scene, and review the finished clip against the details you supplied.", "Add a few clear product photos, describe the scene, and review the finished clip against the details you supplied.");
      replaceIn(slug, howto.intro, 0, "AI Video is for a clip built from product references and a written scene direction. It starts from visual material you provide; it is different from [Text to Video](/guides/how-do-text-to-video), which starts from a brief, and [Image to Video](/guides/how-do-image-to-video), which starts from one photo and one motion prompt.",
        "AI Video builds a clip from a few product photos plus a description of the scene. It is different from [Text to Video](/guides/how-do-text-to-video), which starts from words, and [Image to Video](/guides/how-do-image-to-video), which starts from one photo and one movement.");
      replaceIn(slug, howto.intro, 2, "A 15-second clip typically costs about 30 credits and takes 3–5 minutes to generate.", "A 15-second clip typically costs about 30 credits and takes 3–5 minutes to generate; longer clips cost more.");
      const video = howto.demo.frames[1].video;
      setField(slug, video, "src", "/ai-video-generation/hot-sauce-pour-p10.mp4", "/ai-video-generation/hot-sauce-pour.mp4");
      setField(slug, howto.demo.frames[1], "tag", "Generated clip · from this reference · silent preview", "Generated clip · from this reference · 30 seconds");
      replaceStep(slug, howto, 3, "Read the estimate (The estimate shows how many credits this generation will cost before you confirm. You are never charged without seeing the price first.) before you start.", "Read the price estimate before you start. It shows how many credits the generation will cost; you are never charged without seeing the price first.");
      changed = true;
    } else if (slug === "/guides/how-do-image-to-video") {
      replaceIn(slug, howto.intro, 0, "Image to Video starts with one still photo and a motion prompt. Use it when the product image is ready and you want a short movement, such as giving a shirt one slow full turn or lifting a bottle.",
        "Image to Video starts with one still photo and a short instruction that describes one movement. Use it when the product image is ready and you want a short movement, such as giving a shirt one slow full turn or lifting a bottle.");
      replaceIn(slug, howto.intro, 2, "A 15-second clip typically costs about 30 credits and takes 3–5 minutes to generate.", "A 15-second clip typically costs about 30 credits and takes 3–5 minutes to generate; longer clips cost more.");
      const video = howto.demo.frames[1].video;
      setField(slug, video, "src", "/ai-video-generation/360-showcase-linen-shirt-p10.mp4", "/ai-video-generation/360-showcase-linen-shirt.mp4");
      setField(slug, howto.demo.frames[1], "tag", "Generated clip · from this reference · silent preview", "Generated clip · from this reference · 30 seconds");
      replaceStep(slug, howto, 3, "Read the displayed estimate (The estimate shows how many credits this generation will cost before you confirm. You are never charged without seeing the price first.) before generation.", "Read the displayed price estimate before generation. It shows how many credits the generation will cost; you are never charged without seeing the price first.");
      changed = true;
    } else if (slug === "/guides/how-do-text-to-video") {
      replaceIn(slug, howto.intro, 2, "A 15-second clip typically costs about 30 credits and takes 3–5 minutes to generate.", "A 15-second clip typically costs about 30 credits and takes 3–5 minutes to generate; longer clips cost more.");
      const video = howto.demo.result.frames[0].video;
      setField(slug, video, "src", "/ai-video-generation/skincare-gift-set-unbox-routine-p10.mp4", "/ai-video-generation/skincare-gift-set-unbox-routine.mp4");
      setField(slug, howto.demo.result.frames[0], "tag", "Example clip · skincare gift set unboxing", "Example clip · skincare gift set packing · 30 seconds");
      const chips = howto.demo.panel.chips;
      const chipIndex = chips.indexOf("15s");
      assert.notEqual(chipIndex, -1, "text-to-video length chip drifted");
      record(slug, `demo/panel/chips/${chipIndex}`, chips[chipIndex], "30s");
      chips[chipIndex] = "30s";
      replaceStep(slug, howto, 3, "Use the workspace controls to set 9:16 and 15 seconds (or the format and length you need).", "Use the workspace controls to set 9:16 and 30 seconds (or the format and length you need).");
      replaceIn(slug, howto.sections[0].bullets, 5, "**Format and length:** 9:16 vertical and 15 seconds (or the format and length you choose in the workspace).", "**Format and length:** 9:16 vertical and 30 seconds (or the format and length you choose in the workspace).");
      replaceIn(slug, howto.sections[1].cards[1], "body", "A 15-second vertical video of a creator packing a skincare gift set", "A 30-second vertical video of a creator packing a skincare gift set");
      changed = true;
    } else if (slug === "/guides/how-do-ai-avatar") {
      replaceIn(slug, howto.intro, 2, "A 15-second clip typically costs about 30 credits and takes 3–5 minutes to generate.", "A 15-second clip typically costs about 30 credits and takes 3–5 minutes to generate; longer clips cost more.");
      replaceStep(slug, howto, 0, "return to the presenter (A presenter is an AI actor who appears on camera and speaks your script. You choose the face and the voice before generating.) chooser afterward.", "sign in and return to the presenter chooser. A presenter is an AI actor who appears on camera and speaks your script; you choose the face and voice before generating.");
      replaceStep(slug, howto, 3, "Check the selected presenter, spoken language, product references (Reference photos are the product images you upload so the model knows exactly what your product looks like — its shape, color, label, and proportions.), duration, and estimate (The estimate shows how many credits this generation will cost before you confirm. You are never charged without seeing the price first.) shown by the workspace.",
        "Check the selected presenter, spoken language, product photos, duration, and price estimate shown by the workspace. The product photos are the images you upload so the model knows your product's shape, color, label, and proportions. The estimate shows how many credits the generation will cost before you confirm; you are never charged without seeing the price first.");
      changed = true;
    } else if (slug === "/guides/how-do-ai-image") {
      setField(slug, howto, "h1", "AI Image: Create a Lifestyle Product Photo from a Reference", "AI Image: Turn One Product Photo into a New Scene");
      setField(slug, howto, "lead", "Use a clear product photo with an image preset, then inspect the still image at full size before you keep it.", "Upload one clear product photo, choose where the product should appear, and check the result before you keep it.");
      replaceIn(slug, howto.intro, 0, "Choose AI Image when you need a still for a listing, shop page, or campaign. This walkthrough uses the Lifestyle Photo entry.", "Choose AI Image when you need a photo for a listing, shop page, or campaign. This walkthrough uses the Lifestyle Photo tool, which places the product in a real-life scene.");
      replaceStep(slug, howto, 2, "Use the Lifestyle Photo preset for an in-context image. If the preset is not selected automatically, choose it from the options shown.", "Choose the Lifestyle Photo option for a real-life scene. If it is not selected automatically, choose it from the options shown.");
      replaceStep(slug, howto, 4, "Review the estimate (The estimate shows how many credits this generation will cost before you confirm. You are never charged without seeing the price first.) and start generation.", "Review the price estimate and start generation. It shows how many credits the generation will cost; you are never charged without seeing the price first.");
      changed = true;
    } else if (slug === "/guides/how-do-url-to-video") {
      replaceIn(slug, howto.intro, 1, "The card above shows the import example: a product URL, the parsed listing, and the photos it returns. The example below uses a public BAGGU product page.", "The card above shows the import example: a product URL, the parsed listing, and the photos it returns. The demo below uses a real BAGGU product page for the URL and a separate canvas-tote example for the photos and video.");
      setField(slug, howto.demo, "lead", "The URL field in this example uses a real public product page. The imported photos and details populate the editable draft; the video below shows the kind of clip you can generate from the same product.", "The URL field uses a real BAGGU product page. The photos and video below are a separate canvas-tote example, so you can see how to review imported images and the kind of clip you can make.");
      setField(slug, howto.demo.frames[0], "tag", "Generated video · same tote · play with sound", "Generated video · canvas-tote example · play with sound");
      replaceStep(slug, howto, 3, "into the draft (A draft is an editable version of the video plan — the scenes, the product details, and the settings. You can change anything before spending credits on generation.). If the import is incomplete,", "into the draft. A draft is an editable version of the video plan: the scenes, the product details, and the settings. You can change anything before spending credits on generation. If the import is incomplete,");
      replaceStep(slug, howto, 4, "review the prefilled brief and references (Reference photos are the product images you upload so the model knows exactly what your product looks like — its shape, color, label, and proportions.). Confirm that the same product is present and that the draft can still be edited. This walkthrough ends before video generation; the example video shows the kind of clip the same product can produce.", "review the prefilled brief and photos. The photos are the product images you upload so the model knows your product's shape, color, label, and proportions. Confirm that the imported product is the one you expect and that the draft can still be edited. This walkthrough ends before video generation; the canvas-tote video above is an example of the kind of clip you can make.");
      assert.equal(howto.faq[1].q, "Does this example show a completed video?", "url-to-video faq[1] drifted");
      const faq1 = { q: "Does this example show a completed video?", a: "The walkthrough ends at the draft. The video above is an example of a completed clip from a separate canvas-tote product; your own generation is a separate step you control from the draft." };
      record(slug, "faq/1", howto.faq[1], faq1);
      howto.faq[1] = faq1;
      changed = true;
    } else if (slug === "/guides/how-do-subtitle-studio") {
      assert.equal(howto.faq[0].q, "Can I edit each automatic caption line before generating?", "subtitle faq[0] drifted");
      const faq0 = { q: "Can I edit each automatic caption line before generating?", a: "The current workflow does not let you edit each caption line before generating. Use a clear source and review the result; Promo lines and Product copy are separate text-overlay tools." };
      record(slug, "faq/0", howto.faq[0], faq0);
      howto.faq[0] = faq0;
      changed = true;
    }

    if (changed) rebuildJsonLd(slug, seo, howto);
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
    `aidreamcapes-guides-30s-beginner-2026-11-21-${new Date().toISOString().slice(0, 10)}.json`
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
