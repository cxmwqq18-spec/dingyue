#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import createJiti from "jiti";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

const apply = process.argv.includes("--apply") && !process.argv.includes("--dry-run");
const siteId = "site_dreamshoot";
const pageId = `${siteId}_partner_registration`;
const slug = "/partner-registration";
assertDatabaseTarget({ expectedTarget: "local" });

const sourceRoot = path.resolve("src");
const originalResolveFilename = Module._resolveFilename;
const originalLoad = Module._load;
Module._load = function load(request, ...args) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, ...args);
};
Module._resolveFilename = function resolveFilename(request, ...args) {
  if (request === "server-only") return path.join(sourceRoot, "lib/storefront-context/types.ts");
  let resolved = request.startsWith("@/") ? path.join(sourceRoot, request.slice(2)) : request;
  if (request.startsWith("@/") && fs.existsSync(`${resolved}.ts`)) resolved = `${resolved}.ts`;
  return originalResolveFilename.call(this, resolved, ...args);
};

const jiti = createJiti(import.meta.url);
const { dreamshootAiStudioTemplatesForSite } = jiti("../src/lib/theme/packages/dreamshoot-ai-studio/templates.ts");
const prisma = new PrismaClient();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function hasSameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

try {
  const [site, existingThemeBySlug, existingThemeById, existingLiveBySlug, existingLiveById] = await Promise.all([
    prisma.site.findUnique({
      where: { id: siteId },
      select: { id: true, slug: true, name: true, primaryDomain: true, branding: true }
    }),
    prisma.themePage.findUnique({ where: { siteId_slug: { siteId, slug } } }),
    prisma.themePage.findUnique({ where: { id: pageId } }),
    prisma.livePage.findUnique({ where: { siteId_slug: { siteId, slug } } }),
    prisma.livePage.findUnique({ where: { id: pageId } })
  ]);
  assert.ok(site, `${siteId} is required`);
  assert.ok(!existingThemeById || existingThemeById.slug === slug, `${pageId} is already owned by ${existingThemeById?.slug}`);
  assert.ok(!existingLiveById || existingLiveById.slug === slug, `${pageId} live row is already owned by ${existingLiveById?.slug}`);

  const siteSeed = {
    id: site.id,
    slug: site.slug,
    name: site.name,
    primaryDomain: site.primaryDomain,
    branding: site.branding && typeof site.branding === "object" && !Array.isArray(site.branding)
      ? { logoText: typeof site.branding.logoText === "string" ? site.branding.logoText : undefined }
      : undefined
  };
  const draftJson = clone(dreamshootAiStudioTemplatesForSite(siteSeed)["partner-registration"]);
  assert.equal(draftJson.pageType, "content");
  assert.equal(draftJson.seo?.canonicalPath, slug);
  assert.ok(Array.isArray(draftJson.sectionsOrder) && draftJson.sectionsOrder.length > 0, "Partner Registration template must contain public sections");

  const themeExists = Boolean(existingThemeBySlug);
  const liveExists = Boolean(existingLiveBySlug);
  const themeChanged = !themeExists || !hasSameJson(existingThemeBySlug?.draftJson, draftJson) || !hasSameJson(existingThemeBySlug?.publishedJson, draftJson);
  const liveChanged = !liveExists || !hasSameJson(existingLiveBySlug?.contentJson, draftJson);

  if (apply) {
    await prisma.$transaction(async (tx) => {
      await tx.themePage.upsert({
        where: { siteId_slug: { siteId, slug } },
        create: {
          id: pageId,
          siteId,
          pageType: "content",
          templateKey: "partner-registration",
          slug,
          title: "Partner Registration",
          draftJson,
          publishedJson: draftJson
        },
        update: {
          pageType: "content",
          templateKey: "partner-registration",
          title: "Partner Registration",
          draftJson,
          publishedJson: draftJson,
          updatedAt: new Date()
        }
      });
      await tx.livePage.upsert({
        where: { siteId_slug: { siteId, slug } },
        create: {
          id: pageId,
          siteId,
          pageType: "content",
          templateKey: "partner-registration",
          slug,
          title: "Partner Registration",
          contentJson: draftJson,
          createdAt: new Date()
        },
        update: {
          pageType: "content",
          templateKey: "partner-registration",
          title: "Partner Registration",
          contentJson: draftJson,
          updatedAt: new Date()
        }
      });
    });
  }

  console.log(JSON.stringify({
    ok: true,
    mode: apply ? (themeExists || liveExists ? "updated" : "created") : "dry-run",
    siteId,
    pageId,
    slug,
    themePage: themeExists ? (themeChanged ? "needs-update" : "unchanged") : "missing",
    livePage: liveExists ? (liveChanged ? "needs-update" : "unchanged") : "missing",
    sectionCount: draftJson.sectionsOrder.length
  }, null, 2));
} finally {
  await prisma.$disconnect();
  Module._resolveFilename = originalResolveFilename;
  Module._load = originalLoad;
}
