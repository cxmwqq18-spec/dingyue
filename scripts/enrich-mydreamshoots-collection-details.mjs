#!/usr/bin/env node
import "./load-runtime-env.mjs";
import fs from "node:fs";
import path from "node:path";

const statePath = path.resolve(process.cwd(), "data/platform-state.json");
const siteIds = new Set(["site_dreamshoot"]);
const args = new Set(process.argv.slice(2));
const uniqueGalleryRoot = path.resolve(process.cwd(), "public/assets/dreamshoot/generated/pack-galleries");
const uniqueGalleryPublicPrefix = "/assets/dreamshoot/generated/pack-galleries";
const uniqueGalleryVersion = process.env.THEME_GALLERY_VERSION ?? "20260715b";
const _uniqueCoverRoot = path.resolve(process.cwd(), "public/assets/dreamshoot/generated/pack-covers");
const uniqueCoverPublicPrefix = "/assets/dreamshoot/generated/pack-covers";
const uniqueCoverVersion = process.env.THEME_COVER_VERSION ?? "20260731themeuniqueness1";
const uniqueCoverVersionBySlug = {
  engagement: process.env.THEME_ENGAGEMENT_COVER_VERSION ?? "20260805uncropped1"
};
let sharpLoader;
const perceptualHashCache = new Map();

const profileBySlug = {
  "professional-headshots": {
    headline: "Work-ready AI headshots for LinkedIn, resumes, founder bios, team pages, and speaker profiles.",
    detail: "Keep the look polished and believable with clean lighting, simple wardrobe direction, and crops that feel ready for professional channels.",
    bestFor: "job-search profiles, founder pages, team directories, and speaker headshots",
    pools: ["headshots", "creator", "business"]
  },
  "world-cup-fan-photos": {
    headline: "Personal football fan portraits, match-day posters, avatars, and stadium-inspired social images.",
    detail: "Create energetic fan visuals from your own photos while avoiding official marks, event logos, celebrity likenesses, or protected team assets unless you have permission.",
    bestFor: "match-day posts, fan avatars, stadium portraits, tournament posters, and social banners",
    pools: ["sports", "worldcup", "creator"]
  },
  hairstyle: {
    headline: "AI hairstyle previews for color ideas, polished hair portraits, salon inspiration, and beauty content.",
    detail: "Preview visual directions before committing to a real-world change or a larger beauty package. The result is for planning and content, not a guaranteed salon outcome.",
    bestFor: "hair color previews, salon consultation ideas, beauty profile refreshes, and creator styling tests",
    pools: ["beauty", "hairstyle"]
  },
  cyberpunk: {
    headline: "Neon city portraits, futuristic wardrobe ideas, and high-contrast cyberpunk profile images.",
    detail: "Turn ordinary portraits into cinematic night-city scenes with bold light, dramatic styling, and poster-ready composition.",
    bestFor: "gaming profiles, music visuals, creator campaigns, dramatic avatars, and cinematic social posts",
    pools: ["cyberpunk", "creative", "avatar"]
  },
  "gala-photos": {
    headline: "Formal evening portraits with black-tie styling, polished lighting, and red-carpet energy.",
    detail: "Use gala photos for elevated night-out concepts, announcement images, creator campaigns, and private event-inspired albums.",
    bestFor: "formal portraits, evening social posts, event concepts, and polished creator visuals",
    pools: ["gala", "fashion", "creative"]
  },
  mafia: {
    headline: "Cinematic noir character portraits with tailored styling, moody interiors, and dramatic light.",
    detail: "Create a private character-led album that feels like a premium film still while keeping the subject consented and customer-owned.",
    bestFor: "noir portraits, character concepts, story-led profile images, and dramatic social campaigns",
    pools: ["noir", "creative", "gala"]
  },
  nature: {
    headline: "Outdoor adventure portraits with scenic backdrops, natural light, creator mood, and lifestyle crops.",
    detail: "Place portraits into grounded nature scenes for profile refreshes, creator content, and private travel-inspired albums.",
    bestFor: "outdoor profile photos, adventure portraits, creator moodboards, and lifestyle galleries",
    pools: ["travel", "nature", "creator"]
  },
  "outdoor-creator-scenes": {
    headline: "Outdoor creator-scene portraits for beaches, cities, cliffs, dates, and golden-hour albums.",
    detail: "Compare outdoor creator looks before spending credits, from golden-hour scenes to city walks and scenic personal-brand portraits.",
    bestFor: "dating profiles, personal-brand updates, holiday albums, and golden-hour social visuals",
    pools: ["nature", "couple", "creator"]
  },
  "virtual-try-on": {
    headline: "Private outfit and styling previews for creator looks, fashion tests, and personal photo planning.",
    detail: "Use visual try-on for direction and inspiration before ordering a full package. Outputs are previews, not exact garment fit or purchase guarantees.",
    bestFor: "outfit moodboards, fashion content planning, creator styling tests, and profile-refresh ideas",
    pools: ["fashion", "beauty", "creator"]
  },
  "profile-cards": {
    headline: "Social profile cards, avatar crops, personal intro visuals, and clean identity updates.",
    detail: "Build a small private gallery of profile-ready images that can support bios, social accounts, newsletters, and personal landing pages.",
    bestFor: "profile cards, personal intros, social avatars, newsletter images, and contact-page visuals",
    pools: ["creator", "headshots", "social"]
  },
  "creator-portraits": {
    headline: "Creator portraits for newsletters, media kits, landing pages, thumbnails, and social profiles.",
    detail: "Create a private set of creator-ready portraits that feels consistent across multiple public channels without booking a full studio day.",
    bestFor: "creator pages, thumbnails, newsletter headshots, media kits, and personal-brand launches",
    pools: ["creator", "headshots", "fashion"]
  },
  "fashion-editorial": {
    headline: "Fashion editorial portraits with outfit direction, magazine lighting, and polished creator styling.",
    detail: "Explore wardrobe-led looks and editorial crops for campaigns, style previews, and private image planning.",
    bestFor: "fashion creators, outfit tests, editorial profile photos, and campaign moodboards",
    pools: ["fashion", "gala", "beauty"]
  },
  "anime-avatar": {
    headline: "Stylized anime-inspired avatar concepts, character profile art, and playful identity images.",
    detail: "Turn a private portrait into avatar-ready visual directions for profiles, fan communities, creator accounts, and light character concepts.",
    bestFor: "anime avatars, profile updates, fan community visuals, character ideas, and playful social identities",
    pools: ["avatar"]
  },
  "product-style": {
    headline: "Product-style lifestyle images, creator-led product scenes, and social commerce visual drafts.",
    detail: "Plan simple product or creator-product visuals with private source references and clear credit expectations before publishing anything.",
    bestFor: "social commerce concepts, product lifestyle drafts, creator product posts, and campaign moodboards",
    pools: ["product", "creator", "fashion"]
  },
  "social-cards": {
    headline: "Share-ready social cards, announcements, profile banners, and private keepsake visuals.",
    detail: "Create polished images for lightweight publishing moments while keeping the source photos and finished gallery private by default.",
    bestFor: "announcement cards, story posts, profile banners, personal keepsakes, and creator updates",
    pools: ["social", "seasonal", "creator"]
  },
  "wedding-portraits": {
    headline: "Wedding-inspired portraits, couple album ideas, save-the-date visuals, and romantic scenes.",
    detail: "Create private wedding-style imagery for planning, websites, announcements, and keepsakes from approved photos.",
    bestFor: "wedding websites, save-the-date concepts, couple portraits, and private romantic albums",
    pools: ["wedding", "couple", "valentine"]
  },
  "indian-wedding": {
    headline: "Indian wedding-inspired portraits with saree, lehenga, sherwani, jewelry, and celebration styling.",
    detail: "Build respectful cultural wedding looks around rich textiles, warm ceremony light, and album-ready composition.",
    bestFor: "Indian wedding concepts, celebration portraits, traditional outfits, and private family albums",
    pools: ["cultural", "wedding", "couple"]
  },
  "desi-wedding": {
    headline: "Desi wedding portraits with festive styling, rich color, ceremony mood, and couple-ready album images.",
    detail: "Use the package for private cultural celebration concepts, family keepsakes, and wedding website visuals from approved photos.",
    bestFor: "Desi wedding albums, couple portraits, celebration styling, and cultural keepsake visuals",
    pools: ["cultural", "wedding", "couple"]
  },
  "valentine-photos": {
    headline: "Romantic Valentine photos, couple cards, date-night portraits, and private gift-ready albums.",
    detail: "Create warm seasonal couple visuals for gifts, social posts, announcements, or private memory albums.",
    bestFor: "Valentine cards, anniversary posts, romantic profile images, and private couple keepsakes",
    pools: ["valentine", "couple", "wedding"]
  },
  engagement: {
    headline: "Engagement-style portraits, proposal scenes, announcement looks, and romantic album ideas.",
    detail: "Plan polished engagement visuals before using them for a wedding website, announcement page, or private keepsake gallery.",
    bestFor: "proposal photos, engagement announcements, couple albums, and wedding website previews",
    pools: ["engagement", "couple", "wedding"]
  },
  boudoir: {
    headline: "Tasteful, non-explicit boudoir-inspired portraits for consenting adults and private albums.",
    detail: "Keep the direction elegant, adult, and consent-based with soft studio mood, wardrobe emphasis, and private delivery.",
    bestFor: "private confidence portraits, anniversary concepts, tasteful studio moodboards, and adult personal albums",
    pools: ["boudoir", "beauty", "fashion"]
  },
  holiday: {
    headline: "Holiday portraits, seasonal profile images, scenic cards, and private festive albums.",
    detail: "Create seasonal visuals with warm holiday mood, greeting-card crops, and private gallery review before downloading.",
    bestFor: "holiday cards, festive portraits, seasonal social posts, and private album keepsakes",
    pools: ["seasonal", "christmas", "couple"]
  },
  "christmas-couple": {
    headline: "Christmas couple portraits, cozy holiday scenes, greeting-card ideas, and romantic festive albums.",
    detail: "Create warm couple visuals for cards, posts, private gifts, and seasonal memory galleries from approved photos.",
    bestFor: "Christmas couple cards, holiday gifts, romantic seasonal posts, and private keepsakes",
    pools: ["christmas", "couple", "seasonal"]
  },
  "christmas-photos": {
    headline: "Solo Christmas portraits, festive cards, holiday profile images, and warm seasonal scenes.",
    detail: "Build a private set of Christmas-ready photos for cards, social posts, profile refreshes, and personal albums.",
    bestFor: "holiday cards, festive portraits, seasonal profile photos, and Christmas social visuals",
    pools: ["christmas", "seasonal", "creator"]
  },
  "ai-video-add-ons": {
    headline: "Motion-ready image concepts and add-on visuals for short AI video scenes.",
    detail: "Prepare still images that can become private short video concepts, creator intros, profile clips, or album story moments.",
    bestFor: "image-to-video prep, creator intro frames, social clips, and album recap visuals",
    pools: ["video", "creator", "social"]
  },
  "magic-upscaler": {
    headline: "Sharper delivery previews for favorite generated photos, profile images, and larger downloads.",
    detail: "Use Magic Upscaler when a finished image needs a cleaner high-resolution look before final download or display.",
    bestFor: "upscaled favorites, profile downloads, cleaner album images, and larger display-ready files",
    pools: ["utility", "headshots", "creator"]
  }
};

const parentProfiles = {
  avatar: ["AI avatar packages", "Stylized avatar, anime-inspired profile, and character-concept packages for playful private galleries."],
  beauty: ["AI beauty and style packages", "Hairstyle previews, try-on directions, soft glam portraits, and private style-planning galleries."],
  creative: ["AI creative photo packages", "Cinematic worlds, noir portraits, cyberpunk scenes, gala looks, nature images, and editorial private albums."],
  creator: ["AI creator photo packages", "Creator portraits, profile cards, product-style scenes, social cards, and private personal-brand albums."],
  couple: ["AI couple photo packages", "Romantic couple portraits, engagement concepts, Valentine visuals, and festive relationship keepsakes."],
  cultural: ["AI cultural wedding packages", "Indian and Desi wedding-inspired portraits with respectful styling and private gallery delivery."],
  headshots: ["AI headshot packages", "Professional headshots for LinkedIn, resumes, teams, founders, and polished work profiles."],
  seasonal: ["AI seasonal photo packages", "Holiday portraits, Christmas cards, festive social visuals, and private seasonal albums."],
  sports: ["AI sports fan photo packages", "Personal fan portraits, match-day posters, profile avatars, and stadium-inspired images."],
  utility: ["AI utility image packages", "Upscaling and image-prep packages for cleaner private gallery downloads."],
  video: ["AI video add-on packages", "Motion-ready image frames and short-video add-on directions for private albums."],
  wedding: ["AI wedding photo packages", "Wedding portraits, couple albums, save-the-date concepts, and announcement-ready visuals."]
};

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeSharedProfile(slug, profile) {
  const bestForItems = Array.isArray(profile.bestFor) ? profile.bestFor.filter(Boolean) : [];
  const poolTokens = [
    slug,
    profile.metaLabel,
    ...(profile.tags ?? []),
    ...(profile.detailTags ?? [])
  ].map(slugify).filter(Boolean);
  return {
    ...profile,
    headline: profile.headline,
    detail: profile.detailIntro || profile.cardDescription,
    bestFor: bestForItems.join(", "),
    bestForItems,
    pools: Array.from(new Set(poolTokens))
  };
}

const sharedProfilesPath = path.resolve(process.cwd(), "src/lib/dreamshoot-pack-profiles.json");
const sharedProfileBySlug = JSON.parse(fs.readFileSync(sharedProfilesPath, "utf8"));
for (const [slug, profile] of Object.entries(sharedProfileBySlug)) {
  profileBySlug[slug] = normalizeSharedProfile(slug, profile);
}

function listAssets() {
  const root = path.resolve(process.cwd(), "public/assets/dreamshoot");
  const results = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "brand") continue;
        if (full.startsWith(uniqueGalleryRoot)) continue;
        walk(full);
      } else if (/\.(png|webp|jpe?g)$/i.test(entry.name)) {
        results.push(`/assets/dreamshoot/${path.relative(root, full).split(path.sep).join("/")}`);
      }
    }
  }
  walk(root);
  return dedupeAssetPaths(results).sort();
}

function dedupeAssetPaths(assets) {
  const byStem = new Map();
  for (const asset of assets) {
    const stem = asset.replace(/\.(png|webp|jpe?g)$/i, "");
    const existing = byStem.get(stem);
    if (!existing || (/\.webp$/i.test(asset) && !/\.webp$/i.test(existing))) byStem.set(stem, asset);
  }
  return Array.from(byStem.values());
}

function imagePools(allAssets) {
  const matches = (...patterns) => allAssets.filter((asset) => patterns.some((pattern) => pattern.test(asset)));
  return {
    avatar: matches(/avatar/i, /anime/i, /story-beauty/i),
    beauty: matches(/beauty/i, /hairstyle/i, /hair/i, /mia/i, /story-beauty/i),
    boudoir: matches(/beauty/i, /fashion/i, /woman/i, /editorial/i, /gala/i),
    business: matches(/business/i, /headshot/i, /professional/i, /lucas-result/i),
    christmas: matches(/christmas/i, /holiday/i, /seasonal/i),
    couple: matches(/couple/i, /engagement/i, /date-night/i, /wedding/i, /valentine/i),
    creator: matches(/creator/i, /social/i, /avatar-nora/i, /headshot/i, /business/i),
    creative: matches(/cyber/i, /gala/i, /noir/i, /mafia/i, /cinematic/i, /ava-result/i),
    cultural: matches(/desi/i, /wedding-look/i, /wedding/i),
    cyberpunk: matches(/cyber/i, /sample-cyberpunk/i, /hero-grid-cyber/i),
    engagement: matches(/engagement/i, /couple/i, /wedding/i, /date-night/i),
    fashion: matches(/fashion/i, /editorial/i, /gala/i, /try-on/i, /virtual/i),
    gala: matches(/gala/i, /ava-result/i, /sample-gala/i),
    headshots: matches(/headshot/i, /business/i, /professional/i, /lucas/i),
    hairstyle: matches(/hairstyle/i, /hair/i, /beauty/i),
    nature: matches(/nature/i, /travel/i, /cliffside/i, /holiday-travel/i),
    noir: matches(/noir/i, /mafia/i, /gala/i),
    product: matches(/product/i, /upscaler/i, /pricing/i, /credit/i),
    seasonal: matches(/holiday/i, /christmas/i, /seasonal/i, /date-night/i),
    social: matches(/social/i, /card/i, /review-noah/i, /hero-package/i),
    sports: matches(/worldcup/i, /world-cup/i, /stadium/i, /fan/i, /sports/i, /match-day/i),
    travel: matches(/travel/i, /nature/i, /cliffside/i, /holiday/i, /date-night/i),
    utility: matches(/upscale/i, /upscaler/i, /workflow/i, /flow/i, /credit/i),
    valentine: matches(/valentine/i, /date-night/i, /couple/i, /engagement/i),
    video: matches(/video/i, /flow-private/i, /hero-package/i, /social/i),
    wedding: matches(/wedding/i, /engagement/i, /couple/i, /date-night/i),
    worldcup: matches(/worldcup/i, /world-cup/i, /stadium/i, /fan/i, /match-day/i)
  };
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

const forbiddenSourcePatternsBySlug = {
  "anime-avatar": [/world[-_ ]?cup/i, /match[-_ ]?day/i, /stadium/i, /football/i, /sports/i, /wedding/i, /couple/i, /engagement/i, /nature/i, /travel/i, /noir/i, /mafia/i, /gala/i, /headshot/i, /business/i],
  hairstyle: [/world[-_ ]?cup/i, /match[-_ ]?day/i, /stadium/i, /football/i, /sports/i, /wedding/i, /couple/i, /engagement/i, /nature/i, /travel/i, /noir/i, /mafia/i, /cyber/i, /christmas/i, /business/i, /headshot/i, /avatar-nora/i, /hero-grid-avatar/i, /review-lucas/i, /review-noah/i],
  "professional-headshots": [/world[-_ ]?cup/i, /match[-_ ]?day/i, /stadium/i, /football/i, /sports/i, /wedding/i, /couple/i, /engagement/i, /nature/i, /travel/i, /christmas/i, /valentine/i],
  cyberpunk: [/world[-_ ]?cup/i, /match[-_ ]?day/i, /stadium/i, /football/i, /sports/i, /wedding/i, /couple/i, /engagement/i, /nature/i, /christmas/i],
  "gala-photos": [/world[-_ ]?cup/i, /match[-_ ]?day/i, /stadium/i, /football/i, /sports/i, /nature/i, /travel/i, /christmas/i],
  mafia: [/world[-_ ]?cup/i, /match[-_ ]?day/i, /stadium/i, /football/i, /sports/i, /nature/i, /travel/i, /christmas/i],
  nature: [/world[-_ ]?cup/i, /match[-_ ]?day/i, /stadium/i, /football/i, /sports/i, /wedding/i, /couple/i, /engagement/i, /gala/i, /noir/i, /mafia/i],
  "outdoor-creator-scenes": [/world[-_ ]?cup/i, /match[-_ ]?day/i, /stadium/i, /football/i, /sports/i, /noir/i, /mafia/i],
  "virtual-try-on": [/world[-_ ]?cup/i, /match[-_ ]?day/i, /stadium/i, /football/i, /sports/i, /nature/i, /travel/i, /christmas/i],
  "creator-portraits": [/world[-_ ]?cup/i, /match[-_ ]?day/i, /stadium/i, /football/i, /sports/i, /wedding/i, /couple/i, /engagement/i, /nature/i, /travel/i, /christmas/i],
  "fashion-editorial": [/world[-_ ]?cup/i, /match[-_ ]?day/i, /stadium/i, /football/i, /sports/i, /nature/i, /travel/i, /christmas/i],
  "profile-cards": [/world[-_ ]?cup/i, /match[-_ ]?day/i, /stadium/i, /football/i, /sports/i, /wedding/i, /couple/i, /engagement/i, /nature/i, /travel/i],
  "social-cards": [/world[-_ ]?cup/i, /match[-_ ]?day/i, /stadium/i, /football/i, /sports/i, /noir/i, /mafia/i],
  "ai-video-add-ons": [/world[-_ ]?cup/i, /match[-_ ]?day/i, /stadium/i, /football/i, /sports/i, /nature/i, /travel/i],
  "magic-upscaler": [/world[-_ ]?cup/i, /match[-_ ]?day/i, /stadium/i, /football/i, /sports/i, /wedding/i, /couple/i, /engagement/i]
};

function _allowedThemeSource(asset, slug) {
  const cleanAsset = cleanLocalAsset(asset);
  if (!cleanAsset) return "";
  const forbidden = forbiddenSourcePatternsBySlug[slug] ?? [];
  return forbidden.some((pattern) => pattern.test(cleanAsset)) ? "" : cleanAsset;
}

function hashText(value) {
  let hash = 0;
  for (const char of String(value)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}

function assetFilePath(publicPath) {
  const cleanPath = String(publicPath || "").split("?")[0];
  if (!cleanPath.startsWith("/assets/")) throw new Error(`Refusing non-local asset path: ${publicPath}`);
  return path.resolve(process.cwd(), "public", cleanPath.replace(/^\//, ""));
}

function cleanLocalAsset(publicPath) {
  const cleanPath = String(publicPath || "").split("?")[0];
  return cleanPath.startsWith("/assets/") ? cleanPath : "";
}

async function sharp() {
  if (!sharpLoader) sharpLoader = (await import("sharp")).default;
  return sharpLoader;
}

async function averageImageHash(publicPath) {
  if (perceptualHashCache.has(publicPath)) return perceptualHashCache.get(publicPath);
  const image = await sharp();
  const pixels = await image(assetFilePath(publicPath))
    .resize(8, 8, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer();
  const average = pixels.reduce((sum, value) => sum + value, 0) / pixels.length;
  const hash = Array.from(pixels, (value) => (value >= average ? "1" : "0")).join("");
  perceptualHashCache.set(publicPath, hash);
  return hash;
}

function hammingDistance(left, right) {
  let distance = 0;
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    if (left[index] !== right[index]) distance += 1;
  }
  return distance + Math.abs(left.length - right.length);
}

async function distinctGallerySources(candidates, slug, desiredCount = 12) {
  const offset = hashText(slug) % candidates.length;
  const ordered = candidates.map((_, index) => candidates[(offset + index) % candidates.length]);
  const selected = [];
  const selectedHashes = [];
  for (const threshold of [18, 14, 10, 6, 0]) {
    for (const sourcePublicPath of ordered) {
      if (selected.length >= desiredCount) return selected;
      if (selected.includes(sourcePublicPath)) continue;
      const hash = await averageImageHash(sourcePublicPath);
      const tooSimilar = selectedHashes.some((existingHash) => hammingDistance(existingHash, hash) < threshold);
      if (tooSimilar) continue;
      selected.push(sourcePublicPath);
      selectedHashes.push(hash);
    }
  }
  return selected;
}

async function writeUniqueGalleryImage(sourcePublicPath, outputFile, slug, slot) {
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  if (fs.existsSync(outputFile)) fs.rmSync(outputFile, { force: true });
  const image = await sharp();
  const seed = hashText(`${slug}:${slot}:${sourcePublicPath}`);
  const slotNumber = Number(slot) || 1;
  const cropPositions = ["centre", "north", "south", "east", "west", "northeast", "northwest", "southeast", "southwest", "entropy"];
  const cropPosition = cropPositions[slotNumber % cropPositions.length];
  const hue = (seed % 48) - 24;
  const brightness = 0.9 + ((seed % 16) / 100);
  const saturation = 0.9 + (((seed >>> 3) % 24) / 100);
  const overlayOpacity = 0.16 + (((seed >>> 6) % 9) / 100);
  const accent = [
    ["#16dcf0", "#2f6fed"],
    ["#f7b733", "#fc4a1a"],
    ["#ffffff", "#111827"],
    ["#e879f9", "#06b6d4"]
  ][slotNumber % 4];
  const overlay = Buffer.from(
    `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${accent[0]}" stop-opacity="${overlayOpacity}" offset="0"/><stop stop-color="${accent[1]}" stop-opacity="${overlayOpacity / 1.4}" offset="1"/></linearGradient><radialGradient id="r" cx="${20 + (seed % 60)}%" cy="${18 + ((seed >>> 5) % 58)}%" r="65%"><stop stop-color="#ffffff" stop-opacity="${overlayOpacity / 1.6}" offset="0"/><stop stop-color="#000000" stop-opacity="0" offset="1"/></radialGradient></defs><rect width="1024" height="1024" fill="url(#g)"/><rect width="1024" height="1024" fill="url(#r)"/><path d="M${(seed % 260) - 80} 1024 L1024 ${(seed >>> 3) % 260}" stroke="#ffffff" stroke-opacity="${overlayOpacity / 1.2}" stroke-width="${18 + (seed % 24)}"/></svg>`
  );
  await image(assetFilePath(sourcePublicPath))
    .resize(1024, 1024, { fit: "cover", position: cropPosition })
    .modulate({ brightness, saturation, hue })
    .composite([{ input: overlay, blend: "overlay" }])
    .sharpen({ sigma: 0.32 + ((seed >>> 8) % 6) / 20 })
    .webp({ quality: 88 })
    .toFile(outputFile);
}

function themeSourceAssets(slug, allAssets) {
  const localGallery = (prefix, count = 12) => Array.from({ length: count }, (_, index) => {
    const slot = String(index + 1).padStart(2, "0");
    return `/assets/sites/site_aidreamcapes/fan-holiday-theme/gallery/${prefix}-${slot}.webp`;
  }).filter((asset) => fs.existsSync(assetFilePath(asset)));
  if (slug === "thanksgiving-group-photos") {
    return localGallery("thanksgiving-keepsake-table-set");
  }
  if (slug === "halloween-party-photos") {
    return [
      ...localGallery("halloween-party-portrait-set"),
      ...localGallery("spooky-fan-card-portraits"),
      ...localGallery("haunted-premiere-portrait-set")
    ];
  }
  if (slug === "holiday") {
    return allAssets.filter((asset) => /holiday|christmas|seasonal/i.test(asset));
  }
  return [];
}

async function galleryForProfile(profile, pack, pools, allAssets, slug) {
  const gallery = providerGalleryPaths(slug);
  const missing = gallery.filter((publicPath) => !fs.existsSync(assetFilePath(publicPath)));
  if (missing.length) {
    const profilePools = Array.isArray(profile.pools) ? profile.pools : [];
    const pooledAssets = profilePools.flatMap((pool) => pools[pool] ?? []);
    const candidates = unique([
      ...themeSourceAssets(slug, allAssets),
      ...pooledAssets
    ]).filter((asset) => fs.existsSync(assetFilePath(asset)));
    if (!candidates.length) {
      throw new Error(
        `Missing gallery images for ${pack.name}. Run: node scripts/generate-mydreamshoots-theme-galleries.mjs --slugs ${slug} --force`
      );
    }
    const sources = await distinctGallerySources(candidates, slug, 12);
    for (let index = 0; index < gallery.length; index += 1) {
      const publicPath = gallery[index];
      const outputFile = assetFilePath(publicPath);
      const source = sources[index % sources.length];
      const slot = String(index + 1).padStart(2, "0");
      await writeUniqueGalleryImage(source, outputFile, slug, slot);
    }
  }
  return gallery;
}

function providerGalleryPaths(slug) {
  return Array.from({ length: 12 }, (_, index) => {
    const slot = String(index + 1).padStart(2, "0");
    return `${uniqueGalleryPublicPrefix}/${slug}/${slug}-${slot}.webp?v=${uniqueGalleryVersion}`;
  });
}

function providerCoverPath(slug) {
  return `${uniqueCoverPublicPrefix}/${slug}/${slug}-cover.webp?v=${uniqueCoverVersionBySlug[slug] ?? uniqueCoverVersion}`;
}

async function ensureProviderCover(slug, sourcePublicPath) {
  const coverPublicPath = providerCoverPath(slug);
  const coverFilePath = assetFilePath(coverPublicPath);
  if (fs.existsSync(coverFilePath)) return coverPublicPath;
  fs.mkdirSync(path.dirname(coverFilePath), { recursive: true });
  const image = await sharp();
  const seed = hashText(`cover:${slug}:${sourcePublicPath}`);
  const accent = slug.includes("thanksgiving")
    ? ["#f7b733", "#8b4513"]
    : slug.includes("halloween")
      ? ["#ff7a18", "#7c3aed"]
      : ["#16dcf0", "#ff9f43"];
  const overlay = Buffer.from(
    `<svg width="1280" height="960" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${accent[0]}" stop-opacity="0.16" offset="0"/><stop stop-color="${accent[1]}" stop-opacity="0.18" offset="1"/></linearGradient><radialGradient id="r" cx="${24 + (seed % 48)}%" cy="${18 + ((seed >>> 5) % 52)}%" r="72%"><stop stop-color="#ffffff" stop-opacity="0.11" offset="0"/><stop stop-color="#000000" stop-opacity="0" offset="1"/></radialGradient></defs><rect width="1280" height="960" fill="url(#g)"/><rect width="1280" height="960" fill="url(#r)"/></svg>`
  );
  const background = await image(assetFilePath(sourcePublicPath))
    .resize(1280, 960, { fit: "cover", position: "centre" })
    .blur(26)
    .modulate({ brightness: 0.7, saturation: 1.05, hue: (seed % 28) - 14 })
    .composite([{ input: overlay, blend: "overlay" }])
    .toBuffer();
  const foreground = await image(assetFilePath(sourcePublicPath))
    .resize(900, 900, { fit: "inside" })
    .toBuffer();
  const foregroundMeta = await image(foreground).metadata();
  await image(background)
    .composite([{
      input: foreground,
      left: Math.max(0, Math.floor((1280 - (foregroundMeta.width ?? 900)) / 2)),
      top: Math.max(0, Math.floor((960 - (foregroundMeta.height ?? 900)) / 2))
    }])
    .sharpen({ sigma: 0.46 })
    .webp({ quality: 90 })
    .toFile(coverFilePath);
  return coverPublicPath;
}

function coverSourceForSlug(slug, galleryImages) {
  if (slug === "thanksgiving-group-photos") return galleryImages[1] ?? galleryImages[0];
  if (slug === "halloween-party-photos") return galleryImages[5] ?? galleryImages[0];
  return galleryImages[0];
}

function descriptionFor(pack, profile) {
  const bestFor = profile.bestForItems?.length
    ? `Best for ${profile.bestForItems.join(", ")}.`
    : profile.bestFor
    ? `Best for ${profile.bestFor}.`
    : "";
  return [
    profile.detailIntro || profile.detail || profile.cardDescription || profile.headline,
    profile.whatCreates,
    bestFor,
    profile.safetyNote
  ].filter(Boolean).join(" ");
}

function updateCollectionsPage(pageJson) {
  if (!pageJson?.sections) return;
  const taxonomy = pageJson.sections.taxonomy_1;
  if (taxonomy?.type === "dreamshoot_package_taxonomy") {
    taxonomy.settings = {
      ...taxonomy.settings,
      title: "AI photo packages by style, use case, and delivery goal.",
      subtitle: "Browse every MyDreamShoots package before spending credits: work headshots, creator portraits, fan posters, beauty previews, wedding-style albums, avatars, seasonal cards, video add-ons, and private gallery tools."
    };
  }
  const packages = pageJson.sections.packages_1;
  if (packages?.type === "photo_package_wall") {
    packages.settings = {
      ...packages.settings,
      title: "Browse every MyDreamShoots photo package.",
      subtitle: "Compare all active package themes with image examples, output counts, credit costs, source-photo expectations, and private delivery notes before opening a focused category page.",
      maxCount: "all"
    };
  }
  const proofPairs = pageJson.sections.proof_pairs_1;
  if (proofPairs?.type === "before_after_gallery") {
    proofPairs.settings = {
      ...proofPairs.settings,
      title: "Compare source photos, selected package direction, and finished results.",
      subtitle: "Use the before-and-after examples to judge upload clarity, consent-safe source material, theme fit, and whether the final gallery style matches the channel you plan to use."
    };
  }
  const packagePath = pageJson.sections.packages_strip_1;
  if (packagePath?.type === "feature_grid") {
    packagePath.settings = {
      ...packagePath.settings,
      title: "From upload to a private gallery with clear checkpoints.",
      subtitle: "Every package follows the same decision path: prepare source photos, compare the theme and credit cost, submit the generation request, then review finished images in a private MyDreamShoots album before downloading favorites."
    };
    const richerBlocks = [
      {
        id: "pkg_path_upload",
        meta: "Step 01",
        title: "Source-photo checklist",
        text: "Upload clear portraits, selfies, product references, or group photos that you own or have permission to use. Good lighting, visible faces, and a few angle options help the selected package produce a more consistent private gallery."
      },
      {
        id: "pkg_path_preview",
        meta: "Step 02",
        title: "Package and credit review",
        text: "Compare the package examples, output count, theme description, and visible credit cost before starting. This keeps creative direction, budget, and source-photo expectations clear before a request reserves credits."
      },
      {
        id: "pkg_path_generate",
        meta: "Step 03",
        title: "Private generation request",
        text: "After you confirm the package, MyDreamShoots creates the images inside your signed-in workspace. Failed or interrupted requests release reserved credits automatically, so the gallery workflow stays predictable."
      },
      {
        id: "pkg_path_deliver",
        meta: "Step 04",
        title: "Gallery review and download",
        text: "Finished images return to your private album with the selected package context attached. Review the results, keep favorites for profiles, social posts, websites, albums, or planning boards, and download only what fits your use case."
      }
    ];
    packagePath.blocks = richerBlocks.map((richerBlock, index) => {
      const existingBlock = packagePath.blocks?.[index] ?? packagePath.blocks?.find((block) => block.id === richerBlock.id) ?? {};
      return {
        ...existingBlock,
        id: richerBlock.id,
        type: "card",
        settings: {
          ...(existingBlock.settings ?? {}),
          meta: richerBlock.meta,
          title: richerBlock.title,
          text: richerBlock.text
        }
      };
    });
  }
}

function changed(before, after) {
  return JSON.stringify(before) !== JSON.stringify(after);
}

function updateCollectionsPagesInSnapshot(value) {
  if (!value || typeof value !== "object") return 0;
  let count = 0;
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (node.slug === "/collections") {
      if (node.draftJson?.sections) {
        updateCollectionsPage(node.draftJson);
        count += 1;
      }
      if (node.publishedJson?.sections) {
        updateCollectionsPage(node.publishedJson);
        count += 1;
      }
      if (node.sections) {
        updateCollectionsPage(node);
        count += 1;
      }
    }
    for (const child of Object.values(node)) visit(child);
  };
  visit(value);
  return count;
}

async function applyLocalState() {
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  const allAssets = listAssets();
  const pools = imagePools(allAssets);
  const categories = new Map((state.creativePackCategories ?? []).map((category) => [category.id, category]));
  const leafCategoryBySlug = new Map((state.creativePackCategories ?? []).filter((category) => siteIds.has(category.siteId)).map((category) => [category.slug, category]));
  let packs = 0;
  let categoryCount = 0;
  let pages = 0;

  for (const category of state.creativePackCategories ?? []) {
    if (!siteIds.has(category.siteId)) continue;
    const profile = profileBySlug[category.slug];
    const parentProfile = parentProfiles[category.slug];
    if (profile) {
      category.description = profile.headline;
      category.heroTitle = category.label;
      category.heroSubtitle = profile.detail;
      category.imageUrl = providerCoverPath(category.slug);
      categoryCount += 1;
    } else if (parentProfile) {
      category.heroTitle = parentProfile[0];
      category.description = parentProfile[1];
      category.heroSubtitle = parentProfile[1];
      categoryCount += 1;
    }
  }

  for (const pack of state.creativePacks ?? []) {
    if (!siteIds.has(pack.siteId) || pack.status !== "active") continue;
    const category = categories.get(pack.categoryId);
    const slug = category?.slug || slugify(pack.category || pack.name);
    const profile = profileBySlug[slug] ?? profileBySlug[pack.category] ?? profileBySlug[slugify(pack.name)];
    if (!profile) continue;
    pack.headline = profile.headline;
    pack.description = descriptionFor(pack, profile);
    pack.galleryImages = await galleryForProfile(profile, pack, pools, allAssets, slug);
    pack.imageUrl = await ensureProviderCover(slug, coverSourceForSlug(slug, pack.galleryImages));
    pack.category = slug;
    packs += 1;
  }

  for (const site of state.sites ?? []) {
    if (!siteIds.has(site.id)) continue;
    for (const page of site.pages ?? []) {
      if (page.slug !== "/collections") continue;
      updateCollectionsPage(page.draftJson);
      updateCollectionsPage(page.publishedJson);
      pages += 1;
    }
  }

  for (const page of state.themePages ?? []) {
    if (!siteIds.has(page.siteId) || page.slug !== "/collections") continue;
    updateCollectionsPage(page.draftJson);
    updateCollectionsPage(page.publishedJson);
    pages += 1;
  }

  for (const publication of state.themePublications ?? []) {
    if (!siteIds.has(publication.siteId)) continue;
    const pagesSnapshot = publication.snapshot?.pages;
    if (!Array.isArray(pagesSnapshot)) continue;
    for (const page of pagesSnapshot) {
      if (page.slug !== "/collections") continue;
      updateCollectionsPage(page.draftJson);
      updateCollectionsPage(page.publishedJson);
    }
  }

  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
  clearStateCaches();
  return { packs, categories: categoryCount, pages, categoryRecords: leafCategoryBySlug.size };
}

function clearStateCaches() {
  for (const cacheFile of [
    ".next/cache/platform-state-postgres.json",
    ".next-3002/cache/platform-state-postgres.json",
    ".next-dev/cache/platform-state-postgres.json"
  ]) {
    const fullPath = path.join(process.cwd(), cacheFile);
    if (fs.existsSync(fullPath)) fs.rmSync(fullPath, { force: true });
  }
}

async function applyPostgres(localResult) {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
    const packUpdates = (state.creativePacks ?? []).filter((pack) => siteIds.has(pack.siteId) && profileBySlug[pack.category]);
    const categoryUpdates = (state.creativePackCategories ?? []).filter((category) => siteIds.has(category.siteId) && (profileBySlug[category.slug] || parentProfiles[category.slug]));
    for (const pack of packUpdates) {
      await prisma.creativePack.update({
        where: { id: pack.id },
        data: {
          category: pack.category,
          headline: pack.headline,
          description: pack.description,
          imageUrl: pack.imageUrl,
          galleryImages: pack.galleryImages
        }
      });
    }
    for (const category of categoryUpdates) {
      await prisma.creativePackCategory.update({
        where: { id: category.id },
        data: {
          description: category.description,
          heroTitle: category.heroTitle,
          heroSubtitle: category.heroSubtitle,
          imageUrl: category.imageUrl
        }
      });
    }
    const pageRecords = await prisma.themePage.findMany({
      where: { siteId: { in: Array.from(siteIds) }, slug: "/collections" }
    });
    let postgresPages = 0;
    for (const page of pageRecords) {
      const draftJson = structuredClone(page.draftJson);
      const publishedJson = structuredClone(page.publishedJson);
      updateCollectionsPage(draftJson);
      updateCollectionsPage(publishedJson);
      if (changed(page.draftJson, draftJson) || changed(page.publishedJson, publishedJson)) {
        await prisma.themePage.update({
          where: { id: page.id },
          data: { draftJson, publishedJson }
        });
        postgresPages += 1;
      }
    }

    let postgresThemes = 0;
    const themes = await prisma.siteTheme.findMany({ where: { siteId: { in: Array.from(siteIds) } } });
    for (const theme of themes) {
      const templates = structuredClone(theme.templates);
      const settings = structuredClone(theme.settings);
      updateCollectionsPagesInSnapshot(templates);
      updateCollectionsPagesInSnapshot(settings);
      if (changed(theme.templates, templates) || changed(theme.settings, settings)) {
        await prisma.siteTheme.update({ where: { id: theme.id }, data: { templates, settings } });
        postgresThemes += 1;
      }
    }

    let postgresPublications = 0;
    const publications = await prisma.themePublication.findMany({ where: { siteId: { in: Array.from(siteIds) } } });
    for (const publication of publications) {
      const snapshot = structuredClone(publication.snapshot);
      updateCollectionsPagesInSnapshot(snapshot);
      if (changed(publication.snapshot, snapshot)) {
        await prisma.themePublication.update({
          where: { id: publication.id },
          data: { snapshot }
        });
        postgresPublications += 1;
      }
    }

    clearStateCaches();
    return {
      ...localResult,
      postgresPacks: packUpdates.length,
      postgresCategories: categoryUpdates.length,
      postgresPages,
      postgresThemes,
      postgresPublications
    };
  } finally {
    await prisma.$disconnect();
  }
}

const localResult = await applyLocalState();
const result = args.has("--postgres") ? await applyPostgres(localResult) : localResult;
console.log(JSON.stringify({ ok: true, ...result }, null, 2));
