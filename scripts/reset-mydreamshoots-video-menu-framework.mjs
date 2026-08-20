import fs from "node:fs";
import path from "node:path";
import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";
import { argumentValue, assertAllowedSite, assertDatabaseTarget } from "./lib/database-target.mjs";

const repoRoot = process.cwd();
const stateFile = path.join(repoRoot, "data", "platform-state.json");
const targetSiteIds = ["site_dreamshoot", "site_grownstride_test"];
const baseCategories = [
  {
    slug: "text-to-video",
    label: "Text to video",
    description: "Video themes created from written prompts.",
    sortOrder: 10
  },
  {
    slug: "image-to-video",
    label: "Image to Video",
    description: "Video themes created from uploaded or selected images.",
    sortOrder: 20
  }
];
const categoriesBySiteId = {
  site_dreamshoot: [
    ...baseCategories,
    {
      slug: "talking-photo",
      label: "Talking Photo",
      description: "Explore a talking-photo workflow from one clear portrait and a focused message.",
      sortOrder: 30
    },
    {
      slug: "cinematic-video",
      label: "Cinematic Video",
      description: "Plan cinematic video scenes with stronger mood, shot design, lighting, pacing, and camera movement.",
      sortOrder: 40
    },
    {
      slug: "tiktok-video",
      label: "TikTok Video",
      description: "Shape TikTok-first vertical video ideas with clearer hooks, framing, captions, and closes.",
      sortOrder: 50
    },
    {
      slug: "instagram-reels",
      label: "Instagram Reels",
      description: "Plan Instagram Reels from photos and ideas with mobile-safe pacing, cover choices, and captions.",
      sortOrder: 60
    },
    {
      slug: "social-media-video",
      label: "Social Media Video",
      description: "Adapt one core video idea across social platforms with platform-aware hooks, crops, and CTAs.",
      sortOrder: 70
    },
    {
      slug: "youtube-video",
      label: "YouTube Video",
      description: "Structure YouTube video ideas with stronger openings, chapter-ready sequences, and clearer next steps.",
      sortOrder: 80
    },
    {
      slug: "story-video",
      label: "Story Video",
      description: "Shape story-led videos around setup, tension, turning point, payoff, and meaning.",
      sortOrder: 90
    },
    {
      slug: "meme-video",
      label: "Meme Video",
      description: "Turn reactions, POV setups, everyday situations, and punchlines into clear meme video directions.",
      sortOrder: 100
    },
    {
      slug: "product-video",
      label: "Product Video",
      description: "Turn product photos into clear video directions that answer buyer questions about scale, detail, use, features, and packaging.",
      sortOrder: 110
    },
    {
      slug: "product-ad-video",
      label: "Product Ad Video",
      description: "Build product ads around one audience, product promise, visual proof, offer, and clear next action.",
      sortOrder: 120
    },
    {
      slug: "ugc-ad-video",
      label: "UGC Ad Video",
      description: "Plan creator-style product ads around speaker status, hooks, product context, visible proof, and clear CTAs.",
      sortOrder: 130
    }
  ],
  site_grownstride_test: baseCategories
};

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const useDb = args.has("--db");
const databaseTarget = argumentValue("--target") || process.env.DATABASE_TARGET || "local";

for (const siteId of targetSiteIds) assertAllowedSite(siteId);

function categoryId(siteId, slug) {
  return `video_cat_${siteId.replace(/^site_/, "")}_${slug.replaceAll("-", "_")}`;
}

function categoriesForSite(siteId) {
  return categoriesBySiteId[siteId] ?? baseCategories;
}

function categoryRows(siteId) {
  const now = new Date().toISOString();
  return categoriesForSite(siteId).map((category) => ({
    id: categoryId(siteId, category.slug),
    siteId,
    slug: category.slug,
    label: category.label,
    description: category.description,
    sortOrder: category.sortOrder,
    status: "active",
    createdAt: now,
    updatedAt: now
  }));
}

function removeTargetRows(rows, siteIds) {
  return rows.filter((row) => !siteIds.includes(row.siteId));
}

function printReport(label, report) {
  console.log(`${label}:`);
  for (const siteId of targetSiteIds) {
    const row = report[siteId] ?? {};
    console.log(`  ${siteId}: tools=${row.tools ?? 0}, toolItems=${row.toolItems ?? 0}, videoThemes=${row.videoThemes ?? 0}, videoCategories=${row.videoCategories ?? 0}`);
  }
}

function localReset() {
  const state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  const before = Object.fromEntries(targetSiteIds.map((siteId) => [
    siteId,
    {
      tools: (state.toolCategories ?? []).filter((row) => row.siteId === siteId).length,
      toolItems: (state.toolMenuItems ?? []).filter((row) => row.siteId === siteId).length,
      videoThemes: (state.videoThemes ?? []).filter((row) => row.siteId === siteId).length,
      videoCategories: (state.videoThemeCategories ?? []).filter((row) => row.siteId === siteId).length
    }
  ]));
  const untouchedBefore = JSON.stringify({
    toolCategories: (state.toolCategories ?? []).filter((row) => !targetSiteIds.includes(row.siteId)),
    toolMenuItems: (state.toolMenuItems ?? []).filter((row) => !targetSiteIds.includes(row.siteId)),
    videoThemes: (state.videoThemes ?? []).filter((row) => !targetSiteIds.includes(row.siteId)),
    videoThemeCategories: (state.videoThemeCategories ?? []).filter((row) => !targetSiteIds.includes(row.siteId))
  });

  const nextState = {
    ...state,
    toolCategories: removeTargetRows(state.toolCategories ?? [], targetSiteIds),
    toolMenuItems: removeTargetRows(state.toolMenuItems ?? [], targetSiteIds),
    videoThemes: removeTargetRows(state.videoThemes ?? [], targetSiteIds),
    videoThemeCategories: [
      ...removeTargetRows(state.videoThemeCategories ?? [], targetSiteIds),
      ...targetSiteIds.flatMap((siteId) => categoryRows(siteId))
    ]
  };
  const untouchedAfter = JSON.stringify({
    toolCategories: nextState.toolCategories.filter((row) => !targetSiteIds.includes(row.siteId)),
    toolMenuItems: nextState.toolMenuItems.filter((row) => !targetSiteIds.includes(row.siteId)),
    videoThemes: nextState.videoThemes.filter((row) => !targetSiteIds.includes(row.siteId)),
    videoThemeCategories: nextState.videoThemeCategories.filter((row) => !targetSiteIds.includes(row.siteId))
  });
  if (untouchedBefore !== untouchedAfter) throw new Error("reset would modify a non-target site");

  const after = Object.fromEntries(targetSiteIds.map((siteId) => [
    siteId,
    {
      tools: nextState.toolCategories.filter((row) => row.siteId === siteId).length,
      toolItems: nextState.toolMenuItems.filter((row) => row.siteId === siteId).length,
      videoThemes: nextState.videoThemes.filter((row) => row.siteId === siteId).length,
      videoCategories: nextState.videoThemeCategories.filter((row) => row.siteId === siteId).length
    }
  ]));
  printReport("Before", before);
  printReport("After", after);
  printReport("Deleted", Object.fromEntries(targetSiteIds.map((siteId) => [
    siteId,
    {
      tools: Math.max(0, (before[siteId]?.tools ?? 0) - (after[siteId]?.tools ?? 0)),
      toolItems: Math.max(0, (before[siteId]?.toolItems ?? 0) - (after[siteId]?.toolItems ?? 0)),
      videoThemes: Math.max(0, (before[siteId]?.videoThemes ?? 0) - (after[siteId]?.videoThemes ?? 0)),
      videoCategories: Math.max(0, (before[siteId]?.videoCategories ?? 0) - (after[siteId]?.videoCategories ?? 0))
    }
  ])));
  if (dryRun) return;
  const tempFile = `${stateFile}.tmp`;
  fs.writeFileSync(tempFile, `${JSON.stringify(nextState, null, 2)}\n`);
  fs.renameSync(tempFile, stateFile);
  console.log(`Wrote ${path.relative(repoRoot, stateFile)}`);
}

async function dbReset() {
  if (databaseTarget === "production") {
    throw new Error("Direct video framework reset is disabled for production. Use a reviewed release content manifest.");
  }
  assertDatabaseTarget({ expectedTarget: databaseTarget });
  const prisma = new PrismaClient();
  try {
    const existingSites = new Set(
      (await prisma.site.findMany({ where: { id: { in: targetSiteIds } }, select: { id: true } })).map((site) => site.id)
    );
    const missingSites = targetSiteIds.filter((siteId) => !existingSites.has(siteId));
    if (missingSites.length && !dryRun) {
      throw new Error(`Target site rows are missing in ${databaseTarget} database: ${missingSites.join(", ")}. Seed sites before resetting video categories.`);
    }
    if (missingSites.length) {
      console.log(`Missing target sites in ${databaseTarget} database: ${missingSites.join(", ")}`);
    }
    const beforeRows = await Promise.all(targetSiteIds.map(async (siteId) => {
      const [tools, toolItems, videoThemes, videoCategories] = await Promise.all([
        prisma.toolCategory.count({ where: { siteId } }),
        prisma.toolMenuItem.count({ where: { siteId } }),
        prisma.videoTheme.count({ where: { siteId } }),
        prisma.videoThemeCategory.count({ where: { siteId } })
      ]);
      return [siteId, { tools, toolItems, videoThemes, videoCategories }];
    }));
    printReport("Before", Object.fromEntries(beforeRows));
    if (dryRun) {
      const afterRows = Object.fromEntries(targetSiteIds.map((siteId) => [
        siteId,
        { tools: 0, toolItems: 0, videoThemes: 0, videoCategories: categoriesForSite(siteId).length }
      ]));
      printReport("After (dry-run)", afterRows);
      printReport("Deleted (dry-run)", Object.fromEntries(beforeRows.map(([siteId, before]) => [
        siteId,
        {
          tools: before.tools,
          toolItems: before.toolItems,
          videoThemes: before.videoThemes,
          videoCategories: before.videoCategories
        }
      ])));
      return;
    }

    await prisma.$transaction(async (tx) => {
      for (const siteId of targetSiteIds) {
        await tx.toolMenuItem.deleteMany({ where: { siteId } });
        await tx.toolCategory.deleteMany({ where: { siteId } });
        await tx.videoTheme.deleteMany({ where: { siteId } });
        await tx.videoThemeCategory.deleteMany({ where: { siteId } });
        await tx.videoThemeCategory.createMany({
          data: categoriesForSite(siteId).map((category) => ({
            id: categoryId(siteId, category.slug),
            siteId,
            slug: category.slug,
            label: category.label,
            description: category.description,
            sortOrder: category.sortOrder,
            status: "active"
          }))
        });
      }
    });

    const afterRows = await Promise.all(targetSiteIds.map(async (siteId) => {
      const [tools, toolItems, videoThemes, videoCategories] = await Promise.all([
        prisma.toolCategory.count({ where: { siteId } }),
        prisma.toolMenuItem.count({ where: { siteId } }),
        prisma.videoTheme.count({ where: { siteId } }),
        prisma.videoThemeCategory.count({ where: { siteId } })
      ]);
      return [siteId, { tools, toolItems, videoThemes, videoCategories }];
    }));
    printReport("After", Object.fromEntries(afterRows));
    printReport("Deleted", Object.fromEntries(beforeRows.map(([siteId, before]) => {
      const after = Object.fromEntries(afterRows)[siteId];
      return [siteId, {
        tools: Math.max(0, before.tools - after.tools),
        toolItems: Math.max(0, before.toolItems - after.toolItems),
        videoThemes: Math.max(0, before.videoThemes - after.videoThemes),
        videoCategories: Math.max(0, before.videoCategories - after.videoCategories)
      }];
    })));
  } finally {
    await prisma.$disconnect();
  }
}

if (useDb) {
  await dbReset();
} else {
  localReset();
}
