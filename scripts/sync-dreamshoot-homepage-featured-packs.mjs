#!/usr/bin/env node
import "./load-runtime-env.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const repoRoot = process.cwd();
const statePath = path.join(repoRoot, "data", "platform-state.json");
const orderedFeaturedIds = ["featured_pack_1", "featured_christmas_1", "featured_thanksgiving_1"];
const additionalFeaturedIds = ["featured_christmas_1", "featured_thanksgiving_1"];
const assetVersion = "20260801visualfix1";
const dreamshootFeaturedCoverImages = {
  featured_christmas_1: dreamshootAsset("/assets/dreamshoot/generated/pack-galleries/christmas-photos/christmas-photos-10.webp"),
  featured_thanksgiving_1: dreamshootAsset("/assets/dreamshoot/generated/pack-galleries/thanksgiving-group-photos/thanksgiving-group-photos-10.webp")
};

const rawArgs = process.argv.slice(2);
const args = new Map();
const flags = new Set();
for (let index = 0; index < rawArgs.length; index += 1) {
  const rawArg = rawArgs[index];
  if (!rawArg.startsWith("--")) continue;
  const [key, ...rest] = rawArg.slice(2).split("=");
  if (rest.length) {
    args.set(key, rest.join("="));
  } else {
    const next = rawArgs[index + 1];
    if (next && !next.startsWith("--")) {
      args.set(key, next);
      index += 1;
    } else {
      flags.add(key);
    }
  }
}

const dryRun = flags.has("dry-run");
const updateDb = flags.has("db");
const selectedStores = new Set(
  String(args.get("stores") ?? args.get("store") ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
);

function block(id, type, settings) {
  return { id, type, settings };
}

function section(type, settings, blocks = []) {
  return { type, version: "1", card_name: type, settings, blocks };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function asset(...parts) {
  return `/assets/sites/site_aidreamcapes/fan-holiday-theme/${parts.join("/")}.webp?v=${assetVersion}`;
}

function dreamshootAsset(pathname) {
  return `${pathname}?v=${assetVersion}`;
}

function dreamshootFeaturedSections() {
  return {
    featured_christmas_1: section(
      "dreamshoot_featured_pack",
      {
        anchor: "christmas-holiday-pack",
        label: "Featured holiday pack",
        badge: "Christmas pack",
        title: "Christmas group photos for cards, posts, and private albums.",
        subtitle: "Create festive group portraits, cozy card scenes, warm couple images, and album-ready Christmas visuals from photos you own or can use.",
        primaryCta: "Create Christmas Photos",
        primaryHref: "/login",
        secondaryCta: "View Christmas Photos",
        secondaryHref: "/collections/christmas-photos",
        photos: "Holiday cards",
        credits: "20 credits",
        privacy: "Private album",
        includedTitle: "Included outputs",
        includedOutputs: "Christmas portraits|Festive group scenes|Greeting-card covers|Cozy card-ready crops|Private album images|Warm holiday downloads|Social posts|Square profile crops",
        safetyCopy: "Use photos you own or have permission to use. MyDreamShoots does not recreate protected brand marks, official holiday artwork, celebrity likenesses, or public figures without permission.",
        overlayTitle: "Christmas Photos",
        overlaySubtitle: "Festive holiday portraits without a studio.",
        overlayChips: "Christmas cards|group portraits|cozy scenes|private",
        bottomNote: "Holiday packs can cover Christmas cards, group portraits, couple keepsakes, Thanksgiving warmth, and private seasonal albums.",
        campaignLabel: "Current campaign: Christmas Photos",
        nextCampaignLabel: "Next: Thanksgiving / Halloween / Seasonal"
      },
      [
      block("seasonal_christmas_1", "seasonal_image", { label: "Christmas Portraits", meta: "Card-ready mood", imageUrl: dreamshootAsset("/assets/dreamshoot/generated/pack-galleries/christmas-photos/christmas-photos-06.webp"), collectionSlug: "christmas-photos", shape: "square" }),
      block("seasonal_christmas_2", "seasonal_image", { label: "Greeting Card Scene", meta: "Festive group crop", imageUrl: dreamshootAsset("/assets/dreamshoot/generated/pack-galleries/christmas-photos/christmas-photos-07.webp"), collectionSlug: "christmas-photos", shape: "square" }),
      block("seasonal_christmas_3", "seasonal_image", { label: "Cozy Couple", meta: "Warm keepsake", imageUrl: dreamshootAsset("/assets/dreamshoot/generated/pack-galleries/christmas-couple/christmas-couple-04.webp"), collectionSlug: "christmas-couple", shape: "square" }),
      block("seasonal_christmas_4", "seasonal_image", { label: "Holiday Cover", meta: "Private album art", imageUrl: dreamshootAsset("/assets/dreamshoot/generated/pack-covers/christmas-photos/christmas-photos-cover.webp"), collectionSlug: "christmas-photos", shape: "square" }),
      block("seasonal_christmas_5", "seasonal_image", { label: "Seasonal Album", meta: "Family-style glow", imageUrl: dreamshootAsset("/assets/dreamshoot/generated/pack-galleries/christmas-photos/christmas-photos-08.webp"), collectionSlug: "christmas-photos", shape: "square" }),
      block("seasonal_christmas_6", "seasonal_image", { label: "Giftable Keepsake", meta: "Social-ready crop", imageUrl: dreamshootAsset("/assets/dreamshoot/generated/pack-galleries/christmas-couple/christmas-couple-05.webp"), collectionSlug: "christmas-couple", shape: "square" })
      ]
    ),
    featured_thanksgiving_1: section(
      "dreamshoot_featured_pack",
      {
        anchor: "thanksgiving-pack",
        label: "Featured seasonal pack",
        badge: "Thanksgiving pack",
        title: "Thanksgiving group photos for warm private albums.",
        subtitle: "Create dinner-table portraits, Friendsgiving scenes, gratitude cards, and keepsake crops from photos you own or can use.",
        primaryCta: "Create Thanksgiving Photos",
        primaryHref: "/login",
        secondaryCta: "View Thanksgiving Photos",
        secondaryHref: "/collections/thanksgiving-group-photos",
        photos: "Group portraits",
        credits: "20 credits",
        privacy: "Private gallery",
        includedTitle: "Included outputs",
        includedOutputs: "Dinner-table portraits|Warm gathering scenes|Friendsgiving memories|Group-friendly crops|Gratitude cards|Seasonal notes|Private album covers|Download-ready images",
        safetyCopy: "Use clear photos you own or have permission to use. MyDreamShoots keeps Thanksgiving sets private and avoids protected people, marks, or brand assets without permission.",
        overlayTitle: "Thanksgiving Photos",
        overlaySubtitle: "Warm gratitude scenes from approved photos.",
        overlayChips: "group portraits|gratitude cards|Friendsgiving|private",
        bottomNote: "Thanksgiving packs work best with clear group photos, warm setting cues, and simple album goals.",
        campaignLabel: "Current campaign: Thanksgiving Group Photos",
        nextCampaignLabel: "Next: Christmas / Halloween / Seasonal"
      },
      [
      block("seasonal_thanksgiving_1", "seasonal_image", { label: "Dinner Portraits", meta: "Warm table scene", imageUrl: dreamshootAsset("/assets/dreamshoot/generated/pack-galleries/thanksgiving-group-photos/thanksgiving-group-photos-05.webp"), collectionSlug: "thanksgiving-group-photos", shape: "square" }),
      block("seasonal_thanksgiving_2", "seasonal_image", { label: "Friendsgiving Set", meta: "Group-friendly crop", imageUrl: dreamshootAsset("/assets/dreamshoot/generated/pack-galleries/thanksgiving-group-photos/thanksgiving-group-photos-06.webp"), collectionSlug: "thanksgiving-group-photos", shape: "square" }),
      block("seasonal_thanksgiving_3", "seasonal_image", { label: "Gratitude Card", meta: "Seasonal note", imageUrl: dreamshootAsset("/assets/dreamshoot/generated/pack-galleries/thanksgiving-group-photos/thanksgiving-group-photos-07.webp"), collectionSlug: "thanksgiving-group-photos", shape: "square" }),
      block("seasonal_thanksgiving_4", "seasonal_image", { label: "Keepsake Cover", meta: "Private album art", imageUrl: dreamshootAsset("/assets/dreamshoot/generated/pack-covers/thanksgiving-group-photos/thanksgiving-group-photos-cover.webp"), collectionSlug: "thanksgiving-group-photos", shape: "square" }),
      block("seasonal_thanksgiving_5", "seasonal_image", { label: "Family-style Album", meta: "Harvest warmth", imageUrl: dreamshootAsset("/assets/dreamshoot/generated/pack-galleries/thanksgiving-group-photos/thanksgiving-group-photos-08.webp"), collectionSlug: "thanksgiving-group-photos", shape: "square" }),
      block("seasonal_thanksgiving_6", "seasonal_image", { label: "Host Story", meta: "Download-ready image", imageUrl: dreamshootAsset("/assets/dreamshoot/generated/pack-galleries/thanksgiving-group-photos/thanksgiving-group-photos-09.webp"), collectionSlug: "thanksgiving-group-photos", shape: "square" })
      ]
    )
  };
}

function aidreamcapesFeaturedSections() {
  const complianceCopy =
    "Use only photos you own or have permission to use. Aidreamcapes does not recreate real celebrities, real athletes, public figures, official team logos, event marks, brand logos, trademarks, or protected materials without permission.";
  return {
    featured_christmas_1: section(
      "dreamshoot_featured_pack",
      {
        anchor: "christmas-holiday-albums",
        label: "Featured Aidreamcapes holiday album",
        badge: "Christmas albums",
        title: "Build a private Christmas album around the people in your own photos.",
        subtitle: "Create festive group portraits, card covers, winter greeting scenes, and cozy album crops from approved source photos.",
        primaryCta: "Create a Christmas album",
        primaryHref: "/tools/christmas-group-album-studio",
        secondaryCta: "Browse Christmas albums",
        secondaryHref: "/collections/christmas-holiday-albums",
        photos: "Group album",
        credits: "22 credits",
        privacy: "Permission-safe",
        includedTitle: "Included outputs",
        includedOutputs: "Festive group portraits|Christmas album scenes|Card cover images|Cozy winter crops|Greeting album visuals|Private downloads|Family-style keepsakes|Account-only gallery",
        safetyCopy: complianceCopy,
        overlayTitle: "Christmas Holiday Albums",
        overlaySubtitle: "Cozy festive sets with account-only delivery.",
        overlayChips: "Christmas|group album|card cover|private",
        bottomNote: "Aidreamcapes Christmas albums keep source-photo permission, visible credits, and private delivery clear before generation.",
        campaignLabel: "Current focus: Christmas holiday albums",
        nextCampaignLabel: "Next: Thanksgiving / Halloween / Seasonal"
      },
      [
      block("featured_christmas_album", "seasonal_image", { label: "Christmas album", meta: "Festive cover", imageUrl: asset("covers", "christmas-group-album"), collectionSlug: "christmas-group-albums", shape: "square" }),
      block("featured_christmas_category", "seasonal_image", { label: "Holiday category", meta: "Group-ready set", imageUrl: asset("categories", "christmas-holiday-albums"), collectionSlug: "christmas-holiday-albums", shape: "square" }),
      block("featured_christmas_gallery_1", "seasonal_image", { label: "Card cover", meta: "Cozy crop", imageUrl: asset("gallery", "christmas-group-album-01"), collectionSlug: "christmas-group-albums", shape: "square" }),
      block("featured_christmas_gallery_2", "seasonal_image", { label: "Winter greeting", meta: "Private album", imageUrl: asset("gallery", "christmas-group-album-02"), collectionSlug: "winter-fan-greeting-albums", shape: "square" }),
      block("featured_christmas_group", "seasonal_image", { label: "Group album", meta: "Family-style mood", imageUrl: asset("categories", "christmas-group-albums"), collectionSlug: "christmas-group-albums", shape: "square" }),
      block("featured_christmas_motion", "seasonal_image", { label: "Holiday story", meta: "Album-ready frame", imageUrl: asset("posters", "christmas-card-motion"), collectionSlug: "christmas-holiday-albums", shape: "square" })
      ]
    ),
    featured_thanksgiving_1: section(
      "dreamshoot_featured_pack",
      {
        anchor: "thanksgiving-memory-sets",
        label: "Featured Aidreamcapes occasion album",
        badge: "Thanksgiving sets",
        title: "Turn a gathering table into a permission-safe Thanksgiving keepsake set.",
        subtitle: "Create gratitude portraits, Friendsgiving memories, host-story crops, and warm dinner-table album images from approved photos.",
        primaryCta: "Create a Thanksgiving set",
        primaryHref: "/tools/thanksgiving-keepsake-set-maker",
        secondaryCta: "Browse Thanksgiving sets",
        secondaryHref: "/collections/thanksgiving-memory-sets",
        photos: "Keepsake set",
        credits: "20 credits",
        privacy: "Private delivery",
        includedTitle: "Included outputs",
        includedOutputs: "Gratitude portraits|Dinner-table warmth|Friendsgiving memories|Group-friendly keepsakes|Host story crops|Seasonal card images|Private album covers|Download-ready visuals",
        safetyCopy: complianceCopy,
        overlayTitle: "Thanksgiving Keepsake Sets",
        overlaySubtitle: "Warm occasion albums from approved source photos.",
        overlayChips: "Thanksgiving|keepsake|Friendsgiving|private",
        bottomNote: "Thanksgiving sets work best when each person is clear and the album mood stays simple, warm, and permission-safe.",
        campaignLabel: "Current focus: Thanksgiving keepsake sets",
        nextCampaignLabel: "Next: Christmas / Halloween / Seasonal"
      },
      [
      block("featured_thanksgiving_cover", "seasonal_image", { label: "Keepsake table", meta: "Warm cover", imageUrl: asset("covers", "thanksgiving-keepsake-table-set"), collectionSlug: "thanksgiving-table-keepsakes", shape: "square" }),
      block("featured_thanksgiving_category", "seasonal_image", { label: "Memory sets", meta: "Occasion category", imageUrl: asset("categories", "thanksgiving-memory-sets"), collectionSlug: "thanksgiving-memory-sets", shape: "square" }),
      block("featured_thanksgiving_gallery_1", "seasonal_image", { label: "Gratitude portrait", meta: "Private gallery", imageUrl: asset("gallery", "thanksgiving-keepsake-table-set-01"), collectionSlug: "gratitude-group-portraits", shape: "square" }),
      block("featured_thanksgiving_gallery_2", "seasonal_image", { label: "Friendsgiving scene", meta: "Group crop", imageUrl: asset("gallery", "thanksgiving-keepsake-table-set-02"), collectionSlug: "friendsgiving-memory-sets", shape: "square" }),
      block("featured_thanksgiving_table", "seasonal_image", { label: "Table keepsake", meta: "Seasonal card", imageUrl: asset("categories", "thanksgiving-table-keepsakes"), collectionSlug: "thanksgiving-table-keepsakes", shape: "square" }),
      block("featured_thanksgiving_motion", "seasonal_image", { label: "Host story", meta: "Album-ready frame", imageUrl: asset("posters", "thanksgiving-keepsake-film"), collectionSlug: "thanksgiving-memory-sets", shape: "square" })
      ]
    )
  };
}

const stores = [
  {
    key: "mydreamshoots",
    siteId: "site_dreamshoot",
    siteSlug: "mydreamshoots",
    sections: dreamshootFeaturedSections()
  },
  {
    key: "aidreamcapes",
    siteId: "site_aidreamcapes",
    siteSlug: "aidreamcapes",
    sections: aidreamcapesFeaturedSections()
  }
].filter((store) =>
  !selectedStores.size ||
  selectedStores.has(store.key) ||
  selectedStores.has(store.siteId) ||
  selectedStores.has(store.siteSlug)
);

function normalizeOrder(order, sections) {
  const baseOrder = Array.from(new Set((order ?? []).filter((id) => !additionalFeaturedIds.includes(id))));
  const packageIndex = baseOrder.indexOf("package_catalog_1");
  const existingFeaturedIndex = baseOrder.indexOf("featured_pack_1");
  const insertAt = existingFeaturedIndex >= 0 ? existingFeaturedIndex + 1 : packageIndex >= 0 ? packageIndex : Math.min(4, baseOrder.length);
  baseOrder.splice(insertAt, 0, ...additionalFeaturedIds);
  return baseOrder.filter((id) => id === "featured_pack_1" || Boolean(sections[id]));
}

function applyDreamshootVisualProofIsolation(sections) {
  const visualProof = sections?.visual_proof_1;
  const blocks = visualProof?.blocks;
  const catalog = sections?.package_catalog_1?.blocks;
  if (!Array.isArray(blocks) && !Array.isArray(catalog)) return false;

  let changed = false;
  const updateBlock = (collection, blockId, nextSettings) => {
    const block = collection?.find((item) => item?.id === blockId);
    if (!block?.settings) return;
    const before = JSON.stringify(block.settings);
    block.settings = {
      ...block.settings,
      ...nextSettings
    };
    if (before !== JSON.stringify(block.settings)) changed = true;
  };

  updateBlock(blocks, "proof_christmas", {
    title: "Christmas group photos",
    description: "Festive couple, family-style, and friend-group portraits for cards, posts, and private albums.",
    imageUrl: dreamshootAsset("/assets/dreamshoot/generated/pack-galleries/christmas-photos/christmas-photos-01.webp"),
    href: "/collections/christmas-photos",
    previewImages: `${dreamshootAsset("/assets/dreamshoot/generated/pack-galleries/christmas-photos/christmas-photos-04.webp")}|${dreamshootAsset("/assets/dreamshoot/generated/pack-galleries/christmas-couple/christmas-couple-03.webp")}`
  });
  updateBlock(blocks, "proof_seasonal", {
    imageUrl: "/assets/dreamshoot/generated/pack-covers/holiday/holiday-cover.webp?v=20260803safecover1"
  });
  updateBlock(catalog, "catalog_holiday", {
    imageUrl: "/assets/dreamshoot/generated/pack-covers/holiday/holiday-cover.webp?v=20260803safecover1"
  });
  updateBlock(catalog, "catalog_thanksgiving", {
    imageUrl: "/assets/dreamshoot/generated/pack-covers/thanksgiving-group-photos/thanksgiving-group-photos-cover.webp?v=20260801visualfix1"
  });
  updateBlock(catalog, "catalog_halloween", {
    imageUrl: "/assets/dreamshoot/generated/pack-covers/halloween-party-photos/halloween-party-photos-cover.webp?v=20260803safecover1"
  });

  return changed;
}

function applyDreamshootFeaturedCoverImages(sections, store) {
  if (store.siteId !== "site_dreamshoot") return;
  for (const [sectionId, imageUrl] of Object.entries(dreamshootFeaturedCoverImages)) {
    if (sections[sectionId]?.settings) {
      sections[sectionId].settings.imageUrl = imageUrl;
    }
  }
}

function applyFeaturedSectionsToPageJson(pageJson, store) {
  if (!pageJson?.sections || !Array.isArray(pageJson.sectionsOrder)) return false;
  const before = JSON.stringify({
    order: pageJson.sectionsOrder,
    christmas: pageJson.sections.featured_christmas_1,
    thanksgiving: pageJson.sections.featured_thanksgiving_1,
    visualProofChristmas: store.siteId === "site_dreamshoot" ? pageJson.sections.visual_proof_1?.blocks?.find((item) => item?.id === "proof_christmas") : undefined,
    visualProofSeasonal: store.siteId === "site_dreamshoot" ? pageJson.sections.visual_proof_1?.blocks?.find((item) => item?.id === "proof_seasonal") : undefined,
    catalogHoliday: store.siteId === "site_dreamshoot" ? pageJson.sections.package_catalog_1?.blocks?.find((item) => item?.id === "catalog_holiday") : undefined,
    catalogThanksgiving: store.siteId === "site_dreamshoot" ? pageJson.sections.package_catalog_1?.blocks?.find((item) => item?.id === "catalog_thanksgiving") : undefined,
    catalogHalloween: store.siteId === "site_dreamshoot" ? pageJson.sections.package_catalog_1?.blocks?.find((item) => item?.id === "catalog_halloween") : undefined
  });
  for (const id of additionalFeaturedIds) {
    pageJson.sections[id] = clone(store.sections[id]);
  }
  if (store.siteId === "site_dreamshoot") {
    applyDreamshootVisualProofIsolation(pageJson.sections);
  }
  pageJson.sectionsOrder = normalizeOrder(pageJson.sectionsOrder, pageJson.sections);
  applyDreamshootFeaturedCoverImages(pageJson.sections, store);
  const after = JSON.stringify({
    order: pageJson.sectionsOrder,
    christmas: pageJson.sections.featured_christmas_1,
    thanksgiving: pageJson.sections.featured_thanksgiving_1,
    visualProofChristmas: store.siteId === "site_dreamshoot" ? pageJson.sections.visual_proof_1?.blocks?.find((item) => item?.id === "proof_christmas") : undefined,
    visualProofSeasonal: store.siteId === "site_dreamshoot" ? pageJson.sections.visual_proof_1?.blocks?.find((item) => item?.id === "proof_seasonal") : undefined,
    catalogHoliday: store.siteId === "site_dreamshoot" ? pageJson.sections.package_catalog_1?.blocks?.find((item) => item?.id === "catalog_holiday") : undefined,
    catalogThanksgiving: store.siteId === "site_dreamshoot" ? pageJson.sections.package_catalog_1?.blocks?.find((item) => item?.id === "catalog_thanksgiving") : undefined,
    catalogHalloween: store.siteId === "site_dreamshoot" ? pageJson.sections.package_catalog_1?.blocks?.find((item) => item?.id === "catalog_halloween") : undefined
  });
  return before !== after;
}

function applyFeaturedSectionsToThemeTemplate(template, store) {
  if (!template?.sections || !Array.isArray(template.content_for_page)) return false;
  const before = JSON.stringify({
    order: template.content_for_page,
    christmas: template.sections.featured_christmas_1,
    thanksgiving: template.sections.featured_thanksgiving_1,
    visualProofChristmas: store.siteId === "site_dreamshoot" ? template.sections.visual_proof_1?.blocks?.find((item) => item?.id === "proof_christmas") : undefined,
    visualProofSeasonal: store.siteId === "site_dreamshoot" ? template.sections.visual_proof_1?.blocks?.find((item) => item?.id === "proof_seasonal") : undefined,
    catalogHoliday: store.siteId === "site_dreamshoot" ? template.sections.package_catalog_1?.blocks?.find((item) => item?.id === "catalog_holiday") : undefined,
    catalogThanksgiving: store.siteId === "site_dreamshoot" ? template.sections.package_catalog_1?.blocks?.find((item) => item?.id === "catalog_thanksgiving") : undefined,
    catalogHalloween: store.siteId === "site_dreamshoot" ? template.sections.package_catalog_1?.blocks?.find((item) => item?.id === "catalog_halloween") : undefined
  });
  for (const id of additionalFeaturedIds) {
    template.sections[id] = clone(store.sections[id]);
  }
  if (store.siteId === "site_dreamshoot") {
    applyDreamshootVisualProofIsolation(template.sections);
  }
  template.content_for_page = normalizeOrder(template.content_for_page, template.sections);
  applyDreamshootFeaturedCoverImages(template.sections, store);
  const after = JSON.stringify({
    order: template.content_for_page,
    christmas: template.sections.featured_christmas_1,
    thanksgiving: template.sections.featured_thanksgiving_1,
    visualProofChristmas: store.siteId === "site_dreamshoot" ? template.sections.visual_proof_1?.blocks?.find((item) => item?.id === "proof_christmas") : undefined,
    visualProofSeasonal: store.siteId === "site_dreamshoot" ? template.sections.visual_proof_1?.blocks?.find((item) => item?.id === "proof_seasonal") : undefined,
    catalogHoliday: store.siteId === "site_dreamshoot" ? template.sections.package_catalog_1?.blocks?.find((item) => item?.id === "catalog_holiday") : undefined,
    catalogThanksgiving: store.siteId === "site_dreamshoot" ? template.sections.package_catalog_1?.blocks?.find((item) => item?.id === "catalog_thanksgiving") : undefined,
    catalogHalloween: store.siteId === "site_dreamshoot" ? template.sections.package_catalog_1?.blocks?.find((item) => item?.id === "catalog_halloween") : undefined
  });
  return before !== after;
}

function applyToState(state) {
  const report = { pages: 0, themeTemplates: 0, publications: 0 };

  for (const store of stores) {
    const site = (state.sites ?? []).find((item) => item.id === store.siteId || item.slug === store.siteSlug);
    const homePage = site?.pages?.find((page) => page.slug === "/" || page.pageType === "home");
    if (homePage) {
      if (applyFeaturedSectionsToPageJson(homePage.draftJson, store)) report.pages += 1;
      if (applyFeaturedSectionsToPageJson(homePage.publishedJson, store)) report.pages += 1;
    }

    for (const theme of state.siteThemes ?? []) {
      if (theme.siteId !== store.siteId) continue;
      if (applyFeaturedSectionsToThemeTemplate(theme.templates?.index, store)) report.themeTemplates += 1;
    }

    for (const publication of state.themePublications ?? []) {
      if (publication.siteId !== store.siteId) continue;
      const homeSnapshot = publication.snapshot?.pages?.find((page) => page.slug === "/" || page.pageType === "home");
      if (homeSnapshot?.publishedJson && applyFeaturedSectionsToPageJson(homeSnapshot.publishedJson, store)) {
        report.publications += 1;
      }
      if (applyFeaturedSectionsToThemeTemplate(publication.snapshot?.saasTheme?.templates?.index, store)) {
        report.publications += 1;
      }
    }
  }

  return report;
}

function applyFeaturedSectionsToPublicationSnapshot(snapshot, store) {
  if (!snapshot || typeof snapshot !== "object") return { changed: false, snapshot };
  const nextSnapshot = clone(snapshot);
  let changed = false;
  const homeSnapshot = nextSnapshot.pages?.find((page) => page.slug === "/" || page.pageType === "home");
  if (homeSnapshot?.draftJson && applyFeaturedSectionsToPageJson(homeSnapshot.draftJson, store)) {
    changed = true;
  }
  if (homeSnapshot?.publishedJson && applyFeaturedSectionsToPageJson(homeSnapshot.publishedJson, store)) {
    changed = true;
  }
  if (applyFeaturedSectionsToThemeTemplate(nextSnapshot.saasTheme?.templates?.index, store)) {
    changed = true;
  }
  return { changed, snapshot: nextSnapshot };
}

function publicationMetrics(snapshot) {
  const pages = Array.isArray(snapshot?.pages) ? snapshot.pages : [];
  const sectionCount = pages.reduce((sum, page) => {
    const pageJson = page?.publishedJson ?? page?.draftJson;
    return sum + (Array.isArray(pageJson?.sectionsOrder) ? pageJson.sectionsOrder.length : 0);
  }, 0);
  return {
    pageCount: pages.length,
    sectionCount,
    snapshotBytes: Buffer.byteLength(JSON.stringify(snapshot))
  };
}

async function updateDatabase(state) {
  const prisma = new PrismaClient();
  const report = { pages: 0, siteThemes: 0, publications: 0 };
  try {
    for (const store of stores) {
      const homePage = (state.sites ?? [])
        .find((site) => site.id === store.siteId)
        ?.pages?.find((page) => page.slug === "/" || page.pageType === "home");
      if (homePage) {
        await prisma.themePage.updateMany({
          where: { siteId: store.siteId, slug: "/" },
          data: {
            draftJson: homePage.draftJson,
            publishedJson: homePage.publishedJson
          }
        });
        report.pages += 1;
      }

      const dbThemes = await prisma.siteTheme.findMany({
        where: { siteId: store.siteId },
        select: { id: true, templates: true }
      });
      for (const theme of dbThemes) {
        const templates = clone(theme.templates);
        if (!applyFeaturedSectionsToThemeTemplate(templates?.index, store)) continue;
        await prisma.siteTheme.update({
          where: { id: theme.id },
          data: { templates }
        });
        report.siteThemes += 1;
      }

      const publications = await prisma.themePublication.findMany({
        where: { siteId: store.siteId },
        select: { id: true, snapshot: true }
      });
      for (const publication of publications) {
        const result = applyFeaturedSectionsToPublicationSnapshot(publication.snapshot, store);
        if (!result.changed) continue;
        await prisma.themePublication.update({
          where: { id: publication.id },
          data: {
            snapshot: result.snapshot,
            ...publicationMetrics(result.snapshot)
          }
        });
        report.publications += 1;
      }
    }
    return report;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  if (!stores.length) throw new Error("no_store_selected");
  const state = JSON.parse(await fs.readFile(statePath, "utf8"));
  const stateReport = applyToState(state);
  if (!dryRun) {
    await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`);
  }
  const dbReport = updateDb && !dryRun ? await updateDatabase(state) : undefined;
  console.log(JSON.stringify({
    ok: true,
    dryRun,
    stores: stores.map((store) => store.key),
    featuredOrder: orderedFeaturedIds,
    state: stateReport,
    db: dbReport ?? "skipped"
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
