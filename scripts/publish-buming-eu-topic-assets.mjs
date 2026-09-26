#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const publicRoot = path.resolve(process.cwd(), "public");

const replacementsBySite = [
  {
    siteId: "site_aidreamcapes_xby",
    domain: "aidreamcapes.eu",
    slugs: [
      "/ai-video-generation/proposal",
      "/ai-save-the-date/proposal",
      "/ai-video-generation/engagement",
      "/ai-video-generation/motion-generator",
      "/ai-video-generation/wedding-ceremony",
      "/ai-save-the-date/wedding-ceremony"
    ],
    replacements: new Map([
      [
        "/assets/sites/site_aidreamcapes_eu/mirror/aidreamcapes/dreamshoot/save-the-date/proposal/hero-ai-proposal-beach-sunset.jpg",
        "/assets/sites/site_aidreamcapes_eu/restored/originals/aidreamcapes-eu-no-crop-v1/provider-buming-20260926/proposal/hero-ai-proposal-beach-sunset.jpg"
      ],
      [
        "/assets/sites/site_aidreamcapes_eu/mirror/aidreamcapes/dreamshoot/save-the-date/vendor-api-gpt-image-2-4k-v1/proposal/hero-ai-proposal-beach-sunset.jpg",
        "/assets/sites/site_aidreamcapes_eu/restored/originals/aidreamcapes-eu-no-crop-v1/provider-buming-20260926/proposal/hero-ai-proposal-beach-sunset.jpg"
      ],
      [
        "/assets/sites/site_aidreamcapes_eu/mirror/aidreamcapes/dreamshoot/save-the-date/engagement/hero-ai-engagement-couple-sunset.jpg",
        "/assets/sites/site_aidreamcapes_eu/restored/originals/aidreamcapes-eu-no-crop-v1/provider-buming-20260926/engagement/hero-ai-engagement-couple-sunset.jpg"
      ],
      [
        "/assets/sites/site_aidreamcapes_eu/mirror/aidreamcapes/dreamshoot/generated/pack-galleries/ai-video-add-ons/ai-video-add-ons-02.webp",
        "/assets/sites/site_aidreamcapes_eu/restored/originals/aidreamcapes-eu-no-crop-v1/provider-buming-20260926/motion-generator/ai-video-add-ons-02-product-motion.jpg"
      ],
      [
        "/assets/sites/site_aidreamcapes_eu/mirror/aidreamcapes/dreamshoot/generated/pack-galleries/ai-video-add-ons/ai-video-add-ons-03.webp",
        "/assets/sites/site_aidreamcapes_eu/generated/recovered/aidreamcapes-eu-image-pack-4k-20260916-v1/motion-generator/gallery-07-motion-generator-07-rainy-rooftop-ad2f11017c4b.jpg"
      ],
      [
        "/assets/sites/site_aidreamcapes_eu/mirror/aidreamcapes/dreamshoot/seasonal/wedding-ceremony/hero-ai-wedding-ceremony-first-kiss.jpg",
        "/assets/sites/site_aidreamcapes_eu/restored/originals/aidreamcapes-eu-no-crop-v1/provider-buming-20260926/wedding-ceremony/hero-ai-wedding-ceremony-first-kiss.jpg"
      ],
      [
        "/assets/sites/site_aidreamcapes_eu/mirror/aidreamcapes/dreamshoot/save-the-date/vendor-api-gpt-image-2-4k-v1/wedding-ceremony/hero-ai-wedding-ceremony-first-kiss.jpg",
        "/assets/sites/site_aidreamcapes_eu/restored/originals/aidreamcapes-eu-no-crop-v1/provider-buming-20260926/wedding-ceremony/hero-ai-wedding-ceremony-first-kiss.jpg"
      ]
    ])
  },
  {
    siteId: "site_mydreamshoots_xby",
    domain: "aidreamshoots.eu",
    slugs: ["/ai-video-generation/talking-photo"],
    replacements: new Map([
      [
        "/assets/sites/site_aidreamshoots/visuals/talking-photo/talking-photo-birthday-greeting-woman-cake.webp",
        "/assets/sites/site_aidreamshoots/restored/originals/aidreamshoots-eu-no-crop-v1/provider-buming-20260926/talking-photo/talking-photo-birthday-greeting-woman-cake.jpg"
      ],
      [
        "/assets/sites/site_aidreamshoots/visuals/talking-photo/talking-photo-personal-message-older-man.webp",
        "/assets/sites/site_aidreamshoots/restored/originals/aidreamshoots-eu-no-crop-v1/provider-buming-20260926/talking-photo/talking-photo-personal-message-older-man.jpg"
      ],
      [
        "/assets/sites/site_aidreamshoots/visuals/talking-photo/talking-photo-education-explainer-teacher.webp",
        "/assets/sites/site_aidreamshoots/restored/originals/aidreamshoots-eu-no-crop-v1/provider-buming-20260926/talking-photo/talking-photo-education-explainer-teacher.jpg"
      ],
      [
        "/assets/sites/site_aidreamshoots/visuals/talking-photo/talking-photo-social-video-creator.webp",
        "/assets/sites/site_aidreamshoots/restored/originals/aidreamshoots-eu-no-crop-v1/provider-buming-20260926/talking-photo/talking-photo-social-video-creator.jpg"
      ],
      [
        "/assets/sites/site_aidreamshoots/visuals/talking-photo/talking-photo-product-intro-spokesperson.webp",
        "/assets/sites/site_aidreamshoots/restored/originals/aidreamshoots-eu-no-crop-v1/provider-buming-20260926/talking-photo/talking-photo-product-intro-spokesperson.jpg"
      ],
      [
        "/assets/sites/site_aidreamshoots/visuals/talking-photo/talking-photo-holiday-greeting-woman-gift.webp",
        "/assets/sites/site_aidreamshoots/restored/originals/aidreamshoots-eu-no-crop-v1/provider-buming-20260926/talking-photo/talking-photo-holiday-greeting-woman-gift.jpg"
      ]
    ])
  }
];

function parseJson(value) {
  return typeof value === "string" ? JSON.parse(value) : value;
}

function replaceExact(value, replacements, stats) {
  if (Array.isArray(value)) return value.map((item) => replaceExact(item, replacements, stats));
  if (!value || typeof value !== "object") {
    if (typeof value === "string" && replacements.has(value)) {
      stats.replaced += 1;
      return replacements.get(value);
    }
    return value;
  }
  for (const [key, child] of Object.entries(value)) {
    value[key] = replaceExact(child, replacements, stats);
  }
  return value;
}

function assetFile(url, domain) {
  const clean = String(url).split("?", 1)[0];
  return path.join("/www/wwwroot", domain, "current", "public", clean.replace(/^\//, ""));
}

async function assertAssetsExist(config) {
  for (const target of config.replacements.values()) {
    const file = assetFile(target, config.domain);
    const stat = await fs.stat(file).catch(() => null);
    if (!stat?.isFile() || stat.size < 1) {
      throw new Error(`asset_missing_or_empty:${file}`);
    }
  }
}

const result = { assetChecks: [], livePages: [], themePages: [] };

try {
  for (const config of replacementsBySite) {
    await assertAssetsExist(config);
    result.assetChecks.push({ siteId: config.siteId, checked: config.replacements.size });
  }

  await prisma.$transaction(async (tx) => {
    for (const config of replacementsBySite) {
      const liveRows = await tx.livePage.findMany({
        where: { siteId: config.siteId, slug: { in: config.slugs } },
        select: { id: true, slug: true, contentJson: true }
      });
      if (liveRows.length !== config.slugs.length) {
        throw new Error(`live_page_count_mismatch:${config.siteId}:${liveRows.length}/${config.slugs.length}`);
      }
      for (const row of liveRows) {
        const stats = { replaced: 0 };
        const contentJson = replaceExact(parseJson(row.contentJson), config.replacements, stats);
        await tx.livePage.update({ where: { id: row.id }, data: { contentJson, updatedAt: new Date() } });
        result.livePages.push({ siteId: config.siteId, slug: row.slug, replaced: stats.replaced });
      }

      const themeRows = await tx.themePage.findMany({
        where: { siteId: config.siteId, slug: { in: config.slugs } },
        select: { id: true, slug: true, draftJson: true, publishedJson: true }
      });
      for (const row of themeRows) {
        const draftStats = { replaced: 0 };
        const publishedStats = { replaced: 0 };
        const draftJson = replaceExact(parseJson(row.draftJson), config.replacements, draftStats);
        const publishedJson = replaceExact(parseJson(row.publishedJson), config.replacements, publishedStats);
        if (draftStats.replaced === 0 && publishedStats.replaced === 0) continue;
        await tx.themePage.update({
          where: { id: row.id },
          data: { draftJson, publishedJson, updatedAt: new Date() }
        });
        result.themePages.push({ siteId: config.siteId, slug: row.slug, draftReplaced: draftStats.replaced, publishedReplaced: publishedStats.replaced });
      }
    }
  });

  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
} finally {
  await prisma.$disconnect();
}
