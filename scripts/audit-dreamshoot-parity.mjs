import fs from "fs";
import path from "path";

const repoRoot = process.cwd();
const statePath = path.join(repoRoot, "data", "platform-state.json");
const state = JSON.parse(fs.readFileSync(statePath, "utf8"));

function fail(message) {
  console.error(`DreamShoot parity audit failed: ${message}`);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function featuredCollectionSlugs(section) {
  return (section?.blocks ?? [])
    .filter((block) => block?.type === "seasonal_image")
    .map((block) => String(block?.settings?.collectionSlug ?? "").trim());
}

const site = state.sites?.find((item) => item.slug === "dreamshoot" || item.id === "site_dreamshoot");
assert(site, "missing dreamshoot site");
assert(site.id === "site_dreamshoot", `unexpected dreamshoot site id ${site.id}`);

const packs = (state.creativePacks ?? []).filter((pack) => pack.siteId === site.id && pack.status === "active");
assert(packs.length >= 24, `expected at least 24 active packs for the full DreamShoot catalog, got ${packs.length}`);

const firstEight = packs.slice(0, 8);
const weddingWeightedInFirstEight = firstEight.filter((pack) => ["wedding", "couple"].includes(String(pack.category).toLowerCase()));
assert(
  weddingWeightedInFirstEight.length === 0,
  `homepage first 8 packs should not be wedding/couple-led: ${weddingWeightedInFirstEight.map((pack) => pack.name).join(", ")}`
);

const imageMap = new Map();
for (const pack of packs) {
  assert(pack.imageUrl, `${pack.name} is missing imageUrl`);
  assert(!/\.svg($|\?)/i.test(pack.imageUrl), `${pack.name} is still using an SVG placeholder image: ${pack.imageUrl}`);
  const list = imageMap.get(pack.imageUrl) ?? [];
  list.push(pack.name);
  imageMap.set(pack.imageUrl, list);
}
const duplicateImages = [...imageMap.entries()].filter(([, names]) => names.length > 1);
assert(
  duplicateImages.length === 0,
  `creative pack images must be unique: ${duplicateImages.map(([image, names]) => `${image} => ${names.join(", ")}`).join("; ")}`
);

const homePage = site.pages?.find((page) => page.slug === "/" || page.pageType === "home");
assert(homePage?.publishedJson, "missing published home page");
const homeOrder = homePage.publishedJson.sectionsOrder ?? [];
const requiredHomeSections = [
  "hero_1",
  "featured_pack_1",
  "featured_christmas_1",
  "featured_thanksgiving_1",
  "generation_showcase_1",
  "tutorial_video_1",
  "tutorial_video_2",
  "package_catalog_1",
  "proof_1",
  "faq_1",
  "conversion_1",
  "brand_strip_1"
];
assert(homeOrder.length <= 14, `home page should stay focused at 14 or fewer sections, got ${homeOrder.length}`);
for (const id of requiredHomeSections) {
  assert(homeOrder.includes(id), `home page missing required DreamShoot commercial section ${id}`);
}
for (const id of ["visual_proof_1", "flow_bridge_1", "trust_1", "taxonomy_1", "sample_strip_1", "workflow_1", "packages_1", "free_tools_1", "plan_rules_1", "proof_pairs_1", "packages_strip_1"]) {
  assert(!homeOrder.includes(id), `home page should not carry deep explainer section ${id}; it belongs on a supporting page`);
}
assert(homePage.publishedJson.sections?.pricing_1?.type === "pricing_table", "home pricing section should remain available for embedded rendering");
assert(!homeOrder.includes("pricing_1"), "home pricing_1 should stay embedded in showcase instead of ordered separately");
assert(homePage.publishedJson.sections?.generation_showcase_1?.settings?.embeddedPricingSectionId === "pricing_1", "home showcase should embed pricing_1");
const hero = homePage.publishedJson.sections?.hero_1;
assert(hero?.type === "hero", "missing home hero_1 section");
const forbiddenVisualPattern = /wedding|engagement|couple|date-night|hero-gpt2|sample-wedding|sample-engagement/i;
const heroImage = String(hero.settings?.imageUrl ?? "");
const heroSecondaryImage = String(hero.settings?.secondaryImageUrl ?? "");
const heroTertiaryImage = String(hero.settings?.tertiaryImageUrl ?? "");
assert(heroImage && !forbiddenVisualPattern.test(heroImage), `home hero image is still wedding/couple-led: ${heroImage}`);
assert(!heroSecondaryImage || !forbiddenVisualPattern.test(heroSecondaryImage), `home secondary hero image is still wedding/couple-led: ${heroSecondaryImage}`);
assert(!heroTertiaryImage || !forbiddenVisualPattern.test(heroTertiaryImage), `home tertiary hero image is still wedding/couple-led: ${heroTertiaryImage}`);
const heroGrid = String(hero.settings?.heroGridImages ?? "")
  .split("|")
  .map((item) => item.trim())
  .filter(Boolean);
assert(heroGrid.length >= 8, `hero grid should include at least 8 images, got ${heroGrid.length}`);
const weddingHeroImages = heroGrid.filter((image) => forbiddenVisualPattern.test(image));
assert(
  weddingHeroImages.length === 0,
  `hero grid is still wedding/couple-heavy: ${weddingHeroImages.join(", ")}`
);

const homeAssetRefRecords = [];
function collectAssetRefs(value, pathSegments = []) {
  if (pathSegments.includes("package_catalog_1") && pathSegments.includes("blocks")) {
    return;
  }
  if (typeof value === "string") {
    for (const part of value.split("|").map((item) => item.trim()).filter(Boolean)) {
      if (part.includes("/assets/dreamshoot/")) homeAssetRefRecords.push({ asset: part, pathSegments });
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectAssetRefs(item, [...pathSegments, String(index)]));
    return;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => collectAssetRefs(item, [...pathSegments, key]));
  }
}
collectAssetRefs(homePage.publishedJson);
const homeAssetRefs = homeAssetRefRecords.map((record) => record.asset);
const homeAssetCounts = new Map();
for (const asset of homeAssetRefs) homeAssetCounts.set(asset, (homeAssetCounts.get(asset) ?? 0) + 1);
const sectionAssetCounts = new Map();
for (const record of homeAssetRefRecords) {
  const sectionId = record.pathSegments[0] === "sections" ? record.pathSegments[1] : record.pathSegments[0] ?? "page";
  const key = `${sectionId}\u0000${record.asset}`;
  sectionAssetCounts.set(key, (sectionAssetCounts.get(key) ?? 0) + 1);
}
const overusedSectionAssets = [...sectionAssetCounts.entries()].filter(([, count]) => count > 1);
assert(
  overusedSectionAssets.length === 0,
  `home page single-image assets must not repeat within one section: ${overusedSectionAssets.map(([key, count]) => {
    const [sectionId, asset] = key.split("\u0000");
    return `${sectionId}:${asset} x${count}`;
  }).join("; ")}`
);
assert(homeAssetCounts.size >= 40, `home page should use at least 40 distinct DreamShoot visuals, got ${homeAssetCounts.size}`);
for (const asset of homeAssetCounts.keys()) {
  const assetPath = path.join(repoRoot, "public", asset.split("?")[0].split("#")[0].replace(/^\/+/, ""));
  assert(fs.existsSync(assetPath), `home page references a missing image asset: ${asset}`);
}

function dreamshootFeaturedCatalogScore(pack) {
  const title = String(pack.name ?? "").toLowerCase();
  const category = String(pack.category ?? "").toLowerCase();
  if (title.includes("world cup")) return 0;
  if (title.includes("christmas photos")) return 1;
  if (title.includes("christmas couple")) return 2;
  if (title.includes("holiday") || category.includes("holiday") || category.includes("seasonal")) return 3;
  if (category.includes("creator") || title.includes("creator")) return 4;
  if (title.includes("gala") || category.includes("gala") || category.includes("red carpet") || category.includes("vip")) return 5;
  if (title.includes("thanksgiving") || category.includes("thanksgiving")) return 6;
  if (title.includes("halloween") || category.includes("halloween")) return 7;
  if (title.includes("headshot")) return 8;
  if (title.includes("hairstyle")) return 9;
  if (title.includes("cyberpunk")) return 10;
  if (title.includes("mafia")) return 11;
  if (title.includes("nature")) return 12;
  if (category.includes("wedding") || category.includes("couple") || category.includes("boudoir") || category.includes("cultural")) return 25;
  return 15;
}

const homeFeaturedPackImages = [...packs]
  .sort((a, b) => dreamshootFeaturedCatalogScore(a) - dreamshootFeaturedCatalogScore(b))
  .slice(0, Math.max(3, Math.min(6, Number(homePage.publishedJson.sections?.package_catalog_1?.settings?.featuredCount ?? 5))))
  .map((pack) => pack.imageUrl)
  .filter(Boolean);
const runtimeCatalogCounts = new Map();
for (const asset of homeFeaturedPackImages) runtimeCatalogCounts.set(asset, (runtimeCatalogCounts.get(asset) ?? 0) + 1);
const runtimeDuplicates = [...runtimeCatalogCounts.entries()].filter(([, count]) => count > 1);
assert(
  runtimeDuplicates.length === 0,
  `rendered home page catalog pack images must not repeat within the catalog: ${runtimeDuplicates.map(([asset, count]) => `${asset} x${count}`).join("; ")}`
);

const requiredPackNames = [
  "Professional Headshots",
  "Hairstyle",
  "Virtual Try-On",
  "Cyberpunk",
  "Gala Photos",
  "Mafia",
  "Nature",
  "Outdoor Creator Scenes",
  "World Cup Fan Photos",
  "Creator Portraits",
  "Fashion Editorial",
  "Anime Avatar",
  "Product Style",
  "Social Cards",
  "Wedding Portraits",
  "Indian Wedding",
  "Desi Wedding",
  "Valentine Photos",
  "Engagement",
  "Boudoir",
  "Holiday",
  "Christmas Couple",
  "Christmas Photos",
  "Thanksgiving Group Photos",
  "Halloween Party Photos",
  "AI Video Add-ons",
  "Magic Upscaler"
];
for (const name of requiredPackNames) {
  assert(packs.some((pack) => pack.name === name), `missing required pack ${name}`);
}
const referencePackNames = [
  "Indian Wedding",
  "Desi Wedding",
  "Valentine Photos",
  "Hairstyle",
  "Professional Headshots",
  "Wedding Portraits",
  "Nature",
  "Mafia",
  "Cyberpunk",
  "Holiday",
  "Engagement",
  "Boudoir",
  "Gala Photos",
  "Christmas Couple",
  "Christmas Photos",
  "Thanksgiving Group Photos",
  "Halloween Party Photos"
];
for (const name of referencePackNames) {
  assert(packs.some((pack) => pack.name === name), `reference package coverage missing ${name}`);
}
function packCategoryTokens(pack) {
  const raw = [pack.category, pack.name, pack.headline, pack.description].filter(Boolean).join(" ").toLowerCase();
  const tokens = new Set([String(pack.category ?? "").toLowerCase()]);
  if (/(headshot|linkedin|resume|professional)/.test(raw)) tokens.add("headshots");
  if (/(beauty|hairstyle|hair|fashion|try-on)/.test(raw)) tokens.add("beauty");
  if (/(cyberpunk|gala|mafia|noir|creative|editorial)/.test(raw)) tokens.add("creative");
  if (/(world-cup|sports?|fan|stadium|match)/.test(raw)) tokens.add("sports");
  if (/(creator|media-kit|personal-brand|red-carpet|vip)/.test(raw)) tokens.add("creator");
  if (/(avatar|anime)/.test(raw)) tokens.add("avatar");
  if (/(wedding|save-the-date)/.test(raw)) tokens.add("wedding");
  if (/(cultural|indian|desi)/.test(raw)) tokens.add("cultural");
  if (/(couple|valentine|engagement)/.test(raw)) tokens.add("couple");
  if (/boudoir/.test(raw)) tokens.add("boudoir");
  if (/(seasonal|holiday|christmas|thanksgiving|halloween|graduation)/.test(raw)) tokens.add("seasonal");
  if (/(thanksgiving)/.test(raw)) tokens.add("thanksgiving-group-photos");
  if (/(halloween)/.test(raw)) tokens.add("halloween-party-photos");
  if (/(video|motion|clip)/.test(raw)) tokens.add("video");
  if (/(upscaler|enhancer|utility|product)/.test(raw)) tokens.add("utility");
  return tokens;
}

const requiredCategories = ["headshots", "beauty", "creative", "sports", "creator", "avatar", "wedding", "cultural", "couple", "boudoir", "seasonal", "thanksgiving-group-photos", "halloween-party-photos", "video", "utility"];
for (const category of requiredCategories) {
  assert(packs.some((pack) => packCategoryTokens(pack).has(category)), `missing required pack category ${category}`);
}

const pageText = JSON.stringify(site.pages ?? []);
const coreCommercialPageText = JSON.stringify((site.pages ?? []).filter((page) => !String(page.slug ?? "").startsWith("/blog/")));
const forbiddenDreamshootPhrases = [
  "Choose the perfect package for your love story",
  "Questions couples ask",
  "Balanced for couples",
  "Wedding and engagement",
  "Couple Studio",
  "Date Night",
  "Date Night Photos",
  "Happy Couples",
  "City couple story",
  "Show the couple",
  "couple photos",
  "couple models",
  "couple visuals",
  "couple looks",
  "wedding looks",
  "anniversary-ready",
  "love story",
  "couple-studio-hero",
  "date-night.svg"
];
for (const phrase of forbiddenDreamshootPhrases) {
  assert(!coreCommercialPageText.toLowerCase().includes(phrase.toLowerCase()), `DreamShoot core pages still contain wedding/couple-led phrase: ${phrase}`);
}

const loginPage = site.pages?.find((page) => page.slug === "/login");
const loginImage = loginPage?.publishedJson?.sections?.login_1?.settings?.imageUrl;
assert(loginImage && !forbiddenVisualPattern.test(String(loginImage)), `login hero image is still wedding/couple-led: ${loginImage}`);

const pricingPage = site.pages?.find((page) => page.slug === "/pricing");
const pricingImage = pricingPage?.publishedJson?.sections?.pricing_1?.settings?.backgroundImage;
assert(pricingImage && !forbiddenVisualPattern.test(String(pricingImage)), `pricing background image is still wedding/couple-led: ${pricingImage}`);

const toolsPage = site.pages?.find((page) => page.slug === "/tools");
assert(toolsPage?.publishedJson?.sectionsOrder?.includes("free_tools_1"), "tools page must expose free tools funnel");
assert(toolsPage?.publishedJson?.sectionsOrder?.includes("plan_rules_1"), "tools page must explain paid private model and credits");
assert(toolsPage?.publishedJson?.sectionsOrder?.includes("pricing_1"), "tools page must route into real pricing");

const collectionsPage = site.pages?.find((page) => page.slug === "/collections");
assert(collectionsPage?.publishedJson?.sectionsOrder?.includes("packages_1"), "collections page must show live package wall");
const collectionMaxCount = collectionsPage?.publishedJson?.sections?.packages_1?.settings?.maxCount;
assert(
  collectionMaxCount === "all" || Number(collectionMaxCount) >= 32,
  "collections package wall must expose the full catalog"
);
assert(collectionsPage?.publishedJson?.sectionsOrder?.includes("trust_1"), "collections page must include trust signals");
assert(collectionsPage?.publishedJson?.sectionsOrder?.includes("proof_pairs_1"), "collections page must show package transformation proof");
assert(collectionsPage?.publishedJson?.sectionsOrder?.includes("packages_strip_1"), "collections page must explain package path");

const homeCatalog = homePage.publishedJson.sections?.package_catalog_1;
assert(homeCatalog?.type === "dreamshoot_package_catalog", "home page missing DreamShoot package catalog renderer");
assert(homeCatalog?.settings?.source === "creative_packs", "home package catalog must use active creative packs, not a short manual demo list");
assert(Number(homeCatalog?.settings?.featuredCount ?? 0) >= 5, "home package catalog should feature at least 5 cards before the full directory");

const featuredPack = homePage.publishedJson.sections?.featured_pack_1;
assert(featuredPack?.type === "dreamshoot_featured_pack", "home page missing DreamShoot featured pack renderer");
const featuredOrder = homeOrder.filter((id) => id.startsWith("featured_"));
assert(
  JSON.stringify(featuredOrder) === JSON.stringify(["featured_pack_1", "featured_christmas_1", "featured_thanksgiving_1"]),
  `home featured pack order should be World Cup, Christmas, Thanksgiving; got ${featuredOrder.join(", ")}`
);
const featuredPackText = JSON.stringify(featuredPack);
assert(
  featuredCollectionSlugs(featuredPack).join("|") === "world-cup-fan-photos|gala-photos|christmas-couple|creator-portraits|thanksgiving-group-photos|holiday",
  `World Cup featured pack stable collection slugs drifted: ${featuredCollectionSlugs(featuredPack).join("|")}`
);
for (const phrase of [
  "star-inspired",
  "celebrity-inspired",
  "football-star",
  "sports-star",
  "World Cup now. Holiday next.",
  "World Cup|Christmas|Valentine|Wedding season",
  "AI video"
]) {
  assert(!featuredPackText.toLowerCase().includes(phrase.toLowerCase()), `World Cup featured pack drifted back to forbidden copy: ${phrase}`);
}
for (const phrase of [
  "World Cup fan photos for sports-idol style moments.",
  "A focused sports direction to compare first.",
  "Fan-safe styling: no real player or celebrity likenesses, official team logos, event marks, or protected brand assets without permission.",
  "Current recommendation: World Cup Fan Photos"
]) {
  assert(featuredPackText.includes(phrase), `World Cup featured pack missing required copy: ${phrase}`);
}
const requiredWorldCupAssets = [
  "/assets/dreamshoot/generated/pack-galleries/world-cup-fan-photos/world-cup-fan-photos-03.webp",
  "/assets/dreamshoot/generated/pack-galleries/gala-photos/gala-photos-02.webp",
  "/assets/dreamshoot/generated/pack-galleries/christmas-couple/christmas-couple-02.webp",
  "/assets/dreamshoot/generated/pack-galleries/creator-portraits/creator-portraits-01.webp",
  "/assets/dreamshoot/generated/pack-covers/thanksgiving-group-photos/thanksgiving-group-photos-cover.webp?v=20260801visualfix1",
  "/assets/dreamshoot/generated/pack-covers/holiday/holiday-cover.webp?v=20260803safecover1"
];
for (const asset of requiredWorldCupAssets) {
  assert(featuredPackText.includes(asset), `World Cup featured pack missing generated asset: ${asset}`);
}
assert(!featuredPackText.includes("/assets/dreamshoot/generated/20260619/world-cup-fan-star"), "World Cup featured pack still references old football-star asset");

const christmasPack = homePage.publishedJson.sections?.featured_christmas_1;
assert(christmasPack?.type === "dreamshoot_featured_pack", "home page missing Christmas featured pack renderer");
const christmasPackText = JSON.stringify(christmasPack);
assert(
  featuredCollectionSlugs(christmasPack).join("|") === "christmas-photos|christmas-photos|christmas-couple|christmas-photos|christmas-photos|christmas-couple",
  `Christmas featured pack stable collection slugs drifted: ${featuredCollectionSlugs(christmasPack).join("|")}`
);
for (const phrase of [
  "Christmas group photos for cards, posts, and private albums.",
  "Create Christmas Photos",
  "Current campaign: Christmas Photos",
  "/collections/christmas-photos"
]) {
  assert(christmasPackText.includes(phrase), `Christmas featured pack missing required copy or link: ${phrase}`);
}
for (const asset of [
  "/assets/dreamshoot/generated/pack-galleries/christmas-photos/christmas-photos-06.webp",
  "/assets/dreamshoot/generated/pack-galleries/christmas-photos/christmas-photos-07.webp",
  "/assets/dreamshoot/generated/pack-galleries/christmas-couple/christmas-couple-04.webp",
  "/assets/dreamshoot/generated/pack-covers/christmas-photos/christmas-photos-cover.webp"
]) {
  assert(christmasPackText.includes(asset), `Christmas featured pack missing DreamShoot asset: ${asset}`);
}
assert(christmasPackText.includes("/assets/dreamshoot/generated/pack-galleries/christmas-photos/christmas-photos-10.webp"), "Christmas featured pack missing DreamShoot cover asset");

const thanksgivingPack = homePage.publishedJson.sections?.featured_thanksgiving_1;
assert(thanksgivingPack?.type === "dreamshoot_featured_pack", "home page missing Thanksgiving featured pack renderer");
const thanksgivingPackText = JSON.stringify(thanksgivingPack);
assert(
  featuredCollectionSlugs(thanksgivingPack).join("|") === "thanksgiving-group-photos|thanksgiving-group-photos|thanksgiving-group-photos|thanksgiving-group-photos|thanksgiving-group-photos|thanksgiving-group-photos",
  `Thanksgiving featured pack stable collection slugs drifted: ${featuredCollectionSlugs(thanksgivingPack).join("|")}`
);
for (const phrase of [
  "Thanksgiving group photos for warm private albums.",
  "Create Thanksgiving Photos",
  "Current campaign: Thanksgiving Group Photos",
  "/collections/thanksgiving-group-photos"
]) {
  assert(thanksgivingPackText.includes(phrase), `Thanksgiving featured pack missing required copy or link: ${phrase}`);
}
for (const asset of [
  "/assets/dreamshoot/generated/pack-galleries/thanksgiving-group-photos/thanksgiving-group-photos-05.webp",
  "/assets/dreamshoot/generated/pack-galleries/thanksgiving-group-photos/thanksgiving-group-photos-06.webp",
  "/assets/dreamshoot/generated/pack-galleries/thanksgiving-group-photos/thanksgiving-group-photos-07.webp",
  "/assets/dreamshoot/generated/pack-covers/thanksgiving-group-photos/thanksgiving-group-photos-cover.webp"
]) {
  assert(thanksgivingPackText.includes(asset), `Thanksgiving featured pack missing DreamShoot asset: ${asset}`);
}
assert(thanksgivingPackText.includes("/assets/dreamshoot/generated/pack-galleries/thanksgiving-group-photos/thanksgiving-group-photos-10.webp"), "Thanksgiving featured pack missing DreamShoot cover asset");
for (const packText of [christmasPackText, thanksgivingPackText]) {
  assert(!packText.includes("/assets/sites/site_aidreamcapes/"), "DreamShoot featured packs must not use Aidreamcapes assets");
}

assert(pricingPage?.publishedJson?.sectionsOrder?.includes("plan_rules_1"), "pricing page must explain free tools, private model, and credits");
assert(pricingPage?.publishedJson?.sectionsOrder?.includes("trust_1"), "pricing page must include trust signals");

const loginPageOrder = loginPage?.publishedJson?.sectionsOrder ?? [];
assert(loginPageOrder.includes("login_1"), "login page missing editable login panel");
assert(loginPageOrder.includes("trust_1"), "login page missing trust section");
assert(loginPageOrder.includes("plan_rules_1"), "login page missing plan and credit explanation");

const faqBlocks = homePage.publishedJson.sections?.faq_1?.blocks ?? [];
assert(faqBlocks.length >= 7, `home FAQ should cover at least 7 commercial objections, got ${faqBlocks.length}`);
const testimonialBlocks = homePage.publishedJson.sections?.proof_1?.blocks ?? [];
assert(testimonialBlocks.length >= 6, `home testimonials should include at least 6 believable customers, got ${testimonialBlocks.length}`);

const commerceNeedles = [
  "private model",
  "credits",
  "photo packages",
  "private gallery",
  "subscription",
  "checkout"
];
const lowerPageText = pageText.toLowerCase();
assert(
  lowerPageText.includes("world cup") || lowerPageText.includes("football fan"),
  "DreamShoot pages should include the new World Cup / football fan package direction"
);
for (const needle of ["fan meetup", "sports-idol", "christmas", "thanksgiving", "halloween"]) {
  assert(lowerPageText.includes(needle), `DreamShoot pages missing required fan/holiday theme concept: ${needle}`);
}
for (const needle of commerceNeedles) {
  assert(lowerPageText.includes(needle), `DreamShoot pages missing required commerce concept: ${needle}`);
}
assert(
  lowerPageText.includes("free tools") || lowerPageText.includes("paid tools") || lowerPageText.includes("photo tools") || lowerPageText.includes("ai tools"),
  "DreamShoot pages missing required commerce concept: tools"
);

const dreamshootMedia = (state.mediaAssets ?? []).filter((asset) => asset.siteId === site.id);
const heroMedia = dreamshootMedia.find((asset) => asset.id === "media_dreamshoot_hero");
assert(heroMedia && !forbiddenVisualPattern.test(String(heroMedia.previewUrl ?? "")), `media_dreamshoot_hero points to wedding/couple visual: ${heroMedia?.previewUrl}`);
for (const asset of dreamshootMedia) {
  const preview = String(asset.previewUrl ?? asset.originUrl ?? asset.storageKey ?? "");
  assert(!forbiddenVisualPattern.test(preview), `DreamShoot media asset ${asset.id} points to wedding/couple visual: ${preview}`);
}

const products = (state.products ?? []).filter((product) => product.siteId === site.id && product.status === "active");
for (const name of ["Starter", "Pro", "Premium"]) {
  assert(products.some((product) => product.name === name), `missing product ${name}`);
}
assert(products.some((product) => product.type === "credit_pack"), "missing active credit pack product");

const pro = products.find((product) => product.name === "Pro");
const expectedPlans = {
  Starter: { amountCents: 2450, creditsGranted: 200, featured: false, originalAmountCents: 3500 },
  Pro: { amountCents: 3500, creditsGranted: 300, featured: true, originalAmountCents: 5000 },
  Premium: { amountCents: 6300, creditsGranted: 600, featured: false, originalAmountCents: 9000 }
};
for (const [name, expected] of Object.entries(expectedPlans)) {
  const product = products.find((item) => item.name === name);
  const price = product?.prices?.find((item) => item.interval === "month");
  assert(price, `${name} is missing monthly price`);
  assert(price.amountCents === expected.amountCents, `${name} should be ${expected.amountCents} cents, got ${price.amountCents}`);
  assert(price.creditsGranted === expected.creditsGranted, `${name} should grant ${expected.creditsGranted} credits, got ${price.creditsGranted}`);
  assert(price.metadata?.originalAmountCents === expected.originalAmountCents, `${name} should expose original amount ${expected.originalAmountCents}, got ${price.metadata?.originalAmountCents}`);
  assert(price.metadata?.discountLabel === "30% off", `${name} should expose the current 30% off label`);
  assert(price.metadata?.featured === expected.featured, `${name} featured flag should be ${expected.featured}`);
}
assert(pro?.prices?.some((price) => price.amountCents === 3500 && price.creditsGranted === 300), "Pro plan should be $35 with 300 credits");

const proSubscription = (state.subscriptions ?? []).find((item) => item.siteId === site.id && item.productId === "prod_dreamshoot_pro");
assert(proSubscription?.creditsPerCycle === 300, `demo Pro subscription should grant 300 credits, got ${proSubscription?.creditsPerCycle}`);
const proOrder = (state.orders ?? []).find((item) => item.siteId === site.id && item.id === "order_dreamshoot_pro_001");
assert(proOrder?.amountCents === 3500 && proOrder?.credits === 300, "demo Pro order should be $35 and 300 credits");

const sourceFiles = [
  path.join(repoRoot, "src", "lib", "media.ts"),
  path.join(repoRoot, "src", "components", "designer", "resource-selector.tsx"),
  path.join(repoRoot, "src", "lib", "theme", "packages", "dreamshoot-ai-studio", "manifest.ts"),
  path.join(repoRoot, "src", "lib", "theme", "packages", "dreamshoot-ai-studio", "templates.ts"),
  path.join(repoRoot, "src", "components", "theme-renderer.tsx"),
  path.join(repoRoot, "src", "lib", "section-schema.ts"),
  path.join(repoRoot, "scripts", "migrate-dreamshoot-demo.mjs")
];
for (const file of sourceFiles) {
  const sourceText = fs.readFileSync(file, "utf8");
  assert(
    !/\/assets\/dreamshoot\/[^"')\s]*(hero-gpt2|date-night-gpt2)/i.test(sourceText),
    `DreamShoot unsafe fallback still exists in ${path.relative(repoRoot, file)}`
  );
}

console.log(JSON.stringify({
  ok: true,
  packs: packs.length,
  firstEight: firstEight.map((pack) => pack.name),
  products: products.map((product) => product.name),
  heroGridImages: heroGrid.length,
  homeSections: homeOrder.length,
  faqItems: faqBlocks.length,
  testimonials: testimonialBlocks.length
}, null, 2));
