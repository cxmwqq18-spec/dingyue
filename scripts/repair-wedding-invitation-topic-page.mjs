#!/usr/bin/env node
import assert from "node:assert/strict";
import "./load-runtime-env.mjs";
import path from "node:path";
import Module from "node:module";
import createJiti from "jiti";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

const siteId = process.env.SAVE_THE_DATE_SITE_ID || "site_dreamshoot";
const apply = process.argv.includes("--apply");
const databaseTarget = String(process.env.DATABASE_TARGET || "local").trim().toLowerCase();
if (apply && databaseTarget === "remote" && process.env.CONFIRM_WEDDING_INVITATION_PRODUCTION !== "1") {
  throw new Error("Production repair requires CONFIRM_WEDDING_INVITATION_PRODUCTION=1.");
}
assertDatabaseTarget({ expectedTarget: databaseTarget });

const sourceRoot = path.join(process.cwd(), "src");
const originalLoad = Module._load;
Module._load = function load(request, ...args) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, ...args);
};
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function resolve(request, ...args) {
  if (request === "server-only") return path.join(sourceRoot, "lib/storefront-context/types.ts");
  const aliased = request.startsWith("@/") ? path.join(sourceRoot, request.slice(2)) : request;
  const resolved = request.startsWith("@/") && !path.extname(aliased) ? `${aliased}.ts` : aliased;
  return originalResolve.call(this, resolved, ...args);
};

const jiti = createJiti(import.meta.url);
const { resolveWeddingInvitationTopicContent, WEDDING_INVITATION_MEDIA } = jiti("../src/lib/mydreamshoots-video-topic-publication.ts");

function buildPageJson(content, canonicalPath) {
  return {
    pageType: "ai_tool",
    version: 1,
    sectionsOrder: ["ai_video_topic_landing_1"],
    sections: {
      ai_video_topic_landing_1: {
        type: "ai_video_topic_landing",
        settings: {
          anchor: "wedding-invitation",
          contentKey: "wedding-invitation",
          content: {
            ...structuredClone(content),
            seo: {
              ...content.seo,
              canonicalPath,
              canonical: canonicalPath
            }
          }
        },
        blocks: []
      }
    },
    seo: {
      title: content.seo.title,
      description: content.seo.description,
      keywords: content.seo.keywords,
      canonicalPath,
      canonical: canonicalPath,
      index: true,
      follow: true,
      robots: { index: true, follow: true }
    }
  };
}

const prisma = new PrismaClient();
try {
  const slug = "/ai-video-generation/wedding-invitation";
  const canonicalPath = "/ai-save-the-date/wedding-invitation";
  const [livePage, themePage] = await Promise.all([
    prisma.livePage.findUnique({
      where: { siteId_slug: { siteId, slug } },
      select: { id: true, slug: true, title: true, pageType: true, templateKey: true, contentJson: true }
    }),
    prisma.themePage.findUnique({
      where: { siteId_slug: { siteId, slug } },
      select: { id: true, slug: true, title: true, pageType: true, templateKey: true, draftJson: true }
    })
  ]);
  assert(livePage, "missing_wedding_invitation_live_page");
  assert(themePage, "missing_wedding_invitation_theme_page");

  // LivePage is the only public content source. The legacy ThemePage row is
  // mirrored for compatibility but must never be used to reconstruct content.
  const source = livePage;
  const content = resolveWeddingInvitationTopicContent({
    slug,
    title: source.title,
    draftJson: source.contentJson ?? {}
  }, canonicalPath);
  assert(content, "missing_wedding_invitation_topic_content");
  const pageJson = buildPageJson(content, canonicalPath);
  const weddingInvitationGallery = WEDDING_INVITATION_MEDIA.slice(1).map((item) => item.src);
  const weddingInvitationCover = WEDDING_INVITATION_MEDIA[0];
  const nextNavigation = structuredClone((await prisma.themeSettings.findUnique({ where: { siteId }, select: { draftJson: true } }))?.draftJson ?? {});
  for (const group of nextNavigation.saveTheDateNavigation?.groups ?? []) {
    for (const item of group.items ?? []) {
      if (item.href === canonicalPath) {
        item.imageUrl = weddingInvitationCover.src;
        item.imageAlt = weddingInvitationCover.alt;
        item.status = "published";
      }
    }
  }
  const publishedSettings = structuredClone((await prisma.themeSettings.findUnique({ where: { siteId }, select: { publishedJson: true } }))?.publishedJson ?? {});
  publishedSettings.saveTheDateNavigation = structuredClone(nextNavigation.saveTheDateNavigation);

  if (apply) {
    await prisma.$transaction(async (tx) => {
      await tx.livePage.update({
        where: { id: livePage.id },
        data: {
          pageType: "ai_tool",
          templateKey: "ai-video-topic-wedding-invitation",
          title: livePage.title,
          contentJson: pageJson
        }
      });
      await tx.themePage.update({
        where: { id: themePage.id },
        data: {
          pageType: "ai_tool",
          templateKey: "ai-video-topic-wedding-invitation",
          title: themePage.title,
          draftJson: pageJson,
          publishedJson: pageJson
        }
      });
      await tx.videoTheme.update({
        where: { siteId_slug: { siteId, slug: "wedding-invitation" } },
        data: {
          imageUrl: weddingInvitationCover.src,
          galleryImages: weddingInvitationGallery
        }
      });
      for (const item of WEDDING_INVITATION_MEDIA) {
        await tx.mediaAsset.upsert({
          where: { siteId_storageKey: { siteId, storageKey: item.src } },
          create: {
            id: `media_${siteId}_${Buffer.from(item.src).toString("hex").slice(0, 24)}`,
            siteId,
            label: item.src.split("/").pop() || item.src,
            storageKey: item.src,
            mimeType: "image/jpeg",
            usageType: "theme",
            sourceType: "wedding-invitation-topic-repair",
            previewUrl: item.src,
            originUrl: item.src,
            altText: item.alt
          },
          update: {
            altText: item.alt,
            previewUrl: item.src,
            originUrl: item.src,
            usageType: "theme",
            sourceType: "wedding-invitation-topic-repair"
          }
        });
      }
      await tx.themeSettings.update({ where: { siteId }, data: { draftJson: nextNavigation, publishedJson: publishedSettings } });
    });
  }

  console.log(JSON.stringify({
    ok: true,
    mode: apply ? "applied" : "dry-run",
    siteId,
    slug,
    canonicalPath,
    media: [weddingInvitationCover.src, ...weddingInvitationGallery],
    navigation: nextNavigation.saveTheDateNavigation,
    sectionTypes: pageJson.sectionsOrder.map((sectionId) => pageJson.sections[sectionId].type),
    heroTitle: pageJson.sections.ai_video_topic_landing_1.settings.content.hero.title
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
