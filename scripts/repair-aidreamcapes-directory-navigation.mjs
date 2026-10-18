#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertDatabaseTarget, assertNonProductionWriteTarget, hasArgument } from "./lib/database-target.mjs";
import { AIDREAMCAPES_DIRECTORY_NAV_ITEMS, withAidreamcapesDirectoryNavigation } from "./lib/aidreamcapes-directory-navigation.mjs";

const siteId = "site_aidreamcapes";
const target = argumentValue("--target") ?? "local";
const apply = hasArgument("--apply");
assert(["local", "production"].includes(target));
if (target === "production") {
  const confirmed = argumentValue("--confirm") === "site_aidreamcapes-production";
  assertDatabaseTarget({ expectedTarget: "production", requireProductionConfirmation: apply, productionConfirmed: confirmed });
  if (apply) assert(confirmed, "Use --confirm=site_aidreamcapes-production.");
} else {
  assertDatabaseTarget({ expectedTarget: "local" });
  if (apply) assertNonProductionWriteTarget();
}
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const withoutNavigation = (content) => { const value = structuredClone(content); delete value.siteNavigation; return value; };
const db = new PrismaClient();
try {
  const pages = await db.livePage.findMany({ where: { siteId, slug: { in: ["/", ...AIDREAMCAPES_DIRECTORY_NAV_ITEMS.map((item) => item.href)] } }, select: { id: true, slug: true, contentJson: true, updatedAt: true } });
  const home = pages.find((page) => page.slug === "/");
  assert(home, "Current relational homepage is required.");
  const images = {};
  for (const item of AIDREAMCAPES_DIRECTORY_NAV_ITEMS) {
    const page = pages.find((page) => page.slug === item.href);
    assert(page, `Current directory LivePage is missing: ${item.href}`);
    const image = page.contentJson?.seo?.ogImage;
    if (typeof image === "string" && image.startsWith("/assets/sites/site_aidreamcapes/")) images[item.href] = image;
  }
  const navigation = withAidreamcapesDirectoryNavigation(home.contentJson.siteNavigation, images);
  const changed = hash(navigation) !== hash(home.contentJson.siteNavigation);
  const contentJson = { ...home.contentJson, siteNavigation: navigation };
  assert.equal(hash(withoutNavigation(contentJson)), hash(withoutNavigation(home.contentJson)));
  const summary = { siteId, target, mode: apply ? "apply" : "dry-run", owner: "LivePage.contentJson.siteNavigation", id: home.id, baseUpdatedAt: home.updatedAt, changed, addedVideoLinks: AIDREAMCAPES_DIRECTORY_NAV_ITEMS.filter((item) => !home.contentJson.siteNavigation.menus.find((menu) => menu.label === "Video")?.groups.flatMap((group) => group.items).some((link) => link.href === item.href)).map((item) => item.href), beforeHash: hash(home.contentJson.siteNavigation), afterHash: hash(navigation), nonNavigationContentHash: hash(withoutNavigation(contentJson)) };
  if (apply && changed) {
    const result = await db.livePage.updateMany({ where: { id: home.id, siteId, updatedAt: home.updatedAt }, data: { contentJson } });
    assert.equal(result.count, 1, "Homepage changed concurrently; retry against current relational data.");
  }
  if (apply) {
    const row = await db.livePage.findUnique({ where: { siteId_slug: { siteId, slug: "/" } }, select: { contentJson: true, updatedAt: true } });
    assert.deepEqual(row.contentJson.siteNavigation, navigation);
    assert.equal(hash(withoutNavigation(row.contentJson)), summary.nonNavigationContentHash);
    summary.readback = "passed";
    summary.updatedAt = row.updatedAt;
  }
  console.log(JSON.stringify(summary));
} finally { await db.$disconnect(); }
