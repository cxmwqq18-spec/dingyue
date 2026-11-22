#!/usr/bin/env node
// Guides Subtitle Studio: replace the berry-bowl comparison with the
// hands-only drawer-organizer clip and a white bottom-caption example.
//
// The captioned side is an ffmpeg/libass burn (zero cost), not a Subtitle
// Studio export, so the copy says "Captioned example", never "real run".
//
// Run from the current production release directory:
//   node scripts/apply-aidreamcapes-guides-subtitle-drawer.mjs
//   node scripts/apply-aidreamcapes-guides-subtitle-drawer.mjs --apply-production \
//     --confirm=guides-subtitle-drawer
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

loadRuntimeEnv();
const applying = process.argv.includes("--apply-production");
const confirmed = process.argv.includes("--confirm=guides-subtitle-drawer");
assertDatabaseTarget({
  expectedTarget: "production",
  requireProductionConfirmation: applying,
  productionConfirmed: applying && confirmed
});

const SITE_ID = "site_aidreamcapes";
const SLUGS = ["/guides/how-do-subtitle-studio", "/guides"];

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

const BEFORE_VIDEO = {
  src: "/ai-video-generation/subtitle-example-drawer-original.mp4",
  poster: "/ai-image-generation/subtitle-example-drawer-original-poster.jpg"
};
const AFTER_VIDEO = {
  src: "/ai-video-generation/subtitle-example-drawer-captioned-white.mp4",
  poster: "/ai-image-generation/subtitle-example-drawer-captioned-white-poster.jpg"
};
const OG_IMAGE = "/ai-image-generation/subtitle-example-drawer-captioned-white-poster.jpg";
const OG_ALT = "Drawer-organizer clip frame with white bottom captions from the Subtitle Studio example.";

function editSubtitle(howto, seo) {
  assert.equal(
    howto.image.src,
    "/assets/sites/site_aidreamcapes/guides/subtitle-example-berry-bowl-poster.jpg",
    "subtitle hero drifted"
  );
  const hero = {
    alt: "Drawer-organizer clip frame with white bottom captions from the Subtitle Studio example.",
    src: OG_IMAGE,
    width: 720,
    height: 1280
  };
  record("/guides/how-do-subtitle-studio", "howto/image", howto.image, hero);
  howto.image = structuredClone(hero);

  assert.equal(
    howto.intro[1],
    "The pair below is a real Subtitle Studio run: the same berry-bowl clip before and after a Classic-style caption pass. Play either side to hear the narration and see the caption layer.",
    "subtitle intro[1] drifted"
  );
  const intro1 = "The pair below shows the same drawer-organizer clip before and after captions are added. The captioned side is an example of white captions at the bottom; generate your own in Subtitle Studio. Play either side to hear the narration and see the caption layer.";
  record("/guides/how-do-subtitle-studio", "howto/intro/1", howto.intro[1], intro1);
  howto.intro[1] = intro1;

  assert.equal(
    howto.demo.lead,
    "Both sides play the same 30-second berry-bowl clip with its original audio. Play either one; starting one pauses the other and keeps the comparison near the same time.",
    "subtitle demo.lead drifted"
  );
  const demoLead = "Both sides play the same 15-second drawer-organizer clip with its original audio. Play either one; starting one pauses the other and keeps the comparison near the same time.";
  record("/guides/how-do-subtitle-studio", "howto/demo/lead", howto.demo.lead, demoLead);
  howto.demo.lead = demoLead;

  const subtitles = howto.demo.subtitles;
  assert.equal(subtitles.before.video.src, "/assets/sites/site_aidreamcapes/guides/subtitle-example-berry-bowl-original.mp4", "subtitle before video drifted");
  record("/guides/how-do-subtitle-studio", "howto/demo/subtitles/before/video", subtitles.before.video, BEFORE_VIDEO);
  subtitles.before.video = structuredClone(BEFORE_VIDEO);
  record("/guides/how-do-subtitle-studio", "howto/demo/subtitles/before/lines", subtitles.before.lines, [
    "15 seconds · drawer-organizer clip · original audio",
    "No burned-in captions"
  ]);
  subtitles.before.lines = ["15 seconds · drawer-organizer clip · original audio", "No burned-in captions"];

  assert.equal(subtitles.after.video.src, "/assets/sites/site_aidreamcapes/guides/subtitle-example-berry-bowl-captioned-classic.mp4", "subtitle after video drifted");
  record("/guides/how-do-subtitle-studio", "howto/demo/subtitles/after/video", subtitles.after.video, AFTER_VIDEO);
  subtitles.after.video = structuredClone(AFTER_VIDEO);
  assert.equal(subtitles.after.label, "Captioned with Subtitle Studio · Classic style", "subtitle after label drifted");
  record("/guides/how-do-subtitle-studio", "howto/demo/subtitles/after/label", subtitles.after.label, "Captioned example · white captions at the bottom");
  subtitles.after.label = "Captioned example · white captions at the bottom";
  record("/guides/how-do-subtitle-studio", "howto/demo/subtitles/after/lines", subtitles.after.lines, [
    "Same drawer-organizer clip and audio",
    "White English captions at the bottom"
  ]);
  subtitles.after.lines = ["Same drawer-organizer clip and audio", "White English captions at the bottom"];

  record("/guides/how-do-subtitle-studio", "howto/demo/subtitles/chips", subtitles.chips, [
    "Action · Generate subtitles",
    "Style · Classic",
    "Color · white · Position · bottom"
  ]);
  subtitles.chips = ["Action · Generate subtitles", "Style · Classic", "Color · white · Position · bottom"];

  assert.equal(howto.steps[1].title, "Choose a clean source video", "subtitle steps[1] drifted");
  const step1 = "Select the completed render whose speech you want to caption. For the example above, the drawer-organizer clip has clear narration about the drawer, the tray, the brush, and the cloth. Before generating, play the clip and confirm the speech is clear and has no baked-in subtitles.";
  record("/guides/how-do-subtitle-studio", "howto/steps/1/body", howto.steps[1].body, step1);
  howto.steps[1].body = step1;

  assert.equal(howto.steps[4].title, "Compare, listen, and download", "subtitle steps[4] drifted");
  const step4 = "Compare the new version with **Original** at the same point. In the drawer-organizer example, check the opening line about the drawer, the middle line about the tray, and the closing line about the brush and cloth. Listen for product names and numbers, then use the download control for the version you approved.";
  record("/guides/how-do-subtitle-studio", "howto/steps/4/body", howto.steps[4].body, step4);
  howto.steps[4].body = step4;

  const checklist = howto.checklist[3];
  assert.equal(checklist, "The berry-bowl example above shows the same clip on both sides; only the caption layer differs.", "subtitle checklist[3] drifted");
  const newCheck = "The drawer-organizer example above shows the same clip on both sides; only the caption layer differs.";
  record("/guides/how-do-subtitle-studio", "howto/checklist/3", checklist, newCheck);
  howto.checklist[3] = newCheck;

  assert.equal(seo.ogImage, "/assets/sites/site_aidreamcapes/guides/subtitle-example-berry-bowl-poster.jpg", "subtitle seo.ogImage drifted");
  record("/guides/how-do-subtitle-studio", "seo/ogImage", seo.ogImage, OG_IMAGE);
  seo.ogImage = OG_IMAGE;
  assert.equal(seo.ogImageAlt, "Uncaptioned frame from the original side of a paired subtitle example.", "subtitle seo.ogImageAlt drifted");
  record("/guides/how-do-subtitle-studio", "seo/ogImageAlt", seo.ogImageAlt, OG_ALT);
  seo.ogImageAlt = OG_ALT;

  const howToNode = seo.jsonLd["@graph"].find((node) => node["@type"] === "HowTo");
  assert.ok(howToNode, "subtitle HowTo JSON-LD missing");
  record("/guides/how-do-subtitle-studio", "seo/jsonLd/HowTo/step/1/text", howToNode.step[1].text, step1);
  howToNode.step[1].text = step1;
  record("/guides/how-do-subtitle-studio", "seo/jsonLd/HowTo/step/4/text", howToNode.step[4].text, step4);
  howToNode.step[4].text = step4;
  record("/guides/how-do-subtitle-studio", "seo/jsonLd/HowTo/image", howToNode.image, { url: `https://www.aivideosugc.com${OG_IMAGE}`, "@type": "ImageObject", caption: OG_ALT });
  howToNode.image = { url: `https://www.aivideosugc.com${OG_IMAGE}`, "@type": "ImageObject", caption: OG_ALT };
}

function editHub(hub) {
  const item = hub.howTos.items.find((entry) => entry.href === "/guides/how-do-subtitle-studio");
  assert.ok(item, "hub Subtitle Studio card missing");
  assert.equal(item.image.src, "/assets/sites/site_aidreamcapes/guides/subtitle-example-study-desk-lamp-poster.jpg", "hub Subtitle Studio cover drifted");
  const image = {
    alt: "Drawer-organizer clip frame with white bottom captions, from this tutorial's example video.",
    src: OG_IMAGE,
    width: 720,
    height: 1280
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
    if (row.slug === "/guides/how-do-subtitle-studio") editSubtitle(data.howto, next.seo);
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
  const manifestPath = path.join(
    manifestDir,
    `aidreamcapes-guides-subtitle-drawer-${new Date().toISOString().slice(0, 10)}.json`
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
