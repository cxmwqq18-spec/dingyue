import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stateFile = path.join(repoRoot, "data", "platform-state.json");
const schemaFile = path.join(repoRoot, "src", "lib", "section-schema.ts");
const rendererFile = path.join(repoRoot, "src", "components", "theme-renderer.tsx");
const themePackageFile = path.join(repoRoot, "src", "lib", "theme", "packages", "wedding-story-house", "templates.ts");
const themeManifestFile = path.join(repoRoot, "src", "lib", "theme", "packages", "wedding-story-house", "manifest.ts");

const requiredHomeOrder = [
  "hero_1",
  "metrics_1",
  "pain_points_1",
  "luxury_highlight_1",
  "workflow_1",
  "destinations_1",
  "examples_1",
  "proof_1",
  "pricing_1",
  "trust_1",
  "faq_1",
  "final_cta_1"
];

const requiredPages = [
  "/",
  "/pricing",
  "/tools/image-studio",
  "/login",
  "/app",
  "/album",
  "/account",
  "/help",
  "/blog",
  "/policies/privacy",
  "/policies/refunds",
  "/policies/content"
];

function fail(message) {
  throw new Error(message);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function readText(file) {
  return fs.readFileSync(file, "utf8");
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function assertIncludes(value, marker, message) {
  assert(String(value ?? "").includes(marker), message);
}

function assertArrayEquals(actual, expected, message) {
  assert(Array.isArray(actual), `${message}: actual is not an array`);
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${message}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
}

function blockSettings(section, id) {
  const block = section?.blocks?.find((item) => item.id === id);
  assert(block, `${section?.type ?? "section"} missing block ${id}`);
  return block.settings ?? {};
}

function sectionById(home, id, type) {
  const section = home.publishedJson.sections[id];
  assert(section, `home missing section ${id}`);
  assert(section.type === type, `home section ${id} expected ${type}, got ${section.type}`);
  return section;
}

const state = readJson(stateFile);
const schemaText = readText(schemaFile);
const rendererText = readText(rendererFile);
const themePackageText = readText(themePackageFile);
const themeManifestText = readText(themeManifestFile);

const site = state.sites.find((item) => item.slug === "lumen");
assert(site, "missing lumen site");
assert(site.activeThemeKey === "wedding-story-house" || state.siteThemes?.some((theme) => theme.siteId === site.id && theme.themeKey === "wedding-story-house" && theme.status === "active"), "wedding-story-house is not active/available for Lumen");

const home = site.pages.find((page) => page.slug === "/");
assert(home, "missing Lumen home page");
assertArrayEquals(home.publishedJson.sectionsOrder, requiredHomeOrder, "home section order does not match AI Wedding target");
assertArrayEquals(home.draftJson.sectionsOrder, requiredHomeOrder, "draft home section order does not match AI Wedding target");

const header = site.themeSettings.publishedJson.globalSections?.header;
const footer = site.themeSettings.publishedJson.globalSections?.footer;
assert(header?.type === "header", "published header is not a normalized global section");
assert(footer?.type === "footer", "published footer is not a normalized global section");
assert(header.settings?.title === "AI Wedding", "header logo title is not AI Wedding");
for (const label of ["How It Works", "Styles", "Examples", "Pricing", "FAQ"]) {
  assert(header.blocks?.some((block) => block.settings?.label === label), `header missing menu ${label}`);
}
assert(header.settings?.ctaLabel === "Get Started", "header CTA must be Get Started");
assert(footer.blocks?.length >= 8, "footer must include product/company/support menu blocks");
for (const key of ["instagramUrl", "facebookUrl", "pinterestUrl", "youtubeUrl", "copyright"]) {
  assert(footer.settings?.[key], `footer missing ${key}`);
}

const hero = sectionById(home, "hero_1", "hero");
assert(hero.settings.headline === "AI-Powered Wedding Photos in Any Destination", "hero headline mismatch");
assertIncludes(hero.settings.subheadline, "No travel", "hero subheadline must mention no travel");
assertIncludes(hero.settings.socialProofLabel, "4.9/5", "hero rating card must include 4.9/5");
assertIncludes(hero.settings.socialProofLabel, "10,000+", "hero rating card must include 10,000+ couples");
assert(blockSettings(hero, "hero_cta_primary").label === "See Examples", "hero primary CTA mismatch");
assert(blockSettings(hero, "hero_cta_secondary").label === "How It Works", "hero secondary CTA mismatch");
assert(hero.settings.imageUrl || hero.settings.mediaAssetId, "hero must bind a wedding destination image");

const metrics = sectionById(home, "metrics_1", "metric_strip");
const metricPairs = metrics.blocks.map((block) => `${block.settings.value} ${block.settings.label}`);
for (const marker of ["100+ Dream Destinations", "10,000+ Happy Couples", "99% Satisfaction Rate", "24/7 AI Support"]) {
  assert(metricPairs.includes(marker), `metric strip missing ${marker}`);
}

const pain = sectionById(home, "pain_points_1", "sample_strip");
assert(pain.settings.title === "Tired of These Wedding Photo Problems?", "pain-point title mismatch");
for (const id of ["pain_expensive", "pain_time", "pain_weather", "pain_choices"]) {
  const settings = blockSettings(pain, id);
  assert(settings.label && settings.imageUrl && settings.meta, `pain block ${id} must have editable label/image/meta`);
}

const solution = sectionById(home, "luxury_highlight_1", "luxury_highlight");
assert(solution.settings.title === "AI Makes It Possible.", "solution module title mismatch");
assert(solution.blocks.filter((block) => block.type === "card").length >= 4, "solution module must have at least 4 editable selling-point cards");
assert(solution.blocks.filter((block) => block.type === "example").length >= 3, "solution module must have editable destination examples");
assert(rendererText.includes("lg:grid-cols-[0.46fr_0.54fr]"), "solution renderer is not using the target left-copy/right-gallery layout");
assert(rendererText.includes("overflow-x-auto"), "solution renderer must include a horizontal destination image rail");

const workflow = sectionById(home, "workflow_1", "studio_steps");
for (const title of ["Upload Photos", "Choose Style", "AI Generates", "Download & Enjoy"]) {
  assert(workflow.blocks.some((block) => block.settings.title === title), `workflow missing ${title}`);
}

const destinations = sectionById(home, "destinations_1", "destination_showcase");
assert(destinations.settings.tabs === "All|Europe|Asia|Beach|Desert|City", "destination tabs mismatch");
for (const title of ["Santorini", "Marrakech", "Cappadocia", "Paris", "Bali"]) {
  assert(destinations.blocks.some((block) => block.settings.title === title), `destinations missing ${title}`);
}
for (const block of destinations.blocks) {
  assert(block.settings.tags, `destination ${block.id} missing multi-filter tags`);
  assert(block.settings.title && block.settings.description && block.settings.location && block.settings.imageUrl, `destination ${block.id} missing editable title/description/location/image`);
}

const examples = sectionById(home, "examples_1", "example_gallery");
for (const block of examples.blocks) {
  assert(block.settings.title && block.settings.description && block.settings.location && block.settings.imageUrl, `example ${block.id} missing editable title/description/location/image`);
}

const testimonials = sectionById(home, "proof_1", "testimonial_wall");
assert(testimonials.settings.title === "Loved by Couples Worldwide", "testimonial title mismatch");
assert(testimonials.settings.summaryRating === "4.9/5", "testimonial summary rating mismatch");
for (const block of testimonials.blocks.slice(0, 4)) {
  assert(block.settings.avatarUrl && block.settings.resultImageUrl && block.settings.rating && block.settings.quote, `testimonial ${block.id} missing avatar/result/rating/quote`);
}

const pricing = sectionById(home, "pricing_1", "pricing_table");
assert(pricing.settings.featuredProductId === "prod_lumen_premium", "pricing featuredProductId must bind Premium product");
assert(pricing.settings.productType === "subscription", "pricing productType must be subscription");
assert(!schemaText.includes("[\"credit_pack\", \"Credit packs\"]"), "pricing schema must not allow credit packs in the subscription plan table");
const subscriptionProducts = state.products.filter((product) => product.siteId === site.id && product.type === "subscription" && product.status === "active");
assert(subscriptionProducts.length === 3, `expected exactly 3 active subscription products, got ${subscriptionProducts.length}`);
for (const [productId, generatedPhotos, destinationCount, deliveryDays] of [
  ["prod_lumen_essential", 15, 2, 3],
  ["prod_lumen_premium", 30, 4, 2],
  ["prod_lumen_deluxe", 60, 999, 1]
]) {
  const product = subscriptionProducts.find((item) => item.id === productId);
  assert(product, `missing subscription product ${productId}`);
  const price = product.prices?.[0];
  assert(price?.amountCents && price.creditsGranted, `${productId} missing real amount/credits`);
  assert(price.metadata?.generatedPhotos === generatedPhotos, `${productId} generatedPhotos metadata mismatch`);
  assert(price.metadata?.destinationCount === destinationCount, `${productId} destinationCount metadata mismatch`);
  assert(price.metadata?.deliveryDays === deliveryDays, `${productId} deliveryDays metadata mismatch`);
}

const trust = sectionById(home, "trust_1", "trust_signal_bar");
for (const marker of ["Private & Secure", "Satisfaction Guarantee", "No Hidden Fees", "Revisions"]) {
  assert(trust.blocks.some((block) => String(block.settings.label ?? "").includes(marker)), `trust bar missing ${marker}`);
}

const faq = sectionById(home, "faq_1", "faq");
for (const question of ["Is this really AI-generated?", "How long does it take?", "Can I request styles?", "Are photos high-resolution?", "Can I print the photos?"]) {
  assert(faq.blocks.some((block) => block.settings.question === question), `FAQ missing ${question}`);
}
assert(rendererText.includes("<details className=\"group"), "FAQ renderer must use accordion/details UI");

const finalCta = sectionById(home, "final_cta_1", "final_cta");
assert(finalCta.settings.title === "Your Love Story, Anywhere.", "final CTA title mismatch");
assert(finalCta.settings.primaryCta === "Start Your Journey", "final CTA primary button mismatch");

for (const slug of requiredPages) {
  assert(site.pages.some((page) => page.slug === slug), `missing editable page ${slug}`);
}
const toolPage = site.pages.find((page) => page.slug === "/tools/image-studio");
assert(toolPage, "missing AI wedding tool page");
for (const [id, type] of [
  ["upload_1", "upload_panel"],
  ["form_1", "generation_form"],
  ["progress_1", "job_progress"],
  ["album_1", "album_gallery"]
]) {
  assert(toolPage.publishedJson.sections[id]?.type === type, `tool page missing ${type}`);
}

for (const marker of [
  'text("tags", "Filter tags"',
  '{ id: "featuredProductId", label: "Featured plan", type: "product"',
  'media("backgroundImage", "Background image")',
  'image("imageUrl", "Image URL")',
  'text("primaryCta", "Primary CTA"',
  'url("primaryHref", "Primary link"'
]) {
  assert(schemaText.includes(marker), `designer schema missing marker ${marker}`);
}
for (const marker of [
  "wedding-story-house",
  "featuredSections",
  '"upload_panel"',
  '"generation_form"',
  '"job_progress"',
  '"album_gallery"'
]) {
  assert(themeManifestText.includes(marker), `wedding theme manifest missing ${marker}`);
}
for (const marker of [
  "weddingStoryHouseTemplates",
  "globalSections",
  "productType: \"subscription\"",
  "tags: \"Asia|Beach\""
]) {
  assert(themePackageText.includes(marker), `wedding theme package missing ${marker}`);
}

const result = {
  site: site.slug,
  activeTheme: "wedding-story-house",
  pageCount: site.pages.length,
  homeSections: home.publishedJson.sectionsOrder.length,
  subscriptionProducts: subscriptionProducts.map((product) => ({
    id: product.id,
    name: product.name,
    amountCents: product.prices[0].amountCents,
    credits: product.prices[0].creditsGranted,
    generatedPhotos: product.prices[0].metadata.generatedPhotos,
    destinationCount: product.prices[0].metadata.destinationCount,
    deliveryDays: product.prices[0].metadata.deliveryDays
  })),
  toolFlow: toolPage.publishedJson.sectionsOrder.filter((id) => ["upload_1", "form_1", "progress_1", "album_1"].includes(id)),
  designerSchema: {
    destinationTags: true,
    productBinding: true,
    mediaFields: true
  }
};

console.log(JSON.stringify(result, null, 2));
