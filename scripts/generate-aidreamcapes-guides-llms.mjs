#!/usr/bin/env node
/**
 * Regenerate the Guides block of public/llms-full.txt from the relational
 * guide pages.
 *
 * /llms-full.txt is the full-content companion of /llms.txt for AI assistants.
 * It is a generated artifact, and the guide pages added on 2026-11-15 were
 * never folded back into it, so assistants could not see the how-do-* pages at
 * all. The source of truth is the guide copy stored on each `LivePage`
 * (`contentJson.sections.v2_main.settings.data.howto`); this script renders
 * that copy into plain text and replaces the block between `# Guides` and the
 * next top-level section, so re-running it is safe and idempotent.
 *
 * Usage:
 *   node scripts/generate-aidreamcapes-guides-llms.mjs            # local db
 *   DATABASE_URL=... node scripts/generate-aidreamcapes-guides-llms.mjs --write
 *
 * Without --write the script prints the block and a page count to stdout.
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const SITE_ID = "site_aidreamcapes";
const FILE = path.join(process.cwd(), "public", "llms-full.txt");
const ORIGIN = "https://www.aivideosugc.com";
const BLOCK_HEADING = "# Guides";
const PAGE_PREFIX = "/guides";

const prisma = new PrismaClient();

function text(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

/**
 * Guide pages use a few copy shapes: `howto` (step-by-step tools), flat
 * `h1/lead/sections/faq` (story guides), and a `guide` chapter model. Normalize
 * them so one renderer covers every published page.
 */
function normalizedGuide(data) {
  if (!data || typeof data !== "object") return null;
  const howto = data.howto ?? null;
  const guide = data.guide ?? null;
  const source = howto ?? guide ?? data;
  const sections = Array.isArray(source.sections) ? source.sections : Array.isArray(data.sections) ? data.sections : [];
  const faq = Array.isArray(source.faq) ? source.faq : Array.isArray(data.faq) ? data.faq : [];
  const steps = Array.isArray(source.steps) ? source.steps.map((step) => ({ label: text(step.title), body: text(step.body) })) : [];
  const chapters = Array.isArray(guide?.chapters) ? guide.chapters.map((chapter) => ({
    title: text(chapter.title ?? chapter.name),
    lead: text(chapter.lead ?? chapter.body),
    paras: (Array.isArray(chapter.paras) ? chapter.paras : Array.isArray(chapter.steps) ? chapter.steps : []).map(text).filter(Boolean)
  })) : [];
  const paths = Array.isArray(guide?.paths) ? guide.paths.map((entry) => ({ title: text(entry.title), body: text(entry.body) })) : [];
  const normalized = {
    title: text(source.h1) || text(data.h1) || "",
    lead: text(source.lead) || text(data.lead) || "",
    intro: (Array.isArray(source.intro) ? source.intro : []).map(text).filter(Boolean).slice(1),
    steps,
    chapters,
    paths,
    sections: sections.map((section) => ({
      heading: text(section.h2 ?? section.h3 ?? section.title),
      paras: (Array.isArray(section.paras) ? section.paras : Array.isArray(section.body) ? section.body : Array.isArray(section.items) ? section.items : []).map(text).filter(Boolean)
    })).filter((section) => section.heading || section.paras.length),
    checklist: (Array.isArray(source.checklist) ? source.checklist : []).map(text).filter(Boolean),
    faq: faq.filter((item) => text(item.q) && text(item.a)),
    tip: source.tip,
    related: (Array.isArray(source.related) ? source.related : []).map((item) => ({ href: text(item.href), label: text(item.label) })).filter((item) => item.href && item.label),
    ctaTitle: text(source.cta?.title) || text(data.ctaTitle),
    ctaLead: text(source.cta?.lead) || text(data.ctaLead)
  };
  const hasBody = normalized.title || normalized.lead || normalized.sections.length || normalized.steps.length || normalized.chapters.length || normalized.faq.length;
  return hasBody ? normalized : null;
}

function renderGuide(slug, contentJson) {
  const data = contentJson?.sections?.v2_main?.settings?.data;
  const guide = normalizedGuide(data);
  if (!guide) return "";
  const url = `${ORIGIN}${slug}`;
  const title = guide.title || text(contentJson?.seo?.title);
  const lines = [`## ${slug}`, `URL: ${url}`, ""];
  if (title) lines.push(title);
  if (guide.lead) lines.push("", guide.lead);
  if (guide.intro.length) lines.push("", ...guide.intro);
  if (guide.steps.length) {
    lines.push("", "Steps:");
    for (const step of guide.steps) {
      if (step.label || step.body) lines.push(`- ${step.label}${step.label && step.body ? ": " : ""}${step.body}`);
    }
  }
  for (const chapter of guide.chapters) {
    if (!chapter.title && !chapter.lead && !chapter.paras.length) continue;
    lines.push("");
    if (chapter.title) lines.push(`### ${chapter.title}`);
    if (chapter.lead) lines.push(chapter.lead);
    lines.push(...chapter.paras);
  }
  if (guide.paths.length) {
    lines.push("", "Learning paths:");
    for (const entry of guide.paths) lines.push(`- ${entry.title}${entry.title && entry.body ? ": " : ""}${entry.body}`);
  }
  for (const section of guide.sections) {
    lines.push("");
    if (section.heading) lines.push(`### ${section.heading}`);
    lines.push(...section.paras);
  }
  if (guide.tip && (text(guide.tip.title) || text(guide.tip.body))) {
    lines.push("", `Note: ${[text(guide.tip.title), text(guide.tip.body)].filter(Boolean).join(" — ")}`);
  }
  if (guide.checklist.length) {
    lines.push("", "Checklist:");
    for (const item of guide.checklist) lines.push(`- ${item}`);
  }
  if (guide.faq.length) {
    lines.push("", "Questions:");
    for (const item of guide.faq) lines.push(`- ${text(item.q)} ${text(item.a)}`);
  }
  if (guide.related.length) {
    lines.push("", "Next:");
    for (const item of guide.related) lines.push(`- ${item.label}: ${item.href.startsWith("http") ? item.href : `${ORIGIN}${item.href}`}`);
  }
  if (guide.ctaTitle || guide.ctaLead) lines.push("", `Next step: ${[guide.ctaTitle, guide.ctaLead].filter(Boolean).join(" — ")}`);
  lines.push("", "---", "");
  return lines.join("\n");
}

/**
 * The first generation of this file inlined five guide pages as part of the
 * general page dump. Sections managed here render those pages again in a
 * consistent shape, so the older copies are removed to keep the file free of
 * duplicated body text.
 */
/** True for a line that opens a page block or a top-level index section. */
function isBlockStart(line) {
  return /^## \//.test(line)
    || line === BLOCK_HEADING
    || /^# (?:Video example pages|Photo example pages|AI actor pages|Browse Every Example)/.test(line);
}

function stripGuideSections(text, slugs) {
  const lines = text.split("\n");
  const targets = new Set(slugs.map((slug) => `## ${slug}`));
  const out = [];
  for (let index = 0; index < lines.length; index++) {
    if (!targets.has(lines[index].trim())) {
      out.push(lines[index]);
      continue;
    }
    // A page block starts with `## /<path>`; internal `## ` headings belong to
    // the section being removed, so the slash form is the real boundary.
    index++;
    while (index < lines.length && !isBlockStart(lines[index])) index++;
    index--;
    while (out.length && out[out.length - 1].trim() === "") out.pop();
    out.push("");
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n");
}

async function main() {
  const pages = await prisma.livePage.findMany({
    where: { siteId: SITE_ID, slug: { startsWith: PAGE_PREFIX } },
    select: { slug: true, contentJson: true },
    orderBy: { slug: "asc" }
  });
  const guides = pages
    .filter((page) => page.slug !== PAGE_PREFIX)
    .map((page) => ({ slug: page.slug, rendered: renderGuide(page.slug, page.contentJson) }))
    .filter((entry) => entry.rendered);
  if (!guides.length) {
    console.error("No guide pages with how-to copy were found; nothing to write.");
    process.exit(1);
  }

  const block = [BLOCK_HEADING, "", `Guide pages published on the site, rendered from their live copy. ${guides.length} pages.`, "", ...guides.map((entry) => entry.rendered)].join("\n");

  const deduped = stripGuideSections(fs.readFileSync(FILE, "utf8"), guides.map((entry) => entry.slug));
  const current = deduped.replace(/\s*$/, "") + "\n";
  const start = current.indexOf(`\n${BLOCK_HEADING}\n`);
  let next;
  if (start === -1) {
    // Insert ahead of the example indexes so the guide copy sits with the pages.
    const anchor = "\n# Video example pages (index)\n";
    const at = current.indexOf(anchor);
    if (at === -1) {
      next = `${current.replace(/\s*$/, "")}\n\n${block}`;
    } else {
      next = `${current.slice(0, at)}\n${block}${current.slice(at)}`;
    }
  } else {
    const afterHeading = start + 1;
    const followingTopLevel = current.indexOf("\n# ", afterHeading + BLOCK_HEADING.length);
    const tail = followingTopLevel === -1 ? "" : current.slice(followingTopLevel + 1);
    const head = current.slice(0, start + 1);
    next = tail ? `${head}${block}\n${tail}` : `${head}${block}`;
  }

  if (process.argv.includes("--write")) {
    fs.writeFileSync(FILE, next, "utf8");
    console.log(`Wrote ${guides.length} guide pages into ${path.relative(process.cwd(), FILE)}.`);
  } else {
    console.log(block);
    console.error(`\n[dry run] ${guides.length} guide pages; pass --write to update ${path.relative(process.cwd(), FILE)}.`);
  }
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
