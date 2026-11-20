#!/usr/bin/env node
// Guides batch 1b: sync the four tutorials' stored seo.jsonLd (HowTo steps
// and FAQPage answers) with the page copy that batch 1 already wrote. The
// stored graph was built with the old example copy and still mentions the
// retired yoga-mat / balm / moisturizer / "visual example only" text.
//
// Run from the current production release directory:
//   node scripts/apply-aidreamcapes-guides-batch1b-seo-sync.mjs
//   node scripts/apply-aidreamcapes-guides-batch1b-seo-sync.mjs --apply-production \
//     --confirm=guides-batch1b-seo-sync
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

loadRuntimeEnv();
const applying = process.argv.includes("--apply-production");
const confirmed = process.argv.includes("--confirm=guides-batch1b-seo-sync");
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
  "/guides/how-do-ai-avatar"
];

const stable = (value) => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
    : value;
const hash = (value) => crypto.createHash("sha256")
  .update(value === undefined ? "<undefined>" : JSON.stringify(stable(value)))
  .digest("hex");

const db = new PrismaClient();
try {
  const rows = await db.livePage.findMany({
    where: { siteId: SITE_ID, slug: { in: SLUGS } },
    orderBy: { slug: "asc" }
  });
  assert.equal(rows.length, SLUGS.length, `expected ${SLUGS.length} rows, found ${rows.length}`);

  const edits = [];
  const nextById = new Map();
  for (const row of rows) {
    const next = structuredClone(row.contentJson);
    const howto = next.sections.v2_main.settings.data.howto;
    const graph = next.seo.jsonLd["@graph"];
    const howtoNode = graph.find((node) => node["@type"] === "HowTo");
    const faqNode = graph.find((node) => node["@type"] === "FAQPage");
    assert.ok(howtoNode, `${row.slug}: seo HowTo node missing`);
    assert.ok(faqNode, `${row.slug}: seo FAQPage node missing`);
    assert.equal(howtoNode.step.length, howto.steps.length, `${row.slug}: seo step count differs from page steps`);
    assert.equal(faqNode.mainEntity.length, howto.faq.length, `${row.slug}: seo FAQ count differs from page FAQ`);

    const beforeSteps = structuredClone(howtoNode.step);
    howtoNode.step = howto.steps.map((step) => ({
      ...(howtoNode.step.find((candidate) => candidate.name === step.title) ?? {}),
      name: step.title,
      text: step.body
    }));
    const beforeFaq = structuredClone(faqNode.mainEntity);
    faqNode.mainEntity = howto.faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a }
    }));

    edits.push({
      slug: row.slug,
      stepsBeforeHash: hash(beforeSteps),
      stepsAfterHash: hash(howtoNode.step),
      faqBeforeHash: hash(beforeFaq),
      faqAfterHash: hash(faqNode.mainEntity)
    });
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
  const manifestPath = path.join(manifestDir, `aivideosugc-guides-batch1b-seo-sync-${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifestDoc, null, 2)}\n`);

  if (!applying) {
    console.log(JSON.stringify({ pages: SLUGS, editCount: edits.length, manifestPath }, null, 2));
    console.error(`dry run: ${edits.length} page(s) synced; manifest written to ${manifestPath}`);
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
