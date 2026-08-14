#!/usr/bin/env node
import "./load-runtime-env.mjs";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const updateDb = args.has("--db");
const statePath = path.join(repoRoot, "data", "platform-state.json");
const taxonomyPath = path.join(repoRoot, "src", "lib", "mydreamshoots-theme-taxonomy.json");
const packProfilesPath = path.join(repoRoot, "src", "lib", "dreamshoot-pack-profiles.json");
const useCaseProfilesPath = path.join(repoRoot, "src", "lib", "photo-package-use-case-profiles.json");
const SITE_ID = "site_dreamshoot";
const UPDATE_TIMESTAMP = "2026-08-14T00:00:00.000Z";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function slugUnderscore(slug) {
  return String(slug).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function normalizeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "")
    .replace(/^collections\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function packIdForItem(item) {
  return item.reusePackId || `pack_dreamshoot_${slugUnderscore(item.slug)}`;
}

function categoryIdForSlug(slug) {
  return `pack_cat_dreamshoot_${slugUnderscore(slug)}`;
}

function titleForItem(item) {
  return `AI ${item.label} Generator`;
}

function promptForItem(item) {
  return [
    `Using the uploaded reference photo, create ${item.promptCue}.`,
    "Preserve the subject's identity, age, skin tone, expression, and natural proportions.",
    "Use realistic lighting, believable texture, clean composition, and private gallery-ready output.",
    "Avoid protected logos, public-figure likenesses, unauthorized marks, explicit content, and identity changes."
  ].join(" ");
}

function detailTagsForItem(item) {
  return Array.from(new Set([
    ...item.tags,
    item.label,
    "Private Gallery",
    "AI Photos",
    "Source Photo Guidance",
    "Visible Credits",
    "Download-ready Results"
  ])).slice(0, 8);
}

function bestForItem(item) {
  const [primary = item.label, secondary = "private albums", tertiary = "profile updates"] = item.tags;
  return [
    `${primary} photo sets from approved source photos`,
    `${secondary} concepts with clear credit cost before generation`,
    `${tertiary} images for profiles, posts, cards, or creator pages`,
    "Private gallery review before downloading favorites"
  ];
}

function workflowForItem(item) {
  return [
    "Upload clear source photos you own or have permission to use.",
    `Choose the ${item.label} direction and review the expected image count.`,
    "Confirm the visible credit cost before generation starts.",
    "Review the private gallery, then download the images that match your use case."
  ];
}

function profileForItem(item) {
  return {
    headline: titleForItem(item),
    cardDescription: item.description,
    metaLabel: item.label,
    tags: item.tags,
    detailTags: detailTagsForItem(item),
    detailIntro: `${item.label} helps myDreamshoots customers turn approved uploads into a focused private photo set with a clear style, visible credit cost, and download-ready review.`,
    whatCreates: `A private gallery of ${item.label.toLowerCase()} images, alternate crops, and polished visual directions based on photos the customer owns or has permission to use.`,
    bestFor: bestForItem(item),
    workflow: workflowForItem(item),
    styleNotes: [
      `Keep the request focused on ${item.label} instead of mixing several unrelated looks into one job.`,
      "Use source photos with clear subject detail, natural lighting, and permission from every person shown.",
      "Review face, hands, background details, crop, and overall realism before using the result publicly."
    ],
    coverNote: `${item.label} works best when the source photos are current, sharp, and matched to the final use case.`,
    ...(item.safetyNote ? { safetyNote: item.safetyNote } : {})
  };
}

function profileForRoot(root) {
  return {
    headline: `${root.label} AI Photo Packages`,
    cardDescription: root.description,
    metaLabel: root.label,
    tags: root.tags,
    detailTags: Array.from(new Set([...root.tags, root.label, "AI Photo Packages", "Private Gallery", "Visible Credits"])),
    detailIntro: `${root.label} groups focused myDreamshoots collection pages so customers can compare the right photo direction before spending credits.`,
    whatCreates: `A curated set of ${root.label.toLowerCase()} choices with private uploads, clear package names, source-photo guidance, and account-only gallery delivery.`,
    bestFor: [
      `${root.label} package comparison before generation`,
      "Customers choosing between nearby visual directions",
      "Private albums with visible credit cost",
      "Profile, creator, holiday, lifestyle, or edit-ready photo sets"
    ],
    workflow: [
      "Compare the collection choices in this category.",
      "Open the theme that matches the final use case.",
      "Upload approved source photos and review credits.",
      "Generate a private gallery and download favorites."
    ],
    styleNotes: [
      "Choose one clear theme before generation.",
      "Keep source-photo permission and final-use intent visible.",
      "Review finished images privately before sharing."
    ],
    coverNote: `${root.label} is a navigation category, not a single generic generator.`
  };
}

function profileDescription(profile) {
  return [
    profile.detailIntro,
    profile.whatCreates,
    `Best for ${profile.bestFor.slice(0, 3).join("; ")}.`,
    profile.safetyNote || ""
  ].filter(Boolean).join(" ");
}

function findSiteRecord(records, slug) {
  return records.find((record) => record.siteId === SITE_ID && normalizeSlug(record.slug) === slug);
}

function findSourceRecord(records, sourceSlug) {
  return sourceSlug ? findSiteRecord(records, normalizeSlug(sourceSlug)) : undefined;
}

function updateCategory(category, fields, changes) {
  for (const [field, value] of Object.entries(fields)) {
    if (category[field] === value) continue;
    changes.push({ targetType: "CreativePackCategory", id: category.id, field, before: category[field], after: value });
    category[field] = value;
  }
}

function updatePack(pack, fields, changes) {
  for (const [field, value] of Object.entries(fields)) {
    const previous = JSON.stringify(pack[field]);
    const next = JSON.stringify(value);
    if (previous === next) continue;
    changes.push({ targetType: "CreativePack", id: pack.id, field, before: pack[field], after: value });
    pack[field] = value;
  }
}

function categoryFieldsForRoot(root) {
  return {
    siteId: SITE_ID,
    parentId: null,
    slug: root.slug,
    label: root.label,
    description: root.description,
    heroTitle: `${root.label} AI photo packages`,
    heroSubtitle: root.description,
    icon: root.icon,
    sortOrder: root.sortOrder,
    status: "active",
    updatedAt: UPDATE_TIMESTAMP
  };
}

function categoryFieldsForItem(item, parentId, sortOrder) {
  return {
    siteId: SITE_ID,
    parentId,
    slug: item.slug,
    label: item.label,
    description: item.description,
    heroTitle: titleForItem(item),
    heroSubtitle: profileForItem(item).detailIntro,
    icon: item.icon,
    sortOrder,
    status: "active",
    updatedAt: UPDATE_TIMESTAMP
  };
}

function packFieldsForItem(item, categoryId, sourcePack) {
  const profile = profileForItem(item);
  return {
    siteId: SITE_ID,
    categoryId,
    name: item.label,
    headline: profile.headline,
    description: profileDescription(profile),
    prompt: promptForItem(item),
    category: item.slug,
    aiAppSlug: sourcePack?.aiAppSlug || "image_generator",
    status: "active",
    creditCost: item.creditCost,
    outputCount: item.outputCount,
    trainingRequired: sourcePack?.trainingRequired ?? true,
    generationCount: sourcePack?.generationCount ?? 0,
    conversionRate: sourcePack?.conversionRate ?? 0,
    imageUrl: sourcePack?.imageUrl || "/assets/dreamshoot/generated/pack-covers/professional-headshots/professional-headshots-cover.webp?v=20260731themeuniqueness1",
    galleryImages: sourcePack?.galleryImages || [],
    galleryImageAlts: (sourcePack?.galleryImages || []).map((_, index) => `${item.label} private AI photo package gallery example ${index + 1} for myDreamshoots customers.`),
    updatedAt: UPDATE_TIMESTAMP
  };
}

function replaceCollectionHrefs(value) {
  if (typeof value !== "string") return value;
  const replacements = new Map([
    ["professional-headshots", "headshot"],
    ["headshots", "headshot"],
    ["engagement", "engagement-photo"],
    ["wedding-portraits", "wedding-photo"],
    ["valentine-photos", "valentines-photo"],
    ["christmas-photos", "christmas-photo"],
    ["halloween-party-photos", "halloween-photo"],
    ["thanksgiving-group-photos", "thanksgiving-photo"],
    ["profile-cards", "avatar"],
    ["anime-avatar", "avatar"],
    ["creator-portraits", "portrait-photo"],
    ["gala-photos", "gala-photo"],
    ["gala", "gala-photo"],
    ["world-cup-fan-photos", "soccer"],
    ["sports", "soccer"],
    ["beauty", "hairstyle-generator"],
    ["creative", "lifestyle-creative"],
    ["video", "motion-generator"],
    ["creator", "portrait-photo"],
    ["hairstyle", "hairstyle-generator"],
    ["ai-video-add-ons", "motion-generator"],
    ["outdoor-creator-scenes", "urban"],
    ["nature", "travel"],
    ["fashion-editorial", "street-style"],
    ["product-style", "background-changer"],
    ["social-cards", "edit-by-prompt"],
    ["magic-upscaler", "photo-enhancer"],
    ["indian-wedding", "rich-lifestyle"],
    ["desi-wedding", "cannes"],
    ["christmas-couple", "nightlife"]
  ]);
  const wholeValueReplacement = replacements.get(value);
  if (wholeValueReplacement) return wholeValueReplacement;
  return value.replace(/\/collections\/([a-z0-9-]+)/g, (match, slug) => {
    const next = replacements.get(slug);
    return next ? `/collections/${next}` : match;
  });
}

function replaceThemeText(value) {
  if (typeof value !== "string") return value;
  const replacements = [
    ["World Cup Fan Photos", "Soccer"],
    ["World Cup fan photos", "Soccer"],
    ["world cup fan photos", "soccer"],
    ["Professional Headshots", "Headshot"],
    ["Professional headshots", "Headshot"],
    ["professional headshots", "headshot"],
    ["Creator Portraits", "Portrait Photo"],
    ["Creator portraits", "Portrait Photo"],
    ["creator portraits", "portrait photos"],
    ["Gala Photos", "Gala Photo"],
    ["Gala photos", "Gala Photo"],
    ["Wedding Portraits", "Wedding Photo"],
    ["Wedding portraits", "Wedding Photo"],
    ["Valentine Photos", "Valentines Photo"],
    ["Valentine photos", "Valentines Photo"],
    ["Anime Avatar", "Avatar"],
    ["Profile Cards", "Avatar"],
    ["AI Video Add-Ons", "Motion Generator"],
    ["AI video add-ons", "Motion Generator"],
    ["video add-ons", "motion generator"],
    ["Thanksgiving Group Photos", "Thanksgiving Photo"],
    ["Thanksgiving group photos", "Thanksgiving Photo"],
    ["Halloween Party Photos", "Halloween Photo"],
    ["Halloween party photos", "Halloween Photo"],
    ["Christmas Photos", "Christmas Photo"],
    ["Black Friday promotion", "Black Friday"]
  ];
  return replacements.reduce((result, [before, after]) => result.split(before).join(after), value);
}

function deepReplaceStrings(value) {
  if (typeof value === "string") return replaceThemeText(replaceCollectionHrefs(value));
  if (Array.isArray(value)) return value.map(deepReplaceStrings);
  if (!value || typeof value !== "object") return value;
  for (const [key, child] of Object.entries(value)) {
    value[key] = deepReplaceStrings(child);
  }
  return value;
}

function setSectionBlockCollectionSlug(section, slug) {
  if (!Array.isArray(section?.blocks)) return;
  for (const block of section.blocks) {
    if (!block?.settings || typeof block.settings !== "object") continue;
    block.settings.collectionSlug = slug;
  }
}

const dreamshootHomeFeaturedSectionIds = ["featured_pack_1", "featured_christmas_1", "featured_thanksgiving_1"];

function stripHomeFeaturedSectionsFromPageJson(pageJson) {
  if (!pageJson?.sections || !Array.isArray(pageJson.sectionsOrder)) return;
  for (const sectionId of dreamshootHomeFeaturedSectionIds) {
    if (pageJson.sections[sectionId]) delete pageJson.sections[sectionId];
  }
  pageJson.sectionsOrder = pageJson.sectionsOrder.filter((sectionId) => !dreamshootHomeFeaturedSectionIds.includes(sectionId));
}

function isHomePageRecord(page) {
  return page?.slug === "/" || page?.pageType === "home";
}

function normalizeDreamshootHomeFeaturedSections(record) {
  for (const page of record?.pages || []) {
    if (!isHomePageRecord(page)) continue;
    stripHomeFeaturedSectionsFromPageJson(page.draftJson);
    stripHomeFeaturedSectionsFromPageJson(page.publishedJson);
  }
  stripHomeFeaturedSectionsFromPageJson(record?.templates?.index);
  for (const page of record?.snapshot?.pages || []) {
    if (!isHomePageRecord(page)) continue;
    stripHomeFeaturedSectionsFromPageJson(page.draftJson);
    stripHomeFeaturedSectionsFromPageJson(page.publishedJson);
  }
  stripHomeFeaturedSectionsFromPageJson(record?.snapshot?.saasTheme?.templates?.index);
}

function normalizeFeaturedSectionCollectionSlugs(value) {
  if (Array.isArray(value)) {
    value.forEach(normalizeFeaturedSectionCollectionSlugs);
    return;
  }
  if (!value || typeof value !== "object") return;
  const sections = value.sections;
  if (sections && typeof sections === "object") {
    setSectionBlockCollectionSlug(sections.featured_christmas_1, "christmas-photo");
    setSectionBlockCollectionSlug(sections.featured_thanksgiving_1, "thanksgiving-photo");
  }
  for (const child of Object.values(value)) normalizeFeaturedSectionCollectionSlugs(child);
}

function isDreamshootOwnedRecord(record) {
  if (!record || typeof record !== "object") return false;
  return record.id === SITE_ID || record.siteId === SITE_ID || record.targetId === SITE_ID || record.sourceSiteId === SITE_ID;
}

function applyScopedHrefReplacements(state) {
  for (const key of Object.keys(state)) {
    const value = state[key];
    if (!Array.isArray(value)) continue;
    if (key === "creativePackCategories" || key === "creativePacks") continue;
    for (const record of value) {
      if (!isDreamshootOwnedRecord(record)) continue;
      deepReplaceStrings(record);
      normalizeFeaturedSectionCollectionSlugs(record);
      normalizeDreamshootHomeFeaturedSections(record);
    }
  }
}

function toPrismaJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function clearPlatformStateCaches() {
  for (const cachePath of [
    ".next/cache/platform-state-postgres.json",
    ".next-3002/cache/platform-state-postgres.json",
    ".next-3003/cache/platform-state-postgres.json",
    ".next-dev/cache/platform-state-postgres.json"
  ]) {
    fs.rmSync(path.join(repoRoot, cachePath), { force: true });
  }
}

async function updateDatabase({ state, categories, packs }) {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const stateJson = toPrismaJson(state);
  try {
    const existingCategories = await prisma.creativePackCategory.findMany({
      where: { siteId: SITE_ID },
      select: { id: true, slug: true }
    });
    const existingCategoryIdBySlug = new Map(existingCategories.map((category) => [normalizeSlug(category.slug), category.id]));
    const categoryDbIdByLocalId = new Map(
      categories.map((category) => [
        category.id,
        existingCategoryIdBySlug.get(normalizeSlug(category.slug)) || category.id
      ])
    );
    const targetCategoryDbIds = new Set();
    const targetPackIds = new Set(packs.map((pack) => pack.id));

    await prisma.$transaction(async (tx) => {
      for (const category of categories) {
        const dbCategoryId = categoryDbIdByLocalId.get(category.id) || category.id;
        const parentId = category.parentId ? categoryDbIdByLocalId.get(category.parentId) || category.parentId : null;
        const existingIdForSlug = existingCategoryIdBySlug.get(normalizeSlug(category.slug));
        const updateFields = {
          parentId,
          slug: category.slug,
          label: category.label,
          description: category.description,
          heroTitle: category.heroTitle,
          heroSubtitle: category.heroSubtitle,
          icon: category.icon,
          imageUrl: category.imageUrl,
          sortOrder: category.sortOrder,
          status: category.status
        };

        targetCategoryDbIds.add(dbCategoryId);
        if (existingIdForSlug) {
          await tx.creativePackCategory.update({
            where: { id: existingIdForSlug },
            data: updateFields
          });
        } else {
          await tx.creativePackCategory.upsert({
            where: { id: dbCategoryId },
            create: {
              ...category,
              id: dbCategoryId,
              parentId
            },
            update: updateFields
          });
        }
      }

      await tx.creativePackCategory.updateMany({
        where: {
          siteId: SITE_ID,
          id: { notIn: Array.from(targetCategoryDbIds) }
        },
        data: {
          status: "inactive",
          updatedAt: new Date(UPDATE_TIMESTAMP)
        }
      });

      for (const pack of packs) {
        const categoryId = pack.categoryId ? categoryDbIdByLocalId.get(pack.categoryId) || pack.categoryId : null;
        await tx.creativePack.upsert({
          where: { id: pack.id },
          create: {
            ...pack,
            categoryId
          },
          update: {
            categoryId,
            name: pack.name,
            headline: pack.headline,
            description: pack.description,
            prompt: pack.prompt,
            category: pack.category,
            aiAppSlug: pack.aiAppSlug,
            status: pack.status,
            creditCost: pack.creditCost,
            outputCount: pack.outputCount,
            trainingRequired: pack.trainingRequired,
            generationCount: pack.generationCount,
            conversionRate: pack.conversionRate,
            imageUrl: pack.imageUrl,
            galleryImages: pack.galleryImages,
            galleryImageAlts: pack.galleryImageAlts
          }
        });
      }
      await tx.creativePack.updateMany({
        where: {
          siteId: SITE_ID,
          id: { notIn: Array.from(targetPackIds) }
        },
        data: {
          status: "inactive",
          updatedAt: new Date(UPDATE_TIMESTAMP)
        }
      });
      await tx.platformStateDocument.upsert({
        where: { id: "platform" },
        create: { id: "platform", state: stateJson },
        update: { state: stateJson }
      });
    }, { timeout: 60_000 });
    clearPlatformStateCaches();
  } finally {
    await prisma.$disconnect();
  }
}

const state = readJson(statePath);
const taxonomy = readJson(taxonomyPath);
const packProfiles = readJson(packProfilesPath);
const useCaseProfiles = readJson(useCaseProfilesPath);
const categories = state.creativePackCategories ?? [];
const packs = state.creativePacks ?? [];
const originalPackById = new Map(packs.filter((pack) => pack.siteId === SITE_ID).map((pack) => [pack.id, structuredClone(pack)]));
const changes = [];
const targetCategoryIds = new Set();
const targetPackIds = new Set();
const syncedCategories = [];
const syncedPacks = [];
const rootIdBySlug = new Map();

for (const root of taxonomy.roots) {
  const targetSlug = normalizeSlug(root.slug);
  let category = findSiteRecord(categories, targetSlug) || findSourceRecord(categories, root.sourceSlug);
  if (!category) {
    category = {
      id: categoryIdForSlug(targetSlug),
      siteId: SITE_ID,
      createdAt: UPDATE_TIMESTAMP
    };
    categories.push(category);
    changes.push({ targetType: "CreativePackCategory", id: category.id, field: "create", after: targetSlug });
  }
  updateCategory(category, categoryFieldsForRoot(root), changes);
  targetCategoryIds.add(category.id);
  rootIdBySlug.set(targetSlug, category.id);
  syncedCategories.push(structuredClone(category));
}

for (const [index, item] of taxonomy.items.entries()) {
  const targetSlug = normalizeSlug(item.slug);
  const groupSlug = normalizeSlug(item.groupSlug);
  const parentId = rootIdBySlug.get(groupSlug);
  if (!parentId) throw new Error(`Missing root category for ${item.slug}`);
  let category = findSiteRecord(categories, targetSlug) || findSourceRecord(categories, item.sourceCategorySlug);
  if (!category) {
    category = {
      id: categoryIdForSlug(targetSlug),
      siteId: SITE_ID,
      createdAt: UPDATE_TIMESTAMP
    };
    categories.push(category);
    changes.push({ targetType: "CreativePackCategory", id: category.id, field: "create", after: targetSlug });
  }
  const fields = categoryFieldsForItem(item, parentId, (index + 1) * 10);
  updateCategory(category, fields, changes);
  targetCategoryIds.add(category.id);
  syncedCategories.push(structuredClone(category));

  const packId = packIdForItem(item);
  const sourcePack = originalPackById.get(item.reusePackId || item.sourcePackId || packId) || originalPackById.get(item.sourcePackId);
  let pack = packs.find((candidate) => candidate.siteId === SITE_ID && candidate.id === packId);
  if (!pack) {
    pack = {
      id: packId,
      siteId: SITE_ID,
      createdAt: UPDATE_TIMESTAMP
    };
    packs.push(pack);
    changes.push({ targetType: "CreativePack", id: pack.id, field: "create", after: targetSlug });
  }
  updatePack(pack, packFieldsForItem(item, category.id, sourcePack), changes);
  targetPackIds.add(pack.id);
  syncedPacks.push(structuredClone(pack));
  packProfiles[targetSlug] = profileForItem(item);
}

for (const category of categories) {
  if (category.siteId !== SITE_ID || targetCategoryIds.has(category.id)) continue;
  updateCategory(category, { status: "inactive", updatedAt: UPDATE_TIMESTAMP }, changes);
}

for (const pack of packs) {
  if (pack.siteId !== SITE_ID || targetPackIds.has(pack.id)) continue;
  updatePack(pack, { status: "inactive", updatedAt: UPDATE_TIMESTAMP }, changes);
}

useCaseProfiles.mydreamshootsCategories = {
  ...(useCaseProfiles.mydreamshootsCategories || {}),
  ...Object.fromEntries(taxonomy.roots.map((root) => [root.slug, profileForRoot(root)]))
};

applyScopedHrefReplacements(state);

if (!dryRun) {
  writeJson(statePath, state);
  writeJson(packProfilesPath, packProfiles);
  writeJson(useCaseProfilesPath, useCaseProfiles);
}

if (updateDb && !dryRun) {
  await updateDatabase({ state, categories: syncedCategories, packs: syncedPacks });
}

const activeDreamshootCategories = categories.filter((category) => category.siteId === SITE_ID && category.status === "active");
const activeDreamshootPacks = packs.filter((pack) => pack.siteId === SITE_ID && pack.status === "active");

console.log(JSON.stringify({
  dryRun,
  updateDb,
  changedFields: changes.length,
  changedRecords: new Set(changes.map((change) => `${change.targetType}:${change.id}`)).size,
  activeDreamshootCategories: activeDreamshootCategories.length,
  activeDreamshootRootCategories: activeDreamshootCategories.filter((category) => !category.parentId).length,
  activeDreamshootPacks: activeDreamshootPacks.length,
  targetCategoryIds: targetCategoryIds.size,
  targetPackIds: targetPackIds.size,
  sampleChanges: changes.slice(0, 12)
}, null, 2));
