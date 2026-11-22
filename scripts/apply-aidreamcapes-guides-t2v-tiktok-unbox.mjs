#!/usr/bin/env node
// Guides Text to Video: replace the phone-case demo with the TikTok creator
// unboxing clip from the homepage's first platform example, and align the
// tutorial copy + hub card + stored JSON-LD with the new clip.
//
// Site-owner instruction (2026-11-20): use the first of the three homepage
// videos (`skincare-gift-set-unbox-routine`), and do not mention the product
// reference image in the tutorial copy.
//
// Run from the current production release directory:
//   node scripts/apply-aidreamcapes-guides-t2v-tiktok-unbox.mjs
//   node scripts/apply-aidreamcapes-guides-t2v-tiktok-unbox.mjs --apply-production \
//     --confirm=guides-t2v-tiktok-unbox
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

loadRuntimeEnv();
const applying = process.argv.includes("--apply-production");
const confirmed = process.argv.includes("--confirm=guides-t2v-tiktok-unbox");
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

const NEW_VIDEO = {
  src: "/ai-video-generation/skincare-gift-set-unbox-routine-p10.mp4",
  poster: "/ai-image-generation/skincare-gift-set-unbox-routine-640.webp"
};
const NEW_OG_IMAGE = "/ai-image-generation/skincare-gift-set-unbox-routine-640.webp";
const NEW_OG_ALT = "Creator packing a skincare gift set in a TikTok-style video.";
const NEW_BRIEF = "A creator packs a skincare gift set at a bright worktable: cleanser, serum, and face cream go into a gift box, then she closes it and holds it up.";
const NEW_FAQ = {
  q: "Do I need to upload anything?",
  a: "No. Text to Video starts from a written brief. Describe the product in words and review the proposed scenes before generating."
};

function editTextToVideo(howto, seo) {
  assert.equal(
    howto.intro[1],
    "The example below follows this tutorial's product: the brief names the two phone cases, and the clip was generated for that product.",
    "text-to-video intro[1] drifted"
  );
  const intro1 = "The example below shows the kind of brief this tool takes: one product, one setting, one visible action. The clip shows the finished style, with platform-style captions included.";
  record("/guides/how-do-text-to-video", "howto/intro/1", howto.intro[1], intro1);
  howto.intro[1] = intro1;

  assert.equal(
    howto.demo.lead,
    "The brief names the product, the setting, and one action. The clip was generated for these two phone cases; play it to see the finished style.",
    "text-to-video demo.lead drifted"
  );
  const demoLead = "The brief names the product, the setting, and one action. The clip shows a creator packing a skincare gift set; play it to see the finished style and the platform-style captions.";
  record("/guides/how-do-text-to-video", "howto/demo/lead", howto.demo.lead, demoLead);
  howto.demo.lead = demoLead;

  assert.equal(
    howto.demo.panel.input,
    "Show two phone cases — black and lavender — on a bright desk: fronts first, then backs, ending held up side by side.",
    "text-to-video demo.panel.input drifted"
  );
  record("/guides/how-do-text-to-video", "howto/demo/panel/input", howto.demo.panel.input, NEW_BRIEF);
  howto.demo.panel.input = NEW_BRIEF;

  const frame = howto.demo.result.frames[0];
  assert.equal(frame.tag, "Generated clip · for this example's product · silent preview", "text-to-video frame tag drifted");
  const newTag = "Example clip · platform-style captions included";
  record("/guides/how-do-text-to-video", "howto/demo/result/frames/0/tag", frame.tag, newTag);
  frame.tag = newTag;

  assert.equal(frame.video.src, "/ai-video-generation/phone-case-compare-p10.mp4", "text-to-video frame video drifted");
  record("/guides/how-do-text-to-video", "howto/demo/result/frames/0/video", frame.video, NEW_VIDEO);
  frame.video = structuredClone(NEW_VIDEO);

  assert.equal(
    howto.demo.result.prompt,
    "Example direction: keep both cases' colors exact and show their fronts, then their backs.",
    "text-to-video result.prompt drifted"
  );
  const resultPrompt = "Example direction: keep the three products and the gift box consistent; show the packing steps in order.";
  record("/guides/how-do-text-to-video", "howto/demo/result/prompt", howto.demo.result.prompt, resultPrompt);
  howto.demo.result.prompt = resultPrompt;

  assert.equal(howto.steps[1].title, "Write one specific sentence", "text-to-video steps[1] drifted");
  const step1 = "Name the product, the setting, and one visible action. For this example: “A creator packs a skincare gift set at a bright worktable: cleanser, serum, and face cream go into a gift box, then she closes it and holds it up.” Avoid adding product claims you cannot verify.";
  record("/guides/how-do-text-to-video", "howto/steps/1/body", howto.steps[1].body, step1);
  howto.steps[1].body = step1;

  assert.equal(howto.steps[5].title, "Generate and review the result", "text-to-video steps[5] drifted");
  const step5 = "Start the job from the workspace and wait for its completed state. Play the result and compare the products, the gift box, and the packing order with your brief.";
  record("/guides/how-do-text-to-video", "howto/steps/5/body", howto.steps[5].body, step5);
  howto.steps[5].body = step5;

  assert.equal(howto.faq[0].q, "Do I need a product photo?", "text-to-video faq[0] drifted");
  record("/guides/how-do-text-to-video", "howto/faq/0", howto.faq[0], NEW_FAQ);
  howto.faq[0] = structuredClone(NEW_FAQ);

  assert.equal(seo.ogImage, "/assets/sites/site_aidreamcapes/guides/li-ch02-home-composer.webp", "text-to-video seo.ogImage drifted");
  record("/guides/how-do-text-to-video", "seo/ogImage", seo.ogImage, NEW_OG_IMAGE);
  seo.ogImage = NEW_OG_IMAGE;

  assert.equal(seo.ogImageAlt, "Text to Video composer showing the prompt and generation controls.", "text-to-video seo.ogImageAlt drifted");
  record("/guides/how-do-text-to-video", "seo/ogImageAlt", seo.ogImageAlt, NEW_OG_ALT);
  seo.ogImageAlt = NEW_OG_ALT;

  const howToNode = seo.jsonLd["@graph"].find((node) => node["@type"] === "HowTo");
  assert.ok(howToNode, "text-to-video HowTo JSON-LD missing");
  assert.equal(howToNode.step[1].name, "Write one specific sentence", "HowTo step[1] drifted");
  record("/guides/how-do-text-to-video", "seo/jsonLd/HowTo/step/1/text", howToNode.step[1].text, step1);
  howToNode.step[1].text = step1;
  assert.equal(howToNode.step[5].name, "Generate and review the result", "HowTo step[5] drifted");
  record("/guides/how-do-text-to-video", "seo/jsonLd/HowTo/step/5/text", howToNode.step[5].text, step5);
  howToNode.step[5].text = step5;

  const faqNode = seo.jsonLd["@graph"].find((node) => node["@type"] === "FAQPage");
  assert.ok(faqNode, "text-to-video FAQPage JSON-LD missing");
  assert.equal(faqNode.mainEntity[0].name, "Do I need a product photo?", "FAQPage first question drifted");
  const faqLd = {
    name: NEW_FAQ.q,
    "@type": "Question",
    acceptedAnswer: { text: NEW_FAQ.a, "@type": "Answer" }
  };
  record("/guides/how-do-text-to-video", "seo/jsonLd/FAQPage/mainEntity/0", faqNode.mainEntity[0], faqLd);
  faqNode.mainEntity[0] = faqLd;
}

function editHub(hub) {
  const item = hub.howTos.items.find((entry) => entry.href === "/guides/how-do-text-to-video");
  assert.ok(item, "hub Text to Video card missing");
  assert.equal(item.image.src, "/ai-image-generation/phone-case-compare-ref.jpg", "hub Text to Video cover drifted");
  const image = {
    alt: "Creator packing a skincare gift set, from this tutorial's example video.",
    src: "/ai-image-generation/skincare-gift-set-unbox-routine-640.webp",
    width: 640,
    height: 640
  };
  record("/guides", `hub/howTos/${hub.howTos.items.indexOf(item)}/image`, item.image, image);
  item.image = structuredClone(image);
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
    if (row.slug === "/guides/how-do-text-to-video") {
      editTextToVideo(data.howto, next.seo);
    } else if (row.slug === "/guides") {
      editHub(data.hub);
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
    `aidreamcapes-guides-t2v-tiktok-unbox-${new Date().toISOString().slice(0, 10)}.json`
  );
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifestDoc, null, 2)}\n`);

  if (!applying) {
    console.log(JSON.stringify({ pages: SLUGS, editCount: edits.length, manifestPath }, null, 2));
    console.error(`dry run: ${edits.length} field edit(s) across ${SLUGS.length} page(s); manifest written to ${manifestPath}`);
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
    assert.equal(result.count, 1, `${row.slug}: compare-and-set failed (the row changed after the manifest was read)`);
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
