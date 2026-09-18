#!/usr/bin/env node
import "./load-runtime-env.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { readPlatformStateFromSql } from "./lib/platform-state-sql.mjs";

const repoRoot = process.cwd();
const args = new Set(process.argv.slice(2));
const skipDb = args.has("--skip-db");
const siteId = "site_aidreamcapes";

const requiredFaqSlugs = [
  "/",
  "/pricing",
  "/tools",
  "/collections",
  "/best-packages",
  "/best-ai-image",
  "/best-ai-video",
  "/faq",
  "/tools/fan-scene-album-builder",
  "/tools/game-day-group-portrait-maker",
  "/tools/christmas-group-album-studio",
];

const forbiddenFaqSlugs = [
  "/about-us",
  "/contact-us",
  "/workflow",
  "/privacy",
  "/policies/privacy",
  "/refunds",
  "/policies/refunds",
  "/content",
  "/policies/content",
  "/terms",
  "/policies/terms",
  "/cookies",
  "/policies/cookies"
];

function normalizePath(value) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text === "index") return "/";
  const withSlash = text.startsWith("/") ? text : `/${text}`;
  return withSlash.replace(/\/+$/g, "") || "/";
}

function isFaqSection(section) {
  return section?.type === "faq" || section?.type === "dreamshoot_theme_faq";
}

function pageFaqInfo(pageJson) {
  const sections = pageJson?.sections && typeof pageJson.sections === "object" ? pageJson.sections : {};
  const order = Array.isArray(pageJson?.sectionsOrder) ? pageJson.sectionsOrder : Object.keys(sections);
  const orderedFaqIds = order.filter((id) => isFaqSection(sections[id]));
  const allFaqIds = Object.entries(sections)
    .filter(([, section]) => isFaqSection(section))
    .map(([id]) => id);
  const hiddenFaqIds = allFaqIds.filter((id) => !orderedFaqIds.includes(id));
  const faqBlocks = orderedFaqIds.flatMap((id) => Array.isArray(sections[id]?.blocks) ? sections[id].blocks : []);
  const questions = faqBlocks
    .map((block) => String(block?.settings?.question ?? "").trim())
    .filter(Boolean);
  return { orderedFaqIds, hiddenFaqIds, questions };
}

function assertPageRules(sourceLabel, pages) {
  const bySlug = new Map(pages.map((page) => [normalizePath(page.slug), page]));
  const failures = [];

  for (const slug of requiredFaqSlugs) {
    const page = bySlug.get(slug);
    if (!page) {
      failures.push(`${sourceLabel}:${slug}:missing_page`);
      continue;
    }
    const json = page.publishedJson ?? page.draftJson ?? page;
    const info = pageFaqInfo(json);
    if (!info.orderedFaqIds.length) failures.push(`${sourceLabel}:${slug}:missing_ordered_faq`);
    if (info.questions.length < 5) failures.push(`${sourceLabel}:${slug}:faq_too_short:${info.questions.length}`);
  }

  for (const slug of forbiddenFaqSlugs) {
    const page = bySlug.get(slug);
    if (!page) continue;
    const json = page.publishedJson ?? page.draftJson ?? page;
    const info = pageFaqInfo(json);
    if (info.orderedFaqIds.length) failures.push(`${sourceLabel}:${slug}:has_visible_faq:${info.orderedFaqIds.join(",")}`);
    if (info.hiddenFaqIds.length) failures.push(`${sourceLabel}:${slug}:has_hidden_faq:${info.hiddenFaqIds.join(",")}`);
  }

  if (failures.length) {
    throw new Error(failures.join("\n"));
  }
}

function publicationPages(publication) {
  const snapshot = publication?.publishedSnapshot ?? publication?.snapshot;
  if (Array.isArray(snapshot?.pages)) return snapshot.pages;
  if (Array.isArray(snapshot?.site?.pages)) return snapshot.site.pages;
  return [];
}

const state = await readPlatformStateFromSql();
const localSite = state.sites?.find((site) => site.id === siteId);
if (!localSite) throw new Error("missing_local_site_aidreamcapes");
assertPageRules("local_state", localSite.pages ?? []);

const localPublications = (state.themePublications ?? [])
  .filter((publication) => publication.siteId === siteId)
  .sort((a, b) => new Date(b.publishedAt ?? b.createdAt ?? 0).getTime() - new Date(a.publishedAt ?? a.createdAt ?? 0).getTime());
if (localPublications[0]) {
  assertPageRules("local_publication", publicationPages(localPublications[0]));
}

if (!skipDb) {
  const prisma = new PrismaClient();
  try {
    const dbPages = await prisma.themePage.findMany({
      where: { siteId },
      select: { slug: true, draftJson: true, publishedJson: true }
    });
    assertPageRules("db_theme_pages", dbPages);

    const dbPublication = await prisma.themePublication.findFirst({
      where: { siteId },
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      select: { snapshot: true }
    });
    if (dbPublication) {
      assertPageRules("db_publication", publicationPages(dbPublication));
    }
  } finally {
    await prisma.$disconnect();
  }
}

console.log(`AIdreamcapes FAQ rules passed (${skipDb ? "local only" : "local + DB"}).`);
