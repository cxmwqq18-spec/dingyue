#!/usr/bin/env node
import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

const SITE_ID = "site_mydreamshoots_xby";
const PAGE_SLUG = "/ai-video-generation/talking-photo";
const DUPLICATE_QUESTION = "¿Cómo funciona fotos parlantes con IA?";
const REPLACEMENTS = [
  "¿Puedo hacer que hable la foto de otra persona?",
  "¿Cuánto debe durar mi guion?"
];
const APPLY_CONFIRMATION = "--confirm=aidreamshoots-talking-photo-faq-local";
const apply = process.argv.includes("--apply");

assertDatabaseTarget({ expectedTarget: "local" });

function repairContentJson(input, label) {
  const contentJson = structuredClone(input);
  const section = Object.values(contentJson?.sections ?? {}).find((item) => item?.type === "talking_photo_landing");
  const items = section?.settings?.content?.faq?.items;
  if (!Array.isArray(items)) throw new Error(`${label}: missing talking-photo FAQ items`);

  const duplicateCount = items.filter((item) => item?.question?.trim() === DUPLICATE_QUESTION).length;
  if (duplicateCount === 0) return { contentJson, changed: false };
  if (duplicateCount !== REPLACEMENTS.length) {
    throw new Error(`${label}: expected ${REPLACEMENTS.length} duplicate questions, found ${duplicateCount}`);
  }

  let replacementIndex = 0;
  section.settings.content.faq.items = items.map((item) => {
    if (item?.question?.trim() !== DUPLICATE_QUESTION) return item;
    return { ...item, question: REPLACEMENTS[replacementIndex++] };
  });
  return { contentJson, changed: true };
}

const prisma = new PrismaClient();
try {
  const livePage = await prisma.livePage.findUnique({
    where: { siteId_slug: { siteId: SITE_ID, slug: PAGE_SLUG } },
    select: { id: true, contentJson: true }
  });
  if (!livePage) throw new Error(`Missing LivePage ${SITE_ID}:${PAGE_SLUG}`);

  const liveResult = repairContentJson(livePage.contentJson, "LivePage");
  const themePage = await prisma.themePage.findUnique({
    where: { siteId_slug: { siteId: SITE_ID, slug: PAGE_SLUG } },
    select: { id: true, draftJson: true, publishedJson: true }
  });
  const draftResult = themePage ? repairContentJson(themePage.draftJson, "ThemePage.draftJson") : null;
  const publishedResult = themePage ? repairContentJson(themePage.publishedJson, "ThemePage.publishedJson") : null;
  const changed = liveResult.changed || Boolean(draftResult?.changed || publishedResult?.changed);

  if (!changed) {
    console.log(JSON.stringify({ ok: true, mode: "noop", siteId: SITE_ID, pageSlug: PAGE_SLUG }));
  } else if (!apply) {
    console.log(JSON.stringify({
      ok: true,
      mode: "dry-run",
      siteId: SITE_ID,
      pageSlug: PAGE_SLUG,
      livePageChanged: liveResult.changed,
      themePageChanged: Boolean(draftResult?.changed || publishedResult?.changed),
      applyWith: `node scripts/repair-aidreamshoots-talking-photo-faq-local.mjs --apply ${APPLY_CONFIRMATION}`
    }, null, 2));
  } else {
    if (!process.argv.includes(APPLY_CONFIRMATION)) throw new Error(`apply requires ${APPLY_CONFIRMATION}`);
    await prisma.$transaction(async (tx) => {
      if (liveResult.changed) {
        await tx.livePage.update({ where: { id: livePage.id }, data: { contentJson: liveResult.contentJson } });
      }
      if (themePage && (draftResult?.changed || publishedResult?.changed)) {
        await tx.themePage.update({
          where: { id: themePage.id },
          data: {
            draftJson: draftResult.contentJson,
            publishedJson: publishedResult.contentJson
          }
        });
      }
    });
    console.log(JSON.stringify({ ok: true, mode: "applied", siteId: SITE_ID, pageSlug: PAGE_SLUG }));
  }
} finally {
  await prisma.$disconnect();
}
