#!/usr/bin/env node
import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";

const siteId = process.env.SAVE_THE_DATE_SITE_ID || "site_dreamshoot";
const targets = {
  "/ai-save-the-date/christmas": {
    title: "AI Christmas Photo and Video Maker | Create Holiday Magic",
    description: "Create AI Christmas photos and videos for holiday cards, family memories, festive portraits, winter scenes, pet photos, social posts, and seasonal greetings.",
    h1: "Create AI Christmas Photos and Videos"
  },
  "/ai-save-the-date/thanksgiving": {
    title: "AI Thanksgiving Photo and Video Generator | Create Holiday Content",
    description: "Create Thanksgiving photos and videos with AI for family dinners, Friendsgiving, food scenes, greeting content, and cozy fall storytelling across North American holiday moments.",
    h1: "Create Thanksgiving Photos and Videos with AI"
  }
};

const prisma = new PrismaClient();
try {
  const pages = await prisma.themePage.findMany({ where: { siteId, slug: { in: Object.keys(targets) } } });
  if (pages.length !== Object.keys(targets).length) throw new Error("missing seasonal page(s)");
  await prisma.$transaction(async (tx) => {
    for (const page of pages) {
      const target = targets[page.slug];
      const json = structuredClone(page.draftJson || {});
      json.seo = { ...(json.seo || {}), title: target.title, description: target.description, canonicalPath: page.slug, canonical: `https://www.mydreamshoots.com${page.slug}`, index: false, follow: true, robots: { ...(json.seo?.robots || {}), index: false, follow: true, maxImagePreview: "large" } };
      const heroId = json.sectionsOrder?.[0];
      if (heroId && json.sections?.[heroId]?.settings) {
        json.sections[heroId].settings.title = target.h1;
        json.sections[heroId].settings.h1 = target.h1;
      }
      await tx.themePage.update({ where: { id: page.id }, data: { title: target.h1, draftJson: json } });
    }
  });
  console.log(JSON.stringify({ ok: true, siteId, mode: "draft-only", pages: Object.keys(targets), indexable: false, publicationRequired: true }, null, 2));
} finally {
  await prisma.$disconnect();
}
