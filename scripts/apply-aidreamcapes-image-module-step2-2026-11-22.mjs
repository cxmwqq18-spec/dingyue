#!/usr/bin/env node
// Image module step 2 (2026-11-22): wire the new square / four-view / packaging
// assets into the navigation, photo tools, and the four template pages.
//
// The asset files are committed under public/assets/sites/site_aidreamcapes/
// v2-responsive/ai-image-generation/. Apply this manifest only after the code
// and public assets are live.
//
//   node scripts/apply-aidreamcapes-image-module-step2-2026-11-22.mjs
//   node scripts/apply-aidreamcapes-image-module-step2-2026-11-22.mjs --apply-production \
//     --confirm=image-module-step2-2026-11-22
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

loadRuntimeEnv();
const applying = process.argv.includes("--apply-production");
const confirmed = process.argv.includes("--confirm=image-module-step2-2026-11-22");
assertDatabaseTarget({
  expectedTarget: "production",
  requireProductionConfirmation: applying,
  productionConfirmed: applying && confirmed
});

const SITE_ID = "site_aidreamcapes";
const SLUGS = [
  "/",
  "/ai-image-generation",
  "/ai-image-generation/change-background",
  "/ai-image-generation/colorway-variations",
  "/ai-image-generation/packshot-multi-angle",
  "/ai-image-generation/packaging-mockup"
];
const asset = (name) => `/assets/sites/site_aidreamcapes/v2-responsive/ai-image-generation/${name}`;

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
const setString = (slug, obj, key, oldValue, newValue, label = key) => {
  assert.equal(obj[key], oldValue, `${slug}: ${label} drifted`);
  record(slug, label, oldValue, newValue);
  obj[key] = newValue;
};
const setImage = (slug, obj, fieldPath, oldSrc, next, label = fieldPath) => {
  assert.equal(obj?.src, oldSrc, `${slug}: ${label} src drifted`);
  const before = structuredClone(obj);
  obj.src = next.src;
  if (next.alt !== undefined) obj.alt = next.alt;
  if ("width" in obj) obj.width = next.width ?? next.w;
  if ("height" in obj) obj.height = next.height ?? next.h;
  if ("w" in obj) obj.w = next.w ?? next.width;
  if ("h" in obj) obj.h = next.h ?? next.height;
  record(slug, label, before, obj);
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
    const data = next.sections?.v2_main?.settings?.data;
    assert.ok(data, `${row.slug}: data block is missing`);
    const slug = row.slug;

    if (slug === "/") {
      const nav = next.siteNavigation;
      assert.ok(nav?.menus?.[1], "home: image menu is missing");
      const items = nav.menus[1].groups[0].items;
      const expected = [
        ["White Background Photos", "/ai-image-generation/p-white.webp", "Red running shoe on a white background", null],
        ["Lifestyle Photos", "/ai-image-generation/p-life.webp", "Woman carrying a tote bag at a farmers market", {
          src: asset("nav-lifestyle-2026-11-22.webp"), alt: "Cream canvas tote bag at a farmers market"
        }],
        ["Model Photos", "/ai-image-generation/p-model.webp", "Woman wearing a backpack on a city street", {
          src: asset("nav-model-2026-11-22.webp"), alt: "Model wearing a gray hoodie on a city sidewalk"
        }],
        ["Change Background", "/ai-image-generation/p-bg.webp", "White vase of daisies on a beige background", {
          src: asset("nav-change-bg-2026-11-22.webp"), alt: "Terracotta mug on a picnic table in a garden"
        }],
        ["Social Ad Photos", "/ai-image-generation/p-feed.webp", "Gray running shoe on a rock beside a lake", {
          src: asset("nav-social-2026-11-22.webp"), alt: "Sage-green insulated bottle on a cafe counter"
        }]
      ];
      expected.forEach(([label, oldSrc, oldAlt, replacement], index) => {
        const item = items[index];
        assert.equal(item.label, label, `home: nav item ${index} label drifted`);
        assert.equal(item.image, oldSrc, `home: nav item ${index} image drifted`);
        assert.equal(item.alt, oldAlt, `home: nav item ${index} alt drifted`);
        if (!replacement) return;
        record(slug, `siteNavigation/menus/1/groups/0/items/${index}/image`, item.image, replacement.src);
        record(slug, `siteNavigation/menus/1/groups/0/items/${index}/alt`, item.alt, replacement.alt);
        item.image = replacement.src;
        item.alt = replacement.alt;
      });
      const popular = nav.menus[1].popular;
      const popularExpected = [
        ["Color Variants", "/ai-image-generation/rc1-tpl-color-cover.webp", "Four insulated tumblers in black, mint, pink, and navy", {
          src: asset("nav-color-2026-11-22.webp"), alt: "Four soap dispensers in terracotta, blue, cream, and rose"
        }],
        ["Every Angle", "/ai-image-generation/p-angle.webp", "Gray fabric speaker shown at an angle", {
          src: asset("nav-angle-2026-11-22.webp"), alt: "Cream mug shown from four angles on white"
        }],
        ["Packaging Preview", "/ai-image-generation/p-pack-r1.webp", "Hot sauce bottles in a wooden gift crate", {
          src: asset("nav-packaging-2026-11-22.webp"), alt: "Kraft coffee pouch on a cafe counter"
        }]
      ];
      popularExpected.forEach(([label, oldSrc, oldAlt, replacement], index) => {
        const item = popular[index];
        assert.equal(item.label, label, `home: popular item ${index} label drifted`);
        assert.equal(item.image, oldSrc, `home: popular item ${index} image drifted`);
        assert.equal(item.alt, oldAlt, `home: popular item ${index} alt drifted`);
        record(slug, `siteNavigation/menus/1/popular/${index}/image`, item.image, replacement.src);
        record(slug, `siteNavigation/menus/1/popular/${index}/alt`, item.alt, replacement.alt);
        item.image = replacement.src;
        item.alt = replacement.alt;
      });
    } else if (slug === "/ai-image-generation") {
      const tools = data.photoTools;
      assert.equal(tools.length, 5, "photo hub: photoTools count drifted");
      const updates = [
        ["lifestyle-photos", asset("nav-lifestyle-2026-11-22.webp"), "Cream canvas tote bag at a farmers market"],
        ["model-photos", asset("nav-model-2026-11-22.webp"), "Model wearing a gray hoodie on a city sidewalk"],
        ["change-background", asset("nav-change-bg-2026-11-22.webp"), "Terracotta mug on a picnic table in a garden"],
        ["social-ad-photos", asset("nav-social-2026-11-22.webp"), "Sage-green insulated bottle on a cafe counter"]
      ];
      for (const [id, src, alt] of updates) {
        const tool = tools.find((entry) => entry.id === id);
        assert.ok(tool?.image, `photo hub: ${id} image is missing`);
        setImage(slug, tool.image, `photoTools/${id}/image`, tool.image.src, { src, alt, width: 1024, height: 1024 });
      }
    } else if (slug === "/ai-image-generation/change-background") {
      const before = asset("change-background-mug-before-2026-11-22.webp");
      const after = asset("change-background-mug-after-2026-11-22.webp");
      setImage(slug, data.heroMedia.before, "heroMedia/before", "/ai-image-generation/ra3-change-background-hero-1-r1-640.webp", {
        src: before, alt: "Matte terracotta-orange ceramic mug on a gray tabletop against a white wall.", width: 1024, height: 1024
      });
      setImage(slug, data.heroMedia.after, "heroMedia/after", "/ai-image-generation/ra3-change-background-hero-2-r1.webp", {
        src: after, alt: "The same matte terracotta-orange ceramic mug on a red-and-cream picnic cloth in a sunlit garden.", width: 1024, height: 1024
      });
      setImage(slug, data.visual.steps.source, "visual/steps/source", "/ai-image-generation/img2-change-background-steps-1-r1-640.webp", {
        src: before, alt: "Matte terracotta-orange ceramic mug on a gray tabletop against a white wall.", w: 1024, h: 1024
      });
      setImage(slug, data.visual.steps.result, "visual/steps/result", "/ai-image-generation/img2-change-background-steps-2-r1-640.webp", {
        src: after, alt: "The same matte terracotta-orange ceramic mug on a red-and-cream picnic cloth in a sunlit garden.", w: 1024, h: 1024
      });
      setString(slug, data.visual.steps, "prompt", "Place this mint cleanser tube on a quiet gray backdrop with a pale wall behind it. Keep the tube shape, label, and cap unchanged.",
        "Place this terracotta ceramic mug on a red-and-cream picnic cloth in a sunlit garden, keeping the mug shape, handle, and glaze unchanged.", "visual/steps/prompt");
    } else if (slug === "/ai-image-generation/colorway-variations") {
      const grid = asset("color-variants-grid-2026-11-22.webp");
      const alt = "Four soap dispensers in terracotta, blue, cream, and rose on a clean white background.";
      setImage(slug, data.visual.steps.result, "visual/steps/result", "/ai-image-generation/q7-color-steps-result-640.webp", {
        src: grid, alt, w: 1024, h: 1024
      });
      setImage(slug, data.visual.picker.cards[0].image, "visual/picker/cards/0/image", "/ai-image-generation/q7-color-steps-result-640.webp", {
        src: grid, alt, w: 1024, h: 1024
      });
      setImage(slug, data.templateDefinition.card.image, "templateDefinition/card/image", "/ai-image-generation/q7-color-steps-result-640.webp", {
        src: grid, alt, width: 1024, height: 1024
      });
    } else if (slug === "/ai-image-generation/packshot-multi-angle") {
      const four = asset("angle-four-view-2026-11-22.webp");
      const alt = "The same cream mug shown from the front, side, back, and top on a clean white background.";
      setImage(slug, data.heroMedia.image, "heroMedia/image", "/ai-image-generation/q7-angle-hero-image.webp", {
        src: four, alt, width: 1024, height: 1024
      });
      setImage(slug, data.visual.steps.source, "visual/steps/source", "/ai-image-generation/gen2guide-tpl-angle-round4-speaker-controls-640.webp", {
        src: "/ai-image-generation/k2-white-hero-cream-mug.webp", alt: "Matte cream ceramic travel mug with a plain fitted lid on pure white.", w: 1024, h: 1024
      });
      setImage(slug, data.visual.steps.result, "visual/steps/result", "/ai-image-generation/b2f11-tpl-angle-steps-result-r1-640.webp", {
        src: four, alt, w: 1024, h: 1024
      });
      setImage(slug, data.visual.picker.cards[0].image, "visual/picker/cards/0/image", "/ai-image-generation/b2f11-tpl-angle-steps-result-r1-640.webp", {
        src: four, alt, w: 1024, h: 1024
      });
      setImage(slug, data.templateDefinition.card.image, "templateDefinition/card/image", "/ai-image-generation/b2f11-tpl-angle-steps-result-r1-640.webp", {
        src: four, alt, width: 1024, height: 1024
      });
      setString(slug, data.visual.steps, "prompt", "Front and back of the speaker on one plain background, with the port left as it was photographed.",
        "Show this cream mug from the front, side, back, and top on one clean white background, keeping the handle and glaze unchanged.", "visual/steps/prompt");
    } else if (slug === "/ai-image-generation/packaging-mockup") {
      const source = asset("packaging-coffee-source-2026-11-22.webp");
      const design = asset("packaging-design-coffee-2026-11-22.webp");
      const designAlt = "A kraft coffee pouch with a deep espresso-brown label, copper frame, coffee-bean mark, and the word COFFEE on a cafe counter.";
      setImage(slug, data.heroMedia.before, "heroMedia/before", "/ai-image-generation/source-input-640.webp", {
        src: source, alt: "Plain kraft coffee pouch on a cafe counter.", width: 1024, height: 1024
      });
      setImage(slug, data.heroMedia.after, "heroMedia/after", "/ai-image-generation/hero-output-1280.webp", {
        src: design, alt: designAlt, width: 1024, height: 1024
      });
      setImage(slug, data.visual.steps.source, "visual/steps/source", "/ai-image-generation/gen2guide-tpl-pack-c3-m2-source-640.webp", {
        src: source, alt: "Plain kraft coffee pouch on a cafe counter.", w: 1024, h: 1024
      });
      setImage(slug, data.visual.steps.result, "visual/steps/result", "/ai-image-generation/f15-r10-tpl-pack-steps-open-r1-640.webp", {
        src: design, alt: designAlt, w: 1024, h: 1024
      });
      setImage(slug, data.visual.picker.cards[0].image, "visual/picker/cards/0/image", "/ai-image-generation/f15-r10-tpl-pack-steps-open-r1-640.webp", {
        src: design, alt: designAlt, w: 1024, h: 1024
      });
      setImage(slug, data.templateDefinition.card.image, "templateDefinition/card/image", "/ai-image-generation/f15-r10-tpl-pack-steps-open-r1-640.webp", {
        src: design, alt: designAlt, width: 1024, height: 1024
      });
      setString(slug, data.visual.steps, "prompt", "A plain paper coffee pouch sits on a cafe counter with the front panel facing forward.",
        "Design this kraft coffee pouch with a deep espresso-brown label, a thin copper frame, a simple coffee-bean mark, and the word COFFEE, keeping the pouch shape and cafe counter.", "visual/steps/prompt");
      const galleryBefore = data.gallery.images;
      const galleryAfter = [
        { src: source, alt: "Plain kraft coffee pouch on a cafe counter.", width: 1024, height: 1024 },
        { src: design, alt: designAlt, width: 1024, height: 1024 }
      ];
      record(slug, "gallery/images", galleryBefore, galleryAfter);
      data.gallery.images = galleryAfter;
      const stripBefore = data.visual.strip;
      const designStrip = { src: design, alt: designAlt, w: 1024, h: 1024, kind: "photo" };
      assert.ok(!stripBefore.some((item) => item.src === design), "packaging: design already in strip");
      const stripAfter = [designStrip, ...stripBefore];
      record(slug, "visual/strip", stripBefore, stripAfter);
      data.visual.strip = stripAfter;
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
  const manifestPath = path.join(manifestDir, "aidreamcapes-image-module-step2-2026-11-22.json");
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
  for (const row of rows) {
    const next = nextById.get(row.id);
    const result = await db.livePage.updateMany({
      where: { siteId: SITE_ID, id: row.id, updatedAt: row.updatedAt },
      data: { contentJson: next }
    });
    assert.equal(result.count, 1, `${row.slug}: compare-and-set failed`);
    const readback = await db.livePage.findFirstOrThrow({ where: { siteId: SITE_ID, id: row.id } });
    assert.equal(hash(readback.contentJson), hash(next), `${row.slug}: readback does not match the manifest`);
  }
  const otherAfter = hash(await db.livePage.findMany({
    where: { siteId: { not: SITE_ID } },
    orderBy: { id: "asc" },
    select: { id: true, contentJson: true }
  }));
  assert.equal(otherBefore, otherAfter, "a row outside site_aidreamcapes changed during the apply");

  console.log(JSON.stringify({ applied: rows.length, editCount: edits.length, manifestPath }, null, 2));
} finally {
  await db.$disconnect();
}
