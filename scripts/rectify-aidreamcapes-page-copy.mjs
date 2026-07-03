import "./load-runtime-env.mjs";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const statePath = path.resolve(process.cwd(), "data", "platform-state.json");
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

function updateJsonState() {
  if (!fs.existsSync(statePath)) return 0;
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  let updates = 0;

  for (const site of state.sites ?? []) {
    if (site.id !== siteId && site.slug !== "aidreamcapes") continue;
    const next = rewriteJson(site);
    if (!changed(site, next)) continue;
    Object.assign(site, next);
    updates += 1;
  }

  for (const theme of state.siteThemes ?? []) {
    if (theme.siteId !== siteId) continue;
    const next = rewriteJson(theme);
    if (!changed(theme, next)) continue;
    Object.assign(theme, next);
    updates += 1;
  }

  for (const publication of state.themePublications ?? []) {
    if (publication.siteId !== siteId) continue;
    const next = rewriteJson(publication);
    if (!changed(publication, next)) continue;
    Object.assign(publication, next);
    updates += 1;
  }

  if (updates) fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
  return updates;
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
    const publishedJson = rewriteJson(settings.publishedJson);
    if (changed(settings.draftJson, draftJson) || changed(settings.publishedJson, publishedJson)) {
      await prisma.themeSettings.update({ where: { siteId: site.id }, data: { draftJson, publishedJson } });
      result.themeSettings += 1;
    }
  }

  for (const page of await prisma.themePage.findMany({ where: { siteId: site.id } })) {
    const draftJson = rewriteJson(page.draftJson);
    const publishedJson = rewriteJson(page.publishedJson);
    if (!changed(page.draftJson, draftJson) && !changed(page.publishedJson, publishedJson)) continue;
    await prisma.themePage.update({ where: { id: page.id }, data: { draftJson, publishedJson } });
    result.themePages += 1;
  }

  for (const theme of await prisma.siteTheme.findMany({ where: { siteId: site.id } })) {
    const templates = rewriteJson(theme.templates);
    const themeSettings = rewriteJson(theme.settings);
    if (!changed(theme.templates, templates) && !changed(theme.settings, themeSettings)) continue;
    await prisma.siteTheme.update({ where: { id: theme.id }, data: { templates, settings: themeSettings } });
    result.siteThemes += 1;
  }

  for (const publication of await prisma.themePublication.findMany({ where: { siteId: site.id } })) {
    const snapshot = rewriteJson(publication.snapshot);
    if (!changed(publication.snapshot, snapshot)) continue;
    await prisma.themePublication.update({ where: { id: publication.id }, data: { snapshot } });
    result.themePublications += 1;
  }

  return { siteId: site.id, ...result };
}

async function main() {
  const jsonStateUpdates = updateJsonState();
  const postgres = await updatePostgresState();
  removeStateCaches();
  console.log(JSON.stringify({ ok: true, jsonStateUpdates, postgres }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
