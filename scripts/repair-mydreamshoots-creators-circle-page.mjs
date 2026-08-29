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
const pageId = `${siteId}_creators_circle`;
const slug = "/creators-circle";
assertDatabaseTarget({ expectedTarget: "local" });

const sourceRoot = path.resolve("src");
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveFilename(request, ...args) {
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

try {
  const [site, existingBySlug, existingById] = await Promise.all([
    prisma.site.findUnique({
      where: { id: siteId },
      select: { id: true, slug: true, name: true, primaryDomain: true, branding: true }
    }),
    prisma.themePage.findUnique({ where: { siteId_slug: { siteId, slug } } }),
    prisma.themePage.findUnique({ where: { id: pageId } })
  ]);
  assert.ok(site, `${siteId} is required`);
  assert.ok(!existingById || existingById.slug === slug, `${pageId} is already owned by ${existingById?.slug}`);

  const siteSeed = {
    id: site.id,
    slug: site.slug,
    name: site.name,
    primaryDomain: site.primaryDomain,
    branding: site.branding && typeof site.branding === "object" && !Array.isArray(site.branding)
      ? { logoText: typeof site.branding.logoText === "string" ? site.branding.logoText : undefined }
      : undefined
  };
  const draftJson = clone(dreamshootAiStudioTemplatesForSite(siteSeed)["creators-circle"]);
  assert.equal(draftJson.pageType, "content");
  assert.equal(draftJson.seo?.canonicalPath, slug);
  assert.ok(Array.isArray(draftJson.sectionsOrder) && draftJson.sectionsOrder.length > 0, "Creators Circle template must contain public sections");

  if (existingBySlug) {
    console.log(JSON.stringify({ ok: true, mode: "unchanged", siteId, pageId: existingBySlug.id, slug }, null, 2));
  } else {
    if (apply) {
      await prisma.themePage.create({
        data: {
          id: pageId,
          siteId,
          pageType: "content",
          templateKey: "creators-circle",
          slug,
          title: "Creators Circle",
          draftJson,
          publishedJson: draftJson
        }
      });
    }
    console.log(JSON.stringify({
      ok: true,
      mode: apply ? "created" : "dry-run",
      siteId,
      pageId,
      slug,
      sectionCount: draftJson.sectionsOrder.length
    }, null, 2));
  }
} finally {
  await prisma.$disconnect();
  Module._resolveFilename = originalResolveFilename;
}
