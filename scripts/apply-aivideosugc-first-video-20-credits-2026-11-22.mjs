#!/usr/bin/env node
// $1 starter offer: 20 credits instead of the per-video 8-credit discount
// (2026-11-22, approved by the site owner).
//
// The offer used to grant 8 credits and then discount the first 15s video to 8
// credits on one Wan channel. That channel was removed with the hidden models,
// so the discount could no longer apply while the copy still promised it. The
// offer is now a plain one-time starter pack: pay $1, receive 20 credits —
// exactly one 15s video at the normal price (20 credits).
//
// This manifest only rewrites the four values that still advertise the old
// mechanic; the video pricing code no longer carries a trial discount.
//
//   dry run:  node scripts/apply-aivideosugc-first-video-20-credits-2026-11-22.mjs --target=local
//   apply:    node scripts/apply-aivideosugc-first-video-20-credits-2026-11-22.mjs --target=local --apply
//   production additionally requires --confirm=aivideosugc-first-video-20-credits-2026-11-22
import assert from "node:assert/strict";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const CONFIRM_NAME = "aivideosugc-first-video-20-credits-2026-11-22";
const MANIFEST_PATH = new URL("./manifests/aivideosugc-first-video-20-credits-2026-11-22.json", import.meta.url);
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
const siteId = assertAllowedSite(manifest.siteId);
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const apply = hasArgument("--apply");
assertDatabaseTarget({ expectedTarget: target, requireProductionConfirmation: apply, productionConfirmed: hasArgument(`--confirm=${CONFIRM_NAME}`) });
assert.equal(manifest.confirmName, CONFIRM_NAME);

const prisma = new PrismaClient();

function getPath(root, path) {
  return path.split("/").reduce((node, key) => (node == null ? node : node[key]), root);
}

function setPath(root, path, value) {
  const keys = path.split("/");
  let node = root;
  for (const key of keys.slice(0, -1)) node = node[key];
  node[keys[keys.length - 1]] = value;
}

async function main() {
  // ---- price row: 8 -> 20 credits ----
  const price = await prisma.price.findFirst({
    where: { id: manifest.priceId, siteId },
    select: { id: true, creditsGranted: true, amountCents: true }
  });
  assert(price, `price ${manifest.priceId} not found`);
  console.log(`price ${price.id}: amountCents=${price.amountCents} creditsGranted=${price.creditsGranted}`);

  // ---- product summary ----
  const product = await prisma.product.findFirst({
    where: { id: manifest.productId, siteId },
    select: { id: true, metadata: true, updatedAt: true }
  });
  assert(product, `product ${manifest.productId} not found`);
  const productMetadata = (product.metadata ?? {});
  const productDone = productMetadata.summary === manifest.productSummary;
  console.log(`product summary: ${String(productMetadata.summary ?? "")}${productDone ? " (already updated)" : ""}`);

  // ---- live pages: promo copy ----
  const pageRows = [];
  for (const page of manifest.pages) {
    const row = await prisma.livePage.findFirst({
      where: { siteId, slug: page.slug },
      select: { id: true, contentJson: true, updatedAt: true }
    });
    assert(row, `page ${page.slug} not found`);
    const content = row.contentJson;
    const current = getPath(content, page.path);
    const done = current === page.after;
    console.log(`${page.slug} ${page.path}: ${String(current ?? "")}${done ? " (already updated)" : ""}`);
    if (!done) assert.equal(current, page.before, `${page.slug} ${page.path} no longer holds the expected old value`);
    pageRows.push({ page, row, content, done });
  }

  if (!apply) {
    console.log("dry run — nothing written. Re-run with --apply.");
    return;
  }

  // Price: value CAS (skip when a previous run already applied it).
  if (price.creditsGranted !== manifest.creditsGranted) {
    const priceUpdate = await prisma.price.updateMany({
      where: { id: manifest.priceId, siteId, creditsGranted: price.creditsGranted },
      data: { creditsGranted: manifest.creditsGranted }
    });
    assert.equal(priceUpdate.count, 1, "price changed concurrently; re-run the dry run");
  }

  // Product: metadata CAS on updatedAt (skip when already applied).
  if (!productDone) {
    const productUpdate = await prisma.product.updateMany({
      where: { id: product.id, siteId, updatedAt: product.updatedAt },
      data: { metadata: { ...productMetadata, summary: manifest.productSummary } }
    });
    assert.equal(productUpdate.count, 1, "product changed concurrently; re-run the dry run");
  }

  // Pages: nested JSON write with CAS on updatedAt (skip applied fields).
  for (const { page, row, content, done } of pageRows) {
    if (done) continue;
    setPath(content, page.path, page.after);
    const update = await prisma.livePage.updateMany({
      where: { id: row.id, siteId, updatedAt: row.updatedAt },
      data: { contentJson: content }
    });
    assert.equal(update.count, 1, `${page.slug} changed concurrently; re-run the dry run`);
  }

  // ---- readback ----
  const priceAfter = await prisma.price.findFirst({ where: { id: manifest.priceId }, select: { creditsGranted: true } });
  assert.equal(priceAfter?.creditsGranted, manifest.creditsGranted);
  const productAfter = await prisma.product.findFirst({ where: { id: product.id }, select: { metadata: true } });
  assert.equal((productAfter?.metadata ?? {}).summary, manifest.productSummary);
  for (const { page } of pageRows) {
    const after = await prisma.livePage.findFirst({ where: { siteId, slug: page.slug }, select: { contentJson: true } });
    assert.equal(getPath(after?.contentJson, page.path), page.after);
  }
  console.log(`applied: price.creditsGranted=${manifest.creditsGranted}, product summary, ${pageRows.length} page field(s)`);
  console.log("readback ok");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
