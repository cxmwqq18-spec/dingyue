#!/usr/bin/env node
import assert from "node:assert/strict";
import createJiti from "jiti";
import Module from "node:module";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";

loadRuntimeEnv({ cwd: process.cwd() });
if (!process.env.DATABASE_URL) loadRuntimeEnv({ cwd: path.resolve(process.cwd(), "../dingyue") });

const sourceRoot = path.resolve("src");
const originalLoad = Module._load;
const originalResolveFilename = Module._resolveFilename;
Module._load = function load(request, ...args) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, ...args);
};
Module._resolveFilename = function resolveFilename(request, ...args) {
  if (request === "server-only") return path.join(sourceRoot, "lib/storefront-context/types.ts");
  const resolved = request.startsWith("@/") ? path.join(sourceRoot, request.slice(2)) : request;
  if (request.startsWith("@/")) {
    for (const extension of [".ts", ".tsx", ".js", ".jsx"]) if (fs.existsSync(`${resolved}${extension}`)) return originalResolveFilename.call(this, `${resolved}${extension}`, ...args);
  }
  return originalResolveFilename.call(this, resolved, ...args);
};

const {
  MYDREAMSHOOTS_P1_CHILDREN_PRIVACY,
  MYDREAMSHOOTS_P1_CONTACT,
  MYDREAMSHOOTS_P1_GALLERY_H1,
  MYDREAMSHOOTS_P1_PHOTO_GUIDE_HEADINGS,
  MYDREAMSHOOTS_P1_PET_VIDEO_COPY,
  MYDREAMSHOOTS_P1_SEASONAL_DUPLICATE_TARGETS,
  MYDREAMSHOOTS_P1_STATE_PRIVACY
} = createJiti(import.meta.url)("../src/lib/mydreamshoots-seo-p1-manifest.ts");
const { getSeoDirectoryContentForSite } = createJiti(import.meta.url)("../src/lib/dreamshoot-seo-content.ts");

const site = { id: "site_dreamshoot", slug: "mydreamshoots", name: "myDreamshoots", primaryDomain: "www.mydreamshoots.com", branding: { logoText: "myDreamshoots" } };
const photoHeadingChecks = Object.entries(MYDREAMSHOOTS_P1_PHOTO_GUIDE_HEADINGS).map(([slug, headings]) => {
  const content = getSeoDirectoryContentForSite(site, "collection", slug);
  assert.deepEqual(content.h3.slice(2, 6), headings, `${slug}: Guide 03-06 headings`);
  assert.equal(content.details.length, 6, `${slug}: guide card count must remain six`);
  return slug;
});

const pagePaths = [
  ...Object.keys(MYDREAMSHOOTS_P1_SEASONAL_DUPLICATE_TARGETS),
  "/children-privacy", "/state-privacy", "/contact-us", "/cookies", "/best-ai-image", "/best-ai-video"
];
const prisma = new PrismaClient();
try {
  const [livePages, themePages] = await Promise.all([
    prisma.livePage.findMany({ where: { siteId: "site_dreamshoot", slug: { in: pagePaths } }, select: { slug: true, title: true, contentJson: true } }),
    prisma.themePage.findMany({ where: { siteId: "site_dreamshoot", slug: { in: pagePaths } }, select: { slug: true, title: true, draftJson: true, publishedJson: true } })
  ]);
  assert.equal(livePages.length, pagePaths.length, "all audited pages must have LivePage rows");
  const liveByPath = new Map(livePages.map((page) => [page.slug, page]));
  for (const [pagePath, target] of Object.entries(MYDREAMSHOOTS_P1_SEASONAL_DUPLICATE_TARGETS)) {
    const json = liveByPath.get(pagePath)?.contentJson;
    for (const sectionId of target.sectionIds) {
      for (const block of json?.sections?.[sectionId]?.blocks ?? []) {
        const title = String(block.settings?.title ?? "").trim();
        const text = String(block.settings?.text ?? "").trim();
        assert(!(title && title === text), `${pagePath} ${sectionId}: title-as-description duplicate remains`);
      }
    }
  }
  const christmas = liveByPath.get("/ai-save-the-date/christmas")?.contentJson;
  assert.equal(christmas?.sections?.christmas_quality?.blocks?.length, 1, "Christmas #quality keeps only the independent review card");
  assert.equal(christmas?.sections?.christmas_workflow?.blocks?.length, 7, "Christmas workflow cards remain intact");
  for (const item of ["Review people and objects", "Keep important text editable", "Prepare the final crop"]) {
    assert.equal(christmas.sections.christmas_workflow.blocks.filter((block) => block.settings?.title === item).length, 1, `Christmas workflow keeps ${item}`);
  }
  const children = liveByPath.get("/children-privacy");
  assert.equal(children.title, MYDREAMSHOOTS_P1_CHILDREN_PRIVACY.h1);
  assert.equal(children.contentJson.seo?.title, MYDREAMSHOOTS_P1_CHILDREN_PRIVACY.seoTitle);
  assert.equal(children.contentJson.sections?.intro_1?.settings?.title, MYDREAMSHOOTS_P1_CHILDREN_PRIVACY.h2);
  assert.equal(children.contentJson.sections?.intro_1?.settings?.body, MYDREAMSHOOTS_P1_CHILDREN_PRIVACY.intro);
  assert.equal(children.contentJson.sections?.policy_1?.settings?.title, MYDREAMSHOOTS_P1_CHILDREN_PRIVACY.h2);

  const state = liveByPath.get("/state-privacy")?.contentJson;
  assert.equal(state.sections?.intro_1?.settings?.body, MYDREAMSHOOTS_P1_STATE_PRIVACY.intro);
  assert.match(JSON.stringify(state), new RegExp(MYDREAMSHOOTS_P1_STATE_PRIVACY.address.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(JSON.stringify(state), /8 THE GREEN STE B,DOVER,DE 19901/);

  const contact = liveByPath.get("/contact-us")?.contentJson;
  assert.match(JSON.stringify(contact), new RegExp(MYDREAMSHOOTS_P1_CONTACT.address.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(JSON.stringify(contact), new RegExp(MYDREAMSHOOTS_P1_CONTACT.oldAddress.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  const cookies = liveByPath.get("/cookies")?.contentJson;
  assert.doesNotMatch(JSON.stringify(cookies), /\/policies\/(?:privacy|terms)/);
  assert.match(JSON.stringify(cookies), /\/privacy/);
  assert.match(JSON.stringify(cookies), /\/terms/);

  assert.equal(liveByPath.get("/best-ai-image")?.contentJson.sections?.best_ai_image_1?.settings?.title, MYDREAMSHOOTS_P1_GALLERY_H1.image);
  assert.equal(liveByPath.get("/best-ai-video")?.contentJson.sections?.best_ai_video_1?.settings?.title, MYDREAMSHOOTS_P1_GALLERY_H1.video);
  for (const page of ["/best-ai-image", "/best-ai-video"]) assert.equal(liveByPath.get(page)?.contentJson.seo?.title, page === "/best-ai-image" ? "Best AI image gallery | myDreamshoots" : "Best AI video gallery | myDreamshoots");

  assert.match(MYDREAMSHOOTS_P1_PET_VIDEO_COPY.owner, /owner-and-pet portrait/);
  assert.match(MYDREAMSHOOTS_P1_PET_VIDEO_COPY.pet, /clean pet portrait/);
  assert(!JSON.stringify(MYDREAMSHOOTS_P1_PET_VIDEO_COPY).includes("Additional approved reference"));
  console.log(JSON.stringify({ ok: true, siteId: "site_dreamshoot", photoPages: photoHeadingChecks.length, auditedPages: pagePaths.length, seasonalPages: Object.keys(MYDREAMSHOOTS_P1_SEASONAL_DUPLICATE_TARGETS).length }, null, 2));
} finally {
  await prisma.$disconnect();
}
