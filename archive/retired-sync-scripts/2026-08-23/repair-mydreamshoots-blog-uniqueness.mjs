#!/usr/bin/env node
import "./load-runtime-env.mjs";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

assertDatabaseTarget({ expectedTarget: "local" });
const siteId = "site_dreamshoot";
const apply = process.argv.includes("--apply") && !process.argv.includes("--dry-run");
const prisma = new PrismaClient();
const backupRoot = path.join(process.cwd(), "releases", "backups");

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function articleLabel(page) {
  const explicit = page.slug === "/blog/anime-avatar-photo-package-guide"
    ? "Anime Avatar"
    : page.slug === "/blog/profile-cards-photo-package-guide"
      ? "Profile Cards"
      : String(page.title || page.slug.split("/").pop() || "Package")
        .replace(/\s+guide$/i, "")
        .replace(/\s+photo package$/i, "")
        .trim();
  return explicit || "Package";
}

function uniqueBody(body, label) {
  const lower = label.toLowerCase();
  return `<p>${label} planning starts with the intended ${lower} outcome, not a generic image style. Define where the ${lower} result will appear before choosing ${label} inputs or spending credits.</p>
<h2>${label} source-photo preparation</h2><p>For ${label}, select current, permission-safe photos that show the person clearly. Keep the ${lower} reference set focused on identity, angle, and the visual detail that makes ${label} useful.</p>
<h2>${label} comparison criteria</h2><p>Compare ${label} with nearby packages by the ${lower} job it solves. A ${lower} result should be judged against its own audience, crop, mood, and delivery use rather than a broad ${label} gallery standard.</p>
<h2>${label} credit planning</h2><p>Review the visible credit cost for ${label} before generation. Begin with a small ${lower} pass when the direction is new, then expand only after the first ${label} gallery gives useful evidence.</p>
<h2>${label} review checklist</h2><p>Inspect ${label} outputs for recognizable identity, suitable framing, clean edges, coherent background details, and a result that still communicates the ${lower} purpose at the final ${label} crop size.</p>
<h2>${label} FAQ</h2><h3>Is ${label} suitable for a first request?</h3><p>${label} is suitable when the intended use and source-photo rights are clear. A focused ${lower} request makes it easier to decide whether another credit spend is warranted.</p><h3>How should I prepare photos for ${label}?</h3><p>Choose a concise ${lower} source set with recent, sharp images. Avoid mixed goals, heavy filters, and references that do not support the specific ${lower} outcome.</p><h3>When should I choose a different package?</h3><p>Choose another package when the ${lower} review criteria no longer fit the final use. Separate requests make the next private gallery easier to evaluate and explain.</p>`;
}

function rewriteJson(page) {
  const next = clone(page.publishedJson ?? page.draftJson ?? {});
  const label = articleLabel(page);
  const lower = label.toLowerCase();
  const settings = next.sections?.blog_detail_1?.settings;
  if (!settings || typeof settings !== "object") return undefined;
  const replace = (value) => typeof value === "string"
    ? value
      .replace(/The Avatar package category/g, `The ${label} package category`)
      .replace(/The Avatar package/g, `The ${label} package`)
      .replace(/\bAvatar private AI photo guide\b/g, `${label} private AI photo guide`)
      .replace(/\bAvatar is the right fit\b/g, `${label} is the right fit`)
      .replace(/\bthe package direction\b/g, `the ${lower} package direction`)
      .replace(/\bthe package\b/g, `the ${lower} package`)
    : value;
  for (const key of ["title", "heading", "h1", "body", "summary", "seoTitle", "seoDescription"]) {
    if (typeof settings[key] === "string") settings[key] = replace(settings[key]);
  }
  settings.body = uniqueBody(settings.body, label);
  if (next.seo && typeof next.seo === "object") {
    next.seo.title = page.slug === "/blog/anime-avatar-photo-package-guide"
      ? "Anime Avatar private AI photo guide | myDreamshoots"
      : page.slug === "/blog/profile-cards-photo-package-guide"
        ? "Profile Cards private AI photo guide | myDreamshoots"
        : replace(next.seo.title);
    next.seo.description = replace(next.seo.description);
  }
  return next;
}

function collectBodyNgrams(pageJson, output = []) {
  const body = String(pageJson?.sections?.blog_detail_1?.settings?.body ?? "")
  for (const match of body.matchAll(/<p>([\s\S]*?)<\/p>/gi)) {
    const text = match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
    if (text.length >= 80) output.push(text);
  }
  return output;
}

try {
  const pages = await prisma.themePage.findMany({ where: { siteId, slug: { startsWith: "/blog/" } }, orderBy: { slug: "asc" } });
  const changes = pages.flatMap((page) => {
    const next = rewriteJson(page);
    if (!next) return [];
    return [{ page, next }];
  });
  const before = changes.map(({ page }) => ({ id: page.id, slug: page.slug, title: page.title, draftJson: page.draftJson, publishedJson: page.publishedJson }));
  const after = changes.map(({ page, next }) => ({ id: page.id, slug: page.slug, title: page.slug === "/blog/anime-avatar-photo-package-guide" ? "Anime Avatar guide" : page.slug === "/blog/profile-cards-photo-package-guide" ? "Profile Cards guide" : page.title, draftJson: next, publishedJson: next }));
  const ngrams = new Map();
  for (const item of after) for (const gram of collectBodyNgrams(item.publishedJson)) ngrams.set(gram, (ngrams.get(gram) ?? 0) + 1);
  const repeated = [...ngrams.entries()].filter(([, count]) => count > 3);
  if (repeated.length) throw new Error(`blog duplicate guard failed: ${repeated.slice(0, 5).map(([gram, count]) => `${count}x ${gram}`).join("; ")}`);
  const backupPath = path.join(backupRoot, `mydreamshoots-blog-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  if (apply) {
    fs.mkdirSync(backupRoot, { recursive: true, mode: 0o700 });
    fs.writeFileSync(backupPath, `${JSON.stringify({ createdAt: new Date().toISOString(), siteId, pages: before }, null, 2)}\n`, { mode: 0o600 });
    await prisma.$transaction(async (tx) => {
      for (const item of after) await tx.themePage.update({ where: { id: item.id }, data: { title: item.title, draftJson: item.draftJson, publishedJson: item.publishedJson, updatedAt: new Date() } });
    });
  }
  console.log(JSON.stringify({ ok: true, mode: apply ? "applied" : "dry-run", siteId, blogPages: after.length, changedPages: after.length, backupPath: apply ? backupPath : undefined, duplicateNgramCount: repeated.length }, null, 2));
} finally {
  await prisma.$disconnect();
}
