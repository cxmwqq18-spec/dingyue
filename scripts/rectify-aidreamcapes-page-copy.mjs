import "./load-runtime-env.mjs";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const siteId = "site_aidreamcapes";

const replacements = new Map([
  ["Browse packages", "Travel Packages"],
  ["Photo Packages", "Travel Packages"],
  ["View route portrait packages", "Travel Packages"],
  ["View photo packages", "Travel Packages"],
  ["Create my first photo set", "Create travel portraits"],
  ["Return to AI photo packages, pricing, sign-in, or your private Aidreamcapes workspace.", "Return to travel packages, pricing, sign-in, or your private Aidreamcapes workspace."],
  ["Compare Aidreamcapes plans, shown before generation, one-time top-ups, private uploads, and destination gallery delivery before creating a travel portrait request.", "Compare Aidreamcapes plans, visible credit costs, one-time top-ups, private uploads, and destination gallery delivery before creating a travel portrait request."],
  ["4.9/5 from private travel album customers", "Private route galleries for travel portraits"],
  ["5-star reviews", "Travel use cases"],
  ["40 photos", "Private gallery"]
]);

function rewriteString(value) {
  let next = value;
  for (const [from, to] of replacements) next = next.replaceAll(from, to);
  return next;
}

function rewriteJson(value) {
  if (typeof value === "string") return rewriteString(value);
  if (Array.isArray(value)) return value.map(rewriteJson);
  if (!value || typeof value !== "object") return value;
  const next = Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "keywords")
      .map(([key, entryValue]) => [key, rewriteJson(entryValue)])
  );
  if (next.siteKeywords) next.siteKeywords = "";
  if (next.summaryMeta === "Private gallery stories from route portrait customers" || next.summaryMeta === "Example use cases") {
    next.summaryRating = "";
    next.summaryMeta = "Travel use cases";
  }
  return next;
}

function changed(before, after) {
  return JSON.stringify(before) !== JSON.stringify(after);
}

function removeStateCaches() {
  for (const dir of [".next", ".next-dev", ".next-3002", ".next-docx-verify"]) {
    const cacheFile = path.join(process.cwd(), dir, "cache/platform-state-postgres.json");
    if (fs.existsSync(cacheFile)) fs.rmSync(cacheFile, { force: true });
  }
}

async function updatePostgresState() {
  const site = await prisma.site.findFirst({
    where: {
      OR: [
        { id: siteId },
        { slug: "aidreamcapes" },
        { primaryDomain: "www.aidreamcapes.com" }
      ]
    },
    select: { id: true }
  });
  if (!site) return undefined;

  const result = { themeSettings: 0, themePages: 0, siteThemes: 0, themePublications: 0 };

  const settings = await prisma.themeSettings.findUnique({ where: { siteId: site.id } });
  if (settings) {
    const draftJson = rewriteJson(settings.draftJson);
    if (changed(settings.draftJson, draftJson)) {
      await prisma.themeSettings.update({ where: { siteId: site.id }, data: { draftJson } });
      result.themeSettings += 1;
    }
  }

  for (const page of await prisma.themePage.findMany({ where: { siteId: site.id } })) {
    const draftJson = rewriteJson(page.draftJson);
    if (!changed(page.draftJson, draftJson)) continue;
    await prisma.themePage.update({ where: { id: page.id }, data: { draftJson } });
    result.themePages += 1;
  }

  for (const theme of await prisma.siteTheme.findMany({ where: { siteId: site.id } })) {
    const templates = rewriteJson(theme.templates);
    const themeSettings = rewriteJson(theme.settings);
    if (!changed(theme.templates, templates) && !changed(theme.settings, themeSettings)) continue;
    await prisma.siteTheme.update({ where: { id: theme.id }, data: { templates, settings: themeSettings } });
    result.siteThemes += 1;
  }

  return { siteId: site.id, ...result };
}

async function main() {
  const postgres = await updatePostgresState();
  removeStateCaches();
  console.log(JSON.stringify({ ok: true, postgres }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
