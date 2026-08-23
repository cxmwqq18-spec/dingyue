#!/usr/bin/env node
import "./load-runtime-env.mjs";
import fs from "node:fs";
import path from "node:path";
import Module from "node:module";
import createJiti from "jiti";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

assertDatabaseTarget({ expectedTarget: "local" });
const apply = process.argv.includes("--apply") && !process.argv.includes("--dry-run");
const siteId = "site_dreamshoot";
const slug = "/ai-video-generation/motion-generator";
const pageId = `${siteId}_video_motion_generator`;
const categoryId = `video_cat_${siteId}_motion_generator`;
const sourceRoot = path.join(process.cwd(), "src");
const originalResolveFilename = Module._resolveFilename;
const originalLoad = Module._load;
Module._load = function load(request, ...args) { if (request === "server-only") return {}; return originalLoad.call(this, request, ...args); };
Module._resolveFilename = function resolveFilename(request, ...args) {
  if (request === "server-only") return path.join(sourceRoot, "lib/storefront-context/types.ts");
  const aliased = request.startsWith("@/") ? path.join(sourceRoot, request.slice(2)) : request;
  if (request.startsWith("@/")) {
    if (fs.existsSync(`${aliased}.ts`)) return originalResolveFilename.call(this, `${aliased}.ts`, ...args);
    if (fs.existsSync(`${aliased}.json`)) return originalResolveFilename.call(this, `${aliased}.json`, ...args);
  }
  return originalResolveFilename.call(this, aliased, ...args);
};
const jiti = createJiti(import.meta.url);
const { aiVideoTopicLandingContentByKey } = jiti("./seed-mydreamshoots-ai-video-topic-content.ts");
const content = aiVideoTopicLandingContentByKey["motion-generator"];
if (!content) throw new Error("motion_generator_content_seed_missing");
const pageJson = {
  pageType: "ai_tool",
  version: 1,
  sectionsOrder: ["ai_video_topic_landing_1"],
  sections: { ai_video_topic_landing_1: { type: "ai_video_topic_landing", settings: { anchor: "motion-generator", contentKey: "motion-generator", content }, blocks: [] } },
  seo: { ...content.seo, canonical: slug, canonicalPath: slug, index: true, follow: true, robots: { index: true, follow: true } }
};
const prisma = new PrismaClient();
try {
  const existingPage = await prisma.themePage.findUnique({ where: { siteId_slug: { siteId, slug } } });
  const existingCategory = await prisma.videoThemeCategory.findUnique({ where: { siteId_slug: { siteId, slug: "motion-generator" } } });
  const result = { ok: true, mode: apply ? "applied" : "dry-run", siteId, slug, page: existingPage ? "update" : "create", category: existingCategory ? "update" : "create" };
  if (apply) {
    const backupDir = path.join(process.cwd(), "releases", "backups");
    fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
    const backupPath = path.join(backupDir, `mydreamshoots-motion-page-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    fs.writeFileSync(backupPath, `${JSON.stringify({ page: existingPage, category: existingCategory }, null, 2)}\n`, { mode: 0o600 });
    await prisma.$transaction(async (tx) => {
      await tx.videoThemeCategory.upsert({ where: { siteId_slug: { siteId, slug: "motion-generator" } }, create: { id: categoryId, siteId, slug: "motion-generator", label: "Motion Generator", description: "Animate an approved still image into a short, controlled motion concept.", sortOrder: 40, status: "active" }, update: { label: "Motion Generator", description: "Animate an approved still image into a short, controlled motion concept.", sortOrder: 40, status: "active", updatedAt: new Date() } });
      await tx.themePage.upsert({ where: { siteId_slug: { siteId, slug } }, create: { id: pageId, siteId, pageType: "ai_tool", templateKey: "ai-video-topic-motion-generator", slug, title: "Motion Generator", draftJson: pageJson, publishedJson: pageJson, createdAt: new Date() }, update: { pageType: "ai_tool", templateKey: "ai-video-topic-motion-generator", title: "Motion Generator", draftJson: pageJson, publishedJson: pageJson, updatedAt: new Date() } });
    });
    result.backupPath = backupPath;
  }
  console.log(JSON.stringify(result, null, 2));
} finally { await prisma.$disconnect(); Module._resolveFilename = originalResolveFilename; Module._load = originalLoad; }
