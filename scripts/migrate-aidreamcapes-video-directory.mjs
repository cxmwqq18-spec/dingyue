#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { validateAidreamcapesVideoDirectoryContent } from "./lib/aidreamcapes-video-directory-content.mjs";
import { argumentValue, assertDatabaseTarget, assertNonProductionWriteTarget, hasArgument } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes";
const PAGE_ID = "aidreamcapes_mirror_page_04ef54dc4085da57";
const PAGE_SLUG = "/ai-video-generation";
const apply = hasArgument("--apply-local");
const requestedSiteId = argumentValue("--site-id") ?? SITE_ID;
const requestedPageId = argumentValue("--page-id") ?? PAGE_ID;
const confirmation = argumentValue("--confirm") ?? "";
const backupRoot = argumentValue("--backup-dir") ?? path.resolve("releases/backups/aidreamcapes");

assert.equal(requestedSiteId, SITE_ID, `This migration is restricted to ${SITE_ID}.`);
assert.equal(requestedPageId, PAGE_ID, `This migration requires the exact page ID ${PAGE_ID}.`);
assertDatabaseTarget({ expectedTarget: "local" });
const copy = validateAidreamcapesVideoDirectoryContent();

function hashJson(value) {
  const stable = (current) => {
    if (Array.isArray(current)) return current.map(stable);
    if (current && typeof current === "object") return Object.fromEntries(Object.keys(current).sort().map((key) => [key, stable(current[key])]));
    return current;
  };
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

function pageContent() {
  return {
    version: 1,
    pageType: "ai_tool_directory",
    seo: copy.seo,
    sections: {
      video_theme_directory_1: {
        type: "dreamshoot_tool_collection",
        blocks: [],
        settings: {
          anchor: "video-themes",
          layout: "aidreamcapes_video_directory",
          title: copy.title,
          subtitle: copy.subtitle,
          headingLevel: "h1",
          directoryCopy: copy
        }
      }
    },
    sectionsOrder: ["video_theme_directory_1"],
    mediaManifest: [],
    contentContract: {
      schema: "video-directory-v1",
      siteId: SITE_ID,
      source: "LivePage.contentJson",
      navSource: "ThemeSettings.publishedJson.aidreamcapesZipNavigation.video",
      expectedGroups: 4,
      expectedThemeCount: 35
    }
  };
}

const prisma = new PrismaClient();
try {
  const [site, page] = await Promise.all([
    prisma.site.findUnique({ where: { id: SITE_ID }, select: { id: true, slug: true, primaryDomain: true } }),
    prisma.livePage.findUnique({ where: { id: PAGE_ID }, select: { id: true, siteId: true, slug: true, title: true, pageType: true, templateKey: true, contentJson: true, updatedAt: true } })
  ]);
  assert(site, `${SITE_ID}: site not found`);
  assert.equal(site.id, SITE_ID);
  assert(page, `${PAGE_ID}: page not found`);
  assert.equal(page.siteId, SITE_ID, `${PAGE_ID}: page belongs to another site`);
  assert.equal(page.slug, PAGE_SLUG, `${PAGE_ID}: page slug is not ${PAGE_SLUG}`);

  const nextContent = pageContent();
  const report = {
    siteId: SITE_ID,
    pageId: PAGE_ID,
    slug: PAGE_SLUG,
    oldHash: hashJson(page.contentJson),
    newHash: hashJson(nextContent),
    sections: nextContent.sectionsOrder.length,
    media: nextContent.mediaManifest.length,
    navigationSource: nextContent.contentContract.navSource
  };

  if (!apply) {
    console.log(JSON.stringify({ ok: true, mode: "dry-run", page: report, applyCommand: `node scripts/migrate-aidreamcapes-video-directory.mjs --apply-local --site-id=${SITE_ID} --confirm=${SITE_ID} --page-id=${PAGE_ID}` }, null, 2));
  } else {
    assert.equal(confirmation, SITE_ID, `Applying requires --confirm=${SITE_ID}.`);
    assertNonProductionWriteTarget();
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
    const backupPath = path.resolve(backupRoot, `video-directory-${stamp}.json`);
    await mkdir(path.dirname(backupPath), { recursive: true });
    await writeFile(backupPath, `${JSON.stringify({ site, page }, null, 2)}\n`, "utf8");
    await prisma.livePage.update({
      where: { id: PAGE_ID },
      data: {
        pageType: "ai_tool_directory",
        templateKey: "aidreamcapes-video-directory",
        title: copy.seo.title,
        contentJson: nextContent
      }
    });
    const readback = await prisma.livePage.findUnique({ where: { id: PAGE_ID }, select: { id: true, siteId: true, slug: true, contentJson: true } });
    assert(readback, `${PAGE_ID}: readback returned no page`);
    assert.equal(readback.siteId, SITE_ID);
    assert.equal(readback.slug, PAGE_SLUG);
    assert.equal(hashJson(readback.contentJson), report.newHash, `${PAGE_ID}: content hash readback`);
    console.log(JSON.stringify({ ok: true, mode: "applied", backupPath, page: { ...report, readback: "PASS" } }, null, 2));
  }
} finally {
  await prisma.$disconnect();
}
