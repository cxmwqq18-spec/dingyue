#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";

const SITE_ID = "site_aidreamcapes";
const CONFIRMATION = "aidreamcapes-media-repair-production";
const payloadPath = path.resolve(process.argv.find((arg) => arg.startsWith("--payload="))?.slice("--payload=".length) || "");
const backupPath = path.resolve(process.argv.find((arg) => arg.startsWith("--backup="))?.slice("--backup=".length) || "");
const apply = process.argv.includes("--apply");
const confirmation = process.argv.find((arg) => arg.startsWith("--confirm="))?.slice("--confirm=".length) || "";

if (!payloadPath || !fs.existsSync(payloadPath)) throw new Error("A payload file is required.");
if (!backupPath) throw new Error("A backup path is required.");
if (!apply || confirmation !== CONFIRMATION) throw new Error(`Applying requires --apply --confirm=${CONFIRMATION}.`);

const payload = JSON.parse(fs.readFileSync(payloadPath, "utf8"));
if (payload.siteId !== SITE_ID || !Array.isArray(payload.pages) || !payload.pages.length) throw new Error("Invalid Aidreamcapes media payload.");

function stable(value) {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}
function hash(value) { return crypto.createHash("sha256").update(stable(value)).digest("hex"); }
function pageSnapshot(rows) {
  return rows.map((row) => ({ id: row.id, siteId: row.siteId, slug: row.slug, title: row.title, contentJson: row.contentJson, updatedAt: row.updatedAt }));
}

const protectedSql = ["Customer", "CustomerSession", "Subscription", "Order", "PaymentEvent", "CreditBalance", "CreditLedger", "GenerationJob", "CustomerModel", "AssetUpload", "Album"]
  .map((table) => `SELECT '${table}' AS model, count(*)::text AS count, md5(coalesce(string_agg("id"::text, ',' ORDER BY "id"::text),'')) AS hash FROM "${table}" WHERE "siteId" = '${SITE_ID}'`)
  .join(" UNION ALL ");

async function protectedFingerprint(tx) { return tx.$queryRawUnsafe(protectedSql); }

const prisma = new PrismaClient();
try {
  const slugs = payload.pages.map((page) => page.slug);
  const site = await prisma.site.findUnique({ where: { id: SITE_ID }, select: { id: true, slug: true, primaryDomain: true, status: true } });
  if (!site || site.primaryDomain.toLowerCase() !== "www.aidreamcapes.com") throw new Error("Production Aidreamcapes site identity failed.");

  const before = await prisma.livePage.findMany({ where: { siteId: SITE_ID, slug: { in: slugs } }, orderBy: { slug: "asc" } });
  const missing = payload.pages.filter((page) => !before.some((row) => row.slug === page.slug));
  const collisions = await prisma.livePage.findMany({ where: { id: { in: missing.map((page) => page.id) } }, select: { id: true, siteId: true, slug: true } });
  if (collisions.length) throw new Error(`New page ID collision: ${JSON.stringify(collisions)}`);
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.writeFileSync(backupPath, `${JSON.stringify({ createdAt: new Date().toISOString(), site, pages: before, missingSlugs: missing.map((page) => page.slug) }, null, 2)}\n`);
  const expectedHash = hash(pageSnapshot(before));
  const payloadBySlug = new Map(payload.pages.map((page) => [page.slug, page]));

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Site" WHERE "id" = ${SITE_ID} FOR UPDATE`;
    const current = await tx.livePage.findMany({ where: { siteId: SITE_ID, slug: { in: slugs } }, orderBy: { slug: "asc" } });
    if (hash(pageSnapshot(current)) !== expectedHash) throw new Error("Online LivePage snapshot changed before the production lock.");
    const protectedBefore = await protectedFingerprint(tx);
    let updated = 0;
    let created = 0;
    for (const page of payload.pages) {
      const existing = current.find((row) => row.slug === page.slug);
      if (existing) {
        if (hash(existing.contentJson) === hash(page.contentJson)) continue;
        await tx.livePage.update({ where: { id: existing.id }, data: { contentJson: page.contentJson } });
        updated += 1;
      } else {
        await tx.livePage.create({ data: { id: page.id, siteId: SITE_ID, pageType: page.pageType, templateKey: page.templateKey, slug: page.slug, title: page.title, contentJson: page.contentJson } });
        created += 1;
      }
    }
    const protectedAfter = await protectedFingerprint(tx);
    if (hash(protectedBefore) !== hash(protectedAfter)) throw new Error("Protected business data changed during the media repair.");
    return { updated, created, protectedBefore, protectedAfter };
  }, { timeout: 600000, maxWait: 20000 });

  const readback = await prisma.livePage.findMany({ where: { siteId: SITE_ID, slug: { in: slugs } }, select: { slug: true, contentJson: true } });
  const readbackBySlug = new Map(readback.map((row) => [row.slug, row]));
  for (const page of payload.pages) if (hash(readbackBySlug.get(page.slug)?.contentJson) !== hash(page.contentJson)) throw new Error(`Readback hash failed: ${page.slug}`);
  console.log(JSON.stringify({ ok: true, siteId: SITE_ID, pages: payload.pages.length, productionPagesBefore: before.length, ...result, protectedDataUnchanged: hash(result.protectedBefore) === hash(result.protectedAfter), backupPath }, null, 2));
} finally {
  await prisma.$disconnect();
}
