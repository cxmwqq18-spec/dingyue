#!/usr/bin/env node
// Plan the Aidreamcapes /templates example-gallery pagination change
// (docs/aivideosugc-templates-page-performance-plan.md P0).
//
// Sets exampleDirectory.pageSize on the /templates LivePage row from 20 to
// 12: the gallery renders discrete SSR pages of twelve cards with a plain
// anchor pager instead of the client loader. Field-level change on one row;
// every other field of the row is untouched.
//
//   node --env-file=.env.local scripts/plan-aidreamcapes-gallery-pagination.mjs --target=local
//   PRISMA_BASE=/www/wwwroot/aidreamcapes.com/current/node_modules \
//     node --env-file=.env.local scripts/plan-aidreamcapes-gallery-pagination.mjs --target=production
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(
  process.env.PRISMA_BASE
    ? path.join(process.env.PRISMA_BASE, "package.json")
    : import.meta.url
);
const { PrismaClient } = require("@prisma/client");

const SITE_ID = "site_aidreamcapes";
const CONTRACT = "aidreamcapes-gallery-pagination-2026-11-02-v1";
const TARGET_SLUG = "/templates";
const FIELD = "exampleDirectory.pageSize";
const AFTER = 12;
const target = process.argv.find((arg) => arg.startsWith("--target="))?.split("=")[1] || "local";
assert.ok(["local", "production"].includes(target), "--target must be local or production");

function stable(value) {
  if (value === undefined) return '"<undefined>"';
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}
function hash(value) {
  return crypto.createHash("sha256").update(stable(value)).digest("hex");
}
function pageHash(row) {
  return hash({
    id: row.id,
    siteId: row.siteId,
    slug: row.slug,
    title: row.title,
    pageType: row.pageType,
    templateKey: row.templateKey,
    contentJson: row.contentJson,
    updatedAt: row.updatedAt
  });
}

const db = new PrismaClient({ errorFormat: "minimal" });
try {
  const row = await db.livePage.findUnique({
    where: { siteId_slug: { siteId: SITE_ID, slug: TARGET_SLUG } },
    select: { id: true, siteId: true, slug: true, title: true, pageType: true, templateKey: true, contentJson: true, updatedAt: true }
  });
  assert(row, "The /templates LivePage row is missing");
  const sections = row.contentJson?.sections ?? {};
  const sectionId = Object.entries(sections).find(([, section]) => section?.settings?.data?.exampleDirectory)?.[0];
  assert(sectionId, "No section on /templates carries settings.data.exampleDirectory");
  const directory = row.contentJson.sections[sectionId].settings.data.exampleDirectory;
  const before = directory.pageSize ?? null;
  const jsonPath = `contentJson.sections.${sectionId}.settings.data.exampleDirectory.pageSize`;

  const manifest = {
    ok: true,
    contract: CONTRACT,
    siteId: SITE_ID,
    target,
    generatedAt: new Date().toISOString(),
    page: { slug: row.slug, baseHash: pageHash(row) },
    jsonPath,
    operations: [{ field: FIELD, before, after: AFTER, beforeHash: hash(before), afterHash: hash(AFTER) }]
  };
  manifest.planHash = hash({ page: manifest.page, operations: manifest.operations });

  const manifestPath = path.resolve(process.cwd(), `scripts/manifests/aidreamcapes-gallery-pagination-${target}-2026-11-02.json`);
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ok: true, manifestPath, planHash: manifest.planHash, before, after: AFTER }, null, 2));
} finally {
  await db.$disconnect();
}
