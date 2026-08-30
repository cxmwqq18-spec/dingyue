#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import createJiti from "jiti";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

const databaseUrl = process.env.DATABASE_URL?.trim();
assert(databaseUrl, "DATABASE_URL is required");
const parsedDatabaseUrl = new URL(databaseUrl);
assertDatabaseTarget({ expectedTarget: "local" });
assert(["localhost", "127.0.0.1", "::1"].includes(parsedDatabaseUrl.hostname), `refusing non-local database host: ${parsedDatabaseUrl.hostname}`);
assert(parsedDatabaseUrl.port === "15433", `logo wall sync must use local port 15433 (received ${parsedDatabaseUrl.port})`);

const repoRoot = process.cwd();
const sourceRoot = path.join(repoRoot, "src");
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveFilename(request, ...args) {
  if (request === "server-only") return path.join(sourceRoot, "lib/storefront-context/types.ts");
  const resolved = request.startsWith("@/") ? path.join(sourceRoot, request.slice(2)) : request;
  return originalResolveFilename.call(this, resolved, ...args);
};

const jiti = createJiti(import.meta.url);
const { dreamshootAiStudioTemplatesForSite } = jiti("../src/lib/theme/packages/dreamshoot-ai-studio/templates.ts");

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

const prisma = new PrismaClient();
try {
  const site = await prisma.site.findUnique({
    where: { id: "site_dreamshoot" },
    include: { pages: true }
  });
  assert(site, "site_dreamshoot must exist");
  const page = site.pages.find((entry) => entry.slug === "/");
  assert(page, "MyDreamShoots homepage must exist");
  const templateHome = dreamshootAiStudioTemplatesForSite({
    id: site.id,
    slug: site.slug,
    name: site.name,
    primaryDomain: site.primaryDomain,
    branding: site.branding
  }).home;
  const templateGeneration = templateHome.sections?.generation_showcase_1;
  assert(templateGeneration, "homepage template must provide generation_showcase_1");

  const currentJson = clone(page.publishedJson ?? page.draftJson);
  assert(currentJson?.sections?.generation_showcase_1, "homepage generation showcase must exist");
  const nextJson = clone(currentJson);
  nextJson.sections.generation_showcase_1 = {
    ...nextJson.sections.generation_showcase_1,
    ...clone(templateGeneration),
    settings: {
      ...nextJson.sections.generation_showcase_1.settings,
      ...clone(templateGeneration.settings),
      showTrustedLogoIntro: true,
      trustedLogoEyebrow: "CREATIVE SHOWCASE",
      trustedLogoTitle: "Made with MyDreamShoots",
      trustedLogoSubtitle: "Ideas, brands and visual experiments brought together with AI.",
      trustedLogoSplitIndex: 15
    },
    blocks: clone(templateGeneration.blocks)
  };

  const backupDir = path.join(repoRoot, "releases", "backups");
  fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  const backupPath = path.join(backupDir, `mydreamshoots-logo-wall-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(backupPath, `${JSON.stringify({ createdAt: new Date().toISOString(), siteId: site.id, pageId: page.id, generationShowcase: currentJson.sections.generation_showcase_1 }, null, 2)}\n`, { mode: 0o600 });

  await prisma.themePage.update({
    where: { id: page.id },
    data: { draftJson: nextJson, publishedJson: nextJson, updatedAt: new Date() }
  });
  console.log(JSON.stringify({
    ok: true,
    siteId: site.id,
    pageId: page.id,
    trustedLogoBlocks: nextJson.sections.generation_showcase_1.blocks.length,
    trustedLogoSplitIndex: nextJson.sections.generation_showcase_1.settings.trustedLogoSplitIndex,
    backupPath
  }, null, 2));
} finally {
  await prisma.$disconnect();
  Module._resolveFilename = originalResolveFilename;
}
