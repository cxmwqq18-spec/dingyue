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
const generatedThemeAssetVersion = process.env.THEME_ASSET_VERSION ?? "20260815unique1";
const generatedThemeSlugs = new Set([
  "only-fans",
  "singles-awareness-day",
  "bikini",
  "swimsuit",
  "background-remover",
  "magic-eraser",
  "portrait-retouch",
  "unblur-image",
  "color-correction",
  "old-photo-restoration"
]);
const requiredPageCopySlugs = new Set([
  "engagement-photo",
  "wedding-photo",
  "valentines-photo",
  "christmas-photo",
  "halloween-photo",
  "thanksgiving-photo",
  "holiday",
  "singles-awareness-day",
  "black-friday"
]);
const requiredPageCopyFields = [
  "pageEntityId",
  "copyRevision",
  "seoTitle",
  "galleryTitle",
  "ctaTitle",
  "ctaSubtitle",
  "ctaLabel",
  "faqTitle",
  "relatedTitle",
  "relatedSubtitle",
  "relatedCtaLabel"
];
const AI_IMAGE_GENERATION_ROOT = "/ai-image-generation";
const AI_VIDEO_GENERATION_ROOT = "/ai-video-generation";
const MYDREAMSHOOTS_ORIGIN_PATTERN = "https?:\\/\\/(?:www\\.)?mydreamshoots\\.com";
const videoGenerationCategories = [
  {
    slug: "text-to-video",
    label: "Text to video",
    description: "Video themes created from written prompts.",
    sortOrder: 10
  },
  {
    slug: "image-to-video",
    label: "Image to Video",
    description: "Video themes created from uploaded or selected images.",
    sortOrder: 20
  },
  {
    slug: "talking-photo",
    label: "Talking Photo",
    description: "Explore a talking-photo workflow from one clear portrait and a focused message.",
    sortOrder: 30
  }
];
const videoGenerationSlugs = new Set(videoGenerationCategories.map((category) => category.slug));
const imageThemeSlugByLegacyTool = new Map([
  ["photo-ai", ""],
  ["ai-photo-edit", ""],
  ["ai-image-studio", ""],
  ["image-studio", ""],
  ["headshot", "headshot"],
  ["creator-portrait", "portrait-photo"],
  ["creator-portraits", "portrait-photo"],
  ["world-cup-fan-photos", "soccer"],
  ["cyberpunk-portrait", "cyberpunk"],
  ["gala-photo", "gala-photo"],
  ["noir-portrait", "mafia"],
  ["anime-avatar", "avatar"],
  ["nature-adventure", "travel"],
  ["fashion-editorial", "street-style"],
  ["product-lifestyle", "background-changer"],
  ["background-changer", "background-changer"],
  ["background-remover", "background-remover"],
  ["magic-eraser", "magic-eraser"],
  ["photo-enhancer", "photo-enhancer"],
  ["portrait-retouch", "portrait-retouch"],
  ["unblur-image", "unblur-image"],
  ["color-correction", "color-correction"],
  ["old-photo-restoration", "old-photo-restoration"],
  ["edit-by-prompt", "edit-by-prompt"],
  ["magic-upscaler", "photo-enhancer"],
  ["virtual-try-on", "virtual-try-on"]
]);
const legacySlugReplacements = new Map([
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
let collectionPathBySlug = new Map();
let collectionRootSlugs = new Set();
let mydreamshootsDirectProfiles = {};

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
  const withoutDirectoryRoot = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "")
    .replace(/^collections\//, "")
    .replace(/^ai-image-generation\//, "");
  const finalSegment = withoutDirectoryRoot.split("/").filter(Boolean).pop() || withoutDirectoryRoot;
  return finalSegment
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function packIdForItem(item) {
  return item.reusePackId || `pack_dreamshoot_${slugUnderscore(item.slug)}`;
}

function categoryIdForSlug(slug) {
  return `pack_cat_dreamshoot_${slugUnderscore(slug)}`;
}

function videoCategoryIdForSlug(slug) {
  return `video_cat_dreamshoot_${slugUnderscore(slug)}`;
}

function toolMenuItemIdForSlug(slug) {
  return `tool_menu_dreamshoot_video_${slugUnderscore(slug)}`;
}

function promptForItem(item) {
  return [
    `Using the uploaded reference photo, create ${item.promptCue}.`,
    "Preserve the subject's identity, age, skin tone, expression, and natural proportions.",
    "Use realistic lighting, believable texture, clean composition, and private gallery-ready output.",
    "Avoid protected logos, public-figure likenesses, unauthorized marks, explicit content, and identity changes."
  ].join(" ");
}

function profileForItem(item) {
  const profile = mydreamshootsDirectProfiles[item.slug];
  if (!profile) {
    throw new Error(`Missing direct MyDreamShoots SEO profile for ${item.slug}. Add it to photo-package-use-case-profiles.json before syncing.`);
  }
  if (requiredPageCopySlugs.has(item.slug)) {
    const missingFields = requiredPageCopyFields.filter((field) => typeof profile[field] !== "string" || !profile[field].trim());
    const invalidFaqItems = !Array.isArray(profile.faqItems) ||
      profile.faqItems.length < 4 ||
      profile.faqItems.some((faqItem) => !faqItem?.id?.trim() || !faqItem?.question?.trim() || !faqItem?.answer?.trim());
    if (profile.pageEntityId !== `mydreamshoots:ai-image-theme:${item.slug}`) {
      missingFields.push("pageEntityId:canonicalSlug");
    }
    if (invalidFaqItems) {
      missingFields.push("faqItems");
    }
    if (missingFields.length) {
      throw new Error(`PAGE_COPY_REVIEW_REQUIRED:${item.slug}:${missingFields.join(",")}`);
    }
  }
  return structuredClone(profile);
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

function updateRecord(record, fields, changes, targetType) {
  for (const [field, value] of Object.entries(fields)) {
    const previous = JSON.stringify(record[field]);
    const next = JSON.stringify(value);
    if (previous === next) continue;
    changes.push({ targetType, id: record.id, field, before: record[field], after: value });
    record[field] = value;
  }
}

function syncVideoThemeCategories(state, changes) {
  const records = state.videoThemeCategories ?? (state.videoThemeCategories = []);
  const targetSlugs = new Set(videoGenerationCategories.map((category) => category.slug));
  const existingBySlug = new Map(records.filter((record) => record.siteId === SITE_ID).map((record) => [normalizeSlug(record.slug), record]));

  for (const category of videoGenerationCategories) {
    let record = existingBySlug.get(category.slug);
    if (!record) {
      record = {
        id: videoCategoryIdForSlug(category.slug),
        siteId: SITE_ID,
        slug: category.slug,
        createdAt: UPDATE_TIMESTAMP
      };
      records.push(record);
      changes.push({ targetType: "VideoThemeCategory", id: record.id, field: "create", after: category.slug });
    }
    updateRecord(record, {
      siteId: SITE_ID,
      slug: category.slug,
      label: category.label,
      description: category.description,
      sortOrder: category.sortOrder,
      status: "active"
    }, changes, "VideoThemeCategory");
  }

  for (const record of records) {
    if (record.siteId !== SITE_ID || targetSlugs.has(normalizeSlug(record.slug))) continue;
    updateRecord(record, { status: "paused" }, changes, "VideoThemeCategory");
  }
}

function videoToolMenuDetail(category) {
  return {
    eyebrow: "AI Video Generation",
    title: category.label,
    subtitle: category.description,
    ctaLabel: "Create a video concept",
    guideTitle: `${category.label} guide`,
    guideBody: `${category.label} turns approved MyDreamShoots photo outputs or uploads into short private motion concepts with credits shown before generation.`,
    useCases: [
      "Private motion previews",
      "Short social or album clips",
      "Video concepts from approved images"
    ],
    workflow: [
      "Choose a finished photo or upload an approved image.",
      "Select the video generation direction.",
      "Review credits before generation.",
      "Save the private video concept in your workspace."
    ]
  };
}

function syncToolMenuItems(state, changes) {
  const records = state.toolMenuItems ?? (state.toolMenuItems = []);
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index];
    if (record.siteId !== SITE_ID) continue;
    records.splice(index, 1);
    changes.push({ targetType: "ToolMenuItem", id: record.id, field: "delete", before: record.slug });
  }

  const categories = state.toolCategories ?? (state.toolCategories = []);
  for (let index = categories.length - 1; index >= 0; index -= 1) {
    const category = categories[index];
    if (category.siteId !== SITE_ID) continue;
    categories.splice(index, 1);
    changes.push({ targetType: "ToolCategory", id: category.id, field: "delete", before: category.slug });
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
  const profile = profileForItem(item);
  const generatedMedia = generatedThemeMediaForSlug(item.slug);
  return {
    siteId: SITE_ID,
    parentId,
    slug: item.slug,
    label: item.label,
    description: item.description,
    heroTitle: profile.headline,
    heroSubtitle: profile.detailIntro,
    icon: item.icon,
    sortOrder,
    status: "active",
    ...(generatedMedia ? { imageUrl: generatedMedia.imageUrl } : {}),
    updatedAt: UPDATE_TIMESTAMP
  };
}

const taxonomyGalleryAltScenes = [
  "close portrait framing with clear facial detail",
  "half-body editorial pose with balanced crop",
  "group-friendly composition with space around the subjects",
  "wide environmental scene with contextual background",
  "candid social-style expression with natural posture",
  "detail portrait crop with polished styling",
  "vertical profile crop with clean framing",
  "cinematic color contrast with directional light",
  "album-cover style crop with strong subject focus",
  "lifestyle portrait framing with natural setting cues",
  "event-style portrait under polished light",
  "distinct themed pose with refined styling"
];

const taxonomyGalleryAltSubjects = {
  "professional-headshots": "Professional studio headshot",
  "world-cup-fan-photos": "Football fan portrait in a stadium",
  hairstyle: "Hairstyle preview portrait with polished styling",
  cyberpunk: "Neon cyberpunk portrait in a city scene",
  "gala-photos": "Formal gala portrait with editorial lighting",
  mafia: "Noir character portrait with dramatic contrast",
  nature: "Outdoor adventure portrait in a natural landscape",
  "outdoor-creator-scenes": "Urban lifestyle portrait in a city setting",
  "virtual-try-on": "Beauty portrait with editorial lighting",
  "profile-cards": "Social profile card portrait with clean avatar framing",
  "creator-portraits": "Creator portrait with polished studio styling",
  "fashion-editorial": "Editorial fashion portrait with refined wardrobe styling",
  "anime-avatar": "Stylized anime-inspired avatar portrait",
  "product-style": "Product-style lifestyle scene with clean studio lighting",
  "social-cards": "Social card portrait with polished graphic framing",
  "wedding-portraits": "Wedding-style couple portrait in soft ceremony light",
  "indian-wedding": "Indian wedding-style portrait with rich celebration styling",
  "desi-wedding": "Desi wedding-style portrait with traditional celebration styling",
  "valentine-photos": "Romantic couple portrait with warm date-night light",
  engagement: "Engagement-style couple portrait for an announcement",
  boudoir: "Tasteful style portrait with soft studio lighting",
  holiday: "Seasonal holiday portrait with warm festive styling",
  "christmas-couple": "Christmas couple portrait with cozy festive light",
  "christmas-photos": "Solo Christmas portrait with warm greeting-card styling",
  "ai-video-add-ons": "Motion-ready portrait frame with cinematic lighting",
  "magic-upscaler": "Enhanced portrait preview with crisp detail",
  "thanksgiving-group-photos": "Thanksgiving group portrait at a warm dinner setting",
  "halloween-party-photos": "Halloween party portrait with dramatic colored lighting",
  "only-fans": "Adult creator lifestyle portrait with tasteful editorial styling",
  "singles-awareness-day": "Solo celebration portrait with warm date-night styling",
  bikini: "Adult resort swimwear fashion portrait with bright coastal light",
  swimsuit: "Adult resort swimwear fashion preview with lookbook styling",
  "background-remover": "Clean isolated portrait or product scene with crisp edges",
  "magic-eraser": "Natural photo cleanup preview with a tidy background",
  "portrait-retouch": "Natural professional portrait retouching preview",
  "unblur-image": "Recovered-focus portrait with natural clarity",
  "color-correction": "Balanced portrait color correction with accurate skin tones",
  "old-photo-restoration": "Restored vintage family portrait with archival warmth"
};

function sourceSlugForGalleryImage(imageUrl) {
  return String(imageUrl || "").split("?")[0].split("#")[0].split("/").filter(Boolean).at(-2) || "";
}

function galleryImageAltsForItem(item, sourcePack) {
  const images = Array.isArray(sourcePack?.galleryImages) ? sourcePack.galleryImages : [];
  return images.map((imageUrl, index) => {
    const sourceSlug = sourceSlugForGalleryImage(imageUrl);
    const subject = taxonomyGalleryAltSubjects[sourceSlug]
      || `${item.label} portrait with polished editorial styling`;
    const scene = taxonomyGalleryAltScenes[index % taxonomyGalleryAltScenes.length];
    return `${subject}, ${scene}.`;
  });
}

function generatedThemeMediaForSlug(rawSlug) {
  const slug = normalizeSlug(rawSlug);
  if (!generatedThemeSlugs.has(slug)) return undefined;
  const coverFile = path.join(repoRoot, "public", "assets", "dreamshoot", "generated", "pack-covers", slug, `${slug}-cover.webp`);
  const galleryFiles = Array.from({ length: 12 }, (_, index) => path.join(
    repoRoot,
    "public",
    "assets",
    "dreamshoot",
    "generated",
    "pack-galleries",
    slug,
    `${slug}-${String(index + 1).padStart(2, "0")}.webp`
  ));
  if (!fs.existsSync(coverFile) || galleryFiles.some((filePath) => !fs.existsSync(filePath))) return undefined;
  return {
    imageUrl: `/assets/dreamshoot/generated/pack-covers/${slug}/${slug}-cover.webp?v=${generatedThemeAssetVersion}`,
    galleryImages: galleryFiles.map((_, index) => `/assets/dreamshoot/generated/pack-galleries/${slug}/${slug}-${String(index + 1).padStart(2, "0")}.webp?v=${generatedThemeAssetVersion}`)
  };
}

function packFieldsForItem(item, categoryId, sourcePack) {
  const profile = profileForItem(item);
  const generatedMedia = generatedThemeMediaForSlug(item.slug);
  const galleryImages = generatedMedia?.galleryImages || sourcePack?.galleryImages || [];
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
    imageUrl: generatedMedia?.imageUrl || sourcePack?.imageUrl || "/assets/dreamshoot/generated/pack-covers/professional-headshots/professional-headshots-cover.webp?v=20260731themeuniqueness1",
    galleryImages,
    galleryImageAlts: galleryImageAltsForItem(item, generatedMedia ? { ...sourcePack, galleryImages } : sourcePack),
    updatedAt: UPDATE_TIMESTAMP
  };
}

function buildCollectionPathMap(taxonomy) {
  const paths = new Map([["", AI_IMAGE_GENERATION_ROOT]]);
  collectionRootSlugs = new Set();
  for (const root of taxonomy.roots || []) {
    const rootSlug = normalizeSlug(root.slug);
    collectionRootSlugs.add(rootSlug);
    paths.set(rootSlug, AI_IMAGE_GENERATION_ROOT);
  }
  for (const item of taxonomy.items || []) {
    const itemSlug = normalizeSlug(item.slug);
    paths.set(itemSlug, `${AI_IMAGE_GENERATION_ROOT}/${itemSlug}`);
  }
  return paths;
}

function collectionPathForSlug(value) {
  const canonicalSlug = legacySlugReplacements.get(normalizeSlug(value)) || normalizeSlug(value);
  if (!canonicalSlug || canonicalSlug === "collections" || canonicalSlug === "ai-image-generation" || collectionRootSlugs.has(canonicalSlug)) return AI_IMAGE_GENERATION_ROOT;
  return collectionPathBySlug.get(canonicalSlug) || `${AI_IMAGE_GENERATION_ROOT}/${canonicalSlug}`;
}

function replaceCollectionHrefs(value) {
  if (typeof value !== "string") return value;
  const normalizedValue = normalizeSlug(value);
  const wholeValueReplacement = legacySlugReplacements.get(normalizedValue);
  if (wholeValueReplacement) return wholeValueReplacement;
  const collectionHrefPattern = new RegExp(`(${MYDREAMSHOOTS_ORIGIN_PATTERN})?\\/collections(?:\\/([a-z0-9-]+))?(\\?[^"'\\s<)]*)?`, "g");
  const replaceHref = (origin = "", slug = "", query = "") => {
    const params = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
    const queryCategory = params.get("category") || "";
    params.delete("category");
    const targetSlug = slug || queryCategory;
    const nextPath = collectionPathForSlug(targetSlug);
    const nextQuery = params.toString();
    return `${origin}${nextPath}${nextQuery ? `?${nextQuery}` : ""}`;
  };
  let nextValue = value.replace(collectionHrefPattern, (_match, origin = "", slug = "", query = "") => replaceHref(origin, slug, query));
  const imageGenerationHrefPattern = new RegExp(`(${MYDREAMSHOOTS_ORIGIN_PATTERN})?\\/ai-image-generation(?:\\/([a-z0-9-]+))?(?:\\/([a-z0-9-]+))?(\\?[^"'\\s<)]*)?`, "g");
  nextValue = nextValue.replace(imageGenerationHrefPattern, (_match, origin = "", firstSlug = "", secondSlug = "", query = "") => replaceHref(origin, secondSlug || firstSlug, query));
  const toolHrefPattern = new RegExp(`(${MYDREAMSHOOTS_ORIGIN_PATTERN})?\\/tools(?:\\/([a-z0-9-]+))?(\\?[^"'\\s<)]*)?`, "g");
  nextValue = nextValue.replace(toolHrefPattern, (_match, origin = "", slug = "", query = "") => {
    const canonicalSlug = normalizeSlug(slug);
    const nextPath = !canonicalSlug
      ? AI_VIDEO_GENERATION_ROOT
      : videoGenerationSlugs.has(canonicalSlug)
        ? `${AI_VIDEO_GENERATION_ROOT}/${canonicalSlug}`
        : imageThemeSlugByLegacyTool.has(canonicalSlug)
          ? collectionPathForSlug(imageThemeSlugByLegacyTool.get(canonicalSlug))
          : AI_IMAGE_GENERATION_ROOT;
    return `${origin}${nextPath}${query || ""}`;
  });
  return nextValue
    .replace(/\bAI Photoshoot\b/g, "AI Image Generation")
    .replace(/\bAI Tools\b/g, "AI Video Generation")
    .replace(/\bPhotoshoot Studio\b/g, "AI Image Generation");
}

function replaceThemeText(value) {
  if (typeof value !== "string") return value;
  const replacements = [
    ["AI Headshot Generators", "AI Headshot Photo Packages"],
    ["AI Headshot Generator", "AI Headshot Photo Package"],
    ["Headshot Generators", "Headshot Photo Packages"],
    ["Headshot Generator", "Headshot Photo Package"],
    ["AI tools", "AI Video Generation"],
    ["AI tool", "AI Video Generation"],
    ["Free AI tools", "AI Video Generation"],
    ["Free AI Tools", "AI Video Generation"],
    ["AI Photo Tools with Free Previews | Background, Headshots & Try-ons | myDreamshoots", "AI Video Generation for Private Motion Clips | myDreamshoots"],
    ["Explore myDreamshoots tools for headshots, background edits, video clips, try-on previews, private uploads, visible credits, and private albums.", "Explore myDreamshoots AI Video Generation for image-to-video clips, profile motion, creator intros, product teasers, animated avatars, fashion reels, and private album stories."],
    ["myDreamshoots AI Photo Tools", "myDreamshoots AI Video Generation"],
    ["Photo AI Tools - portraits, headshots, and creator photos | myDreamshoots", "AI Image Generation Themes - portraits, headshots, and creator photos | myDreamshoots"],
    ["Video AI Tools - image to video and creator clips | myDreamshoots", "AI Video Generation - image to video and creator clips | myDreamshoots"],
    ["Video AI tools", "AI Video Generation"],
    ["Video AI", "AI Video Generation"],
    ["AI Tools Collection", "AI Video Generation"],
    ["Compare all AI tools", "Browse AI Image Generation themes"],
    ["Browse edit tools", "Browse Photo Tools themes"],
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

function recordJsonChange(changes, targetType, record, before) {
  const after = JSON.stringify(record);
  if (before === after) return;
  changes.push({
    targetType,
    id: record.id || record.slug || record.siteId || "unknown",
    field: "storedJson",
    before: "legacy public route/text references",
    after: "normalized MyDreamShoots public route/text references"
  });
}

function setDreamshootNavigationLinks(site) {
  const fixedHeaderLinks = [
    { label: "AI Image Generation", href: AI_IMAGE_GENERATION_ROOT },
    { label: "AI Video Generation", href: AI_VIDEO_GENERATION_ROOT },
    { label: "Best Packages", href: "/best-packages" },
    { label: "How it works", href: "/workflow" },
    { label: "Blog", href: "/blog" },
    { label: "Pricing", href: "/pricing" },
    { label: "Workspace", href: "/app/create" }
  ];
  const fixedFooterLinks = [
    { label: "AI Image Generation", href: AI_IMAGE_GENERATION_ROOT, group: "product" },
    { label: "AI Video Generation", href: AI_VIDEO_GENERATION_ROOT, group: "product" },
    { label: "Best Packages", href: "/best-packages", group: "product" },
    { label: "Best AI image", href: "/best-ai-image", group: "product" },
    { label: "Best AI video", href: "/best-ai-video", group: "product" },
    { label: "How it works", href: "/workflow", group: "product" },
    { label: "Pricing", href: "/pricing", group: "product" },
    { label: "Blog", href: "/blog", group: "company" },
    { label: "About us", href: "/about-us", group: "company" },
    { label: "Contact us", href: "/contact-us", group: "company" },
    { label: "Creators Circle", href: "/creators-circle", group: "company" },
    { label: "Refund Policy", href: "/refunds", group: "company" },
    { label: "FAQ", href: "/faq", group: "company" },
    { label: "Privacy Policy", href: "/privacy", group: "support" },
    { label: "Content policy", href: "/content", group: "support" },
    { label: "Terms of Service", href: "/terms", group: "support" },
    { label: "Cookie Policy", href: "/cookies", group: "support" }
  ];
  for (const settings of [site.themeSettings?.draftJson, site.themeSettings?.publishedJson]) {
    if (!settings?.navigation) continue;
    settings.navigation.headerLinks = fixedHeaderLinks;
    settings.navigation.footerLinks = fixedFooterLinks;
  }
}

function applyScopedHrefReplacements(state, changes) {
  for (const key of Object.keys(state)) {
    const value = state[key];
    if (!Array.isArray(value)) continue;
    if (key === "creativePackCategories" || key === "creativePacks") continue;
    for (const record of value) {
      if (!isDreamshootOwnedRecord(record)) continue;
      const before = JSON.stringify(record);
      deepReplaceStrings(record);
      normalizeFeaturedSectionCollectionSlugs(record);
      normalizeDreamshootHomeFeaturedSections(record);
      if (key === "sites" && record.id === SITE_ID) setDreamshootNavigationLinks(record);
      recordJsonChange(changes, `PlatformState.${key}`, record, before);
    }
  }
}

function toPrismaJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function rewriteStoredJson(value) {
  if (value === null || value === undefined) return value;
  return toPrismaJson(deepReplaceStrings(toPrismaJson(value)));
}

function jsonEquals(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function rewriteThemeJsonRows(tx, modelName, fields) {
  const model = tx[modelName];
  const select = Object.fromEntries(["id", ...fields].map((field) => [field, true]));
  const rows = await model.findMany({ where: { siteId: SITE_ID }, select });
  let updates = 0;
  for (const row of rows) {
    const data = {};
    for (const field of fields) {
      if (row[field] === null || row[field] === undefined) continue;
      const nextValue = rewriteStoredJson(row[field]);
      if (jsonEquals(row[field], nextValue)) continue;
      data[field] = nextValue;
    }
    if (!Object.keys(data).length) continue;
    await model.update({
      where: { id: row.id },
      data
    });
    updates += 1;
  }
  return updates;
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
  const siteRecord = (state.sites ?? []).find((site) => site.id === SITE_ID);
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
      for (const category of videoGenerationCategories) {
        await tx.videoThemeCategory.upsert({
          where: { siteId_slug: { siteId: SITE_ID, slug: category.slug } },
          create: {
            id: videoCategoryIdForSlug(category.slug),
            siteId: SITE_ID,
            slug: category.slug,
            label: category.label,
            description: category.description,
            sortOrder: category.sortOrder,
            status: "active",
            createdAt: new Date(UPDATE_TIMESTAMP)
          },
          update: {
            label: category.label,
            description: category.description,
            sortOrder: category.sortOrder,
            status: "active"
          }
        });
      }
      await tx.videoThemeCategory.updateMany({
        where: {
          siteId: SITE_ID,
          slug: { notIn: Array.from(videoGenerationSlugs) }
        },
        data: {
          status: "paused"
        }
      });
      await tx.toolMenuItem.deleteMany({ where: { siteId: SITE_ID } });
      await tx.toolCategory.deleteMany({ where: { siteId: SITE_ID } });
      for (const page of siteRecord?.pages ?? []) {
        const pageData = {
          siteId: SITE_ID,
          pageType: page.pageType || "page",
          templateKey: page.templateKey ?? null,
          slug: page.slug,
          title: page.title || page.slug,
          draftJson: toPrismaJson(page.draftJson),
          publishedJson: toPrismaJson(page.publishedJson),
          draftMeta: page.draftMeta === undefined ? null : toPrismaJson(page.draftMeta)
        };
        await tx.themePage.upsert({
          where: { id: page.id },
          create: {
            id: page.id,
            ...pageData
          },
          update: pageData
        });
      }
      await rewriteThemeJsonRows(tx, "themePage", ["draftJson", "publishedJson", "draftMeta"]);
      await rewriteThemeJsonRows(tx, "themeSettings", ["draftJson", "publishedJson"]);
      await rewriteThemeJsonRows(tx, "themePublication", ["snapshot"]);
      await rewriteThemeJsonRows(tx, "siteTheme", ["templates", "settings"]);
      await tx.platformStateDocument.upsert({
        where: { id: "platform" },
        create: { id: "platform", state: stateJson },
        update: { state: stateJson }
      });
    }, { timeout: 180_000 });
    clearPlatformStateCaches();
  } finally {
    await prisma.$disconnect();
  }
}

const state = readJson(statePath);
const taxonomy = readJson(taxonomyPath);
collectionPathBySlug = buildCollectionPathMap(taxonomy);
const packProfiles = readJson(packProfilesPath);
const useCaseProfiles = readJson(useCaseProfilesPath);
mydreamshootsDirectProfiles = useCaseProfiles.mydreamshootsCategories || {};
const categories = state.creativePackCategories ?? [];
const packs = state.creativePacks ?? [];
const originalPackById = new Map(packs.filter((pack) => pack.siteId === SITE_ID).map((pack) => [pack.id, structuredClone(pack)]));
const changes = [];
const targetCategoryIds = new Set();
const targetPackIds = new Set();
const syncedCategories = [];
const syncedPacks = [];
const rootIdBySlug = new Map();
const taxonomyItemBySlug = new Map(taxonomy.items.map((item) => [normalizeSlug(item.slug), item]));

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
  const inactiveItem = taxonomyItemBySlug.get(normalizeSlug(category.slug));
  const inactiveProfile = inactiveItem ? profileForItem(inactiveItem) : undefined;
  updateCategory(category, {
    ...(inactiveItem ? {
      label: inactiveItem.label,
      description: inactiveItem.description,
      heroTitle: inactiveProfile.headline,
      heroSubtitle: inactiveProfile.detailIntro,
      icon: inactiveItem.icon
    } : {}),
    status: "inactive",
    updatedAt: UPDATE_TIMESTAMP
  }, changes);
}

for (const pack of packs) {
  if (pack.siteId !== SITE_ID || targetPackIds.has(pack.id)) continue;
  const inactiveItem = taxonomyItemBySlug.get(normalizeSlug(pack.category || pack.slug || pack.name));
  const inactiveProfile = inactiveItem ? profileForItem(inactiveItem) : undefined;
  updatePack(pack, {
    ...(inactiveItem ? {
      name: inactiveItem.label,
      headline: inactiveProfile.headline,
      description: profileDescription(inactiveProfile),
      prompt: promptForItem(inactiveItem),
      category: inactiveItem.slug
    } : {}),
    status: "inactive",
    updatedAt: UPDATE_TIMESTAMP
  }, changes);
}

useCaseProfiles.mydreamshootsCategories = {
  ...(useCaseProfiles.mydreamshootsCategories || {}),
  ...Object.fromEntries(taxonomy.roots.map((root) => [root.slug, profileForRoot(root)]))
};

syncVideoThemeCategories(state, changes);
syncToolMenuItems(state, changes);
applyScopedHrefReplacements(state, changes);

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
