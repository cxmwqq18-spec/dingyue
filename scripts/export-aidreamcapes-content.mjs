#!/usr/bin/env node
// Export the current relational content of one storefront site.
//
// The dump is the source payload for
// `scripts/sync-aidreamcapes-content.mjs`: it lets a local development
// database follow the live source of truth without a remote database tunnel
// and without any publication or snapshot.
//
// Usage:
//   node --env-file=.env scripts/export-aidreamcapes-content.mjs --target=production --out=/tmp/aidreamcapes-content.json
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget } from "./lib/database-target.mjs";

const siteId = assertAllowedSite(argumentValue("--site-id") || "site_aidreamcapes");
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const outPath = path.resolve(argumentValue("--out") || `/tmp/${siteId}-content-${target}.json`);
assertDatabaseTarget({ expectedTarget: target });

const prisma = new PrismaClient({ errorFormat: "minimal" });
try {
  const rows = await prisma.livePage.findMany({
    where: { siteId },
    orderBy: { slug: "asc" },
    select: { id: true, slug: true, title: true, pageType: true, templateKey: true, contentJson: true, updatedAt: true }
  });
  assert(rows.length > 0, `No LivePage rows for ${siteId}.`);
  const pages = {};
  for (const row of rows) {
    pages[row.slug] = {
      id: row.id,
      title: row.title,
      pageType: row.pageType,
      templateKey: row.templateKey,
      updatedAt: row.updatedAt,
      contentJson: row.contentJson
    };
  }
  const dump = {
    siteId,
    target,
    exportedAt: new Date().toISOString(),
    pageCount: rows.length,
    pages
  };
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(dump, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    ok: true,
    siteId,
    target,
    outPath,
    pageCount: rows.length,
    bytes: fs.statSync(outPath).size,
    contentHash: crypto.createHash("sha256").update(JSON.stringify(pages)).digest("hex").slice(0, 16)
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
