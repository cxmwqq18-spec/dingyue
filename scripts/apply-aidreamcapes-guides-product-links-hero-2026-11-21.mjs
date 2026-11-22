#!/usr/bin/env node
// Guides Product Links: replace the full-Chrome / translated screenshot with a
// clean English workspace capture (import form + empty library), and align the
// copy with the starting state.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

loadRuntimeEnv();
const applying = process.argv.includes("--apply-production");
const confirmed = process.argv.includes("--confirm=guides-product-links-hero-2026-11-21");
assertDatabaseTarget({ expectedTarget: "production", requireProductionConfirmation: applying, productionConfirmed: applying && confirmed });
const SITE_ID = "site_aidreamcapes";
const SLUGS = ["/guides/how-do-product-links", "/guides"];
const stable = (v) => Array.isArray(v) ? v.map(stable) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])])) : v;
const hash = (v) => crypto.createHash("sha256").update(v === undefined ? "<undefined>" : JSON.stringify(stable(v))).digest("hex");
const edits = [];
const record = (slug, p, b, a) => edits.push({ slug, path: p, beforeHash: hash(b), afterHash: hash(a) });
const set = (slug, obj, key, oldValue, newValue) => { assert.deepEqual(obj[key], oldValue, `${slug}: ${key} drifted`); record(slug, key, obj[key], newValue); obj[key] = newValue; };
const replace = (slug, obj, key, oldSub, newSub) => { const b = obj[key]; assert.equal(typeof b, "string", `${slug}: ${key} not string`); assert.ok(b.includes(oldSub), `${slug}: ${key} missing expected text`); const a = b.replace(oldSub, newSub); record(slug, key, b, a); obj[key] = a; };

const NEW_IMAGE = {
  alt: "Product Links workspace with the import form and the product library.",
  src: "/ai-image-generation/ch08-product-links-clean.webp",
  width: 1440,
  height: 763
};
const NEW_OG_ALT = "Product Links workspace with the import form and product library.";

const db = new PrismaClient();
try {
  const rows = await db.livePage.findMany({ where: { siteId: SITE_ID, slug: { in: SLUGS } }, orderBy: { slug: "asc" } });
  assert.equal(rows.length, SLUGS.length, `expected ${SLUGS.length} rows, found ${rows.length}`);
  const nextById = new Map();
  for (const row of rows) {
    const next = structuredClone(row.contentJson);
    const data = next.sections.v2_main.settings.data;
    const slug = row.slug;
    if (slug === "/guides/how-do-product-links") {
      const h = data.howto; const seo = next.seo;
      assert.equal(h.image.src, "/assets/sites/site_aidreamcapes/guides/ch08-product-links-real.webp", "product-links hero drifted");
      record(slug, "howto/image", h.image, NEW_IMAGE); h.image = structuredClone(NEW_IMAGE);
      replace(slug, h.intro, 1, "The screenshot above shows the Product Links workspace with confirmed products in the library. Each saved entry can be selected again when you start a new video.", "The screenshot above shows the Product Links workspace with the import form and the product library. The library starts empty; each saved entry appears there and can be selected again when you start a new video.");
      replace(slug, h.demo, "lead", "A saved product appears in the library after you review and confirm a public page. The screenshot above shows the real library state.", "A saved product appears in the library after you review and confirm a public page. The screenshot above shows the workspace before any product is saved.");
      replace(slug, h.steps[3], "body", "Wait until the product appears in the library — the screenshot above shows the library with confirmed entries after saving.", "Wait until the product appears in the library below the import form. The library starts empty; each saved product is added there.");
      assert.equal(seo.ogImage, "/assets/sites/site_aidreamcapes/guides/ch08-product-links-real.webp", "product-links ogImage drifted");
      record(slug, "seo/ogImage", seo.ogImage, NEW_IMAGE.src); seo.ogImage = NEW_IMAGE.src;
      assert.equal(seo.ogImageAlt, "Product Links workspace showing the product library and import area.", "product-links ogImageAlt drifted");
      record(slug, "seo/ogImageAlt", seo.ogImageAlt, NEW_OG_ALT); seo.ogImageAlt = NEW_OG_ALT;
      const howTo = seo.jsonLd["@graph"].find((n) => n["@type"] === "HowTo");
      assert.ok(howTo, "product-links HowTo missing");
      const steps = h.steps.map((s) => ({ name: s.title, text: s.body, "@type": "HowToStep" }));
      record(slug, "seo/jsonLd/HowTo/step", howTo.step, steps); howTo.step = steps;
      record(slug, "seo/jsonLd/HowTo/image", howTo.image, { url: `https://www.aivideosugc.com${NEW_IMAGE.src}`, "@type": "ImageObject", caption: NEW_OG_ALT });
      howTo.image = { url: `https://www.aivideosugc.com${NEW_IMAGE.src}`, "@type": "ImageObject", caption: NEW_OG_ALT };
    } else if (slug === "/guides") {
      const item = data.hub.howTos.items.find((e) => e.href === "/guides/how-do-product-links");
      assert.ok(item, "hub Product Links card missing");
      replace(slug, item, "body", "Import a public product page, check what was read, and confirm the product entry for later use.", "Import a public product page, check what was read, and save the product for later use.");
    }
    nextById.set(row.id, next);
  }
  const manifestDir = process.env.MANIFEST_DIR ? path.resolve(process.env.MANIFEST_DIR) : path.join(process.cwd(), "scripts", "manifests");
  fs.mkdirSync(manifestDir, { recursive: true });
  const manifestPath = path.join(manifestDir, `aidreamcapes-guides-product-links-hero-2026-11-21-${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(manifestPath, `${JSON.stringify({ siteId: SITE_ID, generatedAt: new Date().toISOString(), applying, editCount: edits.length, pages: SLUGS, edits }, null, 2)}\n`);
  if (!applying) { console.log(JSON.stringify({ pages: SLUGS, editCount: edits.length, manifestPath }, null, 2)); process.exit(0); }
  const otherBefore = hash(await db.livePage.findMany({ where: { siteId: { not: SITE_ID } }, orderBy: { id: "asc" }, select: { id: true, contentJson: true } }));
  let applied = 0;
  for (const row of rows) {
    const next = nextById.get(row.id);
    const result = await db.livePage.updateMany({ where: { siteId: SITE_ID, id: row.id, updatedAt: row.updatedAt }, data: { contentJson: next } });
    assert.equal(result.count, 1, `${row.slug}: CAS failed`);
    const readback = await db.livePage.findFirstOrThrow({ where: { siteId: SITE_ID, id: row.id } });
    assert.equal(hash(readback.contentJson), hash(next), `${row.slug}: readback mismatch`);
    applied += 1;
  }
  const otherAfter = hash(await db.livePage.findMany({ where: { siteId: { not: SITE_ID } }, orderBy: { id: "asc" }, select: { id: true, contentJson: true } }));
  assert.equal(otherBefore, otherAfter, "a row outside site_aidreamcapes changed");
  console.log(JSON.stringify({ applied, editCount: edits.length, manifestPath }, null, 2));
} finally { await db.$disconnect(); }
