#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertDatabaseTarget, assertNonProductionWriteTarget, hasArgument } from "./lib/database-target.mjs";
import { AIDREAMCAPES_SOCIAL_LINKS } from "./lib/aidreamcapes-social-links.mjs";

const SITE_ID = "site_aidreamcapes";
const PAGE_ID = "site_aidreamcapes_home";
const PAGE_PATH = "/";
const CONFIRMATION = "site_aidreamcapes-live-footer-social-links";
const args = new Set(process.argv.slice(2));
const target = argumentValue("--target") ?? "local";
const apply = hasArgument("--apply");

assert(["local", "production"].includes(target), `Unsupported target: ${target}`);
if (target === "production") {
  const confirmed = argumentValue("--confirm") === CONFIRMATION;
  assertDatabaseTarget({ expectedTarget: "production", requireProductionConfirmation: apply, productionConfirmed: confirmed });
  if (apply) assert(confirmed, `Use --confirm=${CONFIRMATION}.`);
} else {
  assertDatabaseTarget({ expectedTarget: "local" });
  if (apply) assertNonProductionWriteTarget();
}

for (const link of AIDREAMCAPES_SOCIAL_LINKS) {
  const url = new URL(link.href);
  assert.equal(url.protocol, "https:", `${link.label} must use HTTPS.`);
  assert.equal(url.username, "", `${link.label} must not contain URL credentials.`);
  assert.equal(url.password, "", `${link.label} must not contain URL credentials.`);
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hash(value) {
  return createHash("sha256").update(stable(value)).digest("hex");
}

function withoutSocialLinks(contentJson) {
  const copy = structuredClone(contentJson);
  if (copy.siteNavigation?.footer) delete copy.siteNavigation.footer.socialLinks;
  return copy;
}

const db = new PrismaClient();
try {
  const page = await db.livePage.findUnique({
    where: { id: PAGE_ID },
    select: { id: true, siteId: true, slug: true, updatedAt: true, contentJson: true }
  });
  assert(page && page.siteId === SITE_ID && page.slug === PAGE_PATH, "Aidreamcapes homepage LivePage was not found.");
  const currentLinks = page.contentJson?.siteNavigation?.footer?.socialLinks;
  if (Array.isArray(currentLinks) && currentLinks.length > 0) {
    assert.deepEqual(currentLinks, AIDREAMCAPES_SOCIAL_LINKS, "Existing homepage social links differ from the reviewed values; refusing to overwrite them.");
  }

  const nextContent = structuredClone(page.contentJson);
  nextContent.siteNavigation.footer.socialLinks = AIDREAMCAPES_SOCIAL_LINKS.map((link) => ({ ...link }));
  const nonTargetHash = hash(withoutSocialLinks(page.contentJson));
  assert.equal(hash(withoutSocialLinks(nextContent)), nonTargetHash, "Only siteNavigation.footer.socialLinks may change.");
  const plan = {
    target,
    siteId: SITE_ID,
    owner: `LivePage:${PAGE_ID}`,
    publicPath: PAGE_PATH,
    targetField: "contentJson.siteNavigation.footer.socialLinks",
    existingLinkCount: Array.isArray(currentLinks) ? currentLinks.length : 0,
    nextLinkCount: AIDREAMCAPES_SOCIAL_LINKS.length,
    links: AIDREAMCAPES_SOCIAL_LINKS,
    baseUpdatedAt: page.updatedAt,
    nonTargetContentHash: nonTargetHash,
    mode: apply ? "apply" : "plan-only"
  };
  console.log(JSON.stringify(plan, null, 2));

  if (apply && !(Array.isArray(currentLinks) && currentLinks.length > 0)) {
    const result = await db.livePage.updateMany({
      where: { id: PAGE_ID, siteId: SITE_ID, slug: PAGE_PATH, updatedAt: page.updatedAt },
      data: { contentJson: nextContent }
    });
    assert.equal(result.count, 1, "Homepage LivePage changed concurrently; no update was applied.");
  }
  if (apply) {
    const readback = await db.livePage.findUnique({
      where: { id: PAGE_ID },
      select: { id: true, siteId: true, slug: true, updatedAt: true, contentJson: true }
    });
    assert.deepEqual(readback.contentJson?.siteNavigation?.footer?.socialLinks, AIDREAMCAPES_SOCIAL_LINKS, "Homepage social link readback failed.");
    assert.equal(hash(withoutSocialLinks(readback.contentJson)), nonTargetHash, "A non-target homepage field changed.");
    console.log(JSON.stringify({ result: "applied-and-read-back", siteId: readback.siteId, livePageId: readback.id, publicPath: readback.slug, updatedAt: readback.updatedAt, linkCount: AIDREAMCAPES_SOCIAL_LINKS.length, nonTargetContentUnchanged: true }, null, 2));
  }
} finally {
  await db.$disconnect();
}
