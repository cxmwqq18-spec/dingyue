#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const baseUrl = (process.env.SMOKE_BASE_URL || "http://127.0.0.1:3002").replace(/\/+$/, "");
const host = process.env.MYDREAMSHOOTS_HOST || "www.mydreamshoots.com";
const localState = JSON.parse(fs.readFileSync(new URL("../data/platform-state.json", import.meta.url), "utf8"));
const localPageCopyProfiles = JSON.parse(fs.readFileSync(new URL("../src/lib/photo-package-use-case-profiles.json", import.meta.url), "utf8")).mydreamshootsCategories ?? {};
const localSite = localState.sites?.find((site) => site.id === "site_dreamshoot");
const hasProviderBackedPrice = (localState.products ?? [])
  .filter((product) => product.siteId === localSite?.id && product.status === "active")
  .flatMap((product) => product.prices ?? [])
  .some((price) => /^price_[A-Za-z0-9]+$/.test(String(price.stripePriceId ?? "")) && Boolean(price.providerVerifiedAt));
const requestTimeoutMs = Number(process.env.MYDREAMSHOOTS_SEO_SSR_TIMEOUT_MS || 30_000);
const requestAttempts = Number(process.env.MYDREAMSHOOTS_SEO_SSR_ATTEMPTS || 3);

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchTextOnce(pathname, accept, redirectCount = 0) {
  const url = new URL(pathname, `${baseUrl}/`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`${pathname} timed out after ${requestTimeoutMs}ms`)), requestTimeoutMs);
  try {
    const response = await fetch(url, {
      headers: { accept, "x-forwarded-host": host },
      redirect: "manual",
      signal: controller.signal
    });
    const body = await response.text();
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location && redirectCount < 5) {
      const nextUrl = new URL(location, url);
      return fetchTextOnce(`${nextUrl.pathname}${nextUrl.search}`, accept, redirectCount + 1);
    }
    return {
      body,
      headers: Object.fromEntries(response.headers.entries()),
      status: response.status
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function withRetry(label, operation) {
  let lastError;
  for (let attempt = 1; attempt <= requestAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === requestAttempts) break;
      await wait(400 * attempt);
    }
  }
  throw lastError ?? new Error(`${label} failed`);
}

async function fetchText(pathname, accept) {
  return withRetry(`fetch ${pathname}`, () => fetchTextOnce(pathname, accept));
}

async function fetchStatusNoRedirectOnce(pathname, accept = "text/html") {
  const url = new URL(pathname, `${baseUrl}/`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`${pathname} timed out after ${requestTimeoutMs}ms`)), requestTimeoutMs);
  try {
    const response = await fetch(url, {
      headers: { accept, "x-forwarded-host": host },
      redirect: "manual",
      signal: controller.signal
    });
    await response.arrayBuffer();
    return {
      headers: Object.fromEntries(response.headers.entries()),
      status: response.status
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchStatusNoRedirect(pathname, accept = "text/html") {
  return withRetry(`fetch status ${pathname}`, () => fetchStatusNoRedirectOnce(pathname, accept));
}

async function fetchHtml(pathname) {
  const response = await fetchText(pathname, "text/html");
  assert.equal(response.status, 200, `${pathname} should return HTTP 200`);
  return response.body;
}

function graphNodes(html) {
  return [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .flatMap((match) => {
      try {
        const payload = JSON.parse(match[1]);
        return Array.isArray(payload?.["@graph"]) ? payload["@graph"] : [];
      } catch {
        return [];
      }
    });
}

function firstMatch(html, pattern) {
  return html.match(pattern)?.[1] ?? "";
}

function metaDescription(html) {
  return firstMatch(html, /<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
}

function canonicalHref(html) {
  return firstMatch(html, /<link\s+rel=["']canonical["']\s+href=["']([^"']*)["']/i);
}

function pageTitle(html) {
  return firstMatch(html, /<title>([\s\S]*?)<\/title>/i).replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(value) {
  return String(value ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function visibleText(html) {
  return decodeHtmlEntities(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const homepage = await fetchHtml("/");
const pricing = await fetchHtml("/pricing");
const collection = await fetchHtml("/ai-image-generation/headshot");
const sitemap = (await fetchText("/sitemap.xml", "application/xml")).body;
const focusCollectionSlugs = [
  "engagement-photo",
  "wedding-photo",
  "valentines-photo",
  "christmas-photo",
  "halloween-photo",
  "thanksgiving-photo",
  "holiday",
  "singles-awareness-day",
  "black-friday"
];
const focusCollectionPaths = focusCollectionSlugs.map((slug) => `/ai-image-generation/${slug}`);
const focusCollections = {};
for (const pathname of focusCollectionPaths) {
  focusCollections[pathname] = await fetchHtml(pathname);
}
const talkingPhotoGeneration = await fetchHtml("/ai-video-generation/talking-photo");
const storyVideoGeneration = await fetchHtml("/ai-video-generation/story-video");
const memeVideoGeneration = await fetchHtml("/ai-video-generation/meme-video");
const productVideoGeneration = await fetchHtml("/ai-video-generation/product-video");
const productAdVideoPath = "/ai-video-generation/product-ad-video";
const productAdIsPublished = sitemap.includes(`https://${host}${productAdVideoPath}`);
const productAdResponse = await fetchText(productAdVideoPath, "text/html");
assert.equal(productAdResponse.status, productAdIsPublished ? 200 : 404, `${productAdVideoPath} status must match its current published snapshot`);
const productAdVideoGeneration = productAdIsPublished ? productAdResponse.body : "";
const videoTopicGenerationByPath = {
  "/ai-video-generation/talking-photo": talkingPhotoGeneration,
  "/ai-video-generation/cinematic-video": await fetchHtml("/ai-video-generation/cinematic-video"),
  "/ai-video-generation/tiktok-video": await fetchHtml("/ai-video-generation/tiktok-video"),
  "/ai-video-generation/instagram-reels": await fetchHtml("/ai-video-generation/instagram-reels"),
  "/ai-video-generation/social-media-video": await fetchHtml("/ai-video-generation/social-media-video"),
  "/ai-video-generation/youtube-video": await fetchHtml("/ai-video-generation/youtube-video"),
  "/ai-video-generation/story-video": storyVideoGeneration,
  "/ai-video-generation/meme-video": memeVideoGeneration,
  "/ai-video-generation/product-video": productVideoGeneration,
  ...(productAdIsPublished ? { [productAdVideoPath]: productAdVideoGeneration } : {})
};
const workflow = await fetchHtml("/workflow");
const faq = await fetchHtml("/faq");
const legacyCollectionStatuses = [];
for (const pathname of [
  "/collections/wedding-portraits",
  "/collections/profile-cards",
  "/collections/headshots",
  "/collections/ai-video-add-ons",
  "/ai-photoshoot",
  "/ai-photoshoot/professional/headshot",
  "/ai-image-generation/professional",
  "/ai-image-generation/professional/headshot",
  "/tool"
]) {
  legacyCollectionStatuses.push({ pathname, ...(await fetchStatusNoRedirect(pathname)) });
}
const legacyToolRedirectStatuses = [];
for (const pathname of ["/tools"]) {
  legacyToolRedirectStatuses.push({ pathname, ...(await fetchStatusNoRedirect(pathname)) });
}
const hiddenVideoStatuses = [];
for (const pathname of ["/ai-video-generation/text-to-video", "/ai-video-generation/image-to-video", "/tools/image-to-video"]) {
  hiddenVideoStatuses.push({ pathname, ...(await fetchStatusNoRedirect(pathname)) });
}
const homepageGraph = graphNodes(homepage);
const collectionGraph = graphNodes(collection);
const talkingPhotoGenerationGraph = graphNodes(talkingPhotoGeneration);
const storyVideoGenerationGraph = graphNodes(storyVideoGeneration);
const memeVideoGenerationGraph = graphNodes(memeVideoGeneration);
const productVideoGenerationGraph = graphNodes(productVideoGeneration);
const productAdVideoGenerationGraph = graphNodes(productAdVideoGeneration);
const homepageVideos = homepageGraph.filter((node) => node?.["@type"] === "VideoObject");
const collectionProducts = collectionGraph.filter((node) => node?.["@type"] === "Product");
const talkingPhotoGenerationProducts = talkingPhotoGenerationGraph.filter((node) => node?.["@type"] === "Product" || node?.["@type"] === "Service");
const storyVideoGenerationProducts = storyVideoGenerationGraph.filter((node) => node?.["@type"] === "Product" || node?.["@type"] === "Service");
const memeVideoGenerationProducts = memeVideoGenerationGraph.filter((node) => node?.["@type"] === "Product" || node?.["@type"] === "Service");
const productVideoGenerationProducts = productVideoGenerationGraph.filter((node) => node?.["@type"] === "Product" || node?.["@type"] === "Service");
const productAdVideoGenerationProducts = productAdVideoGenerationGraph.filter((node) => node?.["@type"] === "Product" || node?.["@type"] === "Service");
const collectionProduct = collectionProducts[0];
const collectionOffer = collectionProduct?.offers;
const forbiddenLoadingCopy = [
  "Reviews and trust signals are loading now",
  "Preparing credits and plan options",
  "Preparing this section.",
  "Preparing this information.",
  "Fresh storefront content is loading now.",
  "Helpful details are being loaded for this section.",
  "Loading section"
];
const forbiddenGenericThemeCopy = [
  "turn approved uploads into a focused private photo set",
  "A private gallery of",
  "works best when the source photos are current, sharp",
  "Keep the request focused on",
  "Confirm the visible credit cost before generation starts"
];
const publicHtmlPages = {
  homepage,
  pricing,
  collection,
  ...focusCollections,
  talkingPhotoGeneration,
  storyVideoGeneration,
  memeVideoGeneration,
  productVideoGeneration,
  ...(productAdIsPublished ? { productAdVideoGeneration } : {}),
  workflow,
  faq
};

for (const [pageName, html] of Object.entries(publicHtmlPages)) {
  for (const copy of forbiddenLoadingCopy) {
    assert.equal(html.includes(copy), false, `${pageName} must not SSR loading placeholder copy: ${copy}`);
  }
}
const focusTopicNeedles = {
  "/ai-image-generation/engagement-photo": ["proposal", "announcement", "ring", "save-the-date"],
  "/ai-image-generation/wedding-photo": ["save-the-date", "ceremony", "invitation", "wedding website"],
  "/ai-image-generation/valentines-photo": ["date-night", "gifts", "self-love", "romantic"],
  "/ai-image-generation/christmas-photo": ["christmas", "greeting card", "winter", "family"],
  "/ai-image-generation/halloween-photo": ["costume", "party", "spooky", "protected character"],
  "/ai-image-generation/thanksgiving-photo": ["friendsgiving", "gratitude", "dinner", "group"],
  "/ai-image-generation/holiday": ["year-end", "seasonal", "winter", "christmas photo"],
  "/ai-image-generation/singles-awareness-day": ["self-love", "solo", "dating profile", "confidence"],
  "/ai-image-generation/black-friday": ["sale banners", "social ads", "shopping", "campaign"],
};
for (const [pathname, html] of Object.entries(focusCollections)) {
  const slug = pathname.split("/").pop();
  const pageCopy = localPageCopyProfiles[slug];
  assert.ok(pageCopy, `${pathname} must have source page copy`);
  const title = pageTitle(html);
  const description = metaDescription(html);
  const canonical = canonicalHref(html);
  const text = visibleText(html);
  const normalizedHtml = text.toLowerCase();
  assert.equal(canonical, `https://www.mydreamshoots.com${pathname}`, `${pathname} must expose the canonical AI Image Generation URL`);
  assert.equal(decodeHtmlEntities(title), pageCopy.seoTitle, `${pathname} must expose the approved page-copy SEO title`);
  assert.equal(decodeHtmlEntities(description), pageCopy.cardDescription, `${pathname} must keep the approved meta description`);
  assert.ok(text.includes(pageCopy.galleryTitle), `${pathname} must render the approved gallery H2`);
  assert.ok(text.includes(pageCopy.ctaTitle), `${pathname} must render the approved page-copy CTA title`);
  for (const copy of forbiddenGenericThemeCopy) {
    assert.equal(normalizedHtml.includes(copy.toLowerCase()), false, `${pathname} must not SSR generic theme copy: ${copy}`);
  }
  for (const needle of focusTopicNeedles[pathname]) {
    assert.ok(normalizedHtml.includes(needle), `${pathname} must contain topic-specific SEO copy: ${needle}`);
  }
  if (slug === "black-friday") {
    assert.equal(/anime avatar|avatar package/i.test(text), false, `${pathname} must not inherit Anime Avatar page copy`);
  }
  if (slug === "singles-awareness-day") {
    assert.equal(/media kits|sponsor decks/i.test(text), false, `${pathname} must not inherit generic creator portrait page copy`);
  }
  const faqSchema = graphNodes(html).find((node) => node?.["@type"] === "FAQPage");
  const schemaQuestions = Array.isArray(faqSchema?.mainEntity) ? faqSchema.mainEntity : [];
  assert.equal(schemaQuestions.length, pageCopy.faqItems.length, `${pathname} FAQPage must expose the page-copy FAQ count`);
  pageCopy.faqItems.forEach((faqItem, index) => {
    assert.ok(text.includes(faqItem.question), `${pathname} must render visible FAQ question: ${faqItem.id}`);
    assert.ok(text.includes(faqItem.answer), `${pathname} must render visible FAQ answer: ${faqItem.id}`);
    assert.equal(schemaQuestions[index]?.name, faqItem.question, `${pathname} FAQPage question order must match visible FAQ: ${faqItem.id}`);
    assert.equal(schemaQuestions[index]?.acceptedAnswer?.text, faqItem.answer, `${pathname} FAQPage answer must match visible FAQ: ${faqItem.id}`);
  });
}
assert.ok(pricing.includes("Credits") && pricing.includes("checkout") && !pricing.includes(["$", "24.50"].join("")), "pricing HTML must contain plan content without a hardcoded legacy price");
const homepageForbiddenCopy = [
  "Upload selfies and create your own AI model",
  "100% money-back guarantee",
  "instantly go viral",
  "15+ package categories",
  "photshoot",
  "Our plans starts",
  "Most Trusted Creators"
];
for (const copy of homepageForbiddenCopy) {
  assert.equal(homepage.includes(copy), false, `homepage must not contain deprecated SEO copy: ${copy}`);
}
assert.equal((homepage.match(/<h1\b/gi) ?? []).length, 1, "homepage must render exactly one H1");
assert.equal(metaDescription(homepage), "Create AI headshots, portraits, themed photo sets, editing workflows, and supported short video results from your own approved photos. Compare examples and credit costs before you generate.", "homepage meta description must match the V4 SEO copy");
assert.equal(canonicalHref(homepage), "https://www.mydreamshoots.com", "homepage canonical must point to the root URL");
assert.equal(homepage.includes('href="/pricing"'), true, "homepage header must link Pricing to /pricing");
assert.equal(homepage.includes('href="#plans"'), false, "homepage header must not link Pricing to the embedded plans anchor");
assert.ok(homepage.includes('data-dreamshoot-embedded-pricing="true"'), "homepage HTML must contain the embedded pricing section");
assert.ok(
  homepage.includes('data-dreamshoot-embedded-pricing="true"') &&
    !homepage.includes(["$", "24.50"].join("")),
  "homepage embedded pricing must render the section without a legacy hardcoded price"
);
assert.equal(homepageVideos.length, 0, "homepage SSR must not expose legacy video theme VideoObject nodes after the AI Video Generation route migration");
assert.match(talkingPhotoGeneration, /https:\/\/www\.mydreamshoots\.com\/ai-video-generation\/talking-photo/, "Talking Photo detail SSR must expose the canonical AI Video Generation URL");
assert.match(storyVideoGeneration, /https:\/\/www\.mydreamshoots\.com\/ai-video-generation\/story-video/, "Story Video detail SSR must expose the canonical AI Video Generation URL");
assert.match(memeVideoGeneration, /https:\/\/www\.mydreamshoots\.com\/ai-video-generation\/meme-video/, "Meme Video detail SSR must expose the canonical AI Video Generation URL");
assert.match(productVideoGeneration, /https:\/\/www\.mydreamshoots\.com\/ai-video-generation\/product-video/, "Product Video detail SSR must expose the canonical AI Video Generation URL");
if (productAdIsPublished) {
  assert.match(productAdVideoGeneration, /https:\/\/www\.mydreamshoots\.com\/ai-video-generation\/product-ad-video/, "Product Ad Video detail SSR must expose the canonical AI Video Generation URL");
  assert.equal(pageTitle(productAdVideoGeneration), "AI Product Ad Video Generator – Create Product Ads With Clear Proof &amp; CTA | myDreamshoots", "Product Ad Video title must match the approved SEO title");
  assert.equal(
    metaDescription(productAdVideoGeneration),
    "Create product ad videos around a specific audience, problem or desire, product promise, visual proof, offer, and call to action. Plan launch ads, problem-solution ads, benefit ads, offers, comparison ads, and retargeting reminders.",
    "Product Ad Video description must match the approved SEO description"
  );
  assert.match(
    productAdVideoGeneration,
    /<meta name="keywords" content="AI product ad video generator, product ad video maker, AI product advertising video, product video ad generator, ecommerce video ad maker, social media product ad video, product launch ad video, product marketing video generator"/,
    "Product Ad Video must expose the approved SEO keywords"
  );
  const productAdAssetPaths = [
    "ai-product-ad-video-new-product-unboxing-creative.jpg",
    "product-ad-video-new-product-launch-shoes.jpg",
    "product-ad-video-problem-solution-cleaning-scene.jpg",
    "product-ad-video-benefit-feature-headphones.jpg",
    "product-ad-video-limited-offer-shopping-response.jpg",
    "product-ad-video-comparison-shopping-decision.jpg",
    "product-ad-video-retargeting-purchase-reminder.jpg",
    "product-ad-video-skincare-customer-context.jpg"
  ];
  const renderedProductAdAssetPaths = Array.from(productAdVideoGeneration.matchAll(/\/assets\/dreamshoot\/product-ad-video\/([^"'?\\]+)/g)).map((match) => match[1]);
  assert.equal(new Set(renderedProductAdAssetPaths).size, 8, "Product Ad Video SSR must render eight unique topic assets");
  for (const assetPath of productAdAssetPaths) {
    assert.ok(renderedProductAdAssetPaths.includes(assetPath), `Product Ad Video SSR must render ${assetPath}`);
  }
  const normalizedProductAdVideoGeneration = productAdVideoGeneration
    .toLowerCase()
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
  for (const label of [
    "new product launch ad",
    "problem -> solution ad",
    "benefit / feature ad",
    "limited-time offer ad",
    "comparison / why choose it ad",
    "retargeting / reminder ad"
  ]) {
    assert.ok(normalizedProductAdVideoGeneration.includes(label), `Product Ad Video SSR must expose the scenario label ${label}`);
  }
}
for (const [pathname, html] of Object.entries(videoTopicGenerationByPath)) {
  const slug = pathname.split("/").at(-1);
  assert.equal((html.match(/data-video-topic-page=/g) ?? []).length, 1, `${pathname} must render the shared video topic page marker`);
  assert.equal((html.match(/<article[^>]+data-video-topic-use-case-card/g) ?? []).length, 6, `${pathname} must render exactly six use-case cards`);
  for (const section of ["hero", "use-cases", "foundation", "guidance", "steps", "value", "trust", "faq", "final-cta"]) {
    assert.ok(html.includes(`data-video-topic-section="${section}"`), `${pathname} must render the shared ${section} section`);
  }
  const useCaseSection = html.match(/data-video-topic-section="use-cases"[\s\S]*?data-video-topic-section="foundation"/)?.[0] ?? "";
  const imageUrls = Array.from(useCaseSection.matchAll(/<img[^>]+src=["']([^"']+)/g)).map((match) => match[1]);
  assert.equal(imageUrls.length, 6, `${pathname} use-case cards must each expose one image`);
  assert.equal(new Set(imageUrls).size, imageUrls.length, `${pathname} use-case images must be unique`);
  assert.equal(useCaseSection.includes('href="#how-it-works"'), false, `${pathname} use-case cards must not expose repeated anchor CTAs`);
  assert.ok(html.includes(`/app/create?videoMode=${slug}`), `${pathname} must expose a topic-specific workspace CTA`);
}
assert.equal(memeVideoGeneration.includes("Meme Video Examples"), false, "Meme Video must not render the duplicate gallery heading");
assert.equal(memeVideoGeneration.includes("See More Meme Examples"), false, "Meme Video must not render the duplicate gallery CTA");
const sharedSectionOrder = ["hero", "use-cases", "foundation", "guidance", "steps", "value", "trust", "faq", "final-cta"];
for (const [pathname, html] of Object.entries(videoTopicGenerationByPath)) {
  const sectionOrder = html.includes('data-video-topic-section="supporting"')
    ? ["hero", "use-cases", "foundation", "guidance", "supporting", "steps", "value", "trust", "faq", "final-cta"]
    : sharedSectionOrder;
  const indexes = sectionOrder.map((section) => html.indexOf(`data-video-topic-section="${section}"`));
  assert(indexes.every((index) => index >= 0) && indexes.every((index, position, values) => position === 0 || index > values[position - 1]), `${pathname} must keep the shared section order`);
}
if (productAdIsPublished) {
  const productAdSectionOrder = [
    "PLACEMENT ADAPTATION",
    "CHOOSE THE RIGHT VIDEO JOB",
    "FROM PRODUCT GOAL TO AD DRAFT",
    "MESSAGE TESTING WITHOUT CHANGING THE FACTS",
    "CREATE RESPONSIBLY"
  ].map((needle) => productAdVideoGeneration.indexOf(needle));
  assert(productAdSectionOrder.every((index) => index >= 0) && productAdSectionOrder.every((index, position, values) => position === 0 || index > values[position - 1]), "Product Ad Video SSR sections must follow guidance, supporting content, how it works, and responsible storytelling order");
}
assert.ok(talkingPhotoGeneration.includes("/app/create#step-video") || talkingPhotoGeneration.includes("/app/create"), "Talking Photo CTA must point into the video workspace");
assert.ok(storyVideoGeneration.includes("/app/create#step-video") || storyVideoGeneration.includes("/app/create"), "Story Video CTA must point into the video workspace");
assert.ok(memeVideoGeneration.includes("/app/create") && memeVideoGeneration.includes("videoMode=meme-video"), "Meme Video CTA must point into the video workspace with its topic mode");
assert.ok(productVideoGeneration.includes("/app/create") && productVideoGeneration.includes("videoMode=product-video"), "Product Video CTA must point into the video workspace with its topic mode");
if (productAdIsPublished) assert.ok(productAdVideoGeneration.includes("/app/create") && productAdVideoGeneration.includes("videoMode=product-ad-video"), "Product Ad Video CTA must point into the video workspace with its topic mode");
for (const [pageName, html] of Object.entries({ storyVideoGeneration, memeVideoGeneration, productVideoGeneration, ...(productAdIsPublished ? { productAdVideoGeneration } : {}) })) {
  for (const copy of ["what to prepare", "Credits held before creation", "Upload source images"]) {
    assert.equal(html.includes(copy), false, `${pageName} must not render the generic ai_tool_entry hero copy: ${copy}`);
  }
}
assert.ok(talkingPhotoGenerationProducts.length >= 1, "Talking Photo detail SSR must expose product or service JSON-LD");
assert.ok(storyVideoGenerationProducts.length >= 1, "Story Video detail SSR must expose product or service JSON-LD");
assert.ok(memeVideoGenerationProducts.length >= 1, "Meme Video detail SSR must expose product or service JSON-LD");
assert.ok(productVideoGenerationProducts.length >= 1, "Product Video detail SSR must expose product or service JSON-LD");
if (productAdIsPublished) assert.ok(productAdVideoGenerationProducts.length >= 1, "Product Ad Video detail SSR must expose product or service JSON-LD");
const productAdFaq = productAdVideoGenerationGraph.find((node) => node?.["@type"] === "FAQPage");
if (productAdIsPublished) assert.equal(productAdFaq?.mainEntity?.length, 8, "Product Ad Video JSON-LD must expose eight FAQ entries");
assert.equal(collectionProducts.length, 1, "collection SSR must contain one Product node");
assert.ok(Array.isArray(collectionProduct?.image) && collectionProduct.image.length === 8, "collection Product must contain cover plus gallery image URLs");
assert.equal(new Set(collectionProduct.image).size, collectionProduct.image.length, "collection Product image URLs must be unique");
assert.equal(collectionProduct?.mainEntityOfPage, collectionProduct?.url, "collection Product must link to its visible page");
assert.equal(collectionProduct?.subjectOf?.["@type"], "ImageObject", "collection Product must contain an ImageObject subject");
assert.equal(collectionProduct?.subjectOf?.url, collectionProduct?.subjectOf?.contentUrl, "collection ImageObject url should match contentUrl");
assert.equal(collectionProduct?.subjectOf?.thumbnailUrl, collectionProduct?.image?.[0], "collection ImageObject thumbnail should use the Product cover");
assert.match(collectionProduct?.subjectOf?.encodingFormat ?? "", /^image\//, "collection ImageObject must expose image encodingFormat");
if (!hasProviderBackedPrice) {
  assert.equal(collectionOffer, undefined, "collection Product must not expose a manual or draft price as an Offer");
} else {
  assert.equal(collectionOffer?.["@type"], "Offer", "collection Product must contain a provider-backed Offer");
  assert.equal(collectionOffer?.priceCurrency, "USD", "collection Offer must use USD");
  assert.match(collectionOffer?.price ?? "", /^\d+\.\d{2}$/, "collection Offer must contain a decimal price");
  assert.ok(["https://schema.org/InStock", "https://schema.org/OutOfStock"].includes(collectionOffer?.availability), "collection Offer availability must use a schema.org URL");
  assert.equal(collectionOffer?.itemCondition, "https://schema.org/NewCondition", "collection Offer must use the schema.org NewCondition URL");
}
assert.ok(
  (collectionProduct?.additionalProperty ?? []).some((property) => property?.name === "Credit cost"),
  "collection Product must expose credit cost"
);
assert.ok(
  (collectionProduct?.additionalProperty ?? []).some((property) => property?.name === "Output count"),
  "collection Product must expose output count"
);
assert.ok(sitemap.includes("https://www.mydreamshoots.com/pricing"), "sitemap must contain the canonical pricing URL");
assert.ok(sitemap.includes("https://www.mydreamshoots.com/ai-image-generation/headshot"), "sitemap must contain the canonical headshot collection URL");
assert.ok(sitemap.includes("https://www.mydreamshoots.com/ai-video-generation/talking-photo"), "sitemap must contain the canonical Talking Photo URL");
assert.ok(sitemap.includes("https://www.mydreamshoots.com/ai-video-generation/story-video"), "sitemap must contain the canonical Story Video URL");
assert.ok(sitemap.includes("https://www.mydreamshoots.com/ai-video-generation/meme-video"), "sitemap must contain the canonical Meme Video URL");
assert.ok(sitemap.includes("https://www.mydreamshoots.com/ai-video-generation/product-video"), "sitemap must contain the canonical Product Video URL");
assert.equal(sitemap.includes("https://www.mydreamshoots.com/ai-video-generation/product-ad-video"), productAdIsPublished, "Product Ad Video sitemap membership must match the published snapshot");
for (const forbidden of ["/collections/headshots", "/ai-photoshoot", "/tools/image-to-video", "/ai-video-generation/text-to-video", "/ai-video-generation/image-to-video"]) {
  assert.equal(sitemap.includes(`https://www.mydreamshoots.com${forbidden}`), false, `sitemap must not contain ${forbidden}`);
}
for (const legacyStatus of legacyCollectionStatuses) {
  assert.equal(legacyStatus.status, 404, `${legacyStatus.pathname} should return HTTP 404 after the collection slug migration`);
}
for (const legacyStatus of legacyToolRedirectStatuses) {
  assert.equal(legacyStatus.status, 404, `${legacyStatus.pathname} should stay retired after the AI Video Generation route migration`);
}
for (const hiddenStatus of hiddenVideoStatuses) {
  assert.equal(hiddenStatus.status, 404, `${hiddenStatus.pathname} should return HTTP 404 while hidden from public video topics`);
}

console.log(JSON.stringify({
  ok: true,
  pages: ["/", "/pricing", "/ai-image-generation/headshot", "/ai-video-generation/talking-photo", "/ai-video-generation/story-video", "/ai-video-generation/meme-video", "/ai-video-generation/product-video", ...(productAdIsPublished ? [productAdVideoPath] : []), "/workflow", "/faq"],
  legacy404s: legacyCollectionStatuses.map(({ pathname, status }) => ({ pathname, status })),
  retiredTool404s: legacyToolRedirectStatuses.map(({ pathname, status }) => ({ pathname, status })),
  hiddenVideo404s: hiddenVideoStatuses.map(({ pathname, status }) => ({ pathname, status })),
  placeholders: 0,
  homepageVideoObjects: homepageVideos.length,
  talkingPhotoGenerationSchemaObjects: talkingPhotoGenerationProducts.length,
  storyVideoGenerationSchemaObjects: storyVideoGenerationProducts.length,
  memeVideoGenerationSchemaObjects: memeVideoGenerationProducts.length,
  productVideoGenerationSchemaObjects: productVideoGenerationProducts.length,
  productAdVideoGenerationSchemaObjects: productAdVideoGenerationProducts.length,
  collectionProductObjects: collectionProducts.length,
  collectionOfferPrice: collectionOffer?.price ?? null,
  providerBackedPrice: hasProviderBackedPrice
}, null, 2));
