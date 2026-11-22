#!/usr/bin/env node
// Guides AI Image: replace the tote reference/market pair with the homepage
// "Create Product Images in Three Steps" example (navy travel mug → car scene),
// add the four scene directions, and point the hero/OG at the homepage result.
//
// Run from the current production release directory:
//   node scripts/apply-aidreamcapes-guides-ai-image-homepage.mjs
//   node scripts/apply-aidreamcapes-guides-ai-image-homepage.mjs --apply-production \
//     --confirm=guides-ai-image-homepage
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

loadRuntimeEnv();
const applying = process.argv.includes("--apply-production");
const confirmed = process.argv.includes("--confirm=guides-ai-image-homepage");
assertDatabaseTarget({
  expectedTarget: "production",
  requireProductionConfirmation: applying,
  productionConfirmed: applying && confirmed
});

const SITE_ID = "site_aidreamcapes";
const SLUG = "/guides/how-do-ai-image";

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

const SOURCE = {
  alt: "Plain matte navy insulated travel mug with a simple black lid, fully visible on a clean white background.",
  src: "/ai-image-generation/img1-home-steps-source-r1-640.webp",
  width: 640,
  height: 640
};
const RESULT = {
  alt: "Adult man with short gray hair holds the same plain matte navy insulated travel mug beside his face in a parked car.",
  src: "/ai-image-generation/img1-home-steps-result-r1-640.webp",
  width: 640,
  height: 640
};
const DEMO = {
  lead: "Compare the mug's shape, lid, and matte navy finish. The product photo on the left was uploaded to produce the car-scene image on the right.",
  title: "Product photo → lifestyle image example",
  gallery: [
    { image: SOURCE, caption: "Product photo" },
    { image: RESULT, caption: "Generated lifestyle image · same mug in a car scene" }
  ]
};
const STEPS = [
  {
    title: "Open the Lifestyle Photo entry",
    body: "Go to [AI Image · Lifestyle Photo](/app/create/lifestyle-photos). If the workspace asks you to sign in, return to the tool after signing in."
  },
  {
    title: "Upload one clear product photo",
    body: "Choose a sharp image where the whole product and label are visible. For this example, the source photo is a plain matte navy travel mug on a clean background. Avoid glare, blur, or another object covering the item."
  },
  {
    title: "Choose the scene and ratio",
    body: "Use the Lifestyle Photo preset for an in-context image. If the preset is not selected automatically, choose it from the options shown. The homepage example uses a car scene; pick the ratio that fits the placement."
  },
  {
    title: "Describe the scene and preserve details",
    body: "Name the setting and the product details that must remain recognizable. For the mug, call out its matte navy finish, black lid, and simple shape; do not add a logo or a different lid."
  },
  {
    title: "Generate and inspect at full size",
    body: "Review the estimate (The estimate shows how many credits this generation will cost before you confirm. You are never charged without seeing the price first.) and start generation. Compare the output with the source photo for the mug's shape, lid, and color. The example result shows the same mug held beside the presenter's face in a parked car. If any key detail has changed, revise one part of the prompt before making another version."
  }
];
const SECTIONS = [
  {
    h2: "Choose the scene that fits the placement",
    paras: ["The image workspace offers four common directions. Pick the one that matches where the image will appear."],
    bullets: [
      "**Lifestyle:** the product in a real setting, such as the travel mug in a parked car.",
      "**White background:** a clean listing image for a marketplace or shop page.",
      "**Product detail:** a close-up of the material, lid, or label.",
      "**Social image:** a feed-ready still for a post or ad."
    ]
  }
];
const OG_ALT = "A man holds a matte navy insulated travel mug in a parked car.";

const db = new PrismaClient();
try {
  const row = await db.livePage.findFirstOrThrow({ where: { siteId: SITE_ID, slug: SLUG } });
  const next = structuredClone(row.contentJson);
  const howto = next.sections.v2_main.settings.data.howto;
  const seo = next.seo;

  assert.equal(howto.image.src, "/assets/sites/site_aidreamcapes/guides/ch06-ai-image.webp", "ai-image hero drifted");
  record("howto/image", howto.image, RESULT);
  howto.image = structuredClone(RESULT);

  assert.equal(
    howto.intro[1],
    "The example below follows one real run: the tote reference photo on the left, and the lifestyle image generated from it on the right.",
    "ai-image intro[1] drifted"
  );
  const intro1 = "The example below follows the homepage workflow: the navy travel mug photo on the left, and the car-scene image generated from it on the right.";
  record("howto/intro/1", howto.intro[1], intro1);
  howto.intro[1] = intro1;

  assert.equal(howto.demo.gallery[0].image.src, "/ai-image-generation/k5-lifestyle-gallery-source-640.webp", "ai-image demo source drifted");
  assert.equal(howto.demo.gallery[1].image.src, "/ai-image-generation/k5-lifestyle-gallery-hero-640.webp", "ai-image demo result drifted");
  record("howto/demo", howto.demo, DEMO);
  howto.demo = structuredClone(DEMO);

  assert.equal(howto.steps[0].title, "Open the Lifestyle Photo entry", "ai-image steps[0] drifted");
  record("howto/steps", howto.steps, STEPS);
  howto.steps = structuredClone(STEPS);

  record("howto/sections", howto.sections, SECTIONS);
  howto.sections = structuredClone(SECTIONS);

  assert.equal(seo.ogImage, "/assets/sites/site_aidreamcapes/guides/ch06-ai-image.webp", "ai-image seo.ogImage drifted");
  record("seo/ogImage", seo.ogImage, RESULT.src);
  seo.ogImage = RESULT.src;
  assert.equal(seo.ogImageAlt, "AI Image workspace with its reference-photo and style controls.", "ai-image seo.ogImageAlt drifted");
  record("seo/ogImageAlt", seo.ogImageAlt, OG_ALT);
  seo.ogImageAlt = OG_ALT;

  const howTo = seo.jsonLd["@graph"].find((node) => node["@type"] === "HowTo");
  assert.ok(howTo, "ai-image HowTo JSON-LD missing");
  const howToSteps = STEPS.map((step) => ({ name: step.title, text: step.body, "@type": "HowToStep" }));
  record("seo/jsonLd/HowTo/step", howTo.step, howToSteps);
  howTo.step = howToSteps;
  record("seo/jsonLd/HowTo/image", howTo.image, { url: `https://www.aivideosugc.com${RESULT.src}`, "@type": "ImageObject", caption: OG_ALT });
  howTo.image = { url: `https://www.aivideosugc.com${RESULT.src}`, "@type": "ImageObject", caption: OG_ALT };

  const manifestDir = process.env.MANIFEST_DIR
    ? path.resolve(process.env.MANIFEST_DIR)
    : path.join(process.cwd(), "scripts", "manifests");
  fs.mkdirSync(manifestDir, { recursive: true });
  const manifestPath = path.join(
    manifestDir,
    `aidreamcapes-guides-ai-image-homepage-${new Date().toISOString().slice(0, 10)}.json`
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
