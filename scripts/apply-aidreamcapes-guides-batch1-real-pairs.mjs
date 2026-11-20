#!/usr/bin/env node
// Guides batch 1 (approved): point the four tool tutorials at real
// input→output pairs from the media library, remove the provenance
// disclaimers that no longer apply, and fix the four mismatched hub covers.
//
// Scope approved by the site owner (2026-11-20):
//   AI Video        → hot-sauce-pour reference photo + generated clip
//   Image to Video  → 360-showcase-linen-shirt reference photo + clip
//   Text to Video   → phone-case-compare brief + clip
//   AI Avatar       → indoor-entryway-greeting (Ari) picker + tote photo + clip
//   /guides hub     → the four matching card covers
//
// No layout, navigation, playback behavior, titles, or SEO structure changes.
//
// Run from the current production release directory:
//   node scripts/apply-aidreamcapes-guides-batch1-real-pairs.mjs
//   node scripts/apply-aidreamcapes-guides-batch1-real-pairs.mjs --apply-production \
//     --confirm=guides-batch1-real-pairs
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

loadRuntimeEnv();
const applying = process.argv.includes("--apply-production");
const confirmed = process.argv.includes("--confirm=guides-batch1-real-pairs");
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
  "/guides"
];

const stable = (value) => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
    : value;
const hash = (value) => crypto.createHash("sha256")
  .update(value === undefined ? "<undefined>" : JSON.stringify(stable(value)))
  .digest("hex");

// --- new demo assets (verified against the live library) -------------------
const HOT_SAUCE_REF = { alt: "Hot-sauce bottle product reference photo with chilies and a small bowl.", src: "/ai-image-generation/hot-sauce-pour-ref.jpg", width: 640, height: 640 };
const SHIRT_REF = { alt: "Beige linen button-up shirt product reference photo on a white pedestal.", src: "/ai-image-generation/360-showcase-linen-shirt-ref.jpg", width: 640, height: 1138 };
const TOTE_REF = { alt: "Cream canvas tote bag product photo with two sturdy shoulder straps.", src: "/ai-image-generation/indoor-entryway-greeting-product.jpg", width: 640, height: 800 };

const edits = [];
const record = (slug, path, before, after) => {
  edits.push({ slug, path, beforeHash: hash(before), afterHash: hash(after) });
};

function editAiVideo(howto) {
  assert.equal(howto.demo.frames[0].image.src, "/ai-image-generation/q16-wellness-mat-source-640.webp", "ai-video frame 0 drifted");
  assert.equal(howto.demo.frames[1].video.src, "/ai-video-generation/gym-pre-workout-greeting-p10.mp4", "ai-video frame 1 drifted");

  const intro1 = "The example below follows one real run: the hot-sauce reference photo on the left, and the clip generated from it on the right.";
  record("/guides/how-do-ai-video", "howto/intro/1", howto.intro[1], intro1);
  howto.intro[1] = intro1;

  record("/guides/how-do-ai-video", "howto/demo/title", howto.demo.title, "Product reference → scene direction → generated clip");
  howto.demo.title = "Product reference → scene direction → generated clip";

  const lead = "The bottle photo is the reference uploaded for this example; the clip on the right was generated from it. Only the creator's hands appear.";
  record("/guides/how-do-ai-video", "howto/demo/lead", howto.demo.lead, lead);
  howto.demo.lead = lead;

  record("/guides/how-do-ai-video", "howto/demo/frames/0/tag", howto.demo.frames[0].tag, "Product reference · uploaded for this example");
  howto.demo.frames[0].tag = "Product reference · uploaded for this example";
  record("/guides/how-do-ai-video", "howto/demo/frames/0/image", howto.demo.frames[0].image, HOT_SAUCE_REF);
  howto.demo.frames[0].image = structuredClone(HOT_SAUCE_REF);

  record("/guides/how-do-ai-video", "howto/demo/frames/1/tag", howto.demo.frames[1].tag, "Generated clip · from this reference · silent preview");
  howto.demo.frames[1].tag = "Generated clip · from this reference · silent preview";
  const hotVideo = { src: "/ai-video-generation/hot-sauce-pour-p10.mp4", poster: "/ai-image-generation/hot-sauce-pour-ref.jpg" };
  record("/guides/how-do-ai-video", "howto/demo/frames/1/video", howto.demo.frames[1].video, hotVideo);
  howto.demo.frames[1].video = hotVideo;

  const prompt = "Example direction to try: the bottle gets opened and poured onto a plate at the counter; keep the cream label and black cap recognizable.";
  record("/guides/how-do-ai-video", "howto/demo/prompt", howto.demo.prompt, prompt);
  howto.demo.prompt = prompt;

  const stepBody = "Say what should happen, where it happens, and which product details must stay visible. Keep the example focused on the bottle being opened and poured, with its label staying visible.";
  record("/guides/how-do-ai-video", "howto/steps/2/body", howto.steps[2].body, stepBody);
  howto.steps[2].body = stepBody;

  const tip = {
    title: "Photos lock the product",
    body: "The reference photos fix the product's shape, color, and label. Upload the exact item you sell from the angles a shopper would want to see, and remove unrelated images before generating."
  };
  record("/guides/how-do-ai-video", "howto/tip", howto.tip, tip);
  howto.tip = tip;

  const faq = {
    q: "How many reference photos do I need?",
    a: "One clear photo is enough to start. Extra angles help the model keep the shape accurate; the workspace shows the current photo limit for the model you select."
  };
  record("/guides/how-do-ai-video", "howto/faq/2", howto.faq[2], faq);
  howto.faq[2] = faq;
}

function editImageToVideo(howto, content) {
  assert.equal(howto.demo.frames[0].image.src, "/ai-image-generation/im01-video-hub-balm-r1-640.webp", "image-to-video frame 0 drifted");
  assert.equal(howto.demo.frames[1].video.src, "/ai-video-generation/tinted-balm-vanity-reel-p10.mp4", "image-to-video frame 1 drifted");

  const intro0 = howto.intro[0].replace("such as lifting a balm or turning the container", "such as giving a shirt one slow full turn or lifting a bottle");
  record("/guides/how-do-image-to-video", "howto/intro/0", howto.intro[0], intro0);
  howto.intro[0] = intro0;

  const intro1 = "The example below follows one real run: the shirt reference photo on the left, and the clip generated from it on the right.";
  record("/guides/how-do-image-to-video", "howto/intro/1", howto.intro[1], intro1);
  howto.intro[1] = intro1;

  const leadImage = { alt: "Beige linen button-up shirt product reference photo.", src: SHIRT_REF.src, width: 640, height: 1138 };
  record("/guides/how-do-image-to-video", "howto/image", howto.image, leadImage);
  howto.image = leadImage;

  record("/guides/how-do-image-to-video", "howto/demo/title", howto.demo.title, "One product photo → one motion prompt → generated clip");
  howto.demo.title = "One product photo → one motion prompt → generated clip";

  const lead = "The shirt photo is the reference uploaded for this example; the clip was generated from it with one motion prompt. Only the creator's hands appear.";
  record("/guides/how-do-image-to-video", "howto/demo/lead", howto.demo.lead, lead);
  howto.demo.lead = lead;

  record("/guides/how-do-image-to-video", "howto/demo/frames/0/tag", howto.demo.frames[0].tag, "Product photo · uploaded for this example");
  howto.demo.frames[0].tag = "Product photo · uploaded for this example";
  record("/guides/how-do-image-to-video", "howto/demo/frames/0/image", howto.demo.frames[0].image, SHIRT_REF);
  howto.demo.frames[0].image = structuredClone(SHIRT_REF);

  record("/guides/how-do-image-to-video", "howto/demo/frames/1/tag", howto.demo.frames[1].tag, "Generated clip · from this reference · silent preview");
  howto.demo.frames[1].tag = "Generated clip · from this reference · silent preview";
  const shirtVideo = { src: "/ai-video-generation/360-showcase-linen-shirt-p10.mp4", poster: "/ai-image-generation/360-showcase-linen-shirt-ref.jpg" };
  record("/guides/how-do-image-to-video", "howto/demo/frames/1/video", howto.demo.frames[1].video, shirtVideo);
  howto.demo.frames[1].video = shirtVideo;

  const prompt = "Example action: the shirt makes one slow full turn and ends back on the pedestal; keep the beige linen color and collar shape.";
  record("/guides/how-do-image-to-video", "howto/demo/prompt", howto.demo.prompt, prompt);
  howto.demo.prompt = prompt;

  const step1 = "Use a sharp image where the product is large enough to see and its outline is unobstructed. For this example, use the shirt photo as the reference.";
  record("/guides/how-do-image-to-video", "howto/steps/1/body", howto.steps[1].body, step1);
  howto.steps[1].body = step1;

  const step2 = "Write one short action, such as “the shirt makes one slow full turn and ends back on the pedestal.” Add only the product detail that must stay visible; avoid combining several unrelated actions.";
  record("/guides/how-do-image-to-video", "howto/steps/2/body", howto.steps[2].body, step2);
  howto.steps[2].body = step2;

  const step4 = "Start the job and wait for completion. Play the clip beside the source image. Check the fabric color, collar, and that the motion follows the prompt.";
  record("/guides/how-do-image-to-video", "howto/steps/4/body", howto.steps[4].body, step4);
  howto.steps[4].body = step4;

  const checklist4 = "The motion prompt names exactly one action.";
  record("/guides/how-do-image-to-video", "howto/checklist/4", howto.checklist[4], checklist4);
  howto.checklist[4] = checklist4;

  // SEO: the og image and HowTo image still point at the old balm photo.
  const seo = content.seo;
  assert.equal(seo.ogImage, "/ai-image-generation/im01-video-hub-balm-r1-640.webp", "image-to-video ogImage drifted");
  record("/guides/how-do-image-to-video", "seo/ogImage", seo.ogImage, SHIRT_REF.src);
  seo.ogImage = SHIRT_REF.src;
  let seoImageEdits = 0;
  for (const node of seo.jsonLd["@graph"] || []) {
    if (node?.image?.url === "https://www.aivideosugc.com/ai-image-generation/im01-video-hub-balm-r1-640.webp") {
      record("/guides/how-do-image-to-video", "seo/jsonLd graph image", node.image.url, `https://www.aivideosugc.com${SHIRT_REF.src}`);
      node.image.url = `https://www.aivideosugc.com${SHIRT_REF.src}`;
      if (node.image.contentUrl) node.image.contentUrl = `https://www.aivideosugc.com${SHIRT_REF.src}`;
      seoImageEdits += 1;
    }
    if (node?.primaryImageOfPage?.url === "https://www.aivideosugc.com/ai-image-generation/im01-video-hub-balm-r1-640.webp") {
      record("/guides/how-do-image-to-video", "seo/jsonLd graph primaryImageOfPage", node.primaryImageOfPage.url, `https://www.aivideosugc.com${SHIRT_REF.src}`);
      node.primaryImageOfPage.url = `https://www.aivideosugc.com${SHIRT_REF.src}`;
      seoImageEdits += 1;
    }
  }
  assert.ok(seoImageEdits >= 1, "image-to-video seo graph image not found");
}

function editTextToVideo(howto) {
  assert.equal(howto.demo.result.frames[0].video.src, "/ai-video-generation/bathroom-review-moisturizer-p10.mp4", "text-to-video frame drifted");

  const intro1 = "The example below follows this tutorial's product: the brief names the two phone cases, and the clip was generated for that product.";
  record("/guides/how-do-text-to-video", "howto/intro/1", howto.intro[1], intro1);
  howto.intro[1] = intro1;

  record("/guides/how-do-text-to-video", "howto/demo/title", howto.demo.title, "Example brief → generated clip");
  howto.demo.title = "Example brief → generated clip";

  const lead = "The brief names the product, the setting, and one action. The clip was generated for these two phone cases; play it to see the finished style.";
  record("/guides/how-do-text-to-video", "howto/demo/lead", howto.demo.lead, lead);
  howto.demo.lead = lead;

  const input = "Show two phone cases — black and lavender — on a bright desk: fronts first, then backs, ending held up side by side.";
  record("/guides/how-do-text-to-video", "howto/demo/panel/input", howto.demo.panel.input, input);
  howto.demo.panel.input = input;

  const frame = howto.demo.result.frames[0];
  record("/guides/how-do-text-to-video", "howto/demo/result/frames/0/tag", frame.tag, "Generated clip · for this example's product · silent preview");
  frame.tag = "Generated clip · for this example's product · silent preview";
  const caseVideo = { src: "/ai-video-generation/phone-case-compare-p10.mp4", poster: "/ai-image-generation/phone-case-compare-ref.jpg" };
  record("/guides/how-do-text-to-video", "howto/demo/result/frames/0/video", frame.video, caseVideo);
  frame.video = caseVideo;

  const prompt = "Example direction: keep both cases' colors exact and show their fronts, then their backs.";
  record("/guides/how-do-text-to-video", "howto/demo/result/prompt", howto.demo.result.prompt, prompt);
  howto.demo.result.prompt = prompt;

  const step1 = "Name the product, the setting, and one visible action. For this example: “Show two phone cases — black and lavender — on a bright desk: fronts first, then backs, ending held up side by side.” Avoid adding product claims you cannot verify.";
  record("/guides/how-do-text-to-video", "howto/steps/1/body", howto.steps[1].body, step1);
  howto.steps[1].body = step1;

  const step5 = "Start the job from the workspace and wait for its completed state. Play the result and compare the two cases' colors, camera cutouts, and button positions with your brief.";
  record("/guides/how-do-text-to-video", "howto/steps/5/body", howto.steps[5].body, step5);
  howto.steps[5].body = step5;

  const section = howto.sections[0];
  const flow0 = "Two phone cases sit on a bright desk; the creator shows their fronts, then their backs.";
  record("/guides/how-do-text-to-video", "howto/sections/0/flow/items/0/body", section.flow.items[0].body, flow0);
  section.flow.items[0].body = flow0;
  const flow1 = "Desk view → fronts → backs → held up side by side.";
  record("/guides/how-do-text-to-video", "howto/sections/0/flow/items/1/body", section.flow.items[1].body, flow1);
  section.flow.items[1].body = flow1;
  const para = "The outline is an illustrative review guide; the scene wording and controls come from your workspace's Optimize response.";
  record("/guides/how-do-text-to-video", "howto/sections/0/paras/0", section.paras[0], para);
  section.paras[0] = para;

  const faq = {
    q: "How long should the brief be?",
    a: "One or two sentences are enough. Name the product, the setting, and one visible action; Optimize expands it into the scenes you review."
  };
  record("/guides/how-do-text-to-video", "howto/faq/2", howto.faq[2], faq);
  howto.faq[2] = faq;
}

function editAiAvatar(howto) {
  assert.equal(howto.demo.frames[1].video.src, "/ai-video-generation/indoor-entryway-greeting-p10.mp4", "ai-avatar frame drifted");

  const intro1 = "The example below shows the real chain: the presenter chooser, the cream canvas tote product photo, and the clip generated with Ari presenting that tote.";
  record("/guides/how-do-ai-avatar", "howto/intro/1", howto.intro[1], intro1);
  howto.intro[1] = intro1;

  record("/guides/how-do-ai-avatar", "howto/demo/title", howto.demo.title, "Presenter → product photo → generated clip");
  howto.demo.title = "Presenter → product photo → generated clip";

  const lead = "Choose the presenter, attach the product photo — here a cream canvas tote — then write the script. The clip was generated with Ari presenting this tote; play it with sound.";
  record("/guides/how-do-ai-avatar", "howto/demo/lead", howto.demo.lead, lead);
  howto.demo.lead = lead;

  record("/guides/how-do-ai-avatar", "howto/demo/frames/0/tag", howto.demo.frames[0].tag, "Presenter chooser · play the voice sample before choosing");
  howto.demo.frames[0].tag = "Presenter chooser · play the voice sample before choosing";

  const frames = [
    howto.demo.frames[0],
    { tag: "Product photo · attached for this example", image: structuredClone(TOTE_REF) },
    {
      tag: "Generated clip · Ari presenting the tote · play with sound",
      video: { src: "/ai-video-generation/indoor-entryway-greeting.mp4", poster: "/ai-image-generation/actors/ari-640.webp" }
    }
  ];
  record("/guides/how-do-ai-avatar", "howto/demo/frames", howto.demo.frames, frames);
  howto.demo.frames = frames;

  const step2 = "Attach the product photo or photos requested by the composer, then enter a short script that describes only verifiable product details. For the example above, the product photo is the cream canvas tote and the script introduces it in one short line.";
  record("/guides/how-do-ai-avatar", "howto/steps/2/body", howto.steps[2].body, step2);
  howto.steps[2].body = step2;

  const tipBody = "Play the voice sample on the presenter card before you choose. If a card has no playable sample, pick another presenter; the example clip above plays with the presenter's spoken line.";
  record("/guides/how-do-ai-avatar", "howto/tip/body", howto.tip.body, tipBody);
  howto.tip.body = tipBody;

  const faq = {
    q: "Will my clip sound like the sample?",
    a: "Play the voice sample on the presenter card before choosing — your clip is generated with that presenter's voice. The example clip above plays with sound."
  };
  record("/guides/how-do-ai-avatar", "howto/faq/1", howto.faq[1], faq);
  howto.faq[1] = faq;
}

function editHub(hub) {
  const items = hub.howTos.items;
  const byHref = new Map(items.map((item) => [item.href, item]));

  const covers = [
    {
      href: "/guides/how-do-text-to-video",
      expect: "/ai-image-generation/matcha-whisk-morning-ugc-product.jpg",
      image: { alt: "Two matte phone cases, black and lavender, from this tutorial's example video.", src: "/ai-image-generation/phone-case-compare-ref.jpg", width: 640, height: 1138 }
    },
    {
      href: "/guides/how-do-ai-video",
      expect: "/ai-image-generation/mx1w-home-health-fitness-3-r1-640.webp",
      image: HOT_SAUCE_REF
    },
    {
      href: "/guides/how-do-ai-avatar",
      expect: "/ai-image-generation/teams1-home-r1-ad-640.webp",
      image: { alt: "Ari, an adult East Asian woman in her twenties, the example presenter for this tutorial.", src: "/ai-image-generation/actors/ari-640.webp", width: 640, height: 1138 }
    },
    {
      href: "/guides/how-do-image-to-video",
      expect: "/ai-image-generation/im01-video-hub-balm-r1-640.webp",
      image: { alt: "A beige linen button-up shirt, the example product for this tutorial.", src: "/ai-image-generation/360-showcase-linen-shirt-ref.jpg", width: 640, height: 1138 }
    }
  ];
  for (const cover of covers) {
    const item = byHref.get(cover.href);
    assert.ok(item, `hub card missing: ${cover.href}`);
    assert.equal(item.image.src, cover.expect, `hub card ${cover.href} cover drifted`);
    record("/guides", `hub/howTos${items.indexOf(item)}/image`, item.image, cover.image);
    item.image = structuredClone(cover.image);
  }
}

const db = new PrismaClient();
try {
  const rows = await db.livePage.findMany({
    where: { siteId: SITE_ID, slug: { in: SLUGS } },
    orderBy: { slug: "asc" }
  });
  assert.equal(rows.length, SLUGS.length, `expected ${SLUGS.length} rows, found ${rows.length}`);
  const bySlug = new Map(rows.map((row) => [row.slug, row]));

  const nextById = new Map();
  for (const row of rows) {
    const next = structuredClone(row.contentJson);
    const data = next.sections.v2_main.settings.data;
    if (row.slug === "/guides/how-do-ai-video") editAiVideo(data.howto);
    else if (row.slug === "/guides/how-do-image-to-video") editImageToVideo(data.howto, next);
    else if (row.slug === "/guides/how-do-text-to-video") editTextToVideo(data.howto);
    else if (row.slug === "/guides/how-do-ai-avatar") editAiAvatar(data.howto);
    else if (row.slug === "/guides") editHub(data.hub);
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
  const manifestPath = path.join(manifestDir, `aivideosugc-guides-batch1-real-pairs-${new Date().toISOString().slice(0, 10)}.json`);
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
