#!/usr/bin/env node
// Guides batch 2 (approved): the remaining four tutorials get real
// input→output pairs or real workspace screenshots. Zero credits.
//
//   Subtitle Studio → berry-bowl real Subtitle Studio run (same clip before/after)
//   AI Image        → k5 tote reference photo → market lifestyle image
//   URL to Video    → real workspace screenshot + real public URL
//   Product Links   → real workspace screenshot showing saved products
//
// Run from the current production release directory:
//   node scripts/apply-aidreamcapes-guides-batch2-real-pairs.mjs
//   node scripts/apply-aidreamcapes-guides-batch2-real-pairs.mjs --apply-production \
//     --confirm=guides-batch2-real-pairs
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

loadRuntimeEnv();
const applying = process.argv.includes("--apply-production");
const confirmed = process.argv.includes("--confirm=guides-batch2-real-pairs");
assertDatabaseTarget({
  expectedTarget: "production",
  requireProductionConfirmation: applying,
  productionConfirmed: applying && confirmed
});

const SITE_ID = "site_aidreamcapes";
const SLUGS = [
  "/guides/how-do-subtitle-studio",
  "/guides/how-do-ai-image",
  "/guides/how-do-url-to-video",
  "/guides/how-do-product-links"
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
const record = (slug, field, before, after) => {
  edits.push({ slug, field, beforeHash: hash(before), afterHash: hash(after) });
};

function editSubtitleStudio(howto) {
  const s = howto.demo.subtitles;
  assert.equal(s.before.video.src.includes("study-desk-lamp-original"), true, "subtitle before video drifted");
  assert.equal(s.after.video.src.includes("study-desk-lamp-captioned"), true, "subtitle after video drifted");

  const beforeVideo = {
    src: "/assets/sites/site_aidreamcapes/guides/subtitle-example-berry-bowl-original.mp4",
    poster: "/assets/sites/site_aidreamcapes/guides/subtitle-example-berry-bowl-poster.jpg"
  };
  const afterVideo = {
    src: "/assets/sites/site_aidreamcapes/guides/subtitle-example-berry-bowl-captioned-classic.mp4",
    poster: "/assets/sites/site_aidreamcapes/guides/subtitle-example-berry-bowl-poster.jpg"
  };

  record("subtitle", "demo.subtitles.before.video", s.before.video, beforeVideo);
  s.before.video = beforeVideo;
  record("subtitle", "demo.subtitles.before.lines", s.before.lines,
    ["30 seconds · berry-bowl clip · original audio", "No burned-in captions"]);
  s.before.lines = ["30 seconds · berry-bowl clip · original audio", "No burned-in captions"];

  record("subtitle", "demo.subtitles.after.video", s.after.video, afterVideo);
  s.after.video = afterVideo;
  record("subtitle", "demo.subtitles.after.label", s.after.label,
    "Captioned with Subtitle Studio · Classic style");
  s.after.label = "Captioned with Subtitle Studio · Classic style";
  record("subtitle", "demo.subtitles.after.lines", s.after.lines,
    ["Same berry-bowl clip and audio", "Classic-style English captions burned in"]);
  s.after.lines = ["Same berry-bowl clip and audio", "Classic-style English captions burned in"];

  record("subtitle", "demo.lead", howto.demo.lead,
    "Both sides play the same 30-second berry-bowl clip with its original audio. Play either one; starting one pauses the other and keeps the comparison near the same time.");
  howto.demo.lead = "Both sides play the same 30-second berry-bowl clip with its original audio. Play either one; starting one pauses the other and keeps the comparison near the same time.";

  const image = {
    alt: "Berry-bowl clip frame used as the Subtitle Studio example poster.",
    src: "/assets/sites/site_aidreamcapes/guides/subtitle-example-berry-bowl-poster.jpg",
    width: 720,
    height: 1280
  };
  record("subtitle", "image", howto.image, image);
  howto.image = image;

  const intro1 = "The pair below is a real Subtitle Studio run: the same berry-bowl clip before and after a Classic-style caption pass. Play either side to hear the narration and see the caption layer.";
  record("subtitle", "intro[1]", howto.intro[1], intro1);
  howto.intro[1] = intro1;

  const step1 = "Select the completed render whose speech you want to caption. For the example above, the berry-bowl clip has clear narration about fresh berries. Before generating, play the clip and confirm the speech is clear and has no baked-in subtitles.";
  record("subtitle", "steps[1].body", howto.steps[1].body, step1);
  howto.steps[1].body = step1;

  const step4 = "Compare the new version with **Original** at the same point. In the berry-bowl example, check the opening line about fresh berries, the middle section on the raspberry, and the closing mention of the half-empty bowl. Listen for product names and numbers, then use the download control for the version you approved.";
  record("subtitle", "steps[4].body", howto.steps[4].body, step4);
  howto.steps[4].body = step4;

  const checklist3 = "The berry-bowl example above shows the same clip on both sides; only the caption layer differs.";
  record("subtitle", "checklist[3]", howto.checklist[3], checklist3);
  howto.checklist[3] = checklist3;
}

function editAiImage(howto) {
  assert.equal(howto.demo.gallery[0].image.src, "/ai-image-generation/img1-home-steps-source-r1-640.webp", "ai-image gallery[0] drifted");

  const sourceImage = {
    alt: "Linen tote bag reference photo on a pale studio surface, both handles visible.",
    src: "/ai-image-generation/k5-lifestyle-gallery-source-640.webp",
    width: 640,
    height: 640
  };
  const resultImage = {
    alt: "Linen tote bag styled in a bright weekend market scene with the full bag visible.",
    src: "/ai-image-generation/k5-lifestyle-gallery-hero-640.webp",
    width: 640,
    height: 640
  };

  record("ai-image", "demo.gallery[0].image", howto.demo.gallery[0].image, sourceImage);
  howto.demo.gallery[0].image = sourceImage;
  record("ai-image", "demo.gallery[1].image", howto.demo.gallery[1].image, resultImage);
  howto.demo.gallery[1].image = resultImage;
  record("ai-image", "demo.gallery[1].caption", howto.demo.gallery[1].caption,
    "Generated lifestyle image · same tote in a market scene");
  howto.demo.gallery[1].caption = "Generated lifestyle image · same tote in a market scene";

  record("ai-image", "demo.lead", howto.demo.lead,
    "Compare the tote's shape, handles, and natural linen color. The reference on the left was uploaded to produce the market-scene image on the right.");
  howto.demo.lead = "Compare the tote's shape, handles, and natural linen color. The reference on the left was uploaded to produce the market-scene image on the right.";

  const intro1 = "The example below follows one real run: the tote reference photo on the left, and the lifestyle image generated from it on the right.";
  record("ai-image", "intro[1]", howto.intro[1], intro1);
  howto.intro[1] = intro1;

  const step3 = "Name the setting and the product details that must remain recognizable. For the tote, call out its natural linen color and handle shape; do not add features that are not in the source photo.";
  record("ai-image", "steps[3].body", howto.steps[3].body, step3);
  howto.steps[3].body = step3;

  const step4 = "Review the estimate and start generation. Compare the output with the source photo for shape, handles, color, and stitching. If any key detail has changed, revise one part of the prompt before making another version.";
  record("ai-image", "steps[4].body", howto.steps[4].body, step4);
  howto.steps[4].body = step4;
}

function editUrlToVideo(howto) {
  assert.equal(howto.demo.urlCard.label, "https://store.example/products/canvas-tote", "url-card drifted");

  const image = {
    alt: "URL to Video workspace showing the product-page URL field and the imported product preview.",
    src: "/assets/sites/site_aidreamcapes/guides/ch07-url-to-video-real.webp",
    width: 1440,
    height: 900
  };
  record("url-to-video", "image", howto.image, image);
  howto.image = image;

  const urlCard = {
    ...howto.demo.urlCard,
    label: "https://baggu.com/products/medium-nylon-crescent-bag",
    ok: true,
    status: "Public product page · opens without an account",
    caption: { text: "Medium Nylon Crescent Bag · imported from baggu.com", badge: "Imported" }
  };
  record("url-to-video", "demo.urlCard", howto.demo.urlCard, urlCard);
  howto.demo.urlCard = urlCard;

  record("url-to-video", "demo.lead", howto.demo.lead,
    "The URL card above shows a real public product page. The imported photos and details populate the editable draft you review before generating.");
  howto.demo.lead = "The URL card above shows a real public product page. The imported photos and details populate the editable draft you review before generating.";

  const intro1 = "The screenshot above shows the URL to Video workspace with a real public listing. The example below shows the kind of photos the importer reads from a product page.";
  record("url-to-video", "intro[1]", howto.intro[1], intro1);
  howto.intro[1] = intro1;

  const step1 = "Use a public HTTPS product listing, not a video link or image URL. The example above uses a BAGGU product page that opens without an account.";
  record("url-to-video", "steps[1].body", howto.steps[1].body, step1);
  howto.steps[1].body = step1;

  const faq1 = {
    a: "The tutorial shows the workspace and the draft state. A completed video is a separate generation step you control from the draft.",
    q: "Does this example show a completed video?"
  };
  record("url-to-video", "faq[1]", howto.faq[1], faq1);
  howto.faq[1] = faq1;
}

function editProductLinks(howto) {
  assert.equal(howto.image.src.includes("ch08-product-links.webp"), true, "product-links image drifted");

  const image = {
    alt: "Product Links workspace showing the saved-product library with confirmed entries.",
    src: "/assets/sites/site_aidreamcapes/guides/ch08-product-links-real.webp",
    width: 1440,
    height: 900
  };
  record("product-links", "image", howto.image, image);
  howto.image = image;

  const intro1 = "The screenshot above shows the Product Links workspace with confirmed products in the library. Each saved entry can be selected again when you start a new video.";
  record("product-links", "intro[1]", howto.intro[1], intro1);
  howto.intro[1] = intro1;

  const demoLead = "A saved product appears in the library after you review and confirm a public page. The screenshot above shows the real library state.";
  record("product-links", "demo.lead", howto.demo.lead, demoLead);
  howto.demo.lead = demoLead;

  const urlCard = {
    ...howto.demo.urlCard,
    label: "https://www.allbirds.com/products/mens-wool-runners",
    action: "→"
  };
  record("product-links", "demo.urlCard", howto.demo.urlCard, urlCard);
  howto.demo.urlCard = urlCard;

  const step3 = "Use the confirmation control shown by the workspace. Wait until the product appears in the library — the screenshot above shows the library with confirmed entries after saving.";
  record("product-links", "steps[3].body", howto.steps[3].body, step3);
  howto.steps[3].body = step3;

  const step4 = "Return to Product Links and select the saved product. Confirm that its photo and details are the same ones you checked. The entry fills the video form; this step stops before generating a video.";
  record("product-links", "steps[4].body", howto.steps[4].body, step4);
  howto.steps[4].body = step4;
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
    const howto = next.sections.v2_main.settings.data.howto;
    if (row.slug === "/guides/how-do-subtitle-studio") editSubtitleStudio(howto);
    else if (row.slug === "/guides/how-do-ai-image") editAiImage(howto);
    else if (row.slug === "/guides/how-do-url-to-video") editUrlToVideo(howto);
    else if (row.slug === "/guides/how-do-product-links") editProductLinks(howto);
    nextById.set(row.id, next);
  }

  // Sync seo.jsonLd HowTo steps and FAQPage from the updated howto copy
  for (const row of rows) {
    const next = nextById.get(row.id);
    const howto = next.sections.v2_main.settings.data.howto;
    const graph = next.seo.jsonLd["@graph"];
    const howtoNode = graph.find((n) => n["@type"] === "HowTo");
    const faqNode = graph.find((n) => n["@type"] === "FAQPage");
    if (howtoNode && howtoNode.step) {
      howtoNode.step = howto.steps.map((step) => ({
        ...(howtoNode.step.find((c) => c.name === step.title) ?? {}),
        name: step.title,
        text: step.body
      }));
    }
    if (faqNode && faqNode.mainEntity) {
      faqNode.mainEntity = howto.faq.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a }
      }));
    }
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
  const manifestPath = path.join(manifestDir, `aivideosugc-guides-batch2-real-pairs-${new Date().toISOString().slice(0, 10)}.json`);
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
    assert.equal(result.count, 1, `${row.slug}: compare-and-set failed`);
    const readback = await db.livePage.findFirstOrThrow({ where: { siteId: SITE_ID, id: row.id } });
    assert.equal(hash(readback.contentJson), hash(next), `${row.slug}: readback mismatch`);
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
