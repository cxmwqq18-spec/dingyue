#!/usr/bin/env node
// Guides beginner pass 2 (2026-11-21): replace remaining internal jargon in
// the how-to pages with words a first-time reader can follow.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

loadRuntimeEnv();
const applying = process.argv.includes("--apply-production");
const confirmed = process.argv.includes("--confirm=guides-beginner-pass2-2026-11-21");
assertDatabaseTarget({ expectedTarget: "production", requireProductionConfirmation: applying, productionConfirmed: applying && confirmed });

const SITE_ID = "site_aidreamcapes";
const SLUGS = [
  "/guides/how-do-ai-video",
  "/guides/how-do-image-to-video",
  "/guides/how-do-text-to-video",
  "/guides/how-do-ai-image",
  "/guides/how-do-url-to-video",
  "/guides/how-do-product-links",
  "/guides/how-do-subtitle-studio"
];
const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value;
const hash = (value) => crypto.createHash("sha256").update(value === undefined ? "<undefined>" : JSON.stringify(stable(value))).digest("hex");
const edits = [];
const record = (slug, p, b, a) => edits.push({ slug, path: p, beforeHash: hash(b), afterHash: hash(a) });
const set = (slug, obj, key, oldValue, newValue) => { assert.deepEqual(obj[key], oldValue, `${slug}: ${key} drifted`); record(slug, key, obj[key], newValue); obj[key] = newValue; };
const replace = (slug, obj, key, oldSub, newSub) => { const b = obj[key]; assert.equal(typeof b, "string", `${slug}: ${key} not a string`); assert.ok(b.includes(oldSub), `${slug}: ${key} missing expected text`); const a = b.replace(oldSub, newSub); record(slug, key, b, a); obj[key] = a; };
const replaceStep = (slug, howto, i, oldSub, newSub) => { const s = howto.steps[i]; assert.ok(s, `${slug}: step ${i} missing`); assert.ok(s.body.includes(oldSub), `${slug}: step ${i} missing expected text`); const a = s.body.replace(oldSub, newSub); record(slug, `steps/${i}/body`, s.body, a); s.body = a; };

function rebuild(slug, seo, howto) {
  const before = structuredClone(seo.jsonLd);
  const graph = seo.jsonLd["@graph"];
  const article = graph.find((n) => n["@type"] === "Article");
  if (article) { article.headline = howto.h1; article.description = howto.lead; }
  const howTo = graph.find((n) => n["@type"] === "HowTo");
  if (howTo) { howTo.name = howto.h1; howTo.description = howto.lead; howTo.step = howto.steps.map((s) => ({ name: s.title, text: s.body, "@type": "HowToStep" })); }
  const faq = graph.find((n) => n["@type"] === "FAQPage");
  if (faq) faq.mainEntity = howto.faq.map((f) => ({ name: f.q, "@type": "Question", acceptedAnswer: { text: f.a, "@type": "Answer" } }));
  record(slug, "seo/jsonLd", before, seo.jsonLd);
}

const db = new PrismaClient();
try {
  const rows = await db.livePage.findMany({ where: { siteId: SITE_ID, slug: { in: SLUGS } }, orderBy: { slug: "asc" } });
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
      set(slug, howto.meta, 0, "Product reference photos", "Product photos");
      set(slug, howto.steps[1], "title", "Add clear product references", "Add clear product photos");
      set(slug, howto.checklist, 0, "Every reference photo shows the intended product.", "Every product photo shows the intended product.");
      assert.equal(howto.faq[2].q, "How many reference photos do I need?", "ai-video faq[2] drifted");
      const f = { q: "How many product photos do I need?", a: howto.faq[2].a };
      record(slug, "faq/2", howto.faq[2], f); howto.faq[2] = f;
      changed = true;
    } else if (slug === "/guides/how-do-image-to-video") {
      set(slug, howto.meta, 1, "One motion prompt", "One movement instruction");
      set(slug, howto.demo, "title", "One product photo → one motion prompt → generated clip", "One product photo → one movement → generated clip");
      replaceStep(slug, howto, 3, "Select the ratio, duration, and model offered in the current workspace.", "Select the shape (ratio), duration, and model (the AI engine) offered in the current workspace.");
      changed = true;
    } else if (slug === "/guides/how-do-text-to-video") {
      set(slug, howto.meta, 1, "Prompt-first workflow", "No product photo needed");
      // meta is not part of JSON-LD; no rebuild needed
    } else if (slug === "/guides/how-do-ai-image") {
      set(slug, howto.meta, 1, "Reference photo", "Product photo");
      replace(slug, howto.intro, 0, "if you need a clean white main image, choose the matching image tool preset.", "if you need a clean white main image, choose the matching image tool.");
      replaceStep(slug, howto, 2, "pick the ratio that fits the placement.", "pick the shape (ratio) that fits the placement.");
      changed = true;
    } else if (slug === "/guides/how-do-url-to-video") {
      set(slug, howto.meta, 2, "Editable draft is the tutorial endpoint", "Stops at the editable draft");
      replace(slug, howto.intro, 0, "URL to Video is the one-page route: import a public product listing and open an editable video draft.", "URL to Video starts from one public product page and opens an editable video draft. A draft is an editable plan; nothing is generated until you choose.");
      changed = true;
    } else if (slug === "/guides/how-do-product-links") {
      set(slug, howto, "lead", "Import a public product page, check its photo and details, then confirm the product entry so you can use it again.", "Import a public product page, check its photo and details, then save the product so you can use it again.");
      replace(slug, howto.intro, 0, "Product Links is the saved-library route: keep a confirmed product page so you can select it again when you start another video.", "Product Links keeps a library of saved products: confirm a product page once, then select it again when you start another video.");
      set(slug, howto.meta, 1, "Confirm the product entry", "Save the product");
      set(slug, howto.steps[3], "title", "Confirm the product entry", "Confirm and save the product");
      replaceStep(slug, howto, 3, "Use the confirmation control shown by the workspace.", "Use the save or confirm control shown by the workspace.");
      changed = true;
    } else if (slug === "/guides/how-do-subtitle-studio") {
      replace(slug, howto.intro, 0, "Select a clean render with clear speech, choose", "Select a completed video with clear speech and no burned-in captions, choose");
      set(slug, howto.steps[1], "title", "Choose a clean source video", "Choose a video without captions");
      replaceStep(slug, howto, 1, "Select the completed render whose speech you want to caption.", "Select the completed video whose speech you want to caption.");
      replaceStep(slug, howto, 3, "start from the clean original rather than a version that already has captions.", "start from the original without captions rather than a version that already has captions.");
      changed = true;
    }

    if (changed) rebuild(slug, seo, howto);
    nextById.set(row.id, next);
  }

  const manifestDir = process.env.MANIFEST_DIR ? path.resolve(process.env.MANIFEST_DIR) : path.join(process.cwd(), "scripts", "manifests");
  fs.mkdirSync(manifestDir, { recursive: true });
  const manifestPath = path.join(manifestDir, `aidreamcapes-guides-beginner-pass2-2026-11-21-${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(manifestPath, `${JSON.stringify({ siteId: SITE_ID, generatedAt: new Date().toISOString(), applying, editCount: edits.length, pages: SLUGS, edits }, null, 2)}\n`);
  if (!applying) { console.log(JSON.stringify({ pages: SLUGS, editCount: edits.length, manifestPath }, null, 2)); process.exit(0); }

  const otherBefore = hash(await db.livePage.findMany({ where: { siteId: { not: SITE_ID } }, orderBy: { id: "asc" }, select: { id: true, contentJson: true } }));
  let applied = 0;
  for (const row of rows) {
    const next = nextById.get(row.id);
    const result = await db.livePage.updateMany({ where: { siteId: SITE_ID, id: row.id, updatedAt: row.updatedAt }, data: { contentJson: next } });
    assert.equal(result.count, 1, `${row.slug}: compare-and-set failed`);
    const readback = await db.livePage.findFirstOrThrow({ where: { siteId: SITE_ID, id: row.id } });
    assert.equal(hash(readback.contentJson), hash(next), `${row.slug}: readback does not match`);
    applied += 1;
  }
  const otherAfter = hash(await db.livePage.findMany({ where: { siteId: { not: SITE_ID } }, orderBy: { id: "asc" }, select: { id: true, contentJson: true } }));
  assert.equal(otherBefore, otherAfter, "a row outside site_aidreamcapes changed");
  console.log(JSON.stringify({ applied, editCount: edits.length, manifestPath }, null, 2));
} finally { await db.$disconnect(); }
