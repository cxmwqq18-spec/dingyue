import fs from "node:fs";
import path from "node:path";

const targetTitlePattern = /Preview the route mood before committing credits|Revisa el ambiente de ruta antes de confirmar/i;
const checkDatabase = process.argv.includes("--db");

function sectionPath(pathParts) {
  return Array.isArray(pathParts) ? pathParts.join(".") : pathParts;
}

function imageKey(value) {
  return String(value || "").trim();
}

function inspectBeforeAfterSection(section, pathParts, report) {
  if (section?.type !== "before_after_gallery") return;
  if (!targetTitlePattern.test(String(section.settings?.title || ""))) return;

  const seen = new Map();
  const images = [];
  for (const block of section.blocks || []) {
    const label = `${block.settings?.beforeLabel || "Before"} / ${block.settings?.afterLabel || "After"}`;
    for (const field of ["beforeImage", "afterImage"]) {
      const image = imageKey(block.settings?.[field]);
      if (!image) continue;
      images.push(image);
      const previous = seen.get(image);
      if (previous) {
        report.failures.push(`${sectionPath(pathParts)} repeats ${image} in ${previous} and ${label} ${field}`);
      } else {
        seen.set(image, `${label} ${field}`);
      }
    }
  }

  for (const block of section.blocks || []) {
    const beforeImage = imageKey(block.settings?.beforeImage);
    const afterImage = imageKey(block.settings?.afterImage);
    if (beforeImage && beforeImage === afterImage) {
      report.failures.push(`${sectionPath(pathParts)} uses the same before/after image for ${block.id || "unnamed block"}: ${beforeImage}`);
    }
  }
  report.targets.push({
    path: sectionPath(pathParts),
    imageCount: images.length,
    uniqueImageCount: new Set(images).size
  });
}

function walk(value, pathParts, report) {
  if (!value || typeof value !== "object") return;
  inspectBeforeAfterSection(value, pathParts, report);
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, pathParts.concat(String(index)), report));
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    walk(entry, pathParts.concat(key), report);
  }
}

function inspectStateFile() {
  const statePath = path.join(process.cwd(), "data/platform-state.json");
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  const report = { scope: "state file", failures: [], targets: [] };
  walk(state, [], report);
  return report;
}

async function inspectDatabase() {
  await import("./load-runtime-env.mjs");
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const report = { scope: "database", failures: [], targets: [] };
  const siteIds = ["site_aidreamcapes", "site_aidreamcapes_xby"];
  try {
    const pages = await prisma.themePage.findMany({
      where: { siteId: { in: siteIds }, slug: "/collections" },
      select: { id: true, siteId: true, draftJson: true, publishedJson: true }
    });
    for (const page of pages) {
      walk(page.draftJson, ["themePage", page.siteId, page.id, "draftJson"], report);
      walk(page.publishedJson, ["themePage", page.siteId, page.id, "publishedJson"], report);
    }

    const themes = await prisma.siteTheme.findMany({
      where: { siteId: { in: siteIds } },
      select: { id: true, siteId: true, templates: true, settings: true }
    });
    for (const theme of themes) {
      walk(theme.templates, ["siteTheme", theme.siteId, theme.id, "templates"], report);
      walk(theme.settings, ["siteTheme", theme.siteId, theme.id, "settings"], report);
    }

    const publications = await prisma.themePublication.findMany({
      where: { siteId: { in: siteIds } },
      select: { id: true, siteId: true, snapshot: true }
    });
    for (const publication of publications) {
      walk(publication.snapshot, ["themePublication", publication.siteId, publication.id, "snapshot"], report);
    }
  } finally {
    await prisma.$disconnect();
  }
  return report;
}

const reports = [inspectStateFile()];
if (checkDatabase) reports.push(await inspectDatabase());

let failed = false;
for (const report of reports) {
  if (report.failures.length) {
    failed = true;
    console.error(`Aidreamcapes before/after proof images must be visually unique in ${report.scope}.`);
    for (const failure of report.failures) console.error(`- ${failure}`);
  } else {
    console.log(`Aidreamcapes before/after proof images are unique in ${report.scope} (${report.targets.length} target sections).`);
  }
}

if (failed) process.exit(1);
