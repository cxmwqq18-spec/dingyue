import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const repoRoot = process.cwd();
const state = JSON.parse(fs.readFileSync(path.join(repoRoot, "data/platform-state.json"), "utf8"));
const baseUrl = process.env.STOREFRONT_BASE_URL || "http://127.0.0.1:3002";
const siteIds = ["site_dreamshoot", "site_aidreamcapes"];
const failures = [];

function siteSlug(siteId) {
  return state.sites.find((site) => site.id === siteId)?.slug;
}

function normalizeImageUrl(value) {
  if (!value) return "";
  let url;
  try {
    url = new URL(value, baseUrl);
  } catch {
    return "";
  }
  if (url.pathname === "/_next/image") {
    const source = url.searchParams.get("url");
    if (source) return normalizeImageUrl(source);
  }
  if (!url.pathname.startsWith("/assets/")) return "";
  if (!/\.(?:png|jpe?g|webp|avif|svg)$/i.test(url.pathname)) return "";
  return url.pathname;
}

function activeCollectionSlugs(siteId) {
  return [
    ...new Set(
      (state.creativePacks ?? [])
        .filter((pack) => pack.siteId === siteId && pack.status === "active")
        .map((pack) => String(pack.category ?? pack.slug ?? "").trim())
        .filter(Boolean)
    )
  ].sort();
}

function activeCreativePacksForCollectionSlug(siteId, slug) {
  const normalizedSlug = String(slug ?? "").trim();
  return (state.creativePacks ?? []).filter((pack) => {
    if (pack.siteId !== siteId || pack.status !== "active") return false;
    const tokens = [
      pack.slug,
      pack.category,
      pack.categoryRecord?.slug,
      pack.categoryRecord?.parent?.slug
    ].map((value) => String(value ?? "").trim()).filter(Boolean);
    return tokens.includes(normalizedSlug);
  });
}

function expectedDetailCoverUrl(siteId, slug) {
  const selectedPacks = activeCreativePacksForCollectionSlug(siteId, slug);
  if (selectedPacks.length === 1) {
    return normalizeImageUrl(selectedPacks[0].imageUrl ?? selectedPacks[0].coverImageUrl ?? "");
  }
  const category = (state.creativePackCategories ?? []).find(
    (item) => item.siteId === siteId && item.slug === slug && item.status !== "inactive"
  );
  return normalizeImageUrl(
    category?.imageUrl
      ?? selectedPacks[0]?.categoryRecord?.imageUrl
      ?? selectedPacks[0]?.categoryRecord?.parent?.imageUrl
      ?? ""
  );
}

async function settlePage(page) {
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.evaluate(async () => {
    const step = Math.max(320, Math.floor(window.innerHeight * 0.7));
    for (let y = 0; y <= document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 35));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
}

async function imageSnapshot(page) {
  const rawImages = await page.evaluate(() => [...document.querySelectorAll("main img")].map((image) => ({
    alt: image.alt || "",
    src: image.currentSrc || image.src || "",
    visible: image.clientWidth > 0 && image.clientHeight > 0,
    href: image.closest("a")?.getAttribute("href") || "",
    cardKey: (() => {
      const anchor = image.closest("a");
      const rect = anchor?.getBoundingClientRect();
      return anchor
        ? `${anchor.getAttribute("href") || ""}@${Math.round((rect?.left || 0) / 10) * 10},${Math.round((rect?.top || 0) / 10) * 10}`
        : "";
    })(),
    sectionId: image.closest(".xfcart-section")?.getAttribute("data-section-id") || "",
    sectionType: image.closest(".xfcart-section")?.getAttribute("data-section-type") || ""
  })));
  return rawImages
    .map((image) => ({ ...image, url: normalizeImageUrl(image.src) }))
    .filter((image) => image.visible && image.url);
}

function duplicateValues(values) {
  return values.filter((value, index) => values.indexOf(value) !== index);
}

function assertUnique(label, values) {
  const duplicates = duplicateValues(values);
  if (duplicates.length) failures.push(`${label}:${[...new Set(duplicates)].join(" | ")}`);
}

async function auditCatalogRoute(page, route) {
  const images = await imageSnapshot(page);
  const cardImages = images
    .filter((image) => /\b(?:gallery )?preview$/i.test(image.alt))
    .filter((image) => !/background layer|cover preview/i.test(image.alt));
  const cardGroups = new Map();
  for (const image of cardImages) {
    const key = `${image.sectionId || image.sectionType}:${image.cardKey || image.href}`;
    const group = cardGroups.get(key) ?? [];
    group.push(image);
    cardGroups.set(key, group);
  }
  for (const group of cardGroups.values()) {
    const urls = group.map((image) => image.url);
    const uniqueUrls = [...new Set(urls)];
    const witness = `${group[0]?.sectionId || group[0]?.sectionType}:${group[0]?.href}:${group[0]?.alt}`;
    if (uniqueUrls.length < 2) failures.push(`catalog_single_foreground_image:${route}:${witness}:${uniqueUrls.join(" | ")}`);
    assertUnique(`catalog_duplicate_card_image:${route}:${witness}`, urls);
  }
  const cardsByHref = new Map();
  for (const [cardKey, group] of cardGroups) {
    const href = group[0]?.href || "";
    if (!/\/collections\//.test(href)) continue;
    const cards = cardsByHref.get(href) ?? [];
    cards.push(cardKey);
    cardsByHref.set(href, cards);
  }
  for (const [href, cardKeys] of cardsByHref) {
    const uniqueCardKeys = [...new Set(cardKeys)];
    if (uniqueCardKeys.length > 1) failures.push(`catalog_duplicate_collection_card:${route}:${href}:${uniqueCardKeys.join(" <> ")}`);
  }
  const duplicateUrls = [...new Set(duplicateValues(cardImages.map((image) => image.url)))];
  for (const duplicateUrl of duplicateUrls) {
    const witnesses = cardImages
      .filter((image) => image.url === duplicateUrl)
      .map((image) => `${image.sectionId || image.sectionType}:${image.href}:${image.alt}`)
      .join(" <> ");
    failures.push(`catalog_duplicate_foreground_image:${route}:${duplicateUrl}:${witnesses}`);
  }
}

async function auditCollectionDetailRoute(page, siteId, route, slug) {
  const images = await imageSnapshot(page);
  const coverImages = [...new Set(
    images
      .filter((image) => /cover preview/i.test(image.alt))
      .map((image) => image.url)
  )];
  const galleryImages = [...new Set(
    images
      .filter((image) => /gallery example/i.test(image.alt))
      .map((image) => image.url)
  )];
  const detailGalleryImages = galleryImages.length >= 12
    ? galleryImages
    : [...new Set(
        images
          .filter((image) => !/cover preview|background layer|\b(?:gallery )?preview$/i.test(image.alt))
          .map((image) => image.url)
      )];

  if (coverImages.length !== 1) failures.push(`detail_cover_count:${route}:${coverImages.length}`);
  const expectedCover = expectedDetailCoverUrl(siteId, slug);
  if (expectedCover && !coverImages.includes(expectedCover)) {
    failures.push(`detail_cover_unexpected:${route}:expected=${expectedCover}:rendered=${coverImages.join(" | ")}`);
  }
  if (detailGalleryImages.length < 12) failures.push(`detail_gallery_under_12:${route}:${detailGalleryImages.length}`);
  for (const coverImage of coverImages) {
    if (detailGalleryImages.includes(coverImage)) failures.push(`detail_cover_in_gallery:${route}:${coverImage}`);
  }
  assertUnique(`detail_duplicate_gallery_image:${route}`, detailGalleryImages);

  if (siteId === "site_dreamshoot" && /thanksgiving|halloween/i.test(slug)) {
    for (const image of images) {
      if (/\/christmas-photos\//i.test(image.url)) failures.push(`detail_cross_theme_christmas_asset:${route}:${image.url}`);
    }
  }
}

async function visit(page, route) {
  let response = null;
  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(500);
    }
  }
  if (lastError) {
    failures.push(`route_navigation_error:${route}:${lastError.message}`);
    return false;
  }
  if (!response || response.status() >= 400) {
    failures.push(`route_http_error:${route}:${response?.status() ?? "no_response"}`);
    return false;
  }
  await settlePage(page);
  return true;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
const auditedRoutes = [];

for (const siteId of siteIds) {
  const slug = siteSlug(siteId);
  if (!slug) {
    failures.push(`missing_site_slug:${siteId}`);
    continue;
  }
  for (const route of [`/site/${slug}`, `/site/${slug}/collections`]) {
    auditedRoutes.push(route);
    if (await visit(page, route)) await auditCatalogRoute(page, route);
  }
  for (const collectionSlug of activeCollectionSlugs(siteId)) {
    const route = `/site/${slug}/collections/${collectionSlug}`;
    auditedRoutes.push(route);
    if (await visit(page, route)) await auditCollectionDetailRoute(page, siteId, route, collectionSlug);
  }
}

await browser.close();

if (failures.length) {
  console.error("Storefront DOM image isolation smoke failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Storefront DOM image isolation smoke passed: ${auditedRoutes.length} routes checked.`);
