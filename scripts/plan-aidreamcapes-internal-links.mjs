// Build the reviewed field-level manifest that repoints Aidreamcapes content
// links at their canonical destination.
//
//   node --env-file=<production env> scripts/plan-aidreamcapes-internal-links.mjs \
//     --target=production --out=scripts/manifests/aidreamcapes-internal-links-production-2026-10-23.json
//
// The planner only reads LivePage rows for site_aidreamcapes. It never
// imports, restores or regenerates content, and it never writes to the
// database.

import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertDatabaseTarget } from "./lib/database-target.mjs";
import {
  HOME_DESCRIPTION_AFTER,
  HOME_DESCRIPTION_BEFORE,
  HOME_DESCRIPTION_PATHS,
  REDIRECTS,
  findRedirectTargets,
  hashValue,
  isLinkField,
  repointField,
} from "./lib/aidreamcapes-internal-links.mjs";

const target = argumentValue("--target") || "local";
assert(["local", "production"].includes(target));
assertDatabaseTarget({
  expectedTarget: target,
  requireProductionConfirmation: false,
  productionConfirmed: argumentValue("--confirm") === `aidreamcapes-internal-links-${target}`,
});
const outPath = path.resolve(
  argumentValue("--out") || `scripts/manifests/aidreamcapes-internal-links-${target}-${new Date().toISOString().slice(0, 10)}.json`,
);

const parts = (pointer) => pointer.slice(1).split("/").map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
const read = (content, pointer) => parts(pointer).reduce((value, key) => value?.[key], content);
const escapeToken = (value) => value.replaceAll("~", "~0").replaceAll("/", "~1");

const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
try {
  const rows = await db.livePage.findMany({
    where: { siteId: "site_aidreamcapes" },
    orderBy: { slug: "asc" },
    select: { id: true, slug: true, title: true, contentJson: true },
  });
  const operations = [];
  const unsupported = [];
  const untouched = [];

  for (const row of rows) {
    const home = row.slug === "/";
    const walk = (node, pointer) => {
      if (typeof node === "string") {
        if (home && HOME_DESCRIPTION_PATHS.has(pointer) && node === HOME_DESCRIPTION_BEFORE) {
          operations.push({
            pageId: row.id,
            pageSlug: row.slug,
            path: pointer,
            kind: "home-description",
            before: { exists: true, value: node },
            after: HOME_DESCRIPTION_AFTER,
            guards: [
              { pageId: row.id, path: pointer, hash: hashValue(node) },
              { pageId: row.id, path: "/seo/title", hash: hashValue(read(row.contentJson, "/seo/title")) },
            ],
          });
          return;
        }
        const targets = findRedirectTargets(node);
        const whole = REDIRECTS.find((entry) => entry.from === node);
        if (!targets.length && !whole) return;
        const after = repointField(node);
        if (after === node) return;
        if (!isLinkField(pointer)) {
          unsupported.push({
            pageId: row.id,
            pageSlug: row.slug,
            path: pointer,
            targets: whole ? [whole.from] : targets.map((t) => t.raw),
          });
          return;
        }
        operations.push({
          pageId: row.id,
          pageSlug: row.slug,
          path: pointer,
          kind: "link-target",
          before: { exists: true, value: node },
          after,
          guards: [{ pageId: row.id, path: pointer, hash: hashValue(node) }],
        });
        return;
      }
      if (Array.isArray(node)) {
        node.forEach((item, index) => walk(item, `${pointer}/${index}`));
        return;
      }
      if (node && typeof node === "object") {
        for (const [key, value] of Object.entries(node)) walk(value, `${pointer}/${escapeToken(key)}`);
      }
    };
    walk(row.contentJson, "");
  }

  // Structured link fields whose whole value is a redirecting path.
  for (const row of rows) {
    const walk = (node, pointer) => {
      if (typeof node === "string") {
        const rule = REDIRECTS.find((entry) => entry.from === node);
        if (rule && isLinkField(pointer)) {
          const after = rule.to;
          const known = operations.find((op) => op.pageId === row.id && op.path === pointer);
          if (!known) {
            operations.push({
              pageId: row.id,
              pageSlug: row.slug,
              path: pointer,
              kind: "link-target",
              before: { exists: true, value: node },
              after,
              guards: [{ pageId: row.id, path: pointer, hash: hashValue(node) }],
            });
          }
        }
        return;
      }
      if (Array.isArray(node)) return node.forEach((item, index) => walk(item, `${pointer}/${index}`));
      if (node && typeof node === "object") for (const [key, value] of Object.entries(node)) walk(value, `${pointer}/${escapeToken(key)}`);
    };
    walk(row.contentJson, "");
  }

  operations.sort((a, b) => (a.pageSlug === b.pageSlug ? a.path.localeCompare(b.path) : a.pageSlug.localeCompare(b.pageSlug)));
  const contract = "aidreamcapes-internal-links-v1";
  const planHash = hashValue({ contract, siteId: "site_aidreamcapes", target, operations });
  const manifest = {
    ok: true,
    mode: "plan",
    contract,
    siteId: "site_aidreamcapes",
    target,
    generatedAt: new Date().toISOString(),
    owner: "aidreamcapes-content-agent",
    rules: {
      redirects: REDIRECTS,
      allowedLinkFields: "href | primaryHref | sections/*/settings/data/sections/*/paras/* | sections/*/settings/data/benefits/*/d | sections/*/settings/data/more_sections/*/items/*/d | sections/*/settings/data/intro/* | sections/*/settings/data/llmsText | sections/*/settings/body",
      allowedDescriptionFields: [...HOME_DESCRIPTION_PATHS],
      note: "Only link destinations change. Copy, redirect configuration, navigation and media slugs are not part of this manifest.",
    },
    summary: {
      operations: operations.length,
      pages: new Set(operations.map((op) => op.pageId)).size,
      linkTargetOperations: operations.filter((op) => op.kind === "link-target").length,
      homeDescriptionOperations: operations.filter((op) => op.kind === "home-description").length,
      unsupportedFields: unsupported.length,
    },
    unsupported,
    operations,
    planHash,
  };
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ out: outPath, planHash, summary: manifest.summary, unsupported }, null, 2));
} finally {
  await db.$disconnect();
}
