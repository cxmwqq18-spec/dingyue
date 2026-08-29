#!/usr/bin/env node
import createJiti from "jiti";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget } from "./lib/database-target.mjs";
import "./load-runtime-env.mjs";

const siteId = "site_dreamshoot";
const dryRun = process.argv.includes("--dry-run");
const rewritePrompts = process.argv.includes("--rewrite-prompts");
const expectedTarget = String(process.env.DATABASE_TARGET || "local").trim().toLowerCase() === "remote-readonly"
  ? "remote-readonly"
  : "local";
assertDatabaseTarget({ expectedTarget });

const jiti = createJiti(import.meta.url);
const {
  mydreamshootsVideoGenerationCategoriesForSite,
  mydreamshootsVideoGenerationParentCategoriesForSite,
  mydreamshootsVideoGenerationThemeSeedsForSite,
  parentVideoGenerationCategorySlugForChild
} = jiti("../src/lib/mydreamshoots-video-framework.ts");
const { providerReadyVideoThemePrompt, validateVideoPrompt } = jiti("../src/lib/video-prompt-format.ts");
const prisma = new PrismaClient();
const categories = mydreamshootsVideoGenerationCategoriesForSite(siteId);
const parents = mydreamshootsVideoGenerationParentCategoriesForSite(siteId);
const themes = mydreamshootsVideoGenerationThemeSeedsForSite(siteId);

function stableId(prefix, slug) {
  return `${prefix}_${siteId}_${slug.replaceAll("-", "_")}`;
}

function promptNeedsUpgrade(prompt) {
  return !validateVideoPrompt(String(prompt ?? "")).valid || !/15\s*seconds?/i.test(String(prompt ?? ""));
}

function upgradePrompt(prompt, fallbackDirection, topicSlug, force = false) {
  const current = String(prompt ?? "").trim();
  const currentValidation = validateVideoPrompt(current);
  if (!force && currentValidation.valid) {
    const upgraded = current.replace(
      /(Duration\s*\/\s*Aspect Ratio\s*\/\s*Resolution:\s*)[^\n]+/i,
      (_match, prefix) => `${prefix}15 seconds, 16:9 aspect ratio, 720p resolution; preserve the user's selected output settings when they differ.`
    );
    if (validateVideoPrompt(upgraded).valid && /15\s*seconds?/i.test(upgraded)) return upgraded;
  }
  const direction = force
    ? fallbackDirection
    : (current && current.length <= 1800 ? current : fallbackDirection);
  return providerReadyVideoThemePrompt(direction || "An adult subject completes one clear action in a grounded environment and holds on a deliberate final frame.", topicSlug);
}

const report = { categoriesCreated: 0, categoriesUpdated: 0, themesCreated: 0, themesUpdated: 0, promptsRewritten: 0, examplesCreated: 0, examplesUpdated: 0 };

try {
  const categoryIdBySlug = new Map();
  for (const parent of parents) {
    const existing = await prisma.videoThemeCategory.findUnique({ where: { siteId_slug: { siteId, slug: parent.slug } } });
    if (!dryRun) {
      const row = await prisma.videoThemeCategory.upsert({
        where: { siteId_slug: { siteId, slug: parent.slug } },
        create: { id: stableId("video_cat", parent.slug), siteId, ...parent, status: "active", parentId: null },
        update: { label: parent.label, description: parent.description, sortOrder: parent.sortOrder, status: "active", parentId: null }
      });
      categoryIdBySlug.set(parent.slug, row.id);
    } else {
      categoryIdBySlug.set(parent.slug, existing?.id ?? stableId("video_cat", parent.slug));
    }
    report[existing ? "categoriesUpdated" : "categoriesCreated"] += 1;
  }

  for (const category of categories) {
    const parentSlug = parentVideoGenerationCategorySlugForChild(category.slug);
    const parentId = parentSlug ? categoryIdBySlug.get(parentSlug) ?? null : null;
    const existing = await prisma.videoThemeCategory.findUnique({ where: { siteId_slug: { siteId, slug: category.slug } } });
    if (!dryRun) {
      const row = await prisma.videoThemeCategory.upsert({
        where: { siteId_slug: { siteId, slug: category.slug } },
        create: { id: stableId("video_cat", category.slug), siteId, ...category, status: "active", parentId },
        update: { label: category.label, description: category.description, sortOrder: category.sortOrder, status: "active", parentId }
      });
      categoryIdBySlug.set(category.slug, row.id);
    } else {
      categoryIdBySlug.set(category.slug, existing?.id ?? stableId("video_cat", category.slug));
    }
    report[existing ? "categoriesUpdated" : "categoriesCreated"] += 1;
  }

  for (const seed of themes) {
    const existing = await prisma.videoTheme.findUnique({ where: { siteId_slug: { siteId, slug: seed.slug } } });
    const updatePrompt = rewritePrompts || !existing || promptNeedsUpgrade(existing.prompt);
    const imageUrl = existing?.imageUrl || seed.imageUrl || null;
    let themeId = existing?.id ?? stableId("video_theme", seed.slug);
    if (!dryRun) {
      const row = await prisma.videoTheme.upsert({
        where: { siteId_slug: { siteId, slug: seed.slug } },
        create: {
          id: themeId,
          siteId,
          categoryId: categoryIdBySlug.get(seed.categorySlug) ?? null,
          slug: seed.slug,
          name: seed.name,
          headline: seed.headline,
          description: seed.description,
          prompt: seed.prompt,
          status: "active",
          creditCost: seed.creditCost,
          durationSeconds: 15,
          maxFrames: seed.maxFrames,
          sortOrder: seed.sortOrder,
          imageUrl: seed.imageUrl || null,
          galleryImages: seed.imageUrl ? [seed.imageUrl] : []
        },
        update: {
          categoryId: categoryIdBySlug.get(seed.categorySlug) ?? null,
          ...(updatePrompt ? { prompt: seed.prompt, durationSeconds: 15 } : {}),
          ...(!existing?.imageUrl && seed.imageUrl ? { imageUrl: seed.imageUrl, galleryImages: [seed.imageUrl] } : {})
        }
      });
      themeId = row.id;
    }
    report[existing ? "themesUpdated" : "themesCreated"] += 1;
    if (updatePrompt) report.promptsRewritten += 1;

    const example = existing
      ? await prisma.videoThemeExample.findFirst({ where: { siteId, themeId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] })
      : null;
    const defaultReference = !example || (example.sortOrder === 0 && example.name.toLowerCase().endsWith(" reference"));
    const updateExample = defaultReference && (rewritePrompts || !example || promptNeedsUpgrade(example.prompt) || example.imageUrl !== imageUrl);
    if (!example) {
      if (!dryRun) await prisma.videoThemeExample.create({
        data: {
          id: stableId("video_example", seed.slug),
          siteId,
          themeId,
          name: `${seed.name} reference`,
          description: seed.description,
          imageUrl,
          galleryImages: imageUrl ? [imageUrl] : [],
          prompt: seed.prompt,
          status: "active",
          sortOrder: 0
        }
      });
      report.examplesCreated += 1;
    } else if (example && updateExample) {
      if (!dryRun) await prisma.videoThemeExample.update({
        where: { id: example.id },
        data: {
          imageUrl,
          galleryImages: imageUrl ? [imageUrl] : [],
          ...(rewritePrompts || promptNeedsUpgrade(example.prompt) ? { prompt: seed.prompt } : {})
        }
      });
      report.examplesUpdated += 1;
    }
  }

  const allThemes = await prisma.videoTheme.findMany({
    where: { siteId, status: { in: ["active", "draft"] } },
    include: { examples: true }
  });
  const seededSlugs = new Set(themes.map((theme) => theme.slug));
  for (const theme of allThemes) {
    if (!seededSlugs.has(theme.slug) && (rewritePrompts || promptNeedsUpgrade(theme.prompt))) {
      const prompt = upgradePrompt(theme.prompt, `${theme.name}. ${theme.description}`, theme.slug, rewritePrompts);
      if (!dryRun) await prisma.videoTheme.update({ where: { id: theme.id }, data: { prompt, durationSeconds: 15 } });
      report.promptsRewritten += 1;
      theme.prompt = prompt;
    }
    for (const example of theme.examples) {
      if (!["active", "draft"].includes(example.status) || (!rewritePrompts && !promptNeedsUpgrade(example.prompt))) continue;
      const prompt = upgradePrompt(example.prompt, `${example.name}. ${example.description || theme.description}`, theme.slug, rewritePrompts);
      if (!dryRun) await prisma.videoThemeExample.update({ where: { id: example.id }, data: { prompt } });
      report.examplesUpdated += 1;
    }
  }

  console.log(JSON.stringify({ ok: true, dryRun, rewritePrompts, siteId, hierarchy: { roots: parents.length, categories: categories.length, themes: themes.length }, report }, null, 2));
} finally {
  await prisma.$disconnect();
}
